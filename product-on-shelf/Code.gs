/**
 * Product on Shelf — Apps Script entry point.
 *
 * Phase 1 serves a single self-contained HTML page (no server-side data yet),
 * so we use createHtmlOutputFromFile (serves the file verbatim — no templating).
 *
 * Phase 2 note: when we start passing server data into the page, switch to
 *   HtmlService.createTemplateFromFile('index').evaluate()
 * and add an include() helper so index.html can pull in partials via
 *   <?!= include('javascript') ?>. That templating is why index.html stays a
 * single browser-renderable file for now.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Product on Shelf')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include a sub-file's content into a templated HTML file.
 * Unused in Phase 1; kept ready for the Phase 2 templating switch above.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
