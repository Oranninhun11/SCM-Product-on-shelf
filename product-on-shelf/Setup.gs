/**
 * Product on Shelf — Database backbone bootstrap.
 *
 * One-time (idempotent) setup of the central "Database GG-Sheet" defined in DB_SCHEMA.md.
 * Run `setupDatabase()` once from the Apps Script editor on the Workspace account
 * (oran.nin@scmtechnologies.co.th). It will:
 *   1. Create the spreadsheet "Product on Shelf — Database" (or reuse the one already
 *      recorded in Script Properties as DB_SPREADSHEET_ID).
 *   2. Ensure every tab exists with the exact header row (the read-by-name contract).
 *   3. Seed _meta and the Firewall _catalog_map rows if those tabs are empty.
 *
 * Safe to re-run: it (re)writes ONLY the header row + freezes it; it never touches data
 * rows below, and never deletes a tab. Adding a column later = append to the header array
 * here and re-run.
 *
 * First run prompts for authorization (Sheets + Drive create). Approve as the owner.
 */

/**
 * Optional: paste an existing spreadsheet URL or ID here to populate THAT sheet instead of
 * auto-creating a new one. Leave '' to auto-create. (Once run, the ID is saved to Script
 * Properties as DB_SPREADSHEET_ID and this constant is ignored thereafter.)
 */
var EXISTING_DB_ID = '1kzKWvaJN7z7wdcYjbcZHYXZpFfIxsqFyBDg8Ysxs7kY';

/** Tab -> header row. Header order is documentation only; the app reads by column NAME. */
var DB_SCHEMA = {
  // ---- Page 1: reference data the app READS ----
  Spec: [
    'sku_key', 'product', 'vendor', 'model', 'category', 'description',
    'spec_metric1_name', 'spec_metric1_value',
    'spec_metric2_name', 'spec_metric2_value',
    'spec_metric3_name', 'spec_metric3_value',
    'unit', 'citation_tag', 'source', 'source_detail', 'date_time', 'active'
  ],
  Price: [
    'price_id', 'sku_key', 'product', 'vendor', 'model', 'price_type',
    'amount_thb', 'currency', 'qty_basis', 'effective_date', 'superseded',
    'src_system', 'src_ref', 'citation_tag', 'source', 'source_detail', 'date_time'
  ],
  SOW: [
    'sow_id', 'project', 'impl_type', 'product', 'existing_equipment', 'new_equipment',
    'sow_icr', 'sla_tier', 'support_years', 'incidents', 'site_prep',
    'impl_basic_thb', 'impl_standard_thb', 'impl_complex_thb',
    'citation_tag', 'source', 'source_detail', 'date_time'
  ],

  // ---- Page 2: what the app WRITES ----
  Estimates: [
    'estimate_id', 'created_at', 'created_by', 'customer_name', 'customer_detail',
    'request_price_thb', 'buffer_applied', 'status', 'quotation_no', 'notes'
  ],
  Estimate_Lines: [
    'line_id', 'estimate_id', 'category', 'vendor', 'model', 'sku_key',
    'qty', 'unit_price_thb', 'line_total_thb', 'breakdown_json'
  ],

  // ---- Control tabs ----
  _meta: ['key', 'value'],
  _sync_log: [
    'run_id', 'started_at', 'finished_at', 'src_system', 'mode',
    'rows_scanned', 'rows_upserted', 'rows_superseded', 'rows_skipped',
    'status', 'error_detail', 'chat_notified'
  ],
  _alias: ['raw_string', 'sku_key', 'note'],
  // buildCatalog() config: maps backbone Spec/Price into each per-product catalog column.
  // mapping prefix: field:<col> | spec:<metric_name> | price:<price_type>
  _catalog_map: ['product', 'catalog_tab', 'catalog_column', 'mapping']
};

/** Tab order in the workbook (Page 1, Page 2, then control tabs). */
var DB_TAB_ORDER = [
  'Spec', 'Price', 'SOW', 'Estimates', 'Estimate_Lines',
  '_meta', '_sync_log', '_alias', '_catalog_map'
];

/** _meta seed rows (only added when a key is missing). */
var META_SEED = {
  version: '1',
  last_full_sync: '',
  estimate_seq: '0',
  email_backfill_done: 'FALSE',
  email_last_cursor: '',
  owner: 'oran.nin@scmtechnologies.co.th'
};

/** _catalog_map seed — Firewall vertical slice (matches SHEET_SCHEMA.md Firewall tab). */
var CATALOG_MAP_SEED = [
  ['firewall', 'Firewall', 'vendor', 'field:vendor'],
  ['firewall', 'Firewall', 'model', 'field:model'],
  ['firewall', 'Firewall', 'throughput_gbps', 'spec:throughput_gbps'],
  ['firewall', 'Firewall', 'hw_thb', 'price:hw'],
  ['firewall', 'Firewall', 'lic_yr_thb', 'price:lic_yr']
];

/**
 * Create or repair the Database GG-Sheet. Idempotent.
 * @return {string} the spreadsheet URL (also logged).
 */
function setupDatabase() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_SPREADSHEET_ID') || (EXISTING_DB_ID && extractId_(EXISTING_DB_ID));
  var ss;

  if (id) {
    ss = SpreadsheetApp.openById(id);
    props.setProperty('DB_SPREADSHEET_ID', id);
    Logger.log('Using existing DB: ' + id);
  } else {
    ss = SpreadsheetApp.create('Product on Shelf — Database');
    id = ss.getId();
    props.setProperty('DB_SPREADSHEET_ID', id);
    Logger.log('Created new DB: ' + id);
  }

  // Ensure each tab exists with the right header row.
  DB_TAB_ORDER.forEach(function (name, i) {
    var headers = DB_SCHEMA[name];
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(i + 1); // keep tabs in the documented order
  });

  // Drop the auto-created default sheet if it isn't one of ours.
  ss.getSheets().forEach(function (sheet) {
    if (DB_SCHEMA[sheet.getName()] === undefined && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
    }
  });

  seedMeta_(ss);
  seedCatalogMap_(ss);

  var url = ss.getUrl();
  Logger.log('DB ready: ' + url);
  return url;
}

/** Add any missing _meta key/value rows (never overwrites existing values). */
function seedMeta_(ss) {
  var sheet = ss.getSheetByName('_meta');
  var last = sheet.getLastRow();
  var existing = {};
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      existing[r[0]] = true;
    });
  }
  var toAdd = [];
  Object.keys(META_SEED).forEach(function (k) {
    if (!existing[k]) toAdd.push([k, META_SEED[k]]);
  });
  if (toAdd.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 2).setValues(toAdd);
  }
}

/** Accept either a full Sheets URL or a bare spreadsheet ID; return the ID. */
function extractId_(urlOrId) {
  var m = String(urlOrId).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : String(urlOrId).trim();
}

/** Seed Firewall _catalog_map rows only if the tab has no data yet. */
function seedCatalogMap_(ss) {
  var sheet = ss.getSheetByName('_catalog_map');
  if (sheet.getLastRow() > 1) return; // already seeded / curated
  sheet.getRange(2, 1, CATALOG_MAP_SEED.length, CATALOG_MAP_SEED[0].length)
    .setValues(CATALOG_MAP_SEED);
}
