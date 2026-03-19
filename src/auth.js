// ════════════════════════════════════════════════════════════
//  AUTH.JS — Login, session, permissions, staff management
//  Depends on: supabase.js (db, dbLogin, dbGetUserClinics, etc.)
//  Load order: supabase.js → auth.js → clinic.js → script.js
// ════════════════════════════════════════════════════════════

var AUTH_SESSION_KEY = 'rxvault_session';

// ─── Session state ────────────────────────────────────────
var currentUser     = null; // { id, name, email, role }
var currentRole     = null; // effective clinic role

// ════════════════════════════════════════════════════════════
//  SESSION
// ════════════════════════════════════════════════════════════
function saveSession(user, clinicRole) {
  currentUser = user;
  currentRole = clinicRole || null;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    user, clinicRole, savedAt: new Date().toISOString()
  }));
}

function loadSession() {
  try {
    var raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return false;
    var s = JSON.parse(raw);
    var ageHrs = (Date.now() - new Date(s.savedAt).getTime()) / 3600000;
    if (ageHrs > 12) { clearSession(); return false; }
    currentUser = s.user;
    currentRole = s.clinicRole || null;
    return true;
  } catch(e) { return false; }
}

function clearSession() {
  currentUser = null;
  currentRole = null;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function updateClinicRole(role) {
  currentRole = role || null;
  try {
    var raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      s.clinicRole = role;
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
    }
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ════════════════════════════════════════════════════════════
async function authLogin(email, password) {
  var result = await dbLogin(email, password);
  if (!result) return { success: false, error: 'Invalid email or password.' };
  if (!result.is_active) return { success: false, error: 'Account is inactive. Contact admin.' };
  saveSession(result, result.role === 'superadmin' ? 'superadmin' : null);
  return { success: true, user: result };
}

async function authLogout() {
  clearSession();
  localStorage.removeItem('pv_active_clinic');
  // Reload page — cleanest way to reset all state
  window.location.reload();
}

function isLoggedIn() { return currentUser !== null; }
function isSuperAdmin() { return currentUser && currentUser.role === 'superadmin'; }

// ════════════════════════════════════════════════════════════
//  PERMISSIONS
// ════════════════════════════════════════════════════════════
function getEffectiveRole() {
  if (!currentUser) return null;
  if (currentUser.role === 'superadmin') return 'superadmin';
  return currentRole || 'viewer';
}

function hasRole(roles) {
  var role = getEffectiveRole();
  return role && roles.indexOf(role) !== -1;
}

var can = {
  createClinic:       function(){ return hasRole(['superadmin']); },
  deleteClinic:       function(){ return hasRole(['superadmin']); },
  manageStaff:        function(){ return hasRole(['superadmin','admin']); },
  manageDoctors:      function(){ return hasRole(['superadmin','admin']); },
  addPrescription:    function(){ return hasRole(['superadmin','admin','doctor']); },
  editPrescription:   function(){ return hasRole(['superadmin','admin','doctor']); },
  deletePrescription: function(){ return hasRole(['superadmin','admin']); },
  registerPatient:    function(){ return hasRole(['superadmin','admin','doctor','receptionist']); },
  viewPrescriptions:  function(){ return hasRole(['superadmin','admin','doctor','receptionist','pharmacist','viewer']); },
  viewPharmacy:       function(){ return hasRole(['superadmin','admin','doctor','pharmacist']); },
  viewPatients:       function(){ return hasRole(['superadmin','admin','doctor','receptionist','pharmacist','viewer']); },
  exportData:         function(){ return hasRole(['superadmin','admin']); },
  viewAuditLog:       function(){ return hasRole(['superadmin','admin']); },
  accessAdminPanel:   function(){ return hasRole(['superadmin','admin']); },
};

// ════════════════════════════════════════════════════════════
//  LOGIN GATE UI
// ════════════════════════════════════════════════════════════
function showLoginGate() {
  var gate = document.getElementById('loginGate');
  if (gate) { gate.classList.add('open'); document.body.style.overflow = 'hidden'; }
  renderLoginForm();
}

function hideLoginGate() {
  var gate = document.getElementById('loginGate');
  if (gate) gate.classList.remove('open');
  document.body.style.overflow = '';
}

function renderLoginForm() {
  var body = document.getElementById('loginGateBody');
  if (!body) return;
  body.innerHTML =
    '<div class="login-logo">💊</div>' +
    '<div class="login-brand">Rx Vault</div>' +
    '<div class="login-sub">Medical Record Manager · Secure Sign In</div>' +
    '<div class="login-form">' +
      '<div class="field">' +
        '<label>Email</label>' +
        '<input type="email" id="loginEmail" placeholder="admin@rxvault.in" autocomplete="email"' +
          ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'loginPassword\').focus()">' +
      '</div>' +
      '<div class="field" style="margin-top:12px">' +
        '<label>Password</label>' +
        '<div style="position:relative">' +
          '<input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password"' +
            ' onkeydown="if(event.key===\'Enter\')submitLogin()">' +
          '<button type="button" onclick="togglePasswordVisibility()" class="login-pwd-toggle" title="Show/hide">👁</button>' +
        '</div>' +
      '</div>' +
      '<div id="loginError" class="login-error"></div>' +
      '<button class="login-btn" id="loginBtn" onclick="submitLogin()">🔓 Sign In</button>' +
    '</div>' +
    '<div class="login-footer">Rx Vault · Secure Medical Records</div>';
  setTimeout(function(){ document.getElementById('loginEmail')?.focus(); }, 100);
}

function togglePasswordVisibility() {
  var inp = document.getElementById('loginPassword');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function submitLogin() {
  var email    = (document.getElementById('loginEmail')?.value    || '').trim();
  var password = (document.getElementById('loginPassword')?.value || '');
  var errEl    = document.getElementById('loginError');
  var btn      = document.getElementById('loginBtn');

  if (!email || !password) {
    if (errEl) errEl.textContent = 'Please enter email and password.';
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Signing in…'; }
  if (errEl) errEl.textContent = '';

  var result = await authLogin(email, password);

  if (btn) { btn.disabled = false; btn.textContent = '🔓 Sign In'; }

  if (!result.success) {
    if (errEl) errEl.textContent = result.error;
    return;
  }

  hideLoginGate();
  // clinic.js initClinicGate will handle the rest via boot
  if (typeof initClinicGate === 'function') {
    var gateShown = await initClinicGate();
    if (!gateShown && typeof initAppForClinic === 'function') {
      await initAppForClinic();
    }
  }
}

// ════════════════════════════════════════════════════════════
//  INIT AUTH — called by boot
// ════════════════════════════════════════════════════════════
async function initAuth() {
  if (loadSession() && currentUser) {
    return true; // session restored
  }
  showLoginGate();
  return false;
}

// ════════════════════════════════════════════════════════════
//  USER MENU
// ════════════════════════════════════════════════════════════
function toggleUserMenu(e) {
  if (e) e.stopPropagation();
  var dd = document.getElementById('userDropdown');
  if (!dd) return;
  var isOpen = dd.classList.toggle('open');
  if (isOpen) {
    // Show/hide permission-gated items
    dd.querySelectorAll('[data-perm]').forEach(function(el) {
      var perm = el.dataset.perm;
      var allowed = (typeof can !== 'undefined' && can[perm]) ? can[perm]() : true;
      el.style.display = allowed ? '' : 'none';
    });
    // Close on next outside click
    setTimeout(function() {
      document.addEventListener('click', function closeDd(ev) {
        var btn = document.getElementById('topbarUserBtn');
        if (btn && btn.contains(ev.target)) return;
        dd.classList.remove('open');
        document.removeEventListener('click', closeDd);
      });
    }, 0);
  }
}

// ════════════════════════════════════════════════════════════
//  STAFF MANAGEMENT
// ════════════════════════════════════════════════════════════
function openStaffModal() {
  if (!can.manageStaff()) { showToast('Access denied.', 'error'); return; }
  var subtitle = document.getElementById('staffModalSubtitle');
  var clinic = typeof getActiveClinic === 'function' ? getActiveClinic() : null;
  if (subtitle && clinic) subtitle.textContent = clinic.name + ' — Staff Management';
  openModal('staffModal');
  showStaffTab('list');
  loadStaffList();
}

function showStaffTab(tab) {
  ['list','add','audit'].forEach(function(t) {
    var btn = document.getElementById('tabStaff' + capitalize(t));
    var pnl = document.getElementById('staffTab'  + capitalize(t));
    if (btn) btn.classList.toggle('active', t === tab);
    if (pnl) pnl.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'audit') loadAuditLog();
}

async function loadStaffList() {
  var container = document.getElementById('staffListContent');
  if (!container) return;
  container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Loading staff…</div>';

  var staffData = await dbGetClinicStaff(activeClinicId);

  if (!staffData || !staffData.length) {
    container.innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--text-muted)">' +
        'No staff added yet.<br>Use the <strong>Add Staff</strong> tab to add someone.' +
      '</div>';
    return;
  }

  var roleIcon = { admin:'🔐', doctor:'🩺', receptionist:'🧑‍💼', pharmacist:'💊', viewer:'👁️' };
  var roleBg   = { admin:'var(--red-bg)', doctor:'var(--allopathy-bg)', receptionist:'var(--teal-pale)', pharmacist:'var(--homeopathy-bg)', viewer:'var(--bg)' };
  var roleClr  = { admin:'var(--red)', doctor:'var(--allopathy)', receptionist:'var(--teal)', pharmacist:'var(--homeopathy)', viewer:'var(--text-muted)' };

  container.innerHTML = staffData.map(function(s) {
    var lastLogin = s.last_login
      ? new Date(s.last_login).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
      : 'Never';
    var isMe = currentUser && s.user_id === currentUser.id;
    var uid  = s.user_id;
    var uname = escHtml(s.name);
    return (
      '<div class="admin-doctor-row">' +
        '<div class="admin-dr-info">' +
          '<div class="admin-dr-name">' +
            uname +
            (isMe ? ' <span class="staff-you-badge">You</span>' : '') +
            ' <span style="background:'+(roleBg[s.role]||'var(--bg)')+';color:'+(roleClr[s.role]||'var(--text-muted)')+';font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600">' +
              (roleIcon[s.role]||'') + ' ' + capitalize(s.role) +
            '</span>' +
            (!s.is_active ? '<span style="background:var(--red-bg);color:var(--red);font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;margin-left:4px">Inactive</span>' : '') +
          '</div>' +
          '<div class="admin-dr-sub">' + escHtml(s.email) + ' &nbsp;·&nbsp; Last login: ' + lastLogin + '</div>' +
        '</div>' +
        '<div class="admin-dr-actions">' +
          '<select onchange="changeStaffRole(this.dataset.uid, this.value)" data-uid="' + uid + '"' +
            (isMe ? ' disabled' : '') +
            ' style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">' +
            ['admin','doctor','receptionist','pharmacist','viewer'].map(function(r) {
              return '<option value="'+r+'"'+(r===s.role?' selected':'')+'>'+capitalize(r)+'</option>';
            }).join('') +
          '</select>' +
          '<button class="btn-sm '+(s.is_active?'btn-outline-red':'btn-outline-teal')+'"' +
            ' data-uid="'+uid+'" data-active="'+(s.is_active?'false':'true')+'"' +
            ' onclick="toggleStaffActive(this.dataset.uid, this.dataset.active===\'true\')"' +
            (isMe ? ' disabled' : '') + '>' +
            (s.is_active ? '🔴 Deactivate' : '🟢 Activate') +
          '</button>' +
          '<button class="btn-sm btn-outline-teal" data-uid="'+uid+'" data-name="'+uname+'"' +
            ' onclick="resetStaffPassword(this.dataset.uid, this.dataset.name)">🔑 Reset</button>' +
          '<button class="btn-sm btn-outline-red" data-uid="'+uid+'" data-name="'+uname+'"' +
            ' onclick="removeStaffMember(this.dataset.uid, this.dataset.name)"' +
            (isMe ? ' disabled' : '') + '>🗑️</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

async function addStaffMember() {
  var name     = (document.getElementById('staffName')?.value    || '').trim();
  var email    = (document.getElementById('staffEmail')?.value   || '').trim();
  var password = (document.getElementById('staffPassword')?.value|| '');
  var role     = document.getElementById('staffRole')?.value     || 'doctor';
  var errEl    = document.getElementById('staffAddError');
  if (errEl) errEl.textContent = '';

  if (!name)            { if(errEl) errEl.textContent='Name is required.';                    return; }
  if (!email)           { if(errEl) errEl.textContent='Email is required.';                   return; }
  if (password.length < 8) { if(errEl) errEl.textContent='Password must be at least 8 characters.'; return; }
  if (!/[A-Z]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one uppercase letter.'; return; }
  if (!/[0-9]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one number.'; return; }
  if (!/[a-z]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one lowercase letter.'; return; }

  var btn = document.querySelector('#staffTabAdd .btn-teal');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating…'; }

  var result = await dbCreateStaffUser(name, email, password, role, activeClinicId, currentUser.id);

  if (btn) { btn.disabled = false; btn.textContent = '✅ Create Account & Add to Clinic'; }

  if (!result.success) {
    if (errEl) errEl.textContent = result.error || 'Failed to create account.';
    return;
  }

  if (typeof dbAudit === 'function') dbAudit('create', 'clinic_staff', result.userId, null, { name, email, role });

  showToast('✅ ' + name + ' added as ' + capitalize(role), 'success');
  document.getElementById('staffName').value    = '';
  document.getElementById('staffEmail').value   = '';
  document.getElementById('staffPassword').value = '';
  showStaffTab('list');
  loadStaffList();
}

async function changeStaffRole(userId, newRole) {
  var ok = await dbUpdateStaffRole(activeClinicId, userId, newRole);
  if (ok) showToast('Role updated to ' + capitalize(newRole), 'success');
  else    showToast('Failed to update role.', 'error');
  loadStaffList();
}

async function toggleStaffActive(userId, makeActive) {
  var ok = await dbToggleStaffActive(activeClinicId, userId, makeActive);
  if (ok) showToast(makeActive ? 'Staff activated.' : 'Staff deactivated.', 'success');
  else    showToast('Failed to update status.', 'error');
  loadStaffList();
}

async function resetStaffPassword(userId, name) {
  var newPass = prompt('Enter new password for ' + name + '\n(min 8 chars, must include uppercase + number):');
  if (!newPass || newPass.length < 8)  { showToast('Password too short — minimum 8 characters.', 'error'); return; }
  if (!/[A-Z]/.test(newPass)) { showToast('Password must contain at least one uppercase letter.', 'error'); return; }
  if (!/[0-9]/.test(newPass)) { showToast('Password must contain at least one number.', 'error'); return; }
  var ok = await dbAdminResetPassword(userId, newPass);
  if (ok) showToast('Password reset for ' + name, 'success');
  else    showToast('Failed to reset password.', 'error');
}

async function removeStaffMember(userId, name) {
  if (!confirm('Remove ' + name + ' from this clinic?')) return;
  var ok = await dbRemoveStaff(activeClinicId, userId);
  if (ok) { showToast(name + ' removed from clinic.', 'info'); loadStaffList(); }
  else    showToast('Failed to remove staff member.', 'error');
}

// ─── Audit log ────────────────────────────────────────────
async function loadAuditLog() {
  var container = document.getElementById('auditLogContent');
  if (!container) return;
  container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading…</div>';
  try {
    var result = await db.from('audit_log').select('*').eq('clinic_id', activeClinicId)
      .order('created_at', { ascending: false }).limit(100);
    var data = result.data || [];
    if (!data.length) {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No audit entries yet.</div>';
      return;
    }
    var actionClr = { create:'var(--green)', update:'var(--teal)', delete:'var(--red)', login:'var(--allopathy)', logout:'var(--text-muted)' };
    container.innerHTML = data.map(function(log) {
      var time = new Date(log.created_at).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
      var clr  = actionClr[log.action] || 'var(--text-muted)';
      return (
        '<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start">' +
          '<span style="background:'+clr+';color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;flex-shrink:0;margin-top:2px">'+log.action.toUpperCase()+'</span>' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600">'+(log.table_name||'')+(log.record_id?' #'+String(log.record_id).slice(-6):'')+'</div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+time+'</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)">Failed to load audit log.</div>';
  }
}

// ─── Change own password ──────────────────────────────────
function openChangePassword() {
  ['cpOldPass','cpNewPass','cpConfirmPass'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var errEl = document.getElementById('changePassError');
  if (errEl) errEl.textContent = '';
  var sub = document.getElementById('changePassSubtitle');
  if (sub && currentUser) sub.textContent = 'Signed in as ' + currentUser.name;
  openModal('changePassModal');
}

async function submitChangePassword() {
  var oldPass = document.getElementById('cpOldPass')?.value    || '';
  var newPass = document.getElementById('cpNewPass')?.value    || '';
  var confirm = document.getElementById('cpConfirmPass')?.value|| '';
  var errEl   = document.getElementById('changePassError');
  if (errEl) errEl.textContent = '';

  if (!oldPass)              { if(errEl) errEl.textContent='Enter current password.';       return; }
  if (newPass.length < 8)    { if(errEl) errEl.textContent='New password min 8 characters.';return; }
  if (!/[A-Z]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one uppercase letter.'; return; }
  if (!/[0-9]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one number.'; return; }
  if (!/[a-z]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one lowercase letter.'; return; }
  if (newPass !== confirm)   { if(errEl) errEl.textContent='Passwords do not match.';       return; }

  var btn = document.getElementById('cpSubmitBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Saving…'; }
  var ok = await dbChangePassword(currentUser.id, oldPass, newPass);
  if (btn) { btn.disabled=false; btn.textContent='🔒 Change Password'; }

  if (!ok) { if(errEl) errEl.textContent='Current password is incorrect.'; return; }
  closeModal('changePassModal');
  showToast('Password changed successfully.', 'success');
}
