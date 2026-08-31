/**
 * DIP Quotation System — Google Apps Script edition.
 * Entry point + spreadsheet handle. All data lives in the bound/target Spreadsheet
 * (see SPREADSHEET_ID), replacing the GitHub-backed data store used by the Next.js version.
 */

var SPREADSHEET_ID = '1iR9XRg-T4v_i_M6Zl-MnHmhW01kW3oine11d-YDbB9Y';

/** Bump both on every deploy-worthy change (see gas/README.md "Version bump policy").
 *  Shown in the app sidebar so users/admins can tell at a glance whether the deployment
 *  they're looking at is current. */
var APP_VERSION = '1.2.0';
var APP_VERSION_DATE = '2026-08-31';

function doGet() {
  ensureSheets_();
  var template = HtmlService.createTemplateFromFile('Index');
  template.appVersion = APP_VERSION;
  template.appVersionDate = APP_VERSION_DATE;
  return template.evaluate()
    .setTitle('DIP Quotation System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppVersion() {
  return { version: APP_VERSION, date: APP_VERSION_DATE };
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
