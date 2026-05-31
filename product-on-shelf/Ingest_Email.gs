/**
 * Product on Shelf — Ingestion source (a): Price emails [EXT] → `Price` tab.
 *
 * Implements the "Fetch supplier prices" box in the v3 flow diagram and source (a) in
 * DB_SCHEMA.md. A time-driven trigger pulls vendor reply mails from an allowlist of
 * distributor sender domains (INGEST.DISTRIBUTOR_DOMAINS) — with the `[EXT]` subject tag kept
 * as an OR fallback — parses the inline HTML price table, normalizes each part number to a
 * `sku_key` via the `_alias` tab, and append-with-history upserts the prices into `Price`.
 * Anything it can't confidently match is logged to `_alias` for manual curation and skipped
 * (house rule: never fabricate a price). A `_sync_log` row is written and a summary is posted
 * to the Google Chat incoming webhook.
 *
 * WHY HTML table (not plaintext): real [EXT] replies render prices as an HTML <table>; the
 * Gmail plaintext flattens it to one cell per line with vendor-specific widths. The parser
 * here detects the header row by column-name keywords (Part No / Description / Qty /
 * Unit Price|Dealer|Per Item / Total), so one parser handles VST / Ingram / Allied-Telesis
 * layouts. Validated against a real VST reply (10 priced line items extracted correctly).
 *
 * SAFE BY DEFAULT: DRY_RUN = true. The first run only LOGS what it would write (check the
 * execution log / it returns a summary) — it touches no tabs and posts no Chat message.
 * Flip DRY_RUN to false once the parse looks right, then run `installEmailIngestTrigger()`.
 *
 * Reads the DB spreadsheet id from Script Properties (DB_SPREADSHEET_ID), set by setupDatabase().
 */

// ---------------------------------------------------------------------------
// Config knobs
// ---------------------------------------------------------------------------
var INGEST = {
  DRY_RUN: false,                             // true = parse + log only, write nothing
  // SOURCE ALLOWLIST: pull price mail from these distributor sender domains. This is the reliable
  // signal — the [EXT] subject tag is inconsistent sales tagging (many vendor price replies carry
  // no [EXT]), so domain is primary and [EXT] is kept as an OR fallback (USE_EXT_FALLBACK).
  // Edit freely: substring-matched against the From header, so add either a registrable domain
  // (vstecs.co.th) or a brand token (vstecs) to widen coverage. Both the Gmail search and the
  // per-message gate derive from this one list.
  DISTRIBUTOR_DOMAINS: [
    'vstecs.co.th', 'vstecs.com',           // VST ECS
    'ingrammicro.com', 'ingrammicro.co.th', // Ingram Micro
    'exclusive-networks.com',               // Exclusive Networks
    'nutanix.com',                          // Nutanix
    'lenovo.com',                           // Lenovo
    'hpe.com',                              // HPE
    'h3c.com',                              // H3C
    'sisthai.com',                          // SiS Distribution (Thailand)
    'fortinet.com'                          // Fortinet
  ],
  USE_EXT_FALLBACK: true,                     // also include subject:[EXT] mail, OR-ed with the domain allowlist
  DAILY_WINDOW: '2d',                         // daily overlap window; price_id dedupe makes it idempotent
  BACKFILL_MONTHS: 9,                         // initial one-time backfill window
  MAX_THREADS: 250,                           // cap per run (Gmail/exec-time safety; 250 sweeps ~9 mo in one shot)
  TIME_BUDGET_MS: 4.5 * 60 * 1000,            // stop before the 6-min execution limit
  CHAT_WEBHOOK_URL: '',                       // paste the Google Chat incoming webhook; '' = skip notify
  TZ: 'Asia/Bangkok'
};

// ---------------------------------------------------------------------------
// Query builder — (distributor sender domains OR [EXT] subject) AND a time window.
// One DISTRIBUTOR_DOMAINS list drives both the Gmail search and the per-message gate.
// ---------------------------------------------------------------------------

/** Gmail OR-clause matching any allowlisted distributor sender domain (''=none configured). */
function distributorFromClause_() {
  return INGEST.DISTRIBUTOR_DOMAINS.length ? 'from:(' + INGEST.DISTRIBUTOR_DOMAINS.join(' OR ') + ')' : '';
}

/** Source filter: distributor domains OR-ed with the [EXT] tag (when USE_EXT_FALLBACK). */
function sourceClause_() {
  var parts = [];
  var fc = distributorFromClause_();
  if (fc) parts.push(fc);
  if (INGEST.USE_EXT_FALLBACK) parts.push('subject:[EXT]');
  if (!parts.length) throw new Error('No ingest source configured: set DISTRIBUTOR_DOMAINS or USE_EXT_FALLBACK.');
  return parts.length > 1 ? '{' + parts.join(' ') + '}' : parts[0];   // {a b} = Gmail OR group
}

/** Compose the full Gmail search: source filter AND the given time window. */
function buildQuery_(windowClause) {
  return sourceClause_() + ' ' + windowClause;
}

/** True if the From header matches any allowlisted distributor domain (substring, case-insensitive). */
function isFromDistributor_(from) {
  var f = String(from || '').toLowerCase();
  for (var i = 0; i < INGEST.DISTRIBUTOR_DOMAINS.length; i++) {
    if (f.indexOf(INGEST.DISTRIBUTOR_DOMAINS[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Daily trigger target: ingest recent distributor / [EXT] price mails. */
function ingestEmailPrices() {
  return runIngest_(buildQuery_('newer_than:' + INGEST.DAILY_WINDOW), 'daily');
}

/**
 * One-time historical backfill (run manually). Gated by _meta.email_backfill_done so it
 * only does real work once; safe to re-run (price_id dedupe). Sets the flag when it
 * completes within the time budget.
 */
function backfillEmailPrices() {
  var ss = db_();
  if (metaGet_(ss, 'email_backfill_done') === 'TRUE') {
    Logger.log('Backfill already done — nothing to do.');
    return 'backfill already done';
  }
  var q = buildQuery_('newer_than:' + INGEST.BACKFILL_MONTHS + 'm');
  var res = runIngest_(q, 'backfill');
  if (!res.timedOut && !INGEST.DRY_RUN) metaSet_(ss, 'email_backfill_done', 'TRUE');
  return res;
}

/**
 * Clear the backfill gate so backfillEmailPrices() will run the 9-month sweep again.
 * Use before re-running the one-time initial load. Does NOT delete Price data —
 * append-with-history + price_id dedupe make re-runs safe (no duplicates).
 */
function resetBackfill() {
  var ss = db_();
  metaSet_(ss, 'email_backfill_done', 'FALSE');
  Logger.log('Backfill gate cleared — backfillEmailPrices() will sweep ' + INGEST.BACKFILL_MONTHS + ' months again.');
}

/**
 * Seed the `_alias` tab (raw part number → sku_key) so the ingestion can match. Run once from
 * the editor instead of hand-pasting. Idempotent: only adds raw_strings not already present, so
 * your manual edits/curation are never overwritten. Extend ALIAS_SEED as you catalog more SKUs.
 */
var ALIAS_SEED = [
  // [raw_string, sku_key, note]   — built from the 9-month [EXT] discovery sweep (Cisco switches, Veeam, etc.)
  // --- Cisco Catalyst switches (devices) ---
  ['C9300-24UX-E',        'switch:cisco:c9300-24ux-e',   'Catalyst 9300 24p mGig UPOE'],
  ['C9300-24T-E',         'switch:cisco:c9300-24t-e',    'Catalyst 9300 24p data, Net Essentials'],
  ['C9300-NM-8X',         'switch:cisco:c9300-nm-8x',    'Catalyst 9300 8x10GE network module'],
  ['C9200L-24T-4X-E',     'switch:cisco:c9200l-24t-4x-e','Catalyst 9200L 24p data, 4x10G'],
  ['C9200L-48T-4X-E',     'switch:cisco:c9200l-48t-4x-e','Catalyst 9200L 48p data, 4x10G'],
  ['C1300-24XTS',         'switch:cisco:c1300-24xts',    'Catalyst 1300 12p10GE + 12p SFP+'],
  ['C1300-16XTS',         'switch:cisco:c1300-16xts',    'Catalyst 1300 8p10GE + 8p SFP+'],
  ['C1300-48T-4G',        'switch:cisco:c1300-48t-4g',   'Catalyst 1300 48p GE, 4x1G SFP'],
  ['C1300-48T-4X',        'switch:cisco:c1300-48t-4x',   'Catalyst 1300 48p GE, 4x10G SFP+'],
  ['C1300-24T-4X',        'switch:cisco:c1300-24t-4x',   'Catalyst 1300 24p GE, 4x10G SFP+'],
  ['C1300-16P-4X',        'switch:cisco:c1300-16p-4x',   'Catalyst 1300 16p GE PoE, 4x10G SFP+'],
  ['C1300X-24T-4X',       'switch:cisco:c1300x-24t-4x',  'Catalyst 1300X 24p GE, 4x10G SFP+'],
  // --- Cisco support contracts (CON-*) -> support_yr, mapped to their parent device ---
  ['CON-SNTP-C930024U',   'switch:cisco:c9300-24ux-e',   'SNTC-24x7x4 support -> support_yr'],
  ['CON-SNTP-C93002TE',   'switch:cisco:c9300-24t-e',    'SNTC-24x7x4 support -> support_yr'],
  ['CON-SNT-C920L24X',    'switch:cisco:c9200l-24t-4x-e','SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C920L4XE',    'switch:cisco:c9200l-48t-4x-e','SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C1324XTS',    'switch:cisco:c1300-24xts',    'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C1300XTS',    'switch:cisco:c1300-16xts',    'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C130048T',    'switch:cisco:c1300-48t-4g',   'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C130048X',    'switch:cisco:c1300-48t-4x',   'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C1300T24',    'switch:cisco:c1300-24t-4x',   'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C13001XP',    'switch:cisco:c1300-16p-4x',   'SNTC-8x5xNBD support -> support_yr'],
  ['CON-SNT-C13XNU8X',    'switch:cisco:c1300x-24t-4x',  'STD 8x5xNBD support -> support_yr'],
  // --- Cisco DNA term licenses -> lic_yr (3-year term totals) ---
  ['C9300-DNA-E-24-3Y',   'switch:cisco:c9300-dna-e-24', 'DNA Essentials 24p, 3yr term'],
  ['C9200L-DNA-E-24-3Y',  'switch:cisco:c9200l-dna-e-24','DNA Essentials 24p, 3yr term'],
  ['C9200L-DNA-E-48-3Y',  'switch:cisco:c9200l-dna-e-48','DNA Essentials 48p, 3yr term'],
  // --- Cisco power supplies / transceivers / accessories (hw) ---
  ['PWR-C1-1100WAC-P/2',  'switch:cisco:pwr-c1-1100wac', '1100W AC PSU (secondary)'],
  ['PWR-C1-350WAC-P/2',   'switch:cisco:pwr-c1-350wac',  '350W AC PSU (secondary)'],
  ['C9K-ACC-RBFT',        'switch:cisco:acc-rbft',       'rubber feet (accessory)'],
  ['GLC-TE',              'switch:cisco:glc-te',         '1000BASE-T SFP'],
  ['SFP-10G-LR',          'switch:cisco:sfp-10g-lr',     '10GBASE-LR SFP'],
  ['SFP-10G-SR',          'switch:cisco:sfp-10g-sr',     '10GBASE-SR SFP'],
  ['SFP-H10GB-CU1M',      'switch:cisco:sfp-h10gb-cu1m', '10G CU DAC 1m'],
  ['SFP-H10GB-CU3M',      'switch:cisco:sfp-h10gb-cu3m', '10G CU DAC 3m'],
  ['SFP-H10GB-CU5M',      'switch:cisco:sfp-h10gb-cu5m', '10G CU DAC 5m'],
  ['SFP-H25G-CU1M',       'switch:cisco:sfp-h25g-cu1m',  '25G CU DAC 1m'],
  ['SFP-H25G-CU3M',       'switch:cisco:sfp-h25g-cu3m',  '25G CU DAC 3m'],
  ['STACK-T1-50CM',       'switch:cisco:stack-t1-50cm',  'stacking cable 50cm'],
  ['CAB-SPWR-30CM',       'switch:cisco:cab-spwr-30cm',  'stack power cable 30cm'],
  ['RCKMNT-CMPCT-1K',     'switch:cisco:rckmnt-cmpct-1k','19in compact rack mount'],
  // --- Allied-Telesis switches (from earlier sample) ---
  ['AT-x950-28XTQm-E01',  'switch:alliedtelesis:at-x950-28xtqm','x950 24p mGig stackable'],
  ['AT-x950-28XTQm-NCA1', 'switch:alliedtelesis:at-x950-28xtqm','Net.Cover Advanced 1yr -> support_yr'],
  ['AT-XEM2-12XS v2-E01', 'switch:alliedtelesis:at-xem2-12xs',  '12x10G SFP+ line card'],
  ['AT-PWR600-E11',       'switch:alliedtelesis:at-pwr600',     '600W PSU for x950'],
  // --- Veeam backup (subscription licenses) -> backup product ---
  ['V-DPPVUL-0I-SU2YP-00','backup:veeam:dpp-premium',    'Veeam Data Platform Premium, 10-instance, 2yr'],
  ['V-FDNVUL-0I-SU1YP-00','backup:veeam:fdn-universal',  'Veeam Data Platform Foundation Universal, 1yr'],
  ['V-FDN000-1S-SU1YP-00','backup:veeam:fdn-socket',     'Veeam Data Platform Foundation Socket, 1yr'],
  // --- Other security / OS licenses ---
  ['EPESCECE-AA-EA',      'endpoint:cisco:secure-endpoint-essentials', 'Endpoint Essentials Cloud (vendor 🟡 confirm)'],
  ['RH00004',             'server:redhat:rhel-server-std','Red Hat Enterprise Linux Server, Standard']
];
/**
 * Upsert the alias mappings: FILL the sku_key of existing blank rows (the discovery sweep
 * leaves unmatched parts blank), APPEND any seed parts not yet in the tab, and LEAVE rows
 * you've already curated untouched. Run after a discovery backfill, then re-run backfill.
 */
function seedAliases() {
  var ss = db_();
  var d = sheetData_(ss, '_alias');
  var rowByRaw = {};
  d.rows.forEach(function (r, i) {
    rowByRaw[normPart_(String(r[d.col.raw_string] || ''))] = { idx: i + 2, sku: String(r[d.col.sku_key] || '').trim() };
  });
  var filled = 0, toAppend = [];
  ALIAS_SEED.forEach(function (s) {
    var ex = rowByRaw[normPart_(s[0])];
    if (!ex) { toAppend.push(s); return; }              // not in tab yet -> append
    if (ex.sku) return;                                  // already curated -> leave
    d.sh.getRange(ex.idx, d.col.sku_key + 1).setValue(s[1]);   // blank -> fill
    d.sh.getRange(ex.idx, d.col.note + 1).setValue(s[2]);
    filled++;
  });
  if (toAppend.length) appendRows_(ss, '_alias', toAppend);
  Logger.log('seedAliases: filled ' + filled + ' blank rows, appended ' + toAppend.length + ' new.');
  return filled + toAppend.length;
}

/** Install the daily time-driven trigger (run once, after a clean DRY_RUN). */
function installEmailIngestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ingestEmailPrices') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ingestEmailPrices').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Daily trigger installed (≈02:00 ' + INGEST.TZ + ').');
}

// ---------------------------------------------------------------------------
// Core run
// ---------------------------------------------------------------------------

function runIngest_(query, mode) {
  var t0 = Date.now();
  var ss = db_();
  var run = { run_id: 'em-' + nowIso_(), started_at: nowIso_(), src_system: 'email', mode: mode,
              scanned: 0, upserted: 0, superseded: 0, skipped: 0, status: 'ok', error: '', timedOut: false };

  try {
    var aliasMap = readAlias_(ss);                 // raw part_no -> sku_key (curated)
    var priceState = readPriceState_(ss);          // existing rows for dedupe + supersede
    var newAliases = {};                           // unmatched part numbers to log once
    var toAppend = [];                             // new Price rows
    var supersedeRowIdx = {};                       // 1-based sheet row -> set superseded TRUE

    var threads = GmailApp.search(query, 0, INGEST.MAX_THREADS);
    for (var ti = 0; ti < threads.length; ti++) {
      if (Date.now() - t0 > INGEST.TIME_BUDGET_MS) { run.timedOut = true; break; }
      var msgs = threads[ti].getMessages();
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        if (isFromUs_(m.getFrom())) continue;                  // skip our own outbound RFQs
        // Accept a distributor sender OR an [EXT]-tagged subject (mirrors the search query); a
        // thread can mix in unrelated replies, so re-check at the message level.
        if (!isFromDistributor_(m.getFrom()) && !/\[EXT\]/i.test(m.getSubject())) continue;
        run.scanned++;
        var effDate = ymd_(m.getDate());
        var items = parsePriceTable_(m.getBody());             // inline HTML tables → [{part, desc, qty, unit_thb}]
        var attItems = parseAttachmentTables_(m);              // xlsx attachments (dormant until Drive enabled)
        for (var ai = 0; ai < attItems.length; ai++) items.push(attItems[ai]);
        var ctx = { msgId: m.getId(), subject: m.getSubject(), effDate: effDate };

        for (var k = 0; k < items.length; k++) {
          var it = items[k];
          var sku = aliasMap[normPart_(it.part)];
          if (!sku) { newAliases[normPart_(it.part)] = it.desc; run.skipped++; continue; }
          var ptype = classifyPriceType_(it.part, it.desc);
          reconcile_(sku, ptype, it, ctx, priceState, toAppend, supersedeRowIdx, run);
        }
      }
    }

    if (INGEST.DRY_RUN) {
      run.status = 'dry_run';
      Logger.log('[DRY_RUN] would upsert ' + toAppend.length + ', supersede ' +
        Object.keys(supersedeRowIdx).length + ', new aliases ' + Object.keys(newAliases).length +
        ', skipped ' + run.skipped);
      toAppend.slice(0, 20).forEach(function (r) { Logger.log('  + ' + r[0] + '  ' + r[6] + ' THB'); });
      Object.keys(newAliases).forEach(function (p) { Logger.log('  ? unmatched part: ' + p + ' — ' + newAliases[p]); });
    } else {
      applySupersede_(ss, supersedeRowIdx);
      if (toAppend.length) appendRows_(ss, 'Price', toAppend);
      appendNewAliases_(ss, newAliases);
      run.superseded = Object.keys(supersedeRowIdx).length;
      run.upserted = toAppend.length;
      metaSet_(ss, 'email_last_cursor', ymd_(new Date()));
      metaSet_(ss, 'last_full_sync', nowIso_());
    }
  } catch (e) {
    run.status = 'error'; run.error = String(e && e.stack || e);
    Logger.log('INGEST ERROR: ' + run.error);
  }

  run.finished_at = nowIso_();
  if (!INGEST.DRY_RUN) writeSyncLog_(ss, run);
  notifyChat_(run);
  return run;
}

/**
 * Append-with-history reconciliation for one (sku_key, price_type). Newest effective_date in
 * the group is the active row (superseded=FALSE); all older rows get superseded=TRUE. Exact
 * price_id already present → skip (idempotent).
 */
function reconcile_(sku, ptype, it, ctx, state, toAppend, supersedeRowIdx, run) {
  var priceId = sku + '#' + ptype + '#' + ctx.effDate;
  var group = state.byKey[sku + '|' + ptype] || (state.byKey[sku + '|' + ptype] = []);
  if (state.byId[priceId] || pendingHas_(toAppend, priceId)) return;   // already have this exact row

  // Determine the newest effective date across existing + this new row.
  var newest = ctx.effDate;
  group.forEach(function (g) { if (g.eff > newest) newest = g.eff; });

  // Supersede any existing active row older than the newest.
  group.forEach(function (g) { if (g.eff < newest && !g.superseded) supersedeRowIdx[g.rowIndex] = true; });

  var isActive = (ctx.effDate >= newest);          // new row active only if it's the newest
  var parts = sku.split(':');
  toAppend.push([
    priceId, sku, parts[0] || '', parts[1] || '', parts.slice(2).join(':') || '',
    ptype, it.unit_thb, 'THB', 'per_unit', ctx.effDate, isActive ? 'FALSE' : 'TRUE',
    'email', 'gmail:' + ctx.msgId, '🟢', '[EXT email ' + ctx.effDate + ']', ctx.subject, nowIso_()
  ]);
  group.push({ rowIndex: -1, eff: ctx.effDate, superseded: !isActive });
  run.upserted; // counted at write time
}

// ---------------------------------------------------------------------------
// Parser (ported verbatim from the Node prototype; validated on a real VST [EXT] reply)
// ---------------------------------------------------------------------------

var INGEST_COL = {
  part:  /part\s*(no|number)|p\s*\/?\s*n\b/i,
  desc:  /description|product/i,
  qty:   /^\s*qty|quantity/i,
  unit:  /unit\s*price|dealer|per\s*item/i,
  total: /^\s*total|total\s*price/i
};

/**
 * Parse an HTML email body's price table(s) → [{part, desc, qty, unit_thb}] (priced rows only).
 * Iterates EACH <table> separately and only reads rows under a header that has a price column —
 * a mail can hold several tables (e.g. a priced quote + a BOM quantity table), and reading across
 * them would mis-map a qty column as a price (seen in a real Allied-Telesis reply).
 */
function parsePriceTable_(html) {
  var out = [], tables = htmlTables_(html);
  for (var t = 0; t < tables.length; t++) {
    var items = extractPricedRows_(htmlTableRows_(tables[t]));
    for (var j = 0; j < items.length; j++) out.push(items[j]);
  }
  return out;
}

/**
 * From a 2D array of cells (one "table": HTML table rows OR a converted xlsx sheet's getValues()),
 * pull the priced line items under the first header row that has a price column. Shared by the HTML
 * body parser and the xlsx-attachment parser so both layouts go through identical column detection.
 * Cells may be strings (HTML) or numbers/dates (xlsx) — everything is String()-coerced defensively.
 */
function extractPricedRows_(rows) {
  var out = [], h = findHeaderRow_(rows);
  if (!h) return out;                                                         // not a price table
  var idx = h.idx;
  for (var i = h.row + 1; i < rows.length; i++) {
    var r = rows[i];
    if (/grand\s*total|vat|valid|^\s*total\b/i.test(String(r[0] || ''))) continue;  // footer
    var part = String(r[idx.part] || '').trim();
    if (!part) continue;
    var unit = toNum_(idx.unit != null ? r[idx.unit] : r[idx.total]);
    if (unit == null || unit < 100) continue;                               // bundled '-' lines / stray qty values
    out.push({ part: part, desc: String(r[idx.desc] || '').slice(0, 120), qty: toNum_(r[idx.qty]), unit_thb: unit });
  }
  return out;
}

function htmlTables_(html) {
  var tables = [], re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi, m;
  while ((m = re.exec(html))) tables.push(m[1]);
  return tables.length ? tables : [html];   // fall back to whole body if no <table> wrapper
}

// ---------------------------------------------------------------------------
// xlsx attachment parser — firewall / HCI-Nutanix / server-HW quotes arrive as .xlsx
// attachments (not inline tables). GAS can't read xlsx binary, so each is converted to a
// temp Google Sheet via the advanced Drive service, read with SpreadsheetApp through the
// SAME extractPricedRows_ column detection, then trashed.
//
// DORMANT UNTIL the Drive advanced service is enabled (typeof Drive guard): no scope change
// is pushed, so the live daily trigger keeps running on its existing Gmail/Sheets auth. Enable
// "Drive API" under Services in the editor (adds the Drive scope) + reauthorize to activate.
// ---------------------------------------------------------------------------

/** Priced rows from every spreadsheet attachment on a message. */
function parseAttachmentTables_(msg) {
  var out = [];
  if (typeof Drive === 'undefined') return out;          // advanced Drive service not enabled — skip silently
  var atts = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
  for (var a = 0; a < atts.length; a++) {
    if (!isSpreadsheetAttachment_(atts[a])) continue;
    var items = readXlsxBlob_(atts[a]);
    for (var j = 0; j < items.length; j++) out.push(items[j]);
  }
  return out;
}

/** True for .xls/.xlsx attachments (by filename or content-type). */
function isSpreadsheetAttachment_(att) {
  var name = String(att.getName() || '').toLowerCase();
  var ct = String(att.getContentType() || '').toLowerCase();
  return /\.xlsx?$/.test(name) || ct.indexOf('spreadsheetml') !== -1 || ct.indexOf('ms-excel') !== -1;
}

/** Convert an xlsx blob → temp Google Sheet (Drive v2 advanced service), read every sheet, trash it. */
function readXlsxBlob_(att) {
  var out = [], fileId = null, name = (att.getName && att.getName()) || '?';
  try {
    var file = Drive.Files.insert(
      { title: '_pos_ingest_tmp_' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS },
      att.copyBlob().setContentType(MimeType.MICROSOFT_EXCEL),
      { convert: true });
    fileId = file.id;
    var sheets = SpreadsheetApp.openById(fileId).getSheets();
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getLastRow() < 2) continue;          // empty/header-only tab
      var items = extractPricedRows_(sheets[s].getDataRange().getValues());
      for (var j = 0; j < items.length; j++) out.push(items[j]);
    }
  } catch (e) {
    Logger.log('xlsx parse failed for attachment "' + name + '": ' + (e && e.message || e));
  } finally {
    if (fileId) { try { Drive.Files.remove(fileId); } catch (e2) {} }   // always clean up the temp file
  }
  return out;
}

function htmlTableRows_(html) {
  var rows = [], trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, tr;
  while ((tr = trRe.exec(html))) {
    var cells = [], tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi, td;
    while ((td = tdRe.exec(tr[1]))) cells.push(stripTags_(td[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function findHeaderRow_(rows) {
  for (var i = 0; i < rows.length; i++) {
    var idx = {}, r = rows[i];
    for (var c = 0; c < r.length; c++) {
      for (var k in INGEST_COL) { if (idx[k] == null && INGEST_COL[k].test(r[c])) idx[k] = c; }
    }
    if (idx.part != null && idx.desc != null && (idx.unit != null || idx.total != null)) return { row: i, idx: idx };
  }
  return null;
}

function stripTags_(s) {
  return String(s).replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim();
}
function toNum_(s) { var n = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; }

/** Classify a line into a Price.price_type from part-number / description hints. */
function classifyPriceType_(part, desc) {
  var s = (part + ' ' + desc).toLowerCase();
  if (/\bcon-|sntc|\bsnt\b|\bma\b|support|maintenance|service/.test(s)) return 'support_yr';
  if (/lic|licen|subscription|term|dna|-3y|-1y|-5y/.test(s)) return 'lic_yr';
  return 'hw';
}

// ---------------------------------------------------------------------------
// Sheet helpers (read-by-column-name; same contract as Setup.gs)
// ---------------------------------------------------------------------------

function db_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID');
  if (!id) throw new Error('DB_SPREADSHEET_ID not set — run setupDatabase() first.');
  return SpreadsheetApp.openById(id);
}
function sheetData_(ss, name) {
  var sh = ss.getSheetByName(name);
  var values = sh.getDataRange().getValues();
  var headers = values.shift() || [];
  var col = {}; headers.forEach(function (h, i) { col[h] = i; });
  return { sh: sh, headers: headers, col: col, rows: values };
}

function readAlias_(ss) {
  var d = sheetData_(ss, '_alias'), map = {};
  d.rows.forEach(function (r) {
    var raw = String(r[d.col.raw_string] || '').trim(), sku = String(r[d.col.sku_key] || '').trim();
    if (raw && sku) map[normPart_(raw)] = sku;
  });
  return map;
}

/** Existing Price rows indexed for dedupe (by price_id) and supersede (by sku|type group). */
function readPriceState_(ss) {
  var d = sheetData_(ss, 'Price'), byId = {}, byKey = {};
  d.rows.forEach(function (r, i) {
    var id = r[d.col.price_id], sku = r[d.col.sku_key], type = r[d.col.price_type];
    if (id) byId[id] = true;
    var key = sku + '|' + type;
    (byKey[key] || (byKey[key] = [])).push({
      rowIndex: i + 2,                                       // 1-based incl. header
      eff: String(r[d.col.effective_date] || ''),
      superseded: String(r[d.col.superseded]).toUpperCase() === 'TRUE'
    });
  });
  return { byId: byId, byKey: byKey, supersededCol: d.col.superseded + 1 };
}

function applySupersede_(ss, supersedeRowIdx) {
  var idxs = Object.keys(supersedeRowIdx); if (!idxs.length) return;
  var d = sheetData_(ss, 'Price'), c = d.col.superseded + 1;
  idxs.forEach(function (rowIdx) { d.sh.getRange(parseInt(rowIdx, 10), c).setValue('TRUE'); });
}

function appendRows_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function appendNewAliases_(ss, newAliases) {
  var keys = Object.keys(newAliases); if (!keys.length) return;
  var existing = readAliasRaw_(ss);
  var rows = [];
  keys.forEach(function (p) { if (!existing[p]) rows.push([p, '', 'unmatched ' + ymd_(new Date()) + ' — ' + newAliases[p]]); });
  if (rows.length) appendRows_(ss, '_alias', rows);
}
function readAliasRaw_(ss) {
  var d = sheetData_(ss, '_alias'), set = {};
  d.rows.forEach(function (r) { set[normPart_(String(r[d.col.raw_string] || ''))] = true; });
  return set;
}

function writeSyncLog_(ss, run) {
  appendRows_(ss, '_sync_log', [[
    run.run_id, run.started_at, run.finished_at, run.src_system, run.mode,
    run.scanned, run.upserted, run.superseded, run.skipped,
    run.status, run.error, INGEST.CHAT_WEBHOOK_URL ? 'TRUE' : 'FALSE'
  ]]);
}

// ---------------------------------------------------------------------------
// _meta + misc helpers
// ---------------------------------------------------------------------------

function metaGet_(ss, key) {
  var d = sheetData_(ss, '_meta');
  for (var i = 0; i < d.rows.length; i++) if (d.rows[i][d.col.key] === key) return String(d.rows[i][d.col.value]);
  return null;
}
function metaSet_(ss, key, value) {
  var d = sheetData_(ss, '_meta');
  for (var i = 0; i < d.rows.length; i++) {
    if (d.rows[i][d.col.key] === key) { d.sh.getRange(i + 2, d.col.value + 1).setValue(value); return; }
  }
  d.sh.getRange(d.sh.getLastRow() + 1, 1, 1, 2).setValues([[key, value]]);
}

function notifyChat_(run) {
  if (!INGEST.CHAT_WEBHOOK_URL) return;
  var icon = run.status === 'error' ? '🔴' : (run.status === 'dry_run' ? '🧪' : '✅');
  var text = '[Database GG-Sheet] email ' + run.mode + ' sync ' + icon + '\n' +
    'Scanned ' + run.scanned + ' price mails → upserted ' + run.upserted +
    ', superseded ' + run.superseded + ', skipped ' + run.skipped +
    (run.skipped ? ' (unmatched → check _alias)' : '') +
    (run.status === 'error' ? '\nERROR: ' + run.error : '');
  try {
    UrlFetchApp.fetch(INGEST.CHAT_WEBHOOK_URL, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ text: text }), muteHttpExceptions: true
    });
  } catch (e) { Logger.log('Chat notify failed: ' + e); }
}

function pendingHas_(toAppend, priceId) {
  for (var i = 0; i < toAppend.length; i++) if (toAppend[i][0] === priceId) return true;
  return false;
}
function normPart_(s) { return String(s).toUpperCase().replace(/\s+/g, '').replace(/=+$/, ''); }
function isFromUs_(from) { return /scmtechnologies\.co\.th/i.test(from || ''); }
function ymd_(date) { return Utilities.formatDate(date, INGEST.TZ, 'yyyy-MM-dd'); }
function nowIso_() { return Utilities.formatDate(new Date(), INGEST.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
