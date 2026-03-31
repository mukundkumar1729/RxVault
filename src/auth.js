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
    updateStatusUI();
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
      '<button type="button" class="login-forgot-link" onclick="renderForgotForm()">🔑 Forgot Password?</button>' +
    '</div>' +
    '<div class="login-footer">Rx Vault · Secure Medical Records</div>';
  setTimeout(function(){ document.getElementById('loginEmail')?.focus(); }, 100);
}

function renderForgotForm() {
  var body = document.getElementById('loginGateBody');
  if (!body) return;
  body.innerHTML =
    '<div class="login-logo">🔑</div>' +
    '<div class="login-brand">Reset Password</div>' +
    '<div class="login-sub">Enter the reset token provided by your admin</div>' +
    '<div class="login-form">' +
      '<div class="field">' +
        '<label>Your Email</label>' +
        '<input type="email" id="fpEmail" placeholder="you@clinic.in" autocomplete="email"' +
          ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'fpToken\').focus()">' +
      '</div>' +
      '<div class="field" style="margin-top:12px">' +
        '<label>6-Digit Reset Token</label>' +
        '<input type="text" id="fpToken" placeholder="e.g. 482051" maxlength="6" autocomplete="off"' +
          ' style="letter-spacing:0.25em;font-size:18px;text-align:center;font-family:monospace"' +
          ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'fpNew\').focus()">' +
      '</div>' +
      '<div class="field" style="margin-top:12px">' +
        '<label>New Password</label>' +
        '<input type="password" id="fpNew" placeholder="Min 8 chars, include uppercase + number"' +
          ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'fpConfirm\').focus()">' +
      '</div>' +
      '<div class="field" style="margin-top:12px">' +
        '<label>Confirm New Password</label>' +
        '<input type="password" id="fpConfirm" placeholder="Repeat new password"' +
          ' onkeydown="if(event.key===\'Enter\')submitForgotPassword()">' +
      '</div>' +
      '<div id="fpError" class="login-error"></div>' +
      '<button class="login-btn" id="fpBtn" onclick="submitForgotPassword()">✅ Reset Password</button>' +
      '<button type="button" class="login-forgot-link" onclick="renderLoginForm()">← Back to Sign In</button>' +
    '</div>' +
    '<div class="login-footer">Rx Vault · Secure Medical Records</div>';
  setTimeout(function(){ document.getElementById('fpEmail')?.focus(); }, 100);
}

function renderForgotSuccess() {
  var body = document.getElementById('loginGateBody');
  if (!body) return;
  body.innerHTML =
    '<div class="login-logo">✅</div>' +
    '<div class="login-brand" style="color:var(--green)">Password Reset!</div>' +
    '<div class="login-sub">Your password has been updated successfully.</div>' +
    '<div class="login-form">' +
      '<button class="login-btn" style="background:var(--teal)" onclick="renderLoginForm()">🔓 Sign In Now</button>' +
    '</div>' +
    '<div class="login-footer">Rx Vault · Secure Medical Records</div>';
}

async function submitForgotPassword() {
  var email   = (document.getElementById('fpEmail')?.value   || '').trim();
  var token   = (document.getElementById('fpToken')?.value   || '').trim();
  var newPass = (document.getElementById('fpNew')?.value     || '');
  var confirm = (document.getElementById('fpConfirm')?.value || '');
  var errEl   = document.getElementById('fpError');
  var btn     = document.getElementById('fpBtn');
  if (errEl) errEl.textContent = '';

  if (!email)          { if(errEl) errEl.textContent='Please enter your email address.'; return; }
  if (!token || token.length < 4) { if(errEl) errEl.textContent='Please enter the reset token.'; return; }
  if (newPass.length < 8)   { if(errEl) errEl.textContent='Password must be at least 8 characters.'; return; }
  if (!/[A-Z]/.test(newPass)) { if(errEl) errEl.textContent='Password must include at least one uppercase letter.'; return; }
  if (!/[0-9]/.test(newPass)) { if(errEl) errEl.textContent='Password must include at least one number.'; return; }
  if (newPass !== confirm)  { if(errEl) errEl.textContent='Passwords do not match.'; return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Verifying…'; }

  var result = await dbConsumeResetToken(email, token, newPass);

  if (btn) { btn.disabled = false; btn.textContent = '✅ Reset Password'; }

  if (result === 'ok') {
    renderForgotSuccess();
  } else if (result === 'expired') {
    if(errEl) errEl.textContent = 'Token has expired. Ask your admin to generate a new one.';
  } else if (result === 'used') {
    if(errEl) errEl.textContent = 'This token has already been used.';
  } else {
    if(errEl) errEl.textContent = 'Invalid email or token. Please check and try again.';
  }
}

function togglePasswordVisibility() {
  var inp = document.getElementById('loginPassword');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function toggleStaffPasswordVisibility() {
  var inp = document.getElementById('staffPassword');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function togglePasswordVisibilityByID(id) {
  var inp = document.getElementById(id);
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
        if (dd && dd.contains(ev.target)) return; // Don't close if clicking inside dropdown
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
  
  // Wait for the async component to be rendered in the DOM before loading data
  var checkCount = 0;
  var checker = setInterval(function() {
      var container = document.getElementById('staffListContent');
      if (container || checkCount > 30) {
        clearInterval(checker);
        if (container) loadStaffList();
      }
      checkCount++;
    }, 150);
}

function showStaffTab(tab) {
  ['list','add','audit'].forEach(function(t) {
    var btn = document.getElementById('tabStaff' + capitalize(t));
    var pnl = document.getElementById('staffTab'  + capitalize(t));
    if (btn) btn.classList.toggle('active', t === tab);
    if (pnl) pnl.style.display = t === tab ? '' : 'none';
  });
  updateCallStaffBellVisibility();

  if (tab === 'audit') {
    loadAuditLog();
  }
}

async function loadStaffList() {
  var container = document.getElementById('staffListContent');
  if (!container) return;
  container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Loading staff…</div>';

  var clinicId = typeof window !== 'undefined' ? window.activeClinicId : null;
  if (!clinicId) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--red)">Error: No active clinic selected.</div>';
    return;
  }
  
  var staffData = null;
  try {
    staffData = await dbGetClinicStaff(clinicId);
  } catch(e) {
    console.error('[StaffList] Error fetching staff:', e);
  }
  
  window.staffStatusMap = {};
  if (staffData) {
    staffData.forEach(function(s) {
      if (s.status && s.status !== 'available') {
        window.staffStatusMap[s.name] = { status: s.status, until: s.status_until };
      }
    });
  }
  if (!staffData || !staffData.length) {
    container.innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--text-muted)">' +
        'No staff added yet.<br>Use the <strong>Add Staff</strong> tab to add someone.' +
      '</div>';
    return;
  }
  var roleIcon = { 
    admin:'🔐', doctor:'🩺', receptionist:'🧑‍💼', pharmacist:'💊', viewer:'👁️',
    medical_assistant:'🏥', lab_technician:'🧪', billing_manager:'💰', 
    inventory_manager:'📦', clinic_supervisor:'⭐', medical_support_aide:'🛏️'
  };
  var roleBg   = { 
    admin:'var(--red-bg)', doctor:'var(--allopathy-bg)', receptionist:'var(--teal-pale)', 
    pharmacist:'var(--homeopathy-bg)', viewer:'var(--bg)',
    medical_assistant:'var(--teal-pale)', lab_technician:'var(--bg)', 
    billing_manager:'var(--bg)', inventory_manager:'var(--bg)', 
    clinic_supervisor:'var(--teal-pale)', medical_support_aide:'var(--bg)'
  };
  var roleClr  = { 
    admin:'var(--red)', doctor:'var(--allopathy)', receptionist:'var(--teal)', 
    pharmacist:'var(--homeopathy)', viewer:'var(--text-muted)',
    medical_assistant:'var(--teal)', lab_technician:'var(--text-primary)', 
    billing_manager:'var(--text-primary)', inventory_manager:'var(--text-primary)', 
    clinic_supervisor:'var(--teal)', medical_support_aide:'var(--text-primary)'
  };

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
              (roleIcon[s.role]||'👤') + ' ' + capitalize(s.role.replace(/_/g, ' ')) +
            '</span>' +
            (s.staff_type === 'adhoc' ? ' <span style="background:var(--bg);color:var(--text-muted);border:1px solid var(--border);font-size:9px;padding:1px 6px;border-radius:10px;font-weight:600;margin-left:4px">Ad-hoc</span>' : '') +
            (s.status && s.status !== 'available' ? ' <span class="status-badge status-'+s.status.split('_')[0]+'" style="font-size:9px; margin-left:4px">'+formatStatusLabel(s.status)+'</span>' : '') +
            (!s.is_active ? '<span style="background:var(--red-bg);color:var(--red);font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;margin-left:4px">Inactive</span>' : '') +
          '</div>' +
          '<div class="admin-dr-sub">' + escHtml(s.email) + ' &nbsp;·&nbsp; Last login: ' + lastLogin + '</div>' +
        '</div>' +
        '<div class="admin-dr-actions" data-role="'+escAttr(s.role)+'">' +
          (s.staff_type === 'adhoc' ? '<button class="btn-sm btn-outline-teal" onclick="convertStaffToPermanent(\''+uid+'\', \''+uname+'\')">⭐ Make Permanent</button>' : '') +
          '<button class="btn-sm '+(s.is_active?'btn-outline-red':'btn-outline-teal')+'"' +
            ' data-uid="'+uid+'" data-active="'+(s.is_active?'false':'true')+'"' +
            ' onclick="toggleStaffActive(this.dataset.uid, this.dataset.active===\'true\')"' +
            (isMe ? ' disabled' : '') + '>' +
            (s.is_active ? '🔴 Deactivate' : '🟢 Activate') +
          '</button>' +
          '<button class="btn-sm btn-outline-teal reset-token-btn" data-uid="'+uid+'" data-name="'+uname+'" data-email="'+escHtml(s.email)+'"' +
            ' onclick="generateResetTokenForStaff(this.dataset.uid, this.dataset.name, this.dataset.email)">🔑 Reset</button>' +
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
  var staffType = document.querySelector('input[name="staffType"]:checked')?.value || 'permanent';
  var errEl    = document.getElementById('staffAddError');
  if (errEl) errEl.textContent = '';

  if (!name)            { if(errEl) errEl.textContent='Name is required.';                    return; }
  if (!email)           { if(errEl) errEl.textContent='Email is required.';                   return; }
  if (password.length < 8) { if(errEl) errEl.textContent='Password must be at least 8 characters.'; return; }
  if (!/[A-Z]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one uppercase letter.'; return; }
  if (!/[0-9]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one number.'; return; }
  if (!/[a-z]/.test(password)) { if(errEl) errEl.textContent='Password must contain at least one lowercase letter.'; return; }

  // 🛡️ Plan Tier Enforcement
  if (typeof getLimitFeedback === 'function') {
    var staffCheck = getLimitFeedback('staff');
    if (staffCheck) {
      var msg = staffCheck.message + ' <a href="#" onclick="openClinicSwitcher();return false;" style="color:var(--teal);font-weight:700;text-decoration:underline;margin-left:8px">Upgrade Now</a>';
      showToast(msg, 'error');
      if (errEl) errEl.textContent = staffCheck.message;
      return; 
    }
    
    if (window.LAB_TECH_ROLES && window.LAB_TECH_ROLES.indexOf(role) !== -1) {
      var labCheck = getLimitFeedback('labTech');
      if (labCheck) {
        var msg = labCheck.message + ' <a href="#" onclick="openClinicSwitcher();return false;" style="color:var(--teal);font-weight:700;text-decoration:underline;margin-left:8px">Upgrade Now</a>';
        showToast(msg, 'error');
        if (errEl) errEl.textContent = labCheck.message;
        return;
      }
    }
  }

  var btn = document.querySelector('#staffTabAdd .btn-teal');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating…'; }

  var result = await dbCreateStaffUser(name, email, password, role, activeClinicId, currentUser.id, staffType);

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
  document.getElementById('staffRole').value     = 'doctor';
  var pRadio = document.querySelector('input[name="staffType"][value="permanent"]');
  if (pRadio) pRadio.checked = true;
  showStaffTab('list');
  loadStaffList();
}

async function convertStaffToPermanent(userId, name) {
  if (!confirm('Convert ' + name + ' to a Permanent staff member?')) return;
  var ok = await dbUpdateStaffType(activeClinicId, userId, 'permanent');
  if (ok) {
    showToast('✅ ' + name + ' is now a Permanent staff member.', 'success');
    loadStaffList();
  } else {
    showToast('Failed to update staff type.', 'error');
  }
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
  // Legacy — kept for compatibility. Use generateResetTokenForStaff instead.
  var newPass = prompt('Enter new password for ' + name + '\n(min 8 chars, must include uppercase + number):');
  if (!newPass || newPass.length < 8)  { showToast('Password too short — minimum 8 characters.', 'error'); return; }
  if (!/[A-Z]/.test(newPass)) { showToast('Password must contain at least one uppercase letter.', 'error'); return; }
  if (!/[0-9]/.test(newPass)) { showToast('Password must contain at least one number.', 'error'); return; }
  var ok = await dbAdminResetPassword(userId, newPass);
  if (ok) showToast('Password reset for ' + name, 'success');
  else    showToast('Failed to reset password.', 'error');
}

async function generateResetTokenForStaff(userId, name, email) {
  var btn = document.querySelector('[data-uid="'+userId+'"].reset-token-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }

  var result = await dbGenerateResetToken(email);

  if (btn) { btn.disabled = false; btn.textContent = '🔑 Reset'; }

  if (!result || !result.token) {
    showToast('Could not generate token. Check email is correct.', 'error');
    return;
  }

  // Show a token dialog
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML =
    '<div style="background:var(--surface);border-radius:16px;max-width:380px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,0.25);padding:32px 28px;text-align:center;position:relative;animation:slideIn 0.2s ease">' +
      '<div style="font-size:40px;margin-bottom:12px">🔑</div>' +
      '<div style="font-family:\'DM Serif Display\',serif;font-size:20px;color:var(--indian-red);margin-bottom:6px">Reset Token</div>' +
      '<div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Share this token with <strong>' + escHtml(name) + '</strong>.<br>Valid for <strong>30 minutes</strong>.</div>' +
      '<div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:20px">' +
        '<div id="resetTokenDisplay" style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:0.3em;background:var(--teal-pale);color:var(--teal);border:2px solid rgba(10,124,110,0.25);border-radius:12px;padding:14px 24px">' + escHtml(result.token) + '</div>' +
      '</div>' +
      '<button onclick="' +
        'var t=document.getElementById(\'resetTokenDisplay\');' +
        'navigator.clipboard.writeText(t.textContent.trim()).then(function(){' +
          'var b=this;' +
        '}).catch(function(){});' +
        'this.textContent=\'✅ Copied!\';setTimeout(function(){this.textContent=\'📋 Copy Token\';}.bind(this),1500)' +
      '" style="background:var(--teal);color:#fff;border:none;border-radius:8px;padding:10px 22px;font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px;width:100%">📋 Copy Token</button>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:18px">User enters this token on the <strong>Forgot Password</strong> screen.</div>' +
      '<button onclick="this.closest(\'div[style*=\\\'position:fixed\\\']\') ? this.closest(\'div[style*=\\\'position:fixed\\\']\').remove() : this.parentElement.parentElement.remove()" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 22px;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;width:100%">Close</button>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
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
  ['cpOldPass','cpNewPass','cpConfirmPass'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var errEl = document.getElementById('changePassError'); if (errEl) errEl.textContent = '';
  var sub = document.getElementById('changePassSubtitle');
  if (sub && typeof currentUser !== 'undefined' && currentUser) sub.textContent = 'Signed in as ' + currentUser.name;

  // Inject token option into change password modal
  var changePassModal = document.getElementById('changePassModal');
  if (changePassModal && !changePassModal.querySelector('#cpTokenSection')) {
    var body = changePassModal.querySelector('.modal-body');
    if (body) {
      var tokenSection = document.createElement('div');
      tokenSection.id = 'cpTokenSection';
      tokenSection.style.cssText = 'margin-bottom:16px;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);';
      tokenSection.innerHTML =
        '<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Authentication Method</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:8px">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">' +
            '<input type="radio" name="cpAuthMethod" value="password" checked onchange="toggleCpAuthMethod()"> 🔑 Current Password' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">' +
            '<input type="radio" name="cpAuthMethod" value="token" onchange="toggleCpAuthMethod()"> 🎫 Admin Reset Token' +
          '</label>' +
        '</div>' +
        '<div id="cpTokenField" style="display:none">' +
          '<div class="premium-field" style="margin-bottom:0"><label>Admin Token</label>' +
            '<input type="text" id="cpAdminToken" class="premium-input" placeholder="Enter 6-digit admin token" maxlength="10" style="letter-spacing:0.2em;text-align:center;font-size:16px;font-family:monospace">' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Ask your admin to generate a reset token for your account via Staff Management → 🔑 Reset.</div>' +
        '</div>';
      body.insertBefore(tokenSection, body.firstChild);
    }
  }
  openModal('changePassModal');
}

function toggleCpAuthMethod() {
  var method    = document.querySelector('input[name="cpAuthMethod"]:checked')?.value || 'password';
  var tokenFld  = document.getElementById('cpTokenField');
  var oldPassFld = document.getElementById('cpOldPass')?.closest('.premium-field');
  if (tokenFld)  tokenFld.style.display  = method === 'token'    ? '' : 'none';
  if (oldPassFld) oldPassFld.style.display = method === 'password' ? '' : 'none';
}

async function submitChangePassword() {
  var method  = document.querySelector('input[name="cpAuthMethod"]:checked')?.value || 'password';
  var oldPass = document.getElementById('cpOldPass')?.value     || '';
  var newPass = document.getElementById('cpNewPass')?.value     || '';
  var confirm = document.getElementById('cpConfirmPass')?.value || '';
  var token   = document.getElementById('cpAdminToken')?.value  || '';
  var errEl   = document.getElementById('changePassError'); if (errEl) errEl.textContent = '';

  if (newPass.length < 8)      { if(errEl) errEl.textContent='New password min 8 characters.'; return; }
  if (!/[A-Z]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one uppercase letter.'; return; }
  if (!/[0-9]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one number.'; return; }
  if (!/[a-z]/.test(newPass))  { if(errEl) errEl.textContent='Password must contain at least one lowercase letter.'; return; }
  if (newPass !== confirm)     { if(errEl) errEl.textContent='Passwords do not match.'; return; }

  var btn = document.getElementById('cpSubmitBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Saving…'; }

  var ok = false;

  if (method === 'token') {
    if (!token) { if(errEl) errEl.textContent='Please enter the admin token.'; if(btn){btn.disabled=false;btn.textContent='🔑 Update Password';} return; }
    var email = typeof currentUser !== 'undefined' && currentUser ? currentUser.email : '';
    var result = await dbConsumeResetToken(email, token, newPass);
    ok = (result === 'ok');
    if (!ok) {
      var msg = result === 'expired' ? 'Token has expired.' : result === 'used' ? 'Token already used.' : 'Invalid token.';
      if(errEl) errEl.textContent = msg;
    }
  } else {
    if (!oldPass) { if(errEl) errEl.textContent='Enter current password.'; if(btn){btn.disabled=false;btn.textContent='🔑 Update Password';} return; }
    ok = await dbChangePassword(currentUser.id, oldPass, newPass);
    if (!ok) { if(errEl) errEl.textContent='Current password is incorrect.'; }
  }

  if (btn) { btn.disabled=false; btn.textContent='🔑 Update Password'; }
  if (!ok) return;
  closeModal('changePassModal');
  showToast('✅ Password changed successfully. Please sign in again.', 'success');
  setTimeout(function(){ if (typeof authLogout === 'function') authLogout(); }, 1500);
}


// ─── Staff Busy Status ────────────────────────────────────
async function setUserStatus(status, hours) {
  if (!currentUser || !activeClinicId) return;

  var until = null;
  var hrs = parseInt(hours) || 0;
  if (hrs > 0) {
    until = new Date(Date.now() + hrs * 3600000).toISOString();
  }

  // Fallback to localStorage for immediate persistence
  localStorage.setItem('userStatus_' + activeClinicId + '_' + currentUser.id, JSON.stringify({ status: status, until: until }));
  
  // Update currentUser and UI immediately
  currentUser.status = status;
  currentUser.status_until = until;
  saveSession(currentUser, currentRole);
  updateStatusUI();

  // Update DB
  var ok = await dbUpdateStaffStatus(activeClinicId, currentUser.id, status, until);
  if (ok) {
    showToast('Status updated to: ' + formatStatusLabel(status), 'success');
  } else {
    showToast('Status saved locally (Sync failed)', 'info');
  }

  // Hide custom wrapper if it was open
  var wrapper = document.getElementById('customStatusWrapper');
  if (wrapper) wrapper.style.display = 'none';
}

function updateUserStatusFromUI() {
  var preset = document.getElementById('statusPresetSelect').value;
  var duration = document.getElementById('statusDurationSelect').value;
  var finalStatus = preset;

  if (preset === 'custom') {
    finalStatus = document.getElementById('customStatusInput').value.trim();
    if (!finalStatus) { showToast('Please enter a custom status.', 'error'); return; }
  }

  // Available always has 0 duration
  if (preset === 'available') duration = 0;

  setUserStatus(finalStatus, duration);
}

function updateStatusUI() {
  var badge = document.getElementById('topbarUserStatus');
  if (!badge || !currentUser) return;

  // Restore from localStorage if needed (for fresh reloads before DB fetch)
  if (!currentUser.status && activeClinicId) {
    var saved = localStorage.getItem('userStatus_' + activeClinicId + '_' + currentUser.id);
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        if (new Date(parsed.until) > new Date() || parsed.status === 'available') {
          currentUser.status = parsed.status;
          currentUser.status_until = parsed.until;
        }
      } catch(e){}
    }
  }

  var status = currentUser.status || 'available';
  var until  = currentUser.status_until;

  // Check if status expired
  if (until && new Date() > new Date(until)) {
    status = 'available';
    currentUser.status = 'available';
    currentUser.status_until = null;
    saveSession(currentUser, currentRole);
  }

  var label = formatStatusLabel(status);
  if (until && status !== 'available') {
    var minLeft = Math.round((new Date(until) - new Date()) / 60000);
    if (minLeft > 0) {
      label += ' (' + (minLeft > 60 ? Math.floor(minLeft/60)+'h' : minLeft+'m') + ')';
    }
  }

  badge.textContent = label;
  badge.className   = 'status-badge status-' + (status.includes('_') ? status.split('_')[0] : 'custom') + ' no-print';
  if (status === 'on_round' || status === 'on_lunch') badge.className = 'status-badge status-' + status.split('_')[1] + ' no-print';
  badge.style.display = 'inline-block';

  // Update dropdown selection
  var sel = document.getElementById('statusPresetSelect');
  if (sel) {
    var presets = ['available','on_round','on_lunch','busy_ot','busy_opd','outside','not_in'];
    if (presets.includes(status)) {
      sel.value = status;
    } else if (status !== 'available') {
      sel.value = 'custom';
      var inp = document.getElementById('customStatusInput');
      if (inp) inp.value = status;
      var wrap = document.getElementById('customStatusWrapper');
      if (wrap) wrap.style.display = 'block';
    } else {
      sel.value = 'available';
    }
  }
}

function formatStatusLabel(status) {
  if (!status || status === 'available') return 'Available';
  if (status === 'on_round')  return 'On Round';
  if (status === 'on_lunch')  return 'On Lunch';
  if (status === 'busy_ot')   return 'In OT';
  if (status === 'busy_opd')  return 'In OPD';
  if (status === 'outside')   return 'Outside';
  if (status === 'not_in')    return 'Off-Duty';
  // Handle custom status
  return status.split('_').map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
}
function updateCallStaffBellVisibility() {
  var bell = document.getElementById('btnRingBell');
  if (!bell) return;
  var role = getEffectiveRole();
  // Allow doctors, admins, and superadmins to ring the digital bell
  var allowed = ['doctor', 'admin', 'superadmin'].includes(role);
  bell.style.display = allowed ? 'flex' : 'none';
}

// ════════════════════════════════════════════════════════════
//   Staff Profile Update
// ════════════════════════════════════════════════════════════

function openStaffProfileModal(userId, staffData) {
  var overlay = document.getElementById('staffProfileOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='staffProfileOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  var s = staffData || {};
  overlay.innerHTML =
    '<div class="modal" style="max-width:500px">' +
      '<div class="modal-header"><div>' +
        '<div class="modal-title">👤 Update Staff Profile</div>' +
        '<div class="modal-subtitle">'+escHtml(s.name||'')+'</div>' +
      '</div><button class="modal-close" onclick="closeOverlay(\'staffProfileOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="premium-field"><label>Full Name</label>' +
          '<input type="text" id="spName" class="premium-input" value="'+escAttr(s.name||'')+'" placeholder="Full Name"></div>' +
        '<div class="premium-field"><label>Email</label>' +
          '<input type="email" id="spEmail" class="premium-input" value="'+escAttr(s.email||'')+'" placeholder="Email"></div>' +
        '<div class="premium-field"><label>Staff Role</label>' +
          '<select id="spRole" class="premium-input" style="appearance:none;background-image:url(\'data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2214%22%20height%3D%228%22%20viewBox%3D%220%200%2014%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M1%201L7%207L13%201%22%20stroke%3D%22%23A4ADBA%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E\');background-repeat:no-repeat;background-position:right%2018px%20center;">' +
            ['doctor','receptionist','pharmacist','medical_assistant','lab_technician','billing_manager','inventory_manager','clinic_supervisor','medical_support_aide','admin','viewer'].map(function(r){
              return '<option value="'+r+'"'+(r===s.role?' selected':'')+'>'+capitalize(r.replace(/_/g,' '))+'</option>';
            }).join('') +
          '</select></div>' +
        '<div class="premium-field"><label>Staff Type</label>' +
          '<div style="display:flex;gap:12px;margin-top:8px">' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer"><input type="radio" name="spStaffType" value="permanent"'+(s.staff_type!=='adhoc'?' checked':'')+' style="accent-color:var(--teal)"> Permanent</label>' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer"><input type="radio" name="spStaffType" value="adhoc"'+(s.staff_type==='adhoc'?' checked':'')+' style="accent-color:var(--teal)"> Ad-hoc</label>' +
          '</div></div>' +
        '<div style="padding:12px 14px;background:var(--teal-pale);border-radius:var(--radius);border-left:3px solid var(--teal);font-size:12.5px;color:var(--teal);margin-bottom:0">' +
          '🔑 To change password, use <strong>Change Password</strong> from the top-right user menu.' +
        '</div>' +
        '<div id="spError" style="color:var(--red);font-size:12.5px;min-height:18px;margin-top:8px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'staffProfileOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveStaffProfile(\''+escAttr(userId)+'\')">💾 Update Profile</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

async function saveStaffProfile(userId) {
  var name     = (document.getElementById('spName')?.value  || '').trim();
  var email    = (document.getElementById('spEmail')?.value || '').trim();
  var role     = document.getElementById('spRole')?.value   || '';
  var staffType= document.querySelector('input[name="spStaffType"]:checked')?.value || 'permanent';
  var errEl    = document.getElementById('spError');
  if (errEl) errEl.textContent = '';

  if (!name)  { if(errEl) errEl.textContent='Name is required.';  return; }
  if (!email) { if(errEl) errEl.textContent='Email is required.'; return; }

  var btn = document.querySelector('#staffProfileOverlay .btn-teal');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Saving…'; }

  // Update name in users table
  try {
    await db.from('users').update({ name: name, email: email.toLowerCase() }).eq('id', userId);
  } catch(e) { console.warn('[saveStaffProfile] users update:', e); }

  // Update role and type in clinic_staff
  var ok = await dbUpdateStaffRole(activeClinicId, userId, role);
  await dbUpdateStaffType(activeClinicId, userId, staffType);

  if (btn) { btn.disabled=false; btn.textContent='💾 Update Profile'; }

  if (!ok) { if(errEl) errEl.textContent='Failed to update profile.'; return; }

  closeOverlay('staffProfileOverlay');
  showToast('✅ Profile updated successfully.', 'success');

  // Refresh the staff list
  if (typeof loadStaffList === 'function') loadStaffList();
  if (typeof filterStaffListView === 'function') {
    var staffData = await dbGetClinicStaff(activeClinicId);
    window._staffListData = staffData;
    filterStaffListView();
  }
}

// Patch loadStaffList to add "Edit Profile" button
var _origLoadStaffList = typeof loadStaffList === 'function' ? loadStaffList : null;
if (_origLoadStaffList) {
  loadStaffList = async function() {
    await _origLoadStaffList();
    // Add profile edit buttons after render
    setTimeout(function() {
      document.querySelectorAll('.admin-doctor-row').forEach(function(row) {
        if (row.querySelector('.profile-edit-btn')) return;
        var actionsDiv = row.querySelector('.admin-dr-actions');
        if (!actionsDiv) return;
        // Get user ID from existing buttons' data attributes
        var existingBtn = actionsDiv.querySelector('[data-uid]');
        if (!existingBtn) return;
        var uid  = existingBtn.dataset.uid;
        var name = row.querySelector('.admin-dr-name')?.textContent?.split('\n')[0]?.trim() || '';
        var emailEl = row.querySelector('.admin-dr-sub');
        var emailText = emailEl ? emailEl.textContent.split('·')[0]?.trim() : '';
        var role = actionsDiv.dataset.role || '';

        var editBtn = document.createElement('button');
        editBtn.className = 'btn-sm btn-outline-teal profile-edit-btn';
        editBtn.textContent = '👤 Profile';
        editBtn.style.fontSize = '11px';
        editBtn.addEventListener('click', function() {
          openStaffProfileModal(uid, { name: name, email: emailText, role: role, staff_type: 'permanent' });
        });
        actionsDiv.insertBefore(editBtn, actionsDiv.firstChild);
      });
    }, 200);
  };
}