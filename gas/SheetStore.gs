/** Generic row <-> object helpers shared by every data module (Quotes/Masters/Customers/Logs). */

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found. Reload the app once to initialize it.');
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/** Converts a Sheets-coerced Date cell back into a plain YYYY-MM-DD string; leaves
 *  everything else untouched. See ensureSheets_ for why this is only a safety net. */
function normalizeCell_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  return v;
}

/** Every data row as a plain object keyed by header, plus a hidden _rowIndex (1-based
 *  sheet row) used by update/delete. */
function getRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .map(function (row, i) {
      var obj = { _rowIndex: i + 2 };
      headers.forEach(function (h, j) { obj[h] = normalizeCell_(row[j]); });
      return obj;
    })
    .filter(function (obj) {
      // Skip fully-blank rows (e.g. a stray trailing row).
      return Object.keys(obj).some(function (k) { return k !== '_rowIndex' && obj[k] !== ''; });
    });
}

function findRowsBySheetName_(sheetName, predicate) {
  return getRows_(getSheet_(sheetName)).filter(predicate);
}

function findRow_(sheetName, predicate) {
  var rows = findRowsBySheetName_(sheetName, predicate);
  return rows.length > 0 ? rows[0] : null;
}

function appendRow_(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var row = headers.map(function (h) { return obj[h] !== undefined && obj[h] !== null ? obj[h] : ''; });
  sheet.appendRow(row);
}

function updateRow_(sheetName, rowIndex, obj) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var row = headers.map(function (h) { return obj[h] !== undefined && obj[h] !== null ? obj[h] : ''; });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

function deleteRow_(sheetName, rowIndex) {
  getSheet_(sheetName).deleteRow(rowIndex);
}

/** Strips the internal _rowIndex before a row object is sent to the client. */
function rowToPlain_(row) {
  var obj = {};
  Object.keys(row).forEach(function (k) {
    if (k !== '_rowIndex') obj[k] = row[k];
  });
  return obj;
}
