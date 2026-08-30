/** Period-dated cost masters (materials/labor/packing/transportation/exchange rates) —
 *  each type is its own sheet; every row is one immutable-in-spirit dated record, matching
 *  the masters/{type}/{code}/{date}.json layout of the Next.js version's dipquo-data repo. */

var MASTER_SHEET_BY_TYPE = {
  'materials': SHEETS.MATERIALS,
  'labor-rates': SHEETS.LABOR_RATES,
  'packing-costs': SHEETS.PACKING_COSTS,
  'transportation': SHEETS.TRANSPORTATION,
  'exchange-rates': SHEETS.EXCHANGE_RATES
};

function masterSheetName_(type) {
  var name = MASTER_SHEET_BY_TYPE[type];
  if (!name) throw new Error('Unknown master type: ' + type);
  return name;
}

function listMasterCodes(type) {
  var rows = getRows_(getSheet_(masterSheetName_(type)));
  var seen = {};
  var codes = [];
  rows.forEach(function (r) {
    if (!seen[r.code]) { seen[r.code] = true; codes.push(r.code); }
  });
  return codes;
}

/** All dated records for one code, newest first. */
function listMasterHistory(type, code) {
  var rows = findRowsBySheetName_(masterSheetName_(type), function (r) { return r.code === code; });
  rows.sort(function (a, b) {
    if (a.effectiveFrom === b.effectiveFrom) return 0;
    return a.effectiveFrom < b.effectiveFrom ? 1 : -1;
  });
  return rows.map(rowToPlain_);
}

/** Everything the quote form needs to resolve any category as-of any date, in one round trip. */
function getQuoteFormMasters() {
  var materialCodes = listMasterCodes('materials');
  var packingCodes = listMasterCodes('packing-costs');
  return {
    materials: materialCodes.map(function (code) { return { code: code, history: listMasterHistory('materials', code) }; }),
    packingItems: packingCodes.map(function (code) { return { code: code, history: listMasterHistory('packing-costs', code) }; }),
    laborRateHistory: listMasterHistory('labor-rates', 'default'),
    transportationHistory: listMasterHistory('transportation', 'default'),
    exchangeRateHistory: listMasterHistory('exchange-rates', 'default')
  };
}

function addMasterRecord(type, code, data) {
  var email = requireAdmin_();
  code = String(code || '').trim();
  if (!code) throw new Error('Code is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) throw new Error('Effective From must be a YYYY-MM-DD date.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = shallowCopy_(data);
    row.code = code;
    row.recordedAt = new Date().toISOString();
    row.recordedBy = email;
    appendRow_(masterSheetName_(type), row);
    appendActivityLog_(email, 'edited', 'master:' + type + '/' + code, 'Added rate effective ' + data.effectiveFrom);
  } finally {
    lock.releaseLock();
  }
}

function updateMasterRecord(type, code, originalEffectiveFrom, data) {
  var email = requireAdmin_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom)) throw new Error('Effective From must be a YYYY-MM-DD date.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheetName = masterSheetName_(type);
    var row = findRow_(sheetName, function (r) { return r.code === code && String(r.effectiveFrom) === originalEffectiveFrom; });
    if (!row) throw new Error('Rate not found.');
    var updated = shallowCopy_(data);
    updated.code = code;
    updated.recordedAt = new Date().toISOString();
    updated.recordedBy = email;
    updateRow_(sheetName, row._rowIndex, updated);
    appendActivityLog_(email, 'edited', 'master:' + type + '/' + code, 'Updated rate ' + originalEffectiveFrom + ' → ' + data.effectiveFrom);
  } finally {
    lock.releaseLock();
  }
}

function deleteMasterRecord(type, code, effectiveFrom) {
  var email = requireAdmin_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheetName = masterSheetName_(type);
    var row = findRow_(sheetName, function (r) { return r.code === code && String(r.effectiveFrom) === effectiveFrom; });
    if (!row) return;
    deleteRow_(sheetName, row._rowIndex);
    appendActivityLog_(email, 'edited', 'master:' + type + '/' + code, 'Deleted rate effective ' + effectiveFrom);
  } finally {
    lock.releaseLock();
  }
}

function shallowCopy_(obj) {
  var copy = {};
  Object.keys(obj).forEach(function (k) { copy[k] = obj[k]; });
  return copy;
}
