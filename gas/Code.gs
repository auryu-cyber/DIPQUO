/**
 * DIP Quotation System — Google Apps Script edition.
 * Entry point + spreadsheet handle. All data lives in the bound/target Spreadsheet
 * (see SPREADSHEET_ID), replacing the GitHub-backed data store used by the Next.js version.
 */

var SPREADSHEET_ID = '1iR9XRg-T4v_i_M6Zl-MnHmhW01kW3oine11d-YDbB9Y';

function doGet() {
  ensureSheets_();
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('DIP Quotation System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** Inlines another HTML file's content — used by Index.html to pull in QuotesList.html
 *  and QuoteForm.html's <script> blocks (Apps Script has no <script src="..."> to other
 *  project files, this scriptlet include is the standard substitute). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
