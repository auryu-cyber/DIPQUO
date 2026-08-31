/** User Management — per-account view/edit permissions on each page, plus Super Admin
 *  (Admins sheet) grants. All mutations here are Super-Admin-only (requireAdmin_), which is
 *  also what gates the User Management page itself in the client. */

/** Every email worth showing in User Management: current Super Admins, anyone with an
 *  explicit Permissions row, and anyone who has ever logged in — so the owner can grant
 *  access proactively (by typing an email) or after the fact (once someone shows up here). */
function listUserPermissions() {
  requireAdmin_();
  var admins = listAdminEmails_();
  var permRows = getRows_(getSheet_(SHEETS.PERMISSIONS)).map(rowToPlain_);
  var permByEmail = {};
  permRows.forEach(function (r) { permByEmail[String(r.email).toLowerCase()] = r; });

  var allEmails = {};
  admins.forEach(function (e) { allEmails[e] = true; });
  permRows.forEach(function (r) { allEmails[String(r.email).toLowerCase()] = true; });
  getRows_(getSheet_(SHEETS.LOGIN_LOG)).forEach(function (r) {
    var e = String(r.user || '').toLowerCase().trim();
    if (e) allEmails[e] = true;
  });

  return Object.keys(allEmails).sort().map(function (email) {
    var p = permByEmail[email] || {};
    return {
      email: email,
      isAdmin: admins.indexOf(email) !== -1,
      quotes: p.quotes || '',
      masters: p.masters || '',
      customers: p.customers || '',
      logs: p.logs || ''
    };
  });
}

/** Adds an email to the Permissions sheet with all-default (blank) levels, so it shows up
 *  in User Management even before that person's first login. No-op if already present. */
function addUserByEmail(email) {
  var actor = requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = findRow_(SHEETS.PERMISSIONS, function (r) { return String(r.email).toLowerCase() === email; });
    if (!row) {
      appendRow_(SHEETS.PERMISSIONS, { email: email, quotes: '', masters: '', customers: '', logs: '', updatedAt: new Date().toISOString(), updatedBy: actor });
    }
  } finally {
    lock.releaseLock();
  }
}

function saveUserPermission(email, page, level) {
  var actor = requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  if (PERMISSION_PAGES.indexOf(page) === -1) throw new Error('Unknown page: ' + page);
  if (['', 'view', 'edit', 'none'].indexOf(level) === -1) throw new Error('Unknown level: ' + level);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = findRow_(SHEETS.PERMISSIONS, function (r) { return String(r.email).toLowerCase() === email; });
    var data = row ? shallowCopy_(row) : { email: email, quotes: '', masters: '', customers: '', logs: '' };
    data.email = email;
    data[page] = level;
    data.updatedAt = new Date().toISOString();
    data.updatedBy = actor;
    if (row) updateRow_(SHEETS.PERMISSIONS, row._rowIndex, data);
    else appendRow_(SHEETS.PERMISSIONS, data);
    appendActivityLog_(actor, 'edited', 'permission:' + email, 'Set ' + page + ' = ' + (level || '(default)') + ' for ' + email);
  } finally {
    lock.releaseLock();
  }
}

function setUserAdmin(email, isAdmin) {
  var actor = requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  if (!isAdmin && email === String(actor).toLowerCase()) {
    throw new Error('You cannot remove your own Super Admin access.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var row = findRow_(SHEETS.ADMINS, function (r) { return String(r.email).toLowerCase() === email; });
    if (isAdmin && !row) {
      appendRow_(SHEETS.ADMINS, { email: email });
    } else if (!isAdmin && row) {
      deleteRow_(SHEETS.ADMINS, row._rowIndex);
    }
    appendActivityLog_(actor, 'edited', 'admin:' + email, (isAdmin ? 'Granted' : 'Revoked') + ' Super Admin access');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Removes a user's explicit access: deletes their Permissions row and, if present, their
 * Admins row, reverting them to default access (quotes=edit, everything else=none). Note
 * this cannot erase someone from the User Management list entirely if they have a LoginLog
 * history — listUserPermissions() always includes anyone who has ever signed in, showing
 * them back with all-default settings. That is intentional: login history is an audit trail
 * and is never purged.
 */
function deleteUserPermissions(email) {
  var actor = requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  if (email === String(actor).toLowerCase()) {
    throw new Error('You cannot remove your own access.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var permRow = findRow_(SHEETS.PERMISSIONS, function (r) { return String(r.email).toLowerCase() === email; });
    if (permRow) deleteRow_(SHEETS.PERMISSIONS, permRow._rowIndex);
    var adminRow = findRow_(SHEETS.ADMINS, function (r) { return String(r.email).toLowerCase() === email; });
    if (adminRow) deleteRow_(SHEETS.ADMINS, adminRow._rowIndex);
    appendActivityLog_(actor, 'edited', 'permission:' + email, 'Removed user — reverted to default access');
  } finally {
    lock.releaseLock();
  }
}
