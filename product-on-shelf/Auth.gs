/**
 * Product on Shelf — RBAC (email login + role) and the admin Users & Roles editor.
 *
 * Identity is the signed-in Google user (Session.getActiveUser); the role comes from the `_RBAC`
 * tab in the DB sheet (email -> role). doGet injects window.USER = { email, role } the same way
 * window.PRICING is injected (Code.gs + build.py); src/flows/_rbac.html gates the UI by role.
 *
 * The admin "Users & Roles" view (src/panels/admin.html + src/flows/_admin.html) calls the
 * rbac*() functions below via google.script.run to manage the `_RBAC` tab from the web. Every
 * write is guarded server-side by requireAdmin_() — client gating is cosmetic, so the role check
 * MUST live here (this is the real enforcement point for writes).
 *
 * DEPLOYMENT CONTRACT (owner sets in Deploy > Manage deployments):
 *   • Execute as:     Me — server keeps the owner's rights to read/write the DB sheet.
 *   • Who has access: Anyone at scmtechnologies.co.th — so Google signs users in and
 *                     Session.getActiveUser().getEmail() returns their verified @scm email.
 *
 * Schema-flexible: the email/role/name/active columns are found by header NAME (rbacCols_), so it
 * adapts to however the `_RBAC` tab is laid out, as long as it has an email-ish and role-ish column.
 */
var ROLES_SHEET  = '_RBAC';
var DEFAULT_ROLE = 'viewer';   // signed-in domain user not (yet) listed in _RBAC — can use the estimator
var ADMIN_EMAIL  = 'oran.nin@scmtechnologies.co.th';

// ---------------------------------------------------------------------------
// Identity + role (read path: injected into window.USER)
// ---------------------------------------------------------------------------

/** Identity + role for the current request. { email, role }. role 'anonymous' = couldn't identify. */
function getUserContext() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) {}
  if (!email) return { email: '', role: 'anonymous' };
  return { email: email, role: lookupRole_(email) || DEFAULT_ROLE };
}

/** JSON for the bootstrap <script> (Code.gs sets USER_JSON). Never throws → blank/anonymous on error. */
function userContextJson_() {
  try { return JSON.stringify(getUserContext()).replace(/</g, '\\u003c'); }
  catch (e) { return JSON.stringify({ email: '', role: 'anonymous' }); }
}

/** email -> role from the _RBAC tab (active rows only). '' if absent/inactive. */
function lookupRole_(email) {
  var sh;
  try { sh = db_().getSheetByName(ROLES_SHEET); } catch (e) { return ''; }
  if (!sh || sh.getLastRow() < 2) return '';
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0 || c.role < 0) return '';
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() !== email) continue;
    if (c.active >= 0 && String(data[r][c.active]).toUpperCase() === 'FALSE') return '';  // deactivated
    return String(data[r][c.role] || '').trim().toLowerCase();
  }
  return '';
}

/** Locate the email / role / name / active columns by header name (case-insensitive, tolerant). */
function rbacCols_(headerRow) {
  var h = (headerRow || []).map(function (x) { return String(x).trim().toLowerCase(); });
  function find(test) { for (var i = 0; i < h.length; i++) if (test(h[i])) return i; return -1; }
  return {
    email:    find(function (s) { return s === 'email' || s === 'e-mail' || s === 'mail' || s === 'user' || s.indexOf('email') >= 0; }),
    role:     find(function (s) { return s === 'role' || s.indexOf('role') >= 0 || s.indexOf('access') >= 0 || s.indexOf('permission') >= 0 || s.indexOf('level') >= 0; }),
    // Job position / title — kept separate from the access `role` (e.g. "Presale / Solution Architect").
    position: find(function (s) { return s === 'position' || s.indexOf('position') >= 0 || s.indexOf('title') >= 0 || s === 'job' || s.indexOf('job title') >= 0; }),
    name:     find(function (s) { return s === 'name' || (s.indexOf('name') >= 0 && s.indexOf('position') < 0); }),
    active:   find(function (s) { return s === 'active' || s.indexOf('active') >= 0 || s.indexOf('enabled') >= 0 || s.indexOf('status') >= 0; })
  };
}

// ---------------------------------------------------------------------------
// Admin Users & Roles editor (write path) — every entry guarded by requireAdmin_()
// ---------------------------------------------------------------------------

/** Throws unless the caller is an admin. Returns the caller's context. The real write-side gate. */
function requireAdmin_() {
  var ctx = getUserContext();
  if (ctx.role !== 'admin') throw new Error('Not authorized — admin role required.');
  return ctx;
}

function rbacSheet_() {
  var sh = db_().getSheetByName(ROLES_SHEET);
  if (!sh) throw new Error('No "' + ROLES_SHEET + '" tab in the DB sheet — run setupRoles() first.');
  return sh;
}

/** Admin: list users as normalized {email, role, name, active} objects + the raw header row. */
function rbacList() {
  requireAdmin_();
  var sh = rbacSheet_();
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0] || []);
  if (c.email < 0 || c.role < 0) {
    return { ok: false, error: 'Could not find an email and a role column in "' + ROLES_SHEET + '".', headers: data[0] || [] };
  }
  var users = [];
  for (var r = 1; r < data.length; r++) {
    var email = String(data[r][c.email] || '').trim();
    if (!email) continue;
    users.push({
      email:    email,
      role:     String(data[r][c.role] || '').trim(),
      position: c.position >= 0 ? String(data[r][c.position] || '').trim() : '',
      name:     c.name   >= 0 ? String(data[r][c.name]   || '').trim() : '',
      active:   c.active >= 0 ? (String(data[r][c.active]).toUpperCase() !== 'FALSE') : true
    });
  }
  return { ok: true, users: users, hasPosition: c.position >= 0, hasName: c.name >= 0, hasActive: c.active >= 0 };
}

/** Admin: add or update a user by email. Returns the refreshed rbacList(). */
function rbacSave(rec) {
  requireAdmin_();
  rec = rec || {};
  var email = String(rec.email || '').trim().toLowerCase();
  var role  = String(rec.role  || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
  if (!role) throw new Error('Pick a role.');

  var hasPos = rec.position != null && String(rec.position).trim() !== '';
  var sh = rbacSheet_();
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0 || c.role < 0) throw new Error('"' + ROLES_SHEET + '" needs an email and a role column.');

  // Auto-provision a `position` column the first time a job position is set and the tab has none.
  if (hasPos && c.position < 0) {
    c.position = data[0].length;
    sh.getRange(1, c.position + 1).setValue('position');
    data = sh.getDataRange().getValues();
    c = rbacCols_(data[0]);
  }

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() === email) {       // update in place
      sh.getRange(r + 1, c.role + 1).setValue(role);
      if (c.position >= 0 && rec.position != null) sh.getRange(r + 1, c.position + 1).setValue(String(rec.position));
      if (c.name     >= 0 && rec.name     != null) sh.getRange(r + 1, c.name + 1).setValue(String(rec.name));
      if (c.active   >= 0) sh.getRange(r + 1, c.active + 1).setValue(rec.active === false ? false : true);
      return rbacList();
    }
  }
  var row = new Array(data[0].length).fill('');                                 // append new
  row[c.email] = email; row[c.role] = role;
  if (c.position >= 0) row[c.position] = String(rec.position || '');
  if (c.name     >= 0) row[c.name]     = String(rec.name || '');
  if (c.active   >= 0) row[c.active]   = rec.active === false ? false : true;
  sh.appendRow(row);
  return rbacList();
}

/** Admin: remove a user by email. Cannot remove your own account (avoids self-lockout). */
function rbacRemove(email) {
  var ctx = requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (email === ctx.email) throw new Error('You cannot remove your own admin account.');
  var sh = rbacSheet_();
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0) throw new Error('No email column in "' + ROLES_SHEET + '".');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() === email) { sh.deleteRow(r + 1); return rbacList(); }
  }
  throw new Error('Email not found: ' + email);
}

/**
 * One-time setup (run from the editor): ensure the `_RBAC` tab exists and seed the admin.
 * Idempotent — safe to re-run; won't duplicate or clobber other rows. If you already created
 * `_RBAC` with your admin row, this just confirms it. Add more people via the web admin view.
 */
function setupRoles() {
  var ss = db_();
  var sh = ss.getSheetByName(ROLES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ROLES_SHEET);
    sh.getRange(1, 1, 1, 5).setValues([['email', 'role', 'position', 'name', 'active']]);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 280);
  }
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0 || c.role < 0) {
    Logger.log('"' + ROLES_SHEET + '" has no email/role column — add headers "email" and "role" first.');
    return;
  }
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      sh.getRange(r + 1, c.role + 1).setValue('admin');
      if (c.active >= 0) sh.getRange(r + 1, c.active + 1).setValue(true);
      Logger.log('Confirmed admin: ' + ADMIN_EMAIL);
      return;
    }
  }
  var row = new Array(data[0].length).fill('');
  row[c.email] = ADMIN_EMAIL; row[c.role] = 'admin';
  if (c.position >= 0) row[c.position] = 'Presale / Solution Architect';
  if (c.name     >= 0) row[c.name]     = 'Oran Ninhun';
  if (c.active   >= 0) row[c.active]   = true;
  sh.appendRow(row);
  Logger.log('Seeded admin: ' + ADMIN_EMAIL);
}
