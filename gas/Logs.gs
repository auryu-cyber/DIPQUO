/** Activity/login history — append-only sheets, admin-only to read. */

function appendActivityLog_(user, action, target, detail) {
  appendRow_(SHEETS.ACTIVITY_LOG, { at: new Date().toISOString(), user: user, action: action, target: target, detail: detail || '' });
}

function appendLoginLog_(user, result) {
  appendRow_(SHEETS.LOGIN_LOG, { at: new Date().toISOString(), user: user, result: result });
}

function listActivityLog() {
  requirePermission_('logs', 'view');
  var rows = getRows_(getSheet_(SHEETS.ACTIVITY_LOG)).map(rowToPlain_);
  rows.reverse();
  return rows;
}

function listLoginLog() {
  requirePermission_('logs', 'view');
  var rows = getRows_(getSheet_(SHEETS.LOGIN_LOG)).map(rowToPlain_);
  rows.reverse();
  return rows;
}
