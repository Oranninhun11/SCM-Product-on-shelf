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
  // One-time comprehensive discovery (discoverAllPriceMail): ALSO match price-intent subjects (TH+EN)
  // so vendor quotes that carry neither an allowlisted domain nor [EXT] are still found, and parse ANY
  // inbound sender. Broad by design — safe because the _alias gate keeps Price clean (unmapped parts
  // just queue blank for curation). Editable knob; add/remove terms to widen or tighten the net.
  PRICE_SUBJECT_TERMS: [
    'ขอราคา', 'เสนอราคา', 'ใบเสนอราคา', 'ราคา',           // TH: request price / offer price / quotation / price
    'quotation', 'quote', 'pricelist', 'price', 'pricing',  // EN
    'RFQ', 'request price'                                   // EN intent
  ],
  // WIDEST net: when true, discoverAllPriceMail() drops the source filter entirely and reads EVERY mail
  // in the window (whole inbox), not just domains/[EXT]/price-subjects. The _alias gate still keeps Price
  // clean — non-price mail simply yields no priced rows. Slower + floods _alias with parts to curate, but
  // misses nothing. Set false to fall back to the price-intent net (domains OR [EXT] OR PRICE_SUBJECT_TERMS).
  DISCOVER_SCAN_ALL: false,                   // false = price-intent net (domains/[EXT]/price-subjects) — far fewer
                                              // Gmail reads than whole-inbox; avoids the daily "premium gmail" quota.
  DAILY_WINDOW: '2d',                         // daily overlap window; price_id dedupe makes it idempotent
  DISCOVER_MONTHS: 12,                        // discoverAllPriceMail() comprehensive sweep window
  MAX_THREADS: 250,                           // cap per run for daily/backfill (Gmail/exec-time safety)
  ATTACH_MONTHS: 12,                          // fetchAttachmentQuotes() window — distributor xlsx quotes (firewall/HCI/server)
  ATTACH_THREADS: 150,                        // cap per attachment sweep — small targeted set, converges in one run
  DISCOVER_THREADS: 400,                      // cap per discovery run (≤500 Gmail max; cursor walks older across runs)
  DISCOVER_RESUME_AFTER_MS: 60 * 1000,        // gap between auto-resume discovery batches (startDiscovery)
  DISCOVER_MAX_TICKS: 20,                      // hard ceiling on auto-resume reschedules per startDiscovery() — quota safety belt
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

/** Gmail OR-clause matching price-intent subjects (TH+EN); '' if none configured. Discovery only. */
function priceSubjectClause_() {
  var terms = (INGEST.PRICE_SUBJECT_TERMS || []).filter(String);
  if (!terms.length) return '';
  var quoted = terms.map(function (t) { return /\s/.test(t) ? '"' + t + '"' : t; });   // phrase-quote multi-word
  return 'subject:(' + quoted.join(' OR ') + ')';
}

/**
 * Source filter: distributor domains OR the [EXT] tag (when USE_EXT_FALLBACK), and — in `broad`
 * (discovery) mode only — OR price-intent subjects too. One OR group across every configured signal.
 */
function sourceClause_(broad) {
  var parts = [];
  var fc = distributorFromClause_();
  if (fc) parts.push(fc);
  if (INGEST.USE_EXT_FALLBACK) parts.push('subject:[EXT]');
  if (broad) { var ps = priceSubjectClause_(); if (ps) parts.push(ps); }
  if (!parts.length) throw new Error('No ingest source configured: set DISTRIBUTOR_DOMAINS or USE_EXT_FALLBACK.');
  return parts.length > 1 ? '{' + parts.join(' ') + '}' : parts[0];   // {a b} = Gmail OR group
}

/** Compose the full Gmail search: source filter AND the given time window. (broad widens the source.) */
function buildQuery_(windowClause, broad) {
  return sourceClause_(broad) + ' ' + windowClause;
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
 * ONE-TIME COMPREHENSIVE FETCH — sweep every price-related mail (not just the narrow daily net).
 * Uses the BROAD query (distributor domains OR [EXT] OR price-intent subjects, TH+EN) and a BROAD
 * per-message gate (parses any inbound non-SCM message in a matched thread). Safe to cast wide: the
 * _alias gate keeps Price clean — every part it can't map just queues blank in _alias for curation.
 *
 * RESUMABLE: grabs the newest DISCOVER_THREADS per run and walks older via an `email_discover_before`
 * date cursor. Re-run until the log says "Discovery COMPLETE" (each re-run is dedupe-safe). Gated by
 * email_discover_done so it won't re-sweep once finished — call resetDiscover() to run it again.
 *
 * Typical first-time flow:
 *   1) seedAliases()                 — map the brands we've already seeded
 *   2) discoverAllPriceMail()        — repeat until "COMPLETE"; fills Price for mapped parts,
 *                                      dumps all other discovered part numbers into _alias (blank)
 *   3) curate _alias / extend ALIAS_SEED → seedAliases() → discoverAllPriceMail() again to price them
 */
function discoverAllPriceMail() {
  var ss = db_();
  if (metaGet_(ss, 'email_discover_done') === 'TRUE') {
    Logger.log('Discovery already complete — run resetDiscover() to sweep again.');
    return 'discover already done';
  }
  var win = 'newer_than:' + INGEST.DISCOVER_MONTHS + 'm';
  var cursor = metaGet_(ss, 'email_discover_before');          // 'yyyy/MM/dd' boundary set by a prior partial run
  if (cursor) win += ' before:' + cursor;

  // SCAN_ALL drops the source filter — sweep the whole inbox in the window. Otherwise use the price-intent
  // net (domains OR [EXT] OR price subjects). Either way the broad message gate parses every inbound mail.
  var query = INGEST.DISCOVER_SCAN_ALL ? win : buildQuery_(win, true);
  var cap = INGEST.DISCOVER_THREADS;
  var res = runIngest_(query, 'discover', { broadGate: true, cap: cap });

  // On error, write nothing and DON'T advance the cursor — the same batch must retry, not be skipped.
  if (res.status === 'error') {
    Logger.log('Discovery ERROR — cursor left unchanged so the same batch retries on re-run.\n' + res.error);
    return res;
  }

  // More history remains if the page filled to the cap or we ran out of time. Advance the cursor to
  // (oldest fetched day + 1) so the next run re-includes that boundary day (dedupe-safe) and continues
  // older. Otherwise the window is exhausted → mark done. Never advance/finish during a DRY_RUN.
  var more = res.timedOut || res.threadsFetched >= cap;
  if (more) {
    // Advance the resume boundary to (oldest fetched day + 1). If that equals the cursor we STARTED
    // this run with, the batch could not get past a single boundary day within one execution budget —
    // i.e. NO forward progress. Re-running would just re-read the same slice and burn Gmail read quota,
    // so flag res.progressed=false and leave the cursor put; the chain (_discoverTick_) stops on this.
    var newCursor = res.oldestYmd ? ymdPlusDays_(res.oldestYmd, 1).replace(/-/g, '/') : '';
    res.progressed = !!newCursor && newCursor !== cursor;
    if (!INGEST.DRY_RUN && res.progressed) metaSet_(ss, 'email_discover_before', newCursor);
    Logger.log('Discovery PARTIAL (' + res.threadsFetched + ' threads, scanned ' + res.scanned + ')' +
      (res.progressed
        ? ' — advanced to before:' + newCursor + '; re-run to continue older.'
        : ' — NO PROGRESS (boundary day ' + (cursor || 'newest') + ' exceeds one run budget). ' +
          'Cursor unchanged; raise TIME_BUDGET_MS or narrow the net, then re-run.'));
  } else if (!INGEST.DRY_RUN) {
    metaSet_(ss, 'email_discover_done', 'TRUE');
    metaSet_(ss, 'email_discover_before', '');
    res.progressed = true;
    Logger.log('Discovery COMPLETE — swept ' + INGEST.DISCOVER_MONTHS + ' months of price mail.');
  }
  return res;
}

/** Clear the discovery gate + cursor so discoverAllPriceMail() sweeps from the newest again. */
function resetDiscover() {
  var ss = db_();
  metaSet_(ss, 'email_discover_done', 'FALSE');
  metaSet_(ss, 'email_discover_before', '');
  metaSet_(ss, 'email_discover_ticks', '0');
  Logger.log('Discovery gate cleared — discoverAllPriceMail() will sweep from the newest again.');
}

/**
 * Run discovery to completion without manual re-runs. discoverAllPriceMail() fetches at most
 * DISCOVER_THREADS (400) threads per run and reports PARTIAL while older history remains; this
 * runs one batch now, then chains the next on a self-deleting time trigger DISCOVER_RESUME_AFTER_MS
 * later, until the sweep is COMPLETE. Call once from the editor. Use stopDiscovery() to cancel.
 */
function startDiscovery() {
  deleteDiscoverTriggers_();          // start clean — no leftover chain from a previous run
  metaSet_(db_(), 'email_discover_ticks', '0');   // fresh auto-resume budget (DISCOVER_MAX_TICKS)
  _discoverTick_();                   // first batch now; reschedules itself if more remains
}

/** Trigger handler: run one discovery batch, then reschedule unless done / errored / dry-run /
 *  no-progress / tick-cap. The last two are quota safety belts — a batch that can't clear a boundary
 *  day (res.progressed === false) or a chain that has ticked DISCOVER_MAX_TICKS times STOPS instead of
 *  re-reading the same mail until the daily Gmail quota is exhausted. Re-run startDiscovery() to resume. */
function _discoverTick_() {
  deleteDiscoverTriggers_();          // at most one pending tick — delete before (re)scheduling
  var ss = db_();
  var ticks = (parseInt(metaGet_(ss, 'email_discover_ticks'), 10) || 0) + 1;
  metaSet_(ss, 'email_discover_ticks', String(ticks));

  var res = discoverAllPriceMail();
  if (metaGet_(ss, 'email_discover_done') === 'TRUE') {
    Logger.log('Auto-resume: discovery COMPLETE — chain stopped.');
    return;
  }
  if (res && res.status === 'error') {
    Logger.log('Auto-resume: STOPPED on error (cursor unchanged). Fix, then re-run startDiscovery().');
    return;
  }
  if (INGEST.DRY_RUN) {               // DRY_RUN never sets the done flag — would loop forever
    Logger.log('Auto-resume: DRY_RUN — not rescheduling. Set INGEST.DRY_RUN=false to sweep for real.');
    return;
  }
  if (res && res.progressed === false) {   // boundary day didn't clear — re-running would only burn quota
    Logger.log('Auto-resume: STOPPED — no forward progress this batch (cursor stuck). ' +
      'Raise TIME_BUDGET_MS or narrow the net, then re-run startDiscovery(). Quota protected.');
    return;
  }
  if (ticks >= INGEST.DISCOVER_MAX_TICKS) {
    Logger.log('Auto-resume: STOPPED at tick cap (' + ticks + '/' + INGEST.DISCOVER_MAX_TICKS + '). ' +
      'Cursor saved — re-run startDiscovery() to continue older (resets the tick budget). Quota protected.');
    return;
  }
  ScriptApp.newTrigger('_discoverTick_').timeBased().after(INGEST.DISCOVER_RESUME_AFTER_MS).create();
  Logger.log('Auto-resume: tick ' + ticks + '/' + INGEST.DISCOVER_MAX_TICKS + ' — next batch in ' + (INGEST.DISCOVER_RESUME_AFTER_MS / 1000) + 's.');
}

/** Cancel the auto-resume chain (any pending _discoverTick_ triggers). */
function stopDiscovery() {
  Logger.log('Auto-resume: cleared ' + deleteDiscoverTriggers_() + ' pending discovery trigger(s).');
}

/** Delete every pending _discoverTick_ trigger; returns the count removed. */
function deleteDiscoverTriggers_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '_discoverTick_') { ScriptApp.deleteTrigger(t); n++; }
  });
  return n;
}

/**
 * DESTRUCTIVE recovery: wipe all Price DATA rows (header kept) and clear every ingest gate + cursor,
 * so the next seedAliases() + discoverAllPriceMail() rebuilds Price from email cleanly. Use this to
 * recover from a bad partial run (e.g. rows stranded superseded=TRUE with no active replacement).
 * Safe: prices are fully re-derivable from the source mail, and nothing reads Price yet. Leaves the
 * curated `_alias` mappings untouched.
 */
function resetPriceData() {
  var ss = db_();
  var sh = ss.getSheetByName('Price');
  var last = sh.getLastRow(), cleared = Math.max(0, last - 1);
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  ['email_backfill_done', 'email_discover_done'].forEach(function (k) { metaSet_(ss, k, 'FALSE'); });
  ['email_discover_before', 'email_last_cursor'].forEach(function (k) { metaSet_(ss, k, ''); });
  Logger.log('resetPriceData: cleared ' + cleared + ' Price rows + reset all ingest gates/cursors. ' +
    'Next: seedAliases() (if needed) then discoverAllPriceMail() until COMPLETE.');
  return cleared;
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
  ['C9200L-48P-4X-E',     'switch:cisco:c9200l-48p-4x-e','Catalyst 9200L 48p PoE+, 4x10G'],
  ['C1300-24XTS',         'switch:cisco:c1300-24xts',    'Catalyst 1300 12p10GE + 12p SFP+'],
  ['C1300-16XTS',         'switch:cisco:c1300-16xts',    'Catalyst 1300 8p10GE + 8p SFP+'],
  ['C1300-48T-4G',        'switch:cisco:c1300-48t-4g',   'Catalyst 1300 48p GE, 4x1G SFP'],
  ['C1300-48T-4X',        'switch:cisco:c1300-48t-4x',   'Catalyst 1300 48p GE, 4x10G SFP+'],
  ['C1300-24T-4X',        'switch:cisco:c1300-24t-4x',   'Catalyst 1300 24p GE, 4x10G SFP+'],
  ['C1300-16P-4X',        'switch:cisco:c1300-16p-4x',   'Catalyst 1300 16p GE PoE, 4x10G SFP+'],
  ['C1300X-24T-4X',       'switch:cisco:c1300x-24t-4x',  'Catalyst 1300X 24p GE, 4x10G SFP+'],
  // --- Nutanix HCI (cost quotes arrive as xlsx; "Price to SCM" is a LINE TOTAL → stored per-unit via qty) ---
  ['NX-8170-G10',         'hci:nutanix:nx-8170-g10',     'NX-8170-G10 node (1-node cfg) -> hw, per node (line total / qty)'],
  ['SW-NCI-PRO-AP',       'hci:nutanix:nci-pro',         'NCI Pro subscription + L3 support -> per core (verify qty basis on readback)'],
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
  ['C9300-DNA-E-24-1R',   'switch:cisco:c9300-dna-e-24', 'DNA Essentials 24p, 1yr renewal'],
  ['C9300L-DNA-E-24-1R',  'switch:cisco:c9300l-dna-e-24','DNA Essentials 24p (9300L), 1yr renewal'],
  // --- Cisco power supplies / stacking / accessories (hw); transceivers + DAC now under cabling: ---
  ['PWR-C1-1100WAC-P/2',  'switch:cisco:pwr-c1-1100wac', '1100W AC PSU (secondary)'],
  ['PWR-C1-350WAC-P/2',   'switch:cisco:pwr-c1-350wac',  '350W AC PSU (secondary)'],
  ['PWR-C1-715WAC-P/2',   'switch:cisco:pwr-c1-715wac',  '715W AC PSU (secondary)'],
  ['PWR-C5-1KWAC/2',      'switch:cisco:pwr-c5-1kwac',   '1KW AC PSU (secondary, C9200)'],
  ['C9K-ACC-RBFT',        'switch:cisco:acc-rbft',       'rubber feet (accessory)'],
  ['GLC-TE',              'cabling:cisco:glc-te',         '1000BASE-T SFP'],
  ['SFP-10G-LR',          'cabling:cisco:sfp-10g-lr',     '10GBASE-LR SFP'],
  ['SFP-10G-SR',          'cabling:cisco:sfp-10g-sr',     '10GBASE-SR SFP'],
  ['SFP-H10GB-CU1M',      'cabling:cisco:sfp-h10gb-cu1m', '10G CU DAC 1m'],
  ['SFP-H10GB-CU3M',      'cabling:cisco:sfp-h10gb-cu3m', '10G CU DAC 3m'],
  ['SFP-H10GB-CU5M',      'cabling:cisco:sfp-h10gb-cu5m', '10G CU DAC 5m'],
  ['SFP-H25G-CU1M',       'cabling:cisco:sfp-h25g-cu1m',  '25G CU DAC 1m'],
  ['SFP-H25G-CU3M',       'cabling:cisco:sfp-h25g-cu3m',  '25G CU DAC 3m'],
  ['STACK-T1-50CM',       'switch:cisco:stack-t1-50cm',  'stacking cable 50cm'],
  ['CAB-SPWR-30CM',       'switch:cisco:cab-spwr-30cm',  'stack power cable 30cm'],
  ['CAB-SPWR-150CM',      'switch:cisco:cab-spwr-150cm', 'stack power cable 150cm'],
  ['SFP-10G-LR-S',        'cabling:cisco:sfp-10g-lr-s',   '10GBASE-LR SFP, enterprise-class'],
  ['SFP-10G-T-X',         'cabling:cisco:sfp-10g-t-x',    '10GBASE-T copper SFP+'],
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
  ['RH00004',             'server:redhat:rhel-server-std','Red Hat Enterprise Linux Server, Standard'],
  // --- Fortinet FortiGate (firewall) — inline service/subscription lines only; the FG-70G HW
  //     price itself arrives as an xlsx attachment (#2, dormant until Drive enabled). ---
  ['TN-FG70GARBO36N',     'firewall:fortinet:fortigate-70g',   'FG-70G Advance Replacement 24x7/BKK, 3yr -> support_yr'],
  ['TN-FG70GARBO12N',     'firewall:fortinet:fortigate-70g',   'FG-70G Advance Replacement 24x7/BKK, 1yr -> support_yr'],
  ['FTN-0081F1310236-N',  'firewall:fortinet:forticloud-mgmt', 'FortiGate Cloud Mgmt+Analysis, 1yr log, 3yr term -> lic_yr'],
  ['FTN-GT71G1310212-N',  'firewall:fortinet:forticloud-std',  'FortiGate Cloud Standard subscription, 1yr -> lic_yr'],
  // --- HPE Aruba ClearPass (NAC) ---
  ['JZ399AAE',            'nac:aruba:clearpass-cx000v',        'ClearPass NAC Cx000V VM appliance license E-LTU -> lic_yr'],
  ['JZ400AAE',            'nac:aruba:clearpass-acc-100',       'ClearPass Access License, 100 concurrent endpoints E-LTU -> lic_yr'],
  // --- Cisco Catalyst 9300X (devices + module + support + DNA) ---
  ['C9300X-24Y-E',        'switch:cisco:c9300x-24y-e',         'Catalyst 9300X 24x25G fiber, modular uplink'],
  ['C9300X-NM-8Y',        'switch:cisco:c9300x-nm-8y',         'Catalyst 9300 8x10G/25G network module'],
  ['CON-SNT-C9300XYE',    'switch:cisco:c9300x-24y-e',         'SNTC-8x5xNBD support -> support_yr'],
  ['C9300-DNA-L-E-3Y',    'switch:cisco:c9300-dna-l-e',        'DNA Essentials, 3yr term license'],
  ['SFP-10G-SR-S',        'cabling:cisco:sfp-10g-sr-s',        '10GBASE-SR SFP, enterprise-class'],
  // --- Allied-Telesis x550 switch + line-card/PSU support + transceivers/cables ---
  ['AT-X550-18XSPQM-E11', 'switch:alliedtelesis:at-x550-18xspqm','x550 stackable core/distribution switch'],
  ['AT-XEM2-12XSV2-NCA1', 'switch:alliedtelesis:at-xem2-12xs', 'Net.Cover Advanced 1yr (line card) -> support_yr'],
  ['AT-PWR600-NCA1',      'switch:alliedtelesis:at-pwr600',    'Net.Cover Advanced 1yr (PSU) -> support_yr'],
  ['AT-SP10TW1',          'cabling:alliedtelesis:at-sp10tw1',  '1m SFP+ twinax DAC'],
  ['AT-SP10TW3',          'cabling:alliedtelesis:at-sp10tw3',  '3m SFP+ twinax DAC'],
  ['AT-SPLX10A',          'cabling:alliedtelesis:at-splx10a',  '1000BaseLX 10km SFP'],
  ['AT-SP10SR',           'cabling:alliedtelesis:at-sp10sr',   '10G 850nm short-haul SFP+'],
  ['AT-SPSX',             'cabling:alliedtelesis:at-spsx',     '1000BaseSX SFP'],
  ['AT-QSFP1CU',          'cabling:alliedtelesis:at-qsfp1cu',  '40G QSFP+ DAC 1m'],
  // --- Allied-Telesis transceiver Net.Cover support (classify net.cover rule -> support_yr) ---
  ['AT-SP10TW1-NCA1',     'cabling:alliedtelesis:at-sp10tw1',  'Net.Cover Advanced 1yr (SP10TW1) -> support_yr'],
  ['AT-SP10TW3-NCA1',     'cabling:alliedtelesis:at-sp10tw3',  'Net.Cover Advanced 1yr (SP10TW3) -> support_yr'],
  ['AT-QSFP1CU-NCA1',     'cabling:alliedtelesis:at-qsfp1cu',  'Net.Cover Advanced 1yr (QSFP1CU) -> support_yr'],
  ['AT-SPLX10A-NCA1',     'cabling:alliedtelesis:at-splx10a',  'Net.Cover Advanced 1yr (SPLX10A) -> support_yr'],
  ['AT-SP10SR-NCA1',      'cabling:alliedtelesis:at-sp10sr',   'Net.Cover Advanced 1yr (SP10SR) -> support_yr'],
  ['AT-SPSX-NCA1',        'cabling:alliedtelesis:at-spsx',     'Net.Cover Advanced 1yr (SPSX) -> support_yr'],
  // --- H3C optical transceivers (L1 media; HIHSFP = distributor SKU prefix) ---
  ['HIHSFPSFP-XG-LH40-SM1550',     'cabling:h3c:sfp-xg-lh40-sm1550', 'H3C 10GBASE-ER SFP+ 1550nm 40km'],
  ['HIHSFPQSFP-100G-ER4L-WDM1300', 'cabling:h3c:qsfp-100g-er4l',     'H3C 100G QSFP28 ER4L 40km'],
  ['HIHSFPQSFP-100G-ZR4-WDM1300',  'cabling:h3c:qsfp-100g-zr4',      'H3C 100G QSFP28 ZR4 80km'],
  // --- Microsoft Windows Server 2025 (winsvr flow) ---
  ['DG7GMGF0PWHC_16CORE_COM', 'winsvr:microsoft:ws2025-std-16core', 'Windows Server 2025 Standard 16-core pack -> lic_yr'],
  ['DG7GMGF0PWHT_USR_COM',    'winsvr:microsoft:ws2025-user-cal',   'Windows Server 2025 User CAL -> lic_yr'],
  ['DG7GMGF0PWHT_DVC_COM',    'winsvr:microsoft:ws2025-device-cal', 'Windows Server 2025 Device CAL -> lic_yr'],
  // --- Microsoft SQL Server 2025 (catalog only — no app flow yet) ---
  ['DG7GMGF0VNH2_2CORE_COM',  'sqlserver:microsoft:sql2025-std-2core',  'SQL Server 2025 Standard 2-core pack -> lic_yr'],
  ['DG7GMGF0VNHV_DVC_COM',    'sqlserver:microsoft:sql2025-device-cal', 'SQL Server 2025 Device CAL -> lic_yr'],
  // --- Quest Toad for Oracle (catalog only — no app flow yet) ---
  ['DVB-TOD-TK',          'software:quest:toad-oracle-dev',    'Toad for Oracle Developer Edition, per-seat term + maint'],
  // --- Veeam Data Platform Essentials maintenance / migration. Distinct per-term models so these
  //     renewal/uplift/migration line items don't collide with or overwrite the base license price. ---
  ['V-ESSSTD-VS-P0ARE-00','backup:veeam:ess-std-maint-1y',       'Essentials Std annual basic maintenance renewal -> support_yr'],
  ['V-ESSSTD-VS-P024M-00','backup:veeam:ess-std-maint-uplift',   'Essentials Std 24x7 maintenance uplift, 1 month -> support_yr'],
  ['V-ESSSTD-VS-P01MR-00','backup:veeam:ess-std-maint-1m',       'Essentials Std monthly basic maintenance renewal -> support_yr'],
  ['V-ESSVUL-2S-PS1MG-10','backup:veeam:ess-universal-migration','Express migration Essentials Std -> Universal -> lic_yr']
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

/**
 * Targeted attachment sweep — distributor / [EXT] mail WITH attachments only (the small, fast set that
 * carries the .xlsx quotes: firewall, HCI/Nutanix, servers). Reuses runIngest_ (narrow gate + the xlsx
 * attachment reader), so it inherits the _alias gate, price_id dedupe, and _sync_log. Far cheaper than
 * the broad inbox discovery sweep — the from:(distributors) has:attachment set is small, so it converges
 * in one run and is safe to run daily. Re-runs are idempotent (already-captured rows upsert 0).
 */
function fetchAttachmentQuotes() {
  var q = buildQuery_('has:attachment newer_than:' + INGEST.ATTACH_MONTHS + 'm');   // {from:(distributors) [EXT]} has:attachment
  var res = runIngest_(q, 'attach', { broadGate: false, cap: INGEST.ATTACH_THREADS });
  Logger.log('Attachment sweep (' + INGEST.ATTACH_MONTHS + 'm): ' + (res.status === 'error'
    ? 'ERROR — ' + res.error
    : 'scanned ' + res.scanned + ', upserted ' + res.upserted + ' (provisional ' + res.provisional +
      '), skipped ' + res.skipped +
      ((res.timedOut || res.threadsFetched >= INGEST.ATTACH_THREADS)
        ? '  [hit cap/budget — raise ATTACH_THREADS or narrow ATTACH_MONTHS, then re-run (dedupe-safe)]' : '')));
  return res;
}

/**
 * Install a DAILY trigger running fetchAttachmentQuotes() at 16:00 Asia/Bangkok. That is ~02:00 US-Pacific
 * (PDT) / ~01:00 (PST) — safely AFTER the midnight-Pacific Gmail-quota reset in both DST modes, so the
 * sweep always runs on fresh quota and never lands on a drained day. Run ONCE from the editor; then it is
 * hands-off. stopDailyAttachmentSweep() removes it.
 */
function scheduleDailyAttachmentSweep() {
  stopDailyAttachmentSweep();   // no duplicate triggers
  ScriptApp.newTrigger('fetchAttachmentQuotes').timeBased().everyDays(1).atHour(16).create();
  Logger.log('Scheduled fetchAttachmentQuotes() daily at 16:00 ' + INGEST.TZ + ' (post US-Pacific quota reset).');
}

/** Remove the daily attachment-sweep trigger(s). Returns the count removed. */
function stopDailyAttachmentSweep() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'fetchAttachmentQuotes') { ScriptApp.deleteTrigger(t); n++; }
  });
  if (n) Logger.log('Removed ' + n + ' daily attachment-sweep trigger(s).');
  return n;
}

// ---------------------------------------------------------------------------
// Core run
// ---------------------------------------------------------------------------

function runIngest_(query, mode, opts) {
  opts = opts || {};
  var broadGate = !!opts.broadGate;              // discovery: parse any inbound message, not just distributor/[EXT]
  var cap = opts.cap || INGEST.MAX_THREADS;
  var t0 = Date.now();
  var ss = db_();
  var run = { run_id: 'em-' + nowIso_(), started_at: nowIso_(), src_system: 'email', mode: mode,
              scanned: 0, upserted: 0, superseded: 0, skipped: 0, provisional: 0, status: 'ok', error: '', timedOut: false,
              threadsFetched: 0, oldestYmd: '' };

  try {
    var aliasMap = readAlias_(ss);                 // raw part_no -> sku_key (curated)
    var priceState = readPriceState_(ss);          // existing rows for dedupe + supersede
    var newAliases = {};                           // unmatched part numbers to log once
    var toAppend = [];                             // new Price rows
    var supersedeRowIdx = {};                       // 1-based sheet row -> set superseded TRUE

    var threads = GmailApp.search(query, 0, cap);
    run.threadsFetched = threads.length;
    for (var ti = 0; ti < threads.length; ti++) {
      if (Date.now() - t0 > INGEST.TIME_BUDGET_MS) { run.timedOut = true; break; }
      var tYmd = ymd_(threads[ti].getLastMessageDate());   // oldest fetched thread = resume boundary (newest-first)
      if (!run.oldestYmd || tYmd < run.oldestYmd) run.oldestYmd = tYmd;
      var msgs = threads[ti].getMessages();
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        if (isFromUs_(m.getFrom())) continue;                  // skip our own outbound RFQs
        // Narrow gate: distributor sender OR [EXT] subject (mirrors the daily/backfill query). Broad
        // (discovery) gate: accept any inbound message — the _alias gate still protects Price. A thread
        // can mix unrelated replies, so this re-check at the message level matters.
        if (!broadGate && !isFromDistributor_(m.getFrom()) && !/\[EXT\]/i.test(m.getSubject())) continue;
        run.scanned++;
        var effDate = ymd_(m.getDate());
        var items = parsePriceTable_(m.getBody());             // inline HTML tables → [{part, desc, qty, unit_thb}]
        var attItems = parseAttachmentTables_(m);              // xlsx attachments (dormant until Drive enabled)
        for (var ai = 0; ai < attItems.length; ai++) items.push(attItems[ai]);
        var ctx = { msgId: m.getId(), subject: m.getSubject(), effDate: effDate };

        for (var k = 0; k < items.length; k++) {
          var it = items[k];
          var sku = aliasMap[normPart_(it.part)];
          if (!sku) {
            newAliases[normPart_(it.part)] = it.desc;            // still queue blank for curation
            if (!(it.unit_thb > 0)) { run.skipped++; continue; } // no usable price → nothing to record
            // "Pull everything": record the price now under a PROVISIONAL key instead of skipping.
            // Category 'unknown' isn't in POS_CATEGORY_TO_VIEW, so these stay OUT of the app price-list
            // views (no clutter) but are captured in Price and greppable by the 'unknown:' prefix.
            // Curate _alias later to promote the part to its real sku_key.
            sku = 'unknown:unknown:' + normPart_(it.part).toLowerCase().replace(/[:#|]/g, '-');
            run.provisional++;
          }
          var ptype = classifyPriceType_(it.part, it.desc);
          reconcile_(sku, ptype, it, ctx, priceState, toAppend, supersedeRowIdx, run);
        }
      }
    }

    if (INGEST.DRY_RUN) {
      run.status = 'dry_run';
      Logger.log('[DRY_RUN] would upsert ' + toAppend.length + ' (provisional ' + run.provisional +
        '), supersede ' + Object.keys(supersedeRowIdx).length + ', new aliases ' +
        Object.keys(newAliases).length + ', skipped ' + run.skipped);
      toAppend.slice(0, 20).forEach(function (r) { Logger.log('  + ' + r[0] + '  ' + r[6] + ' THB'); });
      Object.keys(newAliases).forEach(function (p) { Logger.log('  ? unmatched part: ' + p + ' — ' + newAliases[p]); });
    } else {
      applySupersede_(ss, supersedeRowIdx);
      if (toAppend.length) appendRows_(ss, 'Price', toAppend);
      appendNewAliases_(ss, newAliases);
      run.superseded = Object.keys(supersedeRowIdx).length;
      run.upserted = toAppend.length;
      Logger.log('Ingest ' + mode + ': upserted ' + run.upserted + ' (provisional ' + run.provisional +
        '), superseded ' + run.superseded + ', skipped ' + run.skipped);
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

// Column index of the `superseded` flag inside a Price row as built in reconcile_'s toAppend.push
// below (price_id,sku_key,product,vendor,model,price_type,amount,currency,qty_basis,effective_date,
// SUPERSEDED,...). Keep in sync with that array if columns ever change.
var PRICE_SUPERSEDED_IDX = 10;

/**
 * Append-with-history reconciliation for one (sku_key, price_type). Newest effective_date in
 * the group is the active row (superseded=FALSE); all older rows get superseded=TRUE. Exact
 * price_id already present → skip (idempotent).
 */
function reconcile_(sku, ptype, it, ctx, state, toAppend, supersedeRowIdx, run) {
  var priceId = sku + '#' + ptype + '#' + ctx.effDate;
  var group = state.byKey[sku + '|' + ptype] || (state.byKey[sku + '|' + ptype] = []);
  if (state.byId[priceId] || pendingHas_(toAppend, priceId)) return;   // already have this exact row

  // Determine the newest effective date across existing + pending + this new row.
  var newest = ctx.effDate;
  group.forEach(function (g) { if (g.eff > newest) newest = g.eff; });

  // Supersede any still-active row older than the newest. An EXISTING sheet row is flipped in the
  // sheet via supersedeRowIdx (1-based row). A row still PENDING in this run (rowIndex < 0) is flipped
  // in place in toAppend by its captured index — never via getRange (a -1 row crashes applySupersede_).
  group.forEach(function (g) {
    if (g.eff < newest && !g.superseded) {
      g.superseded = true;
      if (g.rowIndex > 0) supersedeRowIdx[g.rowIndex] = true;
      else if (g.appendIdx != null) toAppend[g.appendIdx][PRICE_SUPERSEDED_IDX] = 'TRUE';
    }
  });

  var isActive = (ctx.effDate >= newest);          // new row active only if it's the newest
  var parts = sku.split(':');
  toAppend.push([
    priceId, sku, parts[0] || '', parts[1] || '', parts.slice(2).join(':') || '',
    ptype, it.unit_thb, 'THB', it.qty_basis || 'per_unit', ctx.effDate, isActive ? 'FALSE' : 'TRUE',
    'email', 'gmail:' + ctx.msgId, '🟢', '[EXT email ' + ctx.effDate + ']', ctx.subject, nowIso_()
  ]);
  group.push({ rowIndex: -1, appendIdx: toAppend.length - 1, eff: ctx.effDate, superseded: !isActive });
}

// ---------------------------------------------------------------------------
// Parser (ported verbatim from the Node prototype; validated on a real VST [EXT] reply)
// ---------------------------------------------------------------------------

var INGEST_COL = {
  part:  /part\s*(no|number)|p\s*\/?\s*n\b|product\s*code|item\s*code|^\s*sku\b/i,
  desc:  /description|product/i,
  qty:   /^\s*qty|quantity/i,
  unit:  /unit\s*price|unit\s*cost|per\s*item/i,            // genuine per-unit price — never divided by qty
  net:   /price\s*to\s*scm|net\s*price|dealer|\bcost\b/i,   // net/cost column — a LINE TOTAL on xlsx cost quotes
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
function extractPricedRows_(rows, opts) {
  opts = opts || {};
  var out = [], h = findHeaderRow_(rows);
  if (!h) return out;                                                         // not a price table
  var idx = h.idx;
  var priceCol = idx.unit != null ? idx.unit : (idx.net != null ? idx.net : idx.total);
  var priceIsUnit = (idx.unit != null);                                       // price came from a genuine unit-price column
  for (var i = h.row + 1; i < rows.length; i++) {
    var r = rows[i];
    if (/grand\s*total|vat|valid|^\s*total\b/i.test(String(r[0] || ''))) continue;  // footer
    var part = String(r[idx.part] || '').trim();
    if (!part) continue;
    var amt = toNum_(priceCol != null ? r[priceCol] : null);
    if (amt == null || amt < 100) continue;                                 // bundled '-' lines / stray qty values
    var qty = toNum_(r[idx.qty]);
    // xlsx cost quotes (opts.lineTotals) carry a LINE TOTAL in the net/total column → divide by qty for a
    // true unit price (Oran's call). Genuine unit-price columns and the HTML body path are never divided.
    // A line-total column with no usable qty is kept as-is but flagged qty_basis so the DB row isn't mislabeled.
    var divide = !!(opts.lineTotals && !priceIsUnit && qty && qty > 1);
    out.push({
      part: part,
      desc: String(r[idx.desc] || '').slice(0, 120),
      qty: qty,
      unit_thb: divide ? amt / qty : amt,
      qty_basis: (divide || priceIsUnit || !opts.lineTotals) ? 'per_unit' : 'line_total'
    });
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

/** A spreadsheet Blob with the right content type so Drive converts it (handles .xlsx and legacy .xls). */
function spreadsheetBlob_(att) {
  var blob = att.copyBlob(), name = String(att.getName() || '').toLowerCase();
  if (/\.xlsx$/.test(name)) blob.setContentType(MimeType.MICROSOFT_EXCEL);
  else if (/\.xls$/.test(name)) blob.setContentType('application/vnd.ms-excel');
  return blob;
}

/**
 * Upload a spreadsheet blob as a converted Google Sheet, version-agnostically. The Apps Script
 * Advanced Drive service may be v3 (Files.create, conversion implied by the target mimeType) or the
 * older v2 (Files.insert + {convert:true}). Try v3 first, fall back to v2.
 */
function insertConvertedSheet_(title, blob) {
  if (Drive.Files.create) {                                  // Drive advanced service v3
    return Drive.Files.create({ name: title, mimeType: MimeType.GOOGLE_SHEETS }, blob);
  }
  return Drive.Files.insert({ title: title, mimeType: MimeType.GOOGLE_SHEETS }, blob, { convert: true }); // v2
}

/** Convert a spreadsheet attachment → temp Google Sheet (Drive advanced service), read every tab, trash it. */
function readXlsxBlob_(att) {
  var out = [], fileId = null, name = (att.getName && att.getName()) || '?';
  try {
    var file = insertConvertedSheet_('_pos_ingest_tmp_' + Date.now(), spreadsheetBlob_(att));
    fileId = file.id;
    var sheets = SpreadsheetApp.openById(fileId).getSheets();
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getLastRow() < 2) continue;          // empty/header-only tab
      var items = extractPricedRows_(sheets[s].getDataRange().getValues(), { lineTotals: true });
      for (var j = 0; j < items.length; j++) out.push(items[j]);
    }
  } catch (e) {
    Logger.log('xlsx parse failed for attachment "' + name + '": ' + (e && e.message || e));
  } finally {
    if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e2) {} }   // version-agnostic cleanup
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
    var idx = {}, used = {}, r = rows[i];
    for (var c = 0; c < r.length; c++) {
      // one column maps to at most one key (first match in part,desc,qty,unit,net,total order) — so a
      // "Product Code" col is claimed by `part`, not double-claimed by `desc` (which also tests /product/).
      for (var k in INGEST_COL) { if (idx[k] == null && !used[c] && INGEST_COL[k].test(r[c])) { idx[k] = c; used[c] = true; break; } }
    }
    if (idx.part != null && idx.desc != null && (idx.unit != null || idx.net != null || idx.total != null)) return { row: i, idx: idx };
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
  // support/maintenance: Cisco CON-/SNTC/SNT, "MA", net.cover (Allied-Telesis), advance(d) replacement
  // (Fortinet AR), warranty/RMA, plus plain support/maintenance/service.
  if (/\bcon-|sntc|\bsnt\b|\bma\b|support|maintenance|service|net\.?cover|advance[d]? replacement|\bwarranty\b|\brma\b/.test(s)) return 'support_yr';
  // license/subscription: lic(ense), subscription, term, DNA, N-year terms, and Device/User CALs.
  if (/lic|licen|subscription|term|dna|-3y|-1y|-5y|(device|user)\s*cal/.test(s)) return 'lic_yr';
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
  idxs.forEach(function (rowIdx) {
    var n = parseInt(rowIdx, 10);
    if (!(n >= 2)) return;                            // defensive: only real data rows (header is row 1)
    d.sh.getRange(n, c).setValue('TRUE');
  });
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
/** Shift a 'yyyy-MM-dd' string by N days, returning 'yyyy-MM-dd' (used for the discovery resume cursor). */
function ymdPlusDays_(ymd, days) {
  var p = String(ymd).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, INGEST.TZ, 'yyyy-MM-dd');
}
