/** Sheet names and headers — the spreadsheet equivalent of the dipquo-data repo's folders. */

var SHEETS = {
  QUOTES: 'Quotes',
  MATERIALS: 'Materials',
  LABOR_RATES: 'LaborRates',
  PACKING_COSTS: 'PackingCosts',
  TRANSPORTATION: 'Transportation',
  EXCHANGE_RATES: 'ExchangeRates',
  CUSTOMERS: 'Customers',
  ACTIVITY_LOG: 'ActivityLog',
  LOGIN_LOG: 'LoginLog',
  ADMINS: 'Admins',
  PERMISSIONS: 'Permissions'
};

/** Pages a per-account permission can be granted on. Each cell in the Permissions sheet
 *  is '', 'view', or 'edit' — '' means "use the default" (see resolvePermission_ in Auth.gs). */
var PERMISSION_PAGES = ['quotes', 'masters', 'customers', 'logs'];

var HEADERS = {};
HEADERS[SHEETS.QUOTES] = ['id', 'variant', 'productName', 'customerName', 'inquiryDate', 'material',
  'monthlyQty', 'finalPriceToCustomer', 'grossMarginPct', 'status', 'updatedAt', 'updatedBy', 'dataJson'];
HEADERS[SHEETS.MATERIALS] = ['code', 'effectiveFrom', 'displayName', 'pricePerKg', 'recordedAt', 'recordedBy', 'note'];
HEADERS[SHEETS.LABOR_RATES] = ['code', 'effectiveFrom', 'hourlyChargeTHB', 'recordedAt', 'recordedBy', 'note'];
HEADERS[SHEETS.PACKING_COSTS] = ['code', 'effectiveFrom', 'displayName', 'priceTHB', 'qtyPerUnit', 'recordedAt', 'recordedBy', 'note'];
HEADERS[SHEETS.TRANSPORTATION] = ['code', 'effectiveFrom', 'vehicleTHB', 'fuelTHB', 'qtyPerTrip', 'recordedAt', 'recordedBy', 'note'];
HEADERS[SHEETS.EXCHANGE_RATES] = ['code', 'effectiveFrom', 'jpyPerThb', 'usdPerThb', 'recordedAt', 'recordedBy', 'note'];
HEADERS[SHEETS.CUSTOMERS] = ['id', 'customerName', 'industry', 'businessType', 'product', 'updatedAt', 'updatedBy'];
HEADERS[SHEETS.ACTIVITY_LOG] = ['at', 'user', 'action', 'target', 'detail'];
HEADERS[SHEETS.LOGIN_LOG] = ['at', 'user', 'result'];
HEADERS[SHEETS.ADMINS] = ['email'];
HEADERS[SHEETS.PERMISSIONS] = ['email', 'quotes', 'masters', 'customers', 'logs', 'updatedAt', 'updatedBy'];

/** Creates any missing tabs, fixes headers, and formats data columns as plain text
 *  (Sheets otherwise auto-converts "2026-01-01"-looking strings into Date cells, which
 *  breaks the plain string comparisons the app relies on for effectiveFrom lookups). */
function ensureSheets_() {
  var ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    var isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(name);
      isNew = true;
    }
    var headers = HEADERS[name];
    var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsHeader = headers.some(function (h, i) { return firstRow[i] !== h; });
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    if (isNew) {
      sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1000), headers.length).setNumberFormat('@');
    }
  });
  seedInitialData_();
}

function seedInitialData_() {
  var ss = getSpreadsheet_();
  seedIfEmpty_(ss, SHEETS.ADMINS, [['a.uryu@kunomura.com']]);

  var now = new Date().toISOString();
  seedIfEmpty_(ss, SHEETS.MATERIALS, [
    ['pecoat-343', '2026-01-01', 'Pecoat 343 (Green)', 114.42, now, 'a.uryu@kunomura.com', 'Seed data'],
    ['csh107', '2026-01-01', 'CSH107 (Green)', 150, now, 'a.uryu@kunomura.com', 'Seed data']
  ]);
  seedIfEmpty_(ss, SHEETS.LABOR_RATES, [
    ['default', '2026-01-01', 50, now, 'a.uryu@kunomura.com', 'Seed data']
  ]);
  seedIfEmpty_(ss, SHEETS.PACKING_COSTS, [
    ['plastic-bag', '2026-01-01', 'Plastic Bag', 0.5, 50, now, 'a.uryu@kunomura.com', 'Seed data'],
    ['carton-box', '2026-01-01', 'Carton Box', 0, 8000, now, 'a.uryu@kunomura.com', 'Seed data'],
    ['paper-pallet', '2026-01-01', 'Paper Pallet', 350, 128000, now, 'a.uryu@kunomura.com', 'Seed data']
  ]);
  seedIfEmpty_(ss, SHEETS.TRANSPORTATION, [
    ['default', '2026-01-01', 0, 0, 384000, now, 'a.uryu@kunomura.com', 'Seed data']
  ]);
  seedIfEmpty_(ss, SHEETS.EXCHANGE_RATES, [
    ['default', '2026-01-01', 4.2, 0.028, now, 'a.uryu@kunomura.com', 'Initial seed rate — please verify/update']
  ]);
}

function seedIfEmpty_(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet.getLastRow() > 1 || rows.length === 0) return;
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
