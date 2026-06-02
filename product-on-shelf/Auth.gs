/**
 * Product on Shelf — custom email + password auth, on top of the @scm Google sign-in gate.
 *
 * Model (Oran's choice):
 *   • Outer gate  : the deployment is domain-restricted, so only signed-in @scm Google users
 *                   reach the page. We use that Google email only to PREFILL the login form.
 *   • App login   : a custom email + PASSWORD checked against the `_RBAC` tab. A successful login
 *                   mints a session token (CacheService, ~6h) the browser keeps; every privileged
 *                   server call re-validates that token. (Execute-as-Me means the server can't trust
 *                   the Google session for the caller's role — the token is the real identity.)
 *   • Register    : Name + Email + Password + Job position → a row with role 'pending'. No access
 *                   until an admin approves and assigns a real role (admin/editor/sales/viewer).
 *
 * Passwords are NEVER stored in clear: the `password` column holds `salt$sha256(salt$password)`.
 * `_RBAC` columns: email · role · position · name · active · password (detected by header name).
 *
 * DEPLOYMENT CONTRACT (Deploy > Manage deployments):
 *   • Execute as:     Me — server keeps owner rights to read/write the DB sheet.
 *   • Who has access: Anyone at scmtechnologies.co.th — the outer Google gate.
 * BOOTSTRAP (run once in the editor): setupRoles(); setAdminPassword('your-password');
 */
var ROLES_SHEET   = '_RBAC';
var PENDING_ROLE  = 'pending';        // registered, awaiting admin approval — no login until a real role is set
var ADMIN_EMAIL   = 'oran.nin@scmtechnologies.co.th';
var SESSION_TTL_S = 21600;            // session lifetime in seconds (CacheService max = 6h)
var MIN_PASSWORD  = 6;
var OTP_TTL_S     = 600;              // password-reset code lifetime (10 min)
var OTP_MAX_TRIES = 5;                // wrong-code attempts before a code is burned

// ===========================================================================
// Google identity (outer gate) — used ONLY to prefill the login email
// ===========================================================================

/** The signed-in Google email, for prefilling the login form. { email }. */
function getUserContext() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) {}
  return { email: email };
}

/** JSON for the window.USER bootstrap (Code.gs sets USER_JSON; build.py injects it). Never throws. */
function userContextJson_() {
  try { return JSON.stringify(getUserContext()).replace(/</g, '\\u003c'); }
  catch (e) { return JSON.stringify({ email: '' }); }
}

// ===========================================================================
// Passwords (hash + verify) and sessions (token in CacheService)
// ===========================================================================

function hashPw_(pw, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '$' + String(pw), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) { var b = (bytes[i] + 256) % 256; hex += (b < 16 ? '0' : '') + b.toString(16); }
  return hex;
}
/** Build the stored value `salt$hash` for a new/changed password. */
function passwordRecord_(pw) { var salt = Utilities.getUuid(); return salt + '$' + hashPw_(pw, salt); }
/** True if a stored value is our hashed format `<uuid>$<sha256-hex>` (vs a plaintext password). */
function isHashed_(stored) { return /^[0-9a-fA-F-]{36}\$[0-9a-f]{64}$/.test(String(stored || '')); }
/**
 * Check a candidate password against the stored value. Stored is normally `salt$hash`, but we also
 * accept a PLAINTEXT password typed straight into the sheet (so manual edits work) — login() then
 * upgrades it to a hash on first success. Returns true on match.
 */
function verifyPw_(pw, stored) {
  stored = String(stored || '');
  if (!stored) return false;
  if (isHashed_(stored)) {
    var i = stored.indexOf('$');
    return hashPw_(pw, stored.slice(0, i)) === stored.slice(i + 1);
  }
  return String(pw) === stored;            // plaintext set directly in the sheet
}

function newSession_(email) {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, email, SESSION_TTL_S);
  return token;
}
/** Resolve a session token to a FRESH user context (re-reads _RBAC so role/active changes take effect). */
function validateSession(token) {
  if (!token) return null;
  var email = CacheService.getScriptCache().get('sess_' + String(token));
  if (!email) return null;
  var u = lookupUser_(email);                          // null if removed/deactivated
  if (!u || !u.role || u.role === PENDING_ROLE) return null;
  return { email: email, role: u.role, name: u.name, position: u.position };
}
function logout(token) { if (token) CacheService.getScriptCache().remove('sess_' + String(token)); return { ok: true }; }

// ===========================================================================
// Login + register (client-callable)
// ===========================================================================

/** Email + password login. Returns { status:'ok', token, user } | { status:'pending' } or throws. */
function login(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!email || !password) throw new Error('Enter your email and password.');
  var row = readRbacRow_(email);
  if (!row) throw new Error('No account found for that email. Use Register to request one.');
  if (row.active === false) throw new Error('Your account is disabled. Contact an admin.');
  if (!verifyPw_(password, row.password)) throw new Error('Incorrect email or password.');
  if (!isHashed_(row.password)) {                       // upgrade a plaintext sheet password to a hash
    try { upsertRow_(email, { password: passwordRecord_(password) }); } catch (e) {}
  }
  if (!row.role || row.role === PENDING_ROLE) return { status: 'pending', email: email };
  return { status: 'ok', token: newSession_(email), user: { email: email, role: row.role, name: row.name, position: row.position } };
}

/**
 * Self-registration: Name + Email + Password + Job position → a row with role 'pending'.
 * Role is NOT chosen here — an admin assigns it on approval. Returns { ok, status:'pending', email }.
 */
function registerSelf(rec) {
  rec = rec || {};
  var name     = String(rec.name || '').trim();
  var email    = String(rec.email || '').trim().toLowerCase();
  var password = String(rec.password || '');
  var position = String(rec.position || '').trim();
  if (!name) throw new Error('Please enter your name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email.');
  if (password.length < MIN_PASSWORD) throw new Error('Password must be at least ' + MIN_PASSWORD + ' characters.');
  if (!position) throw new Error('Please enter your job position.');

  var existing = readRbacRow_(email);
  if (existing && existing.role && existing.role !== PENDING_ROLE) {
    throw new Error('An account with that email already exists — try logging in.');
  }
  upsertRow_(email, { role: PENDING_ROLE, name: name, position: position, active: true, password: passwordRecord_(password) });
  return { ok: true, status: 'pending', email: email };
}

// ===========================================================================
// Forgot password — email a one-time code, then reset (client-callable)
// ===========================================================================

/** Email a 6-digit reset code to a known account. Returns { ok:true }. Requires the send_mail scope. */
function requestPasswordReset(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
  var row = readRbacRow_(email);
  if (!row) throw new Error('No account found for that email.');
  if (row.active === false) throw new Error('That account is disabled. Contact an admin.');

  var code = String(Math.floor(100000 + Math.random() * 900000));           // 6 digits
  CacheService.getScriptCache().put('otp_' + email, JSON.stringify({ code: code, tries: 0 }), OTP_TTL_S);
  MailApp.sendEmail({
    to: email,
    subject: 'Product on Shelf — your password reset code',
    body: 'Your password reset code is: ' + code + '\n\n'
        + 'Enter it in the app to set a new password. The code expires in 10 minutes.\n'
        + 'If you did not request this, you can ignore this email.\n\n— Product on Shelf'
  });
  return { ok: true };
}

/** Verify the emailed code and set a new password. Returns { ok:true } or throws. */
function resetPassword(email, code, newPassword) {
  email = String(email || '').trim().toLowerCase();
  code = String(code || '').trim();
  newPassword = String(newPassword || '');
  if (!email || !code) throw new Error('Enter the code from your email.');
  if (newPassword.length < MIN_PASSWORD) throw new Error('Password must be at least ' + MIN_PASSWORD + ' characters.');

  var cache = CacheService.getScriptCache();
  var raw = cache.get('otp_' + email);
  if (!raw) throw new Error('Your code has expired — request a new one.');
  var rec = JSON.parse(raw);
  if ((rec.tries || 0) >= OTP_MAX_TRIES) { cache.remove('otp_' + email); throw new Error('Too many attempts — request a new code.'); }
  if (String(rec.code) !== code) {
    rec.tries = (rec.tries || 0) + 1;
    cache.put('otp_' + email, JSON.stringify(rec), OTP_TTL_S);
    throw new Error('Incorrect code.');
  }
  if (!readRbacRow_(email)) throw new Error('No account found for that email.');
  upsertRow_(email, { password: passwordRecord_(newPassword) });
  cache.remove('otp_' + email);
  return { ok: true };
}

// ===========================================================================
// _RBAC read/write helpers
// ===========================================================================

/** Locate the email/role/name/position/active/password columns by header name (tolerant). */
function rbacCols_(headerRow) {
  var h = (headerRow || []).map(function (x) { return String(x).trim().toLowerCase(); });
  function find(test) { for (var i = 0; i < h.length; i++) if (test(h[i])) return i; return -1; }
  return {
    email:    find(function (s) { return s === 'email' || s === 'e-mail' || s === 'mail' || s === 'user' || s.indexOf('email') >= 0; }),
    role:     find(function (s) { return s === 'role' || s.indexOf('role') >= 0 || s.indexOf('access') >= 0 || s.indexOf('permission') >= 0 || s.indexOf('level') >= 0; }),
    position: find(function (s) { return s === 'position' || s.indexOf('position') >= 0 || s.indexOf('title') >= 0 || s === 'job' || s.indexOf('job title') >= 0; }),
    name:     find(function (s) { return s === 'name' || (s.indexOf('name') >= 0 && s.indexOf('position') < 0 && s.indexOf('user') < 0); }),
    active:   find(function (s) { return s === 'active' || s.indexOf('active') >= 0 || s.indexOf('enabled') >= 0 || s.indexOf('status') >= 0; }),
    password: find(function (s) { return s === 'password' || s.indexOf('password') >= 0 || s === 'pass' || s === 'pwd' || s.indexOf('secret') >= 0; })
  };
}

/** Full row for an email (incl. password + active, regardless of active). null if absent. */
function readRbacRow_(email) {
  var sh;
  try { sh = db_().getSheetByName(ROLES_SHEET); } catch (e) { return null; }
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0) return null;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() !== email) continue;
    return {
      role:     c.role     >= 0 ? String(data[r][c.role] || '').trim().toLowerCase() : '',
      name:     c.name     >= 0 ? String(data[r][c.name] || '').trim() : '',
      position: c.position >= 0 ? String(data[r][c.position] || '').trim() : '',
      active:   c.active   >= 0 ? (String(data[r][c.active]).toUpperCase() !== 'FALSE') : true,
      password: c.password >= 0 ? String(data[r][c.password] || '') : ''
    };
  }
  return null;
}

/** Active user (role/name/position) for an email; null if absent or deactivated. */
function lookupUser_(email) {
  var row = readRbacRow_(email);
  if (!row || row.active === false) return null;
  return { role: row.role, name: row.name, position: row.position };
}

function rbacSheet_() {
  var sh = db_().getSheetByName(ROLES_SHEET);
  if (!sh) throw new Error('No "' + ROLES_SHEET + '" tab in the DB sheet — run setupRoles() first.');
  return sh;
}

/** Ensure a named column exists; returns its 0-based index. (Mutates the sheet header if added.) */
function ensureCol_(sh, name) {
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0])[name];
  if (c >= 0) return c;
  var idx = data[0].length;
  sh.getRange(1, idx + 1).setValue(name);
  return idx;
}

/**
 * Insert or update a user row by email. `fields` may include role, name, position, active, password
 * (password already as a `salt$hash` record). Only provided fields are written. Used by register +
 * admin save + setAdminPassword — the single write point.
 */
function upsertRow_(email, fields) {
  email = String(email || '').trim().toLowerCase();
  var sh = db_().getSheetByName(ROLES_SHEET);
  if (!sh) { sh = db_().insertSheet(ROLES_SHEET); sh.getRange(1, 1, 1, 6).setValues([['email', 'role', 'position', 'name', 'active', 'password']]); sh.setFrozenRows(1); }
  // Make sure every column we're about to write exists.
  var need = ['email', 'role'];
  if (fields.position != null) need.push('position');
  if (fields.name     != null) need.push('name');
  if (fields.active   != null) need.push('active');
  if (fields.password != null) need.push('password');
  need.forEach(function (n) { ensureCol_(sh, n); });

  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() === email) {           // update in place
      if (fields.role     != null && c.role     >= 0) sh.getRange(r + 1, c.role + 1).setValue(String(fields.role));
      if (fields.position != null && c.position >= 0) sh.getRange(r + 1, c.position + 1).setValue(String(fields.position));
      if (fields.name     != null && c.name     >= 0) sh.getRange(r + 1, c.name + 1).setValue(String(fields.name));
      if (fields.active   != null && c.active   >= 0) sh.getRange(r + 1, c.active + 1).setValue(fields.active === false ? false : true);
      if (fields.password != null && c.password >= 0) sh.getRange(r + 1, c.password + 1).setValue(String(fields.password));
      return;
    }
  }
  var row = new Array(data[0].length).fill('');                                     // append new
  row[c.email] = email;
  if (c.role     >= 0) row[c.role]     = String(fields.role || PENDING_ROLE);
  if (c.position >= 0) row[c.position] = String(fields.position || '');
  if (c.name     >= 0) row[c.name]     = String(fields.name || '');
  if (c.active   >= 0) row[c.active]   = fields.active === false ? false : true;
  if (c.password >= 0) row[c.password] = String(fields.password || '');
  sh.appendRow(row);
}

// ===========================================================================
// Admin Users & Roles editor — every entry guarded by a valid ADMIN session token
// ===========================================================================

/** Throws unless `token` is a valid admin session. Returns the admin's context. */
function requireAdmin_(token) {
  var u = validateSession(token);
  if (!u || u.role !== 'admin') throw new Error('Not authorized — admin login required.');
  return u;
}

/** Admin: list users. Returns normalized rows (no password values, just hasPassword). */
function rbacList(token) {
  requireAdmin_(token);
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
      email:       email,
      role:        String(data[r][c.role] || '').trim(),
      position:    c.position >= 0 ? String(data[r][c.position] || '').trim() : '',
      name:        c.name     >= 0 ? String(data[r][c.name] || '').trim() : '',
      active:      c.active   >= 0 ? (String(data[r][c.active]).toUpperCase() !== 'FALSE') : true,
      hasPassword: c.password >= 0 ? !!String(data[r][c.password] || '').trim() : false
    });
  }
  return { ok: true, users: users, hasPosition: c.position >= 0, hasName: c.name >= 0, hasActive: c.active >= 0, hasPassword: c.password >= 0 };
}

/** Admin: add/update a user. rec = { email, role, position?, name?, active?, password? }. */
function rbacSave(token, rec) {
  requireAdmin_(token);
  rec = rec || {};
  var email = String(rec.email || '').trim().toLowerCase();
  var role  = String(rec.role || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email.');
  if (!role) throw new Error('Pick a role.');
  var fields = { role: role };
  if (rec.position != null) fields.position = String(rec.position);
  if (rec.name     != null) fields.name     = String(rec.name);
  if (rec.active   != null) fields.active   = rec.active !== false;
  var pw = String(rec.password || '');
  if (pw) { if (pw.length < MIN_PASSWORD) throw new Error('Password must be at least ' + MIN_PASSWORD + ' characters.'); fields.password = passwordRecord_(pw); }
  upsertRow_(email, fields);
  return rbacList(token);
}

/** Admin: remove a user. Cannot remove your own account (avoids self-lockout). */
function rbacRemove(token, email) {
  var ctx = requireAdmin_(token);
  email = String(email || '').trim().toLowerCase();
  if (email === ctx.email) throw new Error('You cannot remove your own admin account.');
  var sh = rbacSheet_();
  var data = sh.getDataRange().getValues();
  var c = rbacCols_(data[0]);
  if (c.email < 0) throw new Error('No email column in "' + ROLES_SHEET + '".');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][c.email] || '').trim().toLowerCase() === email) { sh.deleteRow(r + 1); return rbacList(token); }
  }
  throw new Error('Email not found: ' + email);
}

// ===========================================================================
// One-time editor bootstrap
// ===========================================================================

/** Ensure the `_RBAC` tab exists with the full header and the admin row (no password yet). */
function setupRoles() {
  var ss = db_();
  var sh = ss.getSheetByName(ROLES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ROLES_SHEET);
    sh.getRange(1, 1, 1, 6).setValues([['email', 'role', 'position', 'name', 'active', 'password']]);
    sh.setFrozenRows(1); sh.setColumnWidth(1, 280);
  }
  ['email', 'role', 'position', 'name', 'active', 'password'].forEach(function (n) { ensureCol_(sh, n); });
  if (!readRbacRow_(ADMIN_EMAIL.toLowerCase())) {
    upsertRow_(ADMIN_EMAIL, { role: 'admin', position: 'Presale / Solution Architect', name: 'Oran Ninhun', active: true });
    Logger.log('Seeded admin row: ' + ADMIN_EMAIL + ' — now run setAdminPassword(\'your-password\').');
  } else {
    upsertRow_(ADMIN_EMAIL, { role: 'admin', active: true });
    Logger.log('Confirmed admin: ' + ADMIN_EMAIL + '. Set/confirm the password with setAdminPassword(\'your-password\').');
  }
}

/** One-time (editor): set the admin's login password. Run after setupRoles(). */
function setAdminPassword(pw) {
  pw = String(pw || '');
  if (pw.length < MIN_PASSWORD) { Logger.log('Password must be at least ' + MIN_PASSWORD + ' characters.'); return; }
  upsertRow_(ADMIN_EMAIL, { role: 'admin', active: true, password: passwordRecord_(pw) });
  Logger.log('Admin password set for ' + ADMIN_EMAIL + '. Log in at the app with that email + password.');
}
