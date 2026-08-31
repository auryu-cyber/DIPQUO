/**
 * Identity comes from Session.getActiveUser(), which Google itself only populates once the
 * signed-in user has passed the web app's deployment access check — with this app deployed
 * as "Anyone within [your domain]", that check IS the domain restriction, so there is no
 * separate hd-claim check to write (unlike the Next.js/NextAuth version).
 */

function getCurrentUserInfo() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('Could not determine your Google account email. Make sure the app is deployed with access limited to your Workspace domain, and that you are signed in with your work account.');
  }
  appendLoginLog_(email, 'success');
  return { email: email, isAdmin: isAdminEmail_(email), permissions: resolveAllPermissions_(email) };
}

function isAdminEmail_(email) {
  var admins = listAdminEmails_();
  return admins.indexOf(String(email).toLowerCase()) !== -1;
}

function listAdminEmails_() {
  return getRows_(getSheet_(SHEETS.ADMINS))
    .map(function (r) { return String(r.email || '').toLowerCase().trim(); })
    .filter(function (e) { return e; });
}

function requireUser_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('Not signed in.');
  return email;
}

/** Super Admins (the Admins sheet) always have full 'edit' access everywhere — this is the
 *  safety net that keeps whoever manages User Management from ever locking themselves out.
 *  Everyone else's access comes from the Permissions sheet, falling back to a per-page
 *  default when they have no row (or a blank cell) there. */
function requireAdmin_() {
  var email = requireUser_();
  if (!isAdminEmail_(email)) {
    throw new Error('Admin access required.');
  }
  return email;
}

var PERMISSION_RANK_ = { none: 0, view: 1, edit: 2 };
var PERMISSION_DEFAULT_ = { quotes: 'edit', masters: 'none', customers: 'none', logs: 'none' };

function resolvePermission_(email, page) {
  if (isAdminEmail_(email)) return 'edit';
  var row = findRow_(SHEETS.PERMISSIONS, function (r) { return String(r.email).toLowerCase() === String(email).toLowerCase(); });
  var val = row ? row[page] : '';
  if (val === 'edit' || val === 'view' || val === 'none') return val;
  return PERMISSION_DEFAULT_[page] || 'none';
}

function resolveAllPermissions_(email) {
  var out = {};
  PERMISSION_PAGES.forEach(function (page) { out[page] = resolvePermission_(email, page); });
  return out;
}

/** Throws unless the current user's permission for `page` is at least `minLevel`
 *  ('view' or 'edit'). Super Admins always pass. */
function requirePermission_(page, minLevel) {
  var email = requireUser_();
  var level = resolvePermission_(email, page);
  if (PERMISSION_RANK_[level] < PERMISSION_RANK_[minLevel]) {
    throw new Error('You do not have ' + minLevel + ' access to ' + page + '.');
  }
  return email;
}
