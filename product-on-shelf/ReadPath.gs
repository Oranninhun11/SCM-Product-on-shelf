/**
 * Product on Shelf — read path: backbone `Price` tab → window.PRICING for the app.
 *
 * The app's flows read `window.PRICING` (each with a mock fallback). doGet() injects this
 * server-side BEFORE the flow scripts run — see Code.gs (sets PRICING_JSON) and build.py
 * (emits the bootstrap <script> right after the head). It MUST be synchronous: google.script.run
 * would arrive too late because every flow binds its pricing at IIFE-init during page parse.
 *
 * v1 scope — the per-product **Price list** tab. Each product panel mounts the generic engine in
 * src/flows/_pricelist.html, which reads `P[view].pricelist` as an array of { model, price, unit }.
 * We build those arrays straight from the `Price` tab (active rows only) — no `Spec` needed, so the
 * real ingested email prices show immediately (switch is the richest today). The sizing flows that
 * match by spec (firewall throughput, switch ports, HCI cores, storage TB) keep their mock catalog
 * until the `Spec` tab is populated — that's the next data step, not a code gap here.
 */

// Price sku_key category (first segment, e.g. "switch" in switch:cisco:c9300) → the
// data-pricelist view key used by the product panels. Categories absent here have no price-list
// view yet, so their rows are skipped (the panel falls back to its mock list).
var POS_CATEGORY_TO_VIEW = {
  switch: 'switch', server: 'server', storage: 'storage', router: 'router', adc: 'adc',
  ups: 'ups', wireless: 'wireless', hci: 'hci', cabling: 'cabling',
  backup: 'backup', nac: 'nac', endpoint: 'endpoint', dlp: 'dlp', captive: 'captive',
  siem: 'siem', virt: 'virt', m365: 'm365', esec: 'esec',
  winsvr: 'ws'   // Windows Server backbone category → the "ws" price-list view
};

// Vendor token (as stored in sku_key / the vendor column) → display name. Fallback: capitalize.
var POS_VENDOR_DISPLAY = {
  cisco: 'Cisco', alliedtelesis: 'Allied Telesis', h3c: 'H3C', fortinet: 'Fortinet',
  redhat: 'Red Hat', veeam: 'Veeam', aruba: 'Aruba', microsoft: 'Microsoft', quest: 'Quest',
  hpe: 'HPE', lenovo: 'Lenovo', nutanix: 'Nutanix', dell: 'Dell', netapp: 'NetApp'
};

/** Entry point (called by doGet via posPricingJson_). Returns the window.PRICING object. */
function getPricing() {
  var ss = db_();
  var d = sheetData_(ss, 'Price');
  var rows = d.rows.map(function (r) {
    return {
      sku_key: String(r[d.col.sku_key] || ''),
      vendor: String(r[d.col.vendor] || ''),
      model: String(r[d.col.model] || ''),
      type: String(r[d.col.price_type] || ''),
      amount: Number(r[d.col.amount_thb] || 0),
      eff: String(r[d.col.effective_date] || ''),
      superseded: String(r[d.col.superseded]).toUpperCase() === 'TRUE'
    };
  });
  return posBuildPricing_(rows);
}

/**
 * Pure transform (no Sheets API, unit-testable): active Price rows → { view: { pricelist: [...] } }.
 * One item per sku_key, priced hw > lic_yr > support_yr; newest effective_date wins within a type.
 * @param {Array<{sku_key,vendor,model,type,amount,eff,superseded}>} rows
 */
function posBuildPricing_(rows) {
  var TYPE_RANK = { hw: 3, lic_yr: 2, support_yr: 1 };
  var best = {};   // sku_key → chosen row
  rows.forEach(function (r) {
    if (r.superseded || !r.sku_key || !(r.amount > 0)) return;
    var cur = best[r.sku_key];
    if (!cur) { best[r.sku_key] = r; return; }
    var rRank = TYPE_RANK[r.type] || 0, cRank = TYPE_RANK[cur.type] || 0;
    if (rRank > cRank || (rRank === cRank && r.eff > cur.eff)) best[r.sku_key] = r;
  });

  var out = {};
  Object.keys(best).forEach(function (sku) {
    var r = best[sku];
    var view = POS_CATEGORY_TO_VIEW[sku.split(':')[0]];
    if (!view) return;
    var vendor = POS_VENDOR_DISPLAY[r.vendor] || posCap_(r.vendor);
    var label = (vendor + ' ' + String(r.model).toUpperCase()).trim();
    var unit = r.type === 'hw' ? 'each' : 'per unit/yr';
    (out[view] || (out[view] = { pricelist: [] })).pricelist.push(
      { brand: vendor, model: label, price: Math.round(r.amount), unit: unit });
  });

  // Cheapest first within each view — stable, readable order.
  Object.keys(out).forEach(function (v) {
    out[v].pricelist.sort(function (a, b) { return a.price - b.price; });
  });
  return out;
}

/** JSON literal for the bootstrap <script> in index.html. Never throws; <-escapes '<'. */
function posPricingJson_() {
  try {
    return JSON.stringify(getPricing() || {}).replace(/</g, '\\u003c');
  } catch (e) {
    return '{}';   // any failure → empty → flows fall back to their mock pricing (app never breaks)
  }
}

function posCap_(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
