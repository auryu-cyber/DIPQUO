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
  return { email: email, isAdmin: isAdminEmail_(email) };
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

function requireAdmin_() {
  var email = requireUser_();
  if (!isAdminEmail_(email)) {
    throw new Error('Admin access required.');
  }
  return email;
}
