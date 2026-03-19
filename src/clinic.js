// ════════════════════════════════════════════════════════════
//  CLINIC.JS — Clinic management, gate, topbar
//  Depends on: supabase.js (db, showLoading, hideLoading)
//              auth.js     (currentUser, currentRole, can, isSuperAdmin)
// ════════════════════════════════════════════════════════════

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
function formatRole(role) {
  var labels = { superadmin:'⚡ SuperAdmin', admin:'🔐 Admin', doctor:'🩺 Doctor',
    receptionist:'🧑‍💼 Receptionist', pharmacist:'💊 Pharmacist', viewer:'👁 Viewer', staff:'Staff' };
  return labels[role] || capitalize(role||'');
}

var ACTIVE_CLINIC_KEY = 'pv_active_clinic';
var clinics = [];
var activeClinicId = null;

function setActiveClinic(id) {
  activeClinicId = id;
  if (id) localStorage.setItem(ACTIVE_CLINIC_KEY, id);
  else    localStorage.removeItem(ACTIVE_CLINIC_KEY);
  var match = clinics.find(function(c){ return c.id === id; });
  if (typeof updateClinicRole === 'function') {
    updateClinicRole(match ? (match.staffRole || 'viewer') : null);
  }
}

function getActiveClinic() {
  return clinics.find(function(c){ return c.id === activeClinicId; }) || null;
}

function clinicKey(baseKey) {
  if (!activeClinicId) return baseKey;
  return baseKey + '__' + activeClinicId;
}

function genClinicId() {
  return 'clinic_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
}

// ════════════════════════════════════════════════════════════
//  BOOT ENTRY POINT  (called from script.js)
// ════════════════════════════════════════════════════════════
async function initClinicGate() {
  // 1. Auth check
  var authenticated = await initAuth();
  if (!authenticated) return true; // login gate shown

  // 2. Load clinics for this user
  showLoading('Loading clinics…');
  try {
    if (typeof dbGetUserClinics === 'function' && typeof currentUser !== 'undefined' && currentUser) {
      var userClinics = await dbGetUserClinics(currentUser.id);
      clinics = (userClinics || []).map(function(c) {
        return { id: c.clinic_id, name: c.clinic_name, logo: c.clinic_logo||'🏥',
                 type: c.clinic_type||'multispecialty', staffRole: c.staff_role };
      });
      // SuperAdmin fallback: if no clinics assigned yet, load ALL clinics
      if (!clinics.length && typeof isSuperAdmin === 'function' && isSuperAdmin()) {
        clinics = await dbGetClinics();
        clinics.forEach(function(c) { c.staffRole = 'superadmin'; });
      }
    } else {
      clinics = await dbGetClinics();
    }
  } catch(e) {
    console.error('[Clinic] initClinicGate:', e);
    try { clinics = await dbGetClinics(); } catch(e2) { clinics = []; }
  }
  hideLoading();

  // 3. No clinics
  if (!clinics.length) {
    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) {
      showClinicGate();
      return true;
    }
    showToast('No clinics assigned. Contact your admin.', 'error');
    if (typeof authLogout === 'function') authLogout();
    return true;
  }

  // 4. Try restoring last-used clinic
  var saved = localStorage.getItem(ACTIVE_CLINIC_KEY);
  if (saved && clinics.find(function(c){ return c.id === saved; })) {
    setActiveClinic(saved);
    hideClinicGate();
    renderTopbarClinic();
    renderTopbarUser();
    if (typeof applyPermissionUI === 'function') applyPermissionUI();
    return false;
  }

  // 5. Only one clinic → auto-select
  if (clinics.length === 1) {
    setActiveClinic(clinics[0].id);
    hideClinicGate();
    renderTopbarClinic();
    renderTopbarUser();
    if (typeof applyPermissionUI === 'function') applyPermissionUI();
    return false;
  }

  // 6. Multiple clinics → show picker
  showClinicGate();
  return true;
}

// ════════════════════════════════════════════════════════════
//  CLINIC GATE
// ════════════════════════════════════════════════════════════
function showClinicGate() {
  var gate = document.getElementById('clinicGate');
  if (gate) { gate.classList.add('open'); document.body.style.overflow = 'hidden'; }
  renderClinicGate();
}

function hideClinicGate() {
  var gate = document.getElementById('clinicGate');
  if (gate) gate.classList.remove('open');
  document.body.style.overflow = '';
}

function openClinicSwitcher() {
  var openMod = document.querySelector('.modal-overlay.open');
  if (openMod && openMod.id !== 'clinicGate') {
    if (!confirm('You have an open form. Switch clinic anyway? Unsaved data will be lost.')) return;
    document.querySelectorAll('.modal-overlay.open').forEach(function(m){ m.classList.remove('open'); });
  }
  showClinicGate();
}

function renderClinicGate() {
  var listEl   = document.getElementById('clinicGateList');
  var formEl   = document.getElementById('clinicGateForm');
  var closeBtn = document.getElementById('clinicGateCloseBtn');
  if (!listEl || !formEl) return;

  if (closeBtn) closeBtn.style.display = clinics.length ? '' : 'none';

  if (!clinics.length) {
    listEl.style.display = 'none';
    formEl.style.display = '';
    prefillNewClinicForm(null);
    return;
  }

  listEl.style.display = '';
  formEl.style.display = 'none';

  var typeIcon = { allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱', multispecialty:'🏥' };
  var typeName = { allopathy:'Allopathy', homeopathy:'Homeopathy', ayurveda:'Ayurveda', multispecialty:'Multispecialty' };
  var canCreate = typeof isSuperAdmin === 'function' && isSuperAdmin();

  var cards = clinics.map(function(c) {
    var icon  = typeIcon[c.type] || '🏥';
    var tname = typeName[c.type] || c.type;
    var isActive = c.id === activeClinicId;
    var roleLabel = c.staffRole
      ? '<span class="clinic-type-tag" style="background:rgba(10,124,110,0.15);color:var(--teal);margin-left:4px">'+formatRole(c.staffRole)+'</span>'
      : '';
    var adminBtns = canCreate
      ? '<button class="clinic-edit-btn" onclick="event.stopPropagation();openEditClinicModal(\''+c.id+'\')" title="Edit">✏️</button>' +
        '<button class="clinic-del-btn"  onclick="event.stopPropagation();deleteClinicById(\''+c.id+'\')" title="Delete">🗑️</button>'
      : '';
    return (
      '<div class="clinic-card'+(isActive?' clinic-card-active':'')+'" onclick="selectClinic(\''+c.id+'\')">' +
        '<div class="clinic-card-icon">'+escHtml(c.logo||icon)+'</div>' +
        '<div class="clinic-card-info">' +
          '<div class="clinic-card-name">'+escHtml(c.name)+(isActive?' <span style="font-size:10px;color:var(--teal)">✓ Active</span>':'')+'</div>' +
          '<div class="clinic-card-meta"><span class="clinic-type-tag">'+icon+' '+tname+'</span>'+roleLabel+'</div>' +
        '</div>' +
        (adminBtns ? '<div class="clinic-card-actions">'+adminBtns+'</div>' : '') +
        '<div class="clinic-card-arrow">→</div>' +
      '</div>'
    );
  }).join('');

  var userName = typeof currentUser !== 'undefined' && currentUser ? currentUser.name : '';
  var userRole = typeof getEffectiveRole === 'function' ? getEffectiveRole() : '';

  listEl.innerHTML =
    '<div class="clinic-gate-list-header">' +
      '<div>' +
        '<span>Select a clinic to continue</span>' +
        (userName ? '<div style="font-size:11px;color:var(--text-muted);margin-top:3px">Signed in as <strong>'+escHtml(userName)+'</strong> · '+formatRole(userRole)+'</div>' : '') +
      '</div>' +
      (canCreate ? '<button class="clinic-new-btn" onclick="showNewClinicForm()">＋ New Clinic</button>' : '') +
    '</div>' +
    '<div class="clinic-cards">'+cards+'</div>' +
    '<div style="padding:12px 0 4px;text-align:right">' +
      '<button class="btn-sm btn-outline-red" onclick="authLogout()" style="font-size:12px">🚪 Sign Out</button>' +
    '</div>';
}

function selectClinic(id) {
  setActiveClinic(id);
  hideClinicGate();
  renderTopbarClinic();
  renderTopbarUser();
  // Apply nav permissions immediately so items like Pharmacy appear before data loads
  if (typeof applyPermissionUI === 'function') applyPermissionUI();
  if (typeof initAppForClinic === 'function') initAppForClinic();
}

// ─── Clinic form ──────────────────────────────────────────
function setGateVal(id, val) { var el = document.getElementById(id); if (el) el.value = val||''; }

function prefillNewClinicForm(clinic) {
  setGateVal('cgName',    clinic ? clinic.name    : '');
  setGateVal('cgAddress', clinic ? clinic.address : '');
  setGateVal('cgPhone',   clinic ? clinic.phone   : '');
  setGateVal('cgEmail',   clinic ? clinic.email   : '');
  setGateVal('cgPin',     clinic ? clinic.pin     : '');
  setGateVal('cgLogo',    clinic ? clinic.logo    : '🏥');
  var typeEl = document.getElementById('cgType');
  if (typeEl) typeEl.value = clinic ? (clinic.type||'multispecialty') : 'multispecialty';
  var titleEl = document.getElementById('clinicFormTitle');
  if (titleEl) titleEl.textContent = clinic ? 'Edit Clinic' : (clinics.length ? '＋ New Clinic' : '🏥 Create Your First Clinic');
  var subEl = document.getElementById('clinicFormSub');
  if (subEl) subEl.textContent = clinic ? 'Update clinic details.' : 'Set up your clinic to get started.';
  var saveBtn = document.getElementById('cgSaveBtn');
  if (saveBtn) saveBtn.dataset.editId = clinic ? clinic.id : '';
}

function showNewClinicForm() {
  document.getElementById('clinicGateList').style.display = 'none';
  document.getElementById('clinicGateForm').style.display = '';
  var cb = document.getElementById('clinicGateCloseBtn');
  if (cb) cb.style.display = clinics.length ? '' : 'none';
  prefillNewClinicForm(null);
  setTimeout(function(){ var el = document.getElementById('cgName'); if(el) el.focus(); }, 100);
}

function cancelNewClinic() {
  if (!clinics.length) {
    showToast('Please create your first clinic to continue.', 'info');
    return;
  }
  // Re-render the list first (in case it was never populated)
  renderClinicGate();
  document.getElementById('clinicGateList').style.display = '';
  document.getElementById('clinicGateForm').style.display = 'none';
}

function openEditClinicModal(id) {
  var clinic = clinics.find(function(c){ return c.id === id; });
  if (!clinic) return;
  document.getElementById('clinicGateList').style.display = 'none';
  document.getElementById('clinicGateForm').style.display = '';
  prefillNewClinicForm(clinic);
}

async function saveClinicForm() {
  var name = (document.getElementById('cgName')?.value || '').trim();
  if (!name) { alert('Clinic name is required.'); document.getElementById('cgName').focus(); return; }
  var btn    = document.getElementById('cgSaveBtn');
  var editId = btn ? btn.dataset.editId : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }

  var data = {
    name:    name,
    address: document.getElementById('cgAddress')?.value || '',
    phone:   document.getElementById('cgPhone')?.value   || '',
    email:   document.getElementById('cgEmail')?.value   || '',
    type:    document.getElementById('cgType')?.value    || 'multispecialty',
    logo:   (document.getElementById('cgLogo')?.value || '').trim() || '🏥',
    pin:    (document.getElementById('cgPin')?.value  || '').trim() || 'admin1234'
  };

  if (editId) {
    var ok = await dbUpdateClinic(editId, data);
    if (btn) { btn.disabled = false; btn.textContent = '🏥 Save & Enter'; }
    if (!ok) { alert('Failed to update clinic.'); return; }
    var idx = clinics.findIndex(function(c){ return c.id === editId; });
    if (idx > -1) clinics[idx] = Object.assign({}, clinics[idx], data);
    if (editId === activeClinicId) renderTopbarClinic();
    renderClinicGate();
    document.getElementById('clinicGateList').style.display = '';
    document.getElementById('clinicGateForm').style.display = 'none';
  } else {
    var newClinic = Object.assign({ id: genClinicId() }, data);
    var saved = await dbInsertClinic(newClinic);
    if (btn) { btn.disabled = false; btn.textContent = '🏥 Save & Enter'; }
    if (!saved) { alert('Failed to create clinic.'); return; }
    clinics.push(saved);
    // Also assign superadmin as clinic admin in clinic_staff
    if (typeof currentUser !== 'undefined' && currentUser) {
      await dbAssignStaff(saved.id, currentUser.id, 'admin', currentUser.id);
    }
    if (typeof dbAudit === 'function') dbAudit('create', 'clinics', saved.id, null, data);
    selectClinic(saved.id);
  }
}

async function deleteClinicById(id) {
  if (!confirm('Delete this clinic and ALL its data?\nThis cannot be undone.')) return;
  showLoading('Deleting clinic…');
  await dbDeleteClinic(id);
  var userClinics = await dbGetUserClinics(currentUser.id);
  clinics = (userClinics||[]).map(function(c){
    return { id:c.clinic_id, name:c.clinic_name, logo:c.clinic_logo||'🏥', type:c.clinic_type, staffRole:c.staff_role };
  });
  hideLoading();
  if (activeClinicId === id) {
    setActiveClinic(null);
  }
  showClinicGate();
  renderClinicGate();
}

// ─── Topbar ───────────────────────────────────────────────
function renderTopbarClinic() {
  var clinic = getActiveClinic();
  var nameEl = document.getElementById('topbarClinicName');
  var iconEl = document.getElementById('topbarClinicIcon');
  if (nameEl) nameEl.textContent = clinic ? clinic.name : 'No Clinic';
  if (iconEl) iconEl.textContent = clinic ? (clinic.logo||'🏥') : '🏥';
}

// Called by both clinic.js and auth.js — unified function
function renderTopbarUser() {
  var nameEl  = document.getElementById('topbarUserName');
  var roleEl  = document.getElementById('topbarUserRole');
  var ddName  = document.getElementById('ddUserName');
  var ddEmail = document.getElementById('ddUserEmail');
  var user = typeof currentUser !== 'undefined' ? currentUser : null;
  if (!user) return;
  if (nameEl)  nameEl.textContent  = user.name;
  if (roleEl)  roleEl.textContent  = formatRole(typeof getEffectiveRole === 'function' ? getEffectiveRole() : user.role);
  if (ddName)  ddName.textContent  = user.name;
  if (ddEmail) ddEmail.textContent = user.email;
}
