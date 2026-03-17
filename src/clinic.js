// ════════════════════════════════════════════════════════════
//  CLINIC MANAGEMENT — Supabase-backed
//  NOTE: showLoading/hideLoading are defined in supabase.js
// ════════════════════════════════════════════════════════════

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var ACTIVE_CLINIC_KEY = 'pv_active_clinic';
var clinics = [];
var activeClinicId = null;

function setActiveClinic(id) {
  activeClinicId = id;
  localStorage.setItem(ACTIVE_CLINIC_KEY, id);
}

function getActiveClinic() {
  return clinics.find(function (c) { return c.id === activeClinicId; }) || null;
}

function genClinicId() {
  return 'clinic_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function clinicKey(baseKey) {
  if (!activeClinicId) return baseKey;
  return baseKey + '__' + activeClinicId;
}

// ════════════════════════════════════════════════════════════
//  INIT GATE
// ════════════════════════════════════════════════════════════
async function initClinicGate() {
  showLoading('Connecting to database\u2026');
  try {
    clinics = await dbGetClinics();
  } catch (e) {
    console.error('initClinicGate error:', e);
    clinics = [];
  }
  hideLoading();

  activeClinicId = localStorage.getItem(ACTIVE_CLINIC_KEY) || null;

  if (activeClinicId && clinics.find(function (c) { return c.id === activeClinicId; })) {
    hideClinicGate();
    return false;
  }
  if (clinics.length === 1) {
    setActiveClinic(clinics[0].id);
    hideClinicGate();
    return false;
  }
  showClinicGate();
  return true;
}

// ════════════════════════════════════════════════════════════
//  GATE SHOW / HIDE
// ════════════════════════════════════════════════════════════
function showClinicGate() {
  var gate = document.getElementById('clinicGate');
  if (!gate) return;
  gate.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderClinicGate();
}

function hideClinicGate() {
  var gate = document.getElementById('clinicGate');
  if (gate) gate.classList.remove('open');
  document.body.style.overflow = '';
}

function openClinicSwitcher() {
  showClinicGate();
  renderClinicGate();
}

// ════════════════════════════════════════════════════════════
//  RENDER GATE LIST
// ════════════════════════════════════════════════════════════
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

  var typeIcon = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱', multispecialty: '🏥' };
  var typeName = { allopathy: 'Allopathy', homeopathy: 'Homeopathy', ayurveda: 'Ayurveda', multispecialty: 'Multispecialty' };

  var cards = clinics.map(function (c) {
    var icon  = typeIcon[c.type]  || '🏥';
    var tname = typeName[c.type] || c.type;
    return (
      '<div class="clinic-card" onclick="selectClinic(\'' + c.id + '\')">' +
        '<div class="clinic-card-icon">' + escHtml(c.logo || icon) + '</div>' +
        '<div class="clinic-card-info">' +
          '<div class="clinic-card-name">' + escHtml(c.name) + '</div>' +
          '<div class="clinic-card-meta">' +
            '<span class="clinic-type-tag">' + icon + ' ' + tname + '</span>' +
            (c.address ? '<span class="clinic-addr">📍 ' + escHtml(c.address) + '</span>' : '') +
            (c.phone   ? '<span class="clinic-addr">📞 ' + escHtml(c.phone)   + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="clinic-card-actions" onclick="event.stopPropagation()">' +
          '<button class="clinic-edit-btn" onclick="openEditClinicModal(\'' + c.id + '\')" title="Edit">✏️</button>' +
          '<button class="clinic-del-btn"  onclick="deleteClinicById(\''   + c.id + '\')" title="Delete">🗑️</button>' +
        '</div>' +
        '<div class="clinic-card-arrow">→</div>' +
      '</div>'
    );
  }).join('');

  listEl.innerHTML =
    '<div class="clinic-gate-list-header">' +
      '<span>Select a clinic to continue</span>' +
      '<button class="clinic-new-btn" onclick="showNewClinicForm()">＋ New Clinic</button>' +
    '</div>' +
    '<div class="clinic-cards">' + cards + '</div>';
}

// ════════════════════════════════════════════════════════════
//  SELECT CLINIC
// ════════════════════════════════════════════════════════════
function selectClinic(id) {
  setActiveClinic(id);
  hideClinicGate();
  if (typeof initAppForClinic === 'function') initAppForClinic();
}

// ════════════════════════════════════════════════════════════
//  CLINIC FORM — CREATE / EDIT
// ════════════════════════════════════════════════════════════
function prefillNewClinicForm(clinic) {
  setGateVal('cgName',    clinic ? clinic.name    : '');
  setGateVal('cgAddress', clinic ? clinic.address : '');
  setGateVal('cgPhone',   clinic ? clinic.phone   : '');
  setGateVal('cgEmail',   clinic ? clinic.email   : '');
  setGateVal('cgPin',     clinic ? clinic.pin     : '');
  setGateVal('cgLogo',    clinic ? clinic.logo    : '🏥');

  var typeEl = document.getElementById('cgType');
  if (typeEl) typeEl.value = clinic ? (clinic.type || 'multispecialty') : 'multispecialty';

  var titleEl = document.getElementById('clinicFormTitle');
  if (titleEl) titleEl.textContent = clinic
    ? 'Edit Clinic'
    : (clinics.length ? '＋ New Clinic' : '🏥 Create Your First Clinic');

  var subEl = document.getElementById('clinicFormSub');
  if (subEl) subEl.textContent = clinic
    ? 'Update clinic details.'
    : 'Set up your clinic to get started with Rx Vault.';

  var saveBtn = document.getElementById('cgSaveBtn');
  if (saveBtn) saveBtn.dataset.editId = clinic ? clinic.id : '';
}

function setGateVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val || '';
}

function showNewClinicForm() {
  document.getElementById('clinicGateList').style.display = 'none';
  document.getElementById('clinicGateForm').style.display = '';
  var closeBtn = document.getElementById('clinicGateCloseBtn');
  if (closeBtn) closeBtn.style.display = clinics.length ? '' : 'none';
  prefillNewClinicForm(null);
  setTimeout(function () {
    var el = document.getElementById('cgName');
    if (el) el.focus();
  }, 100);
}

function cancelNewClinic() {
  if (!clinics.length) return;
  document.getElementById('clinicGateList').style.display = '';
  document.getElementById('clinicGateForm').style.display = 'none';
}

function openEditClinicModal(id) {
  var clinic = clinics.find(function (c) { return c.id === id; });
  if (!clinic) return;
  document.getElementById('clinicGateList').style.display = 'none';
  document.getElementById('clinicGateForm').style.display = '';
  prefillNewClinicForm(clinic);
}

async function saveClinicForm() {
  var name = (document.getElementById('cgName') ? document.getElementById('cgName').value : '').trim();
  if (!name) {
    alert('Clinic name is required.');
    if (document.getElementById('cgName')) document.getElementById('cgName').focus();
    return;
  }

  var btn    = document.getElementById('cgSaveBtn');
  var editId = btn ? btn.dataset.editId : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }

  var data = {
    name:    name,
    address: document.getElementById('cgAddress') ? document.getElementById('cgAddress').value : '',
    phone:   document.getElementById('cgPhone')   ? document.getElementById('cgPhone').value   : '',
    email:   document.getElementById('cgEmail')   ? document.getElementById('cgEmail').value   : '',
    type:    document.getElementById('cgType')    ? document.getElementById('cgType').value    : 'multispecialty',
    logo:   (document.getElementById('cgLogo')    ? document.getElementById('cgLogo').value    : '').trim() || '🏥',
    pin:    (document.getElementById('cgPin')     ? document.getElementById('cgPin').value     : '').trim() || 'admin1234'
  };

  if (editId) {
    var ok = await dbUpdateClinic(editId, data);
    if (btn) { btn.disabled = false; btn.textContent = '🏥 Save & Enter'; }
    if (!ok) { alert('Failed to update clinic. Check console.'); return; }
    var idx = clinics.findIndex(function (c) { return c.id === editId; });
    if (idx > -1) clinics[idx] = Object.assign({}, clinics[idx], data);
    if (editId === activeClinicId && typeof renderTopbarClinic === 'function') renderTopbarClinic();
    renderClinicGate();
    document.getElementById('clinicGateList').style.display = '';
    document.getElementById('clinicGateForm').style.display = 'none';
  } else {
    var clinic = Object.assign({ id: genClinicId() }, data);
    var saved  = await dbInsertClinic(clinic);
    if (btn) { btn.disabled = false; btn.textContent = '🏥 Save & Enter'; }
    if (!saved) { alert('Failed to create clinic. Check console.'); return; }
    clinics.push(saved);
    selectClinic(saved.id);
  }
}

// ════════════════════════════════════════════════════════════
//  DELETE CLINIC
// ════════════════════════════════════════════════════════════
async function deleteClinicById(id) {
  if (!confirm('Delete this clinic and ALL its data?\nThis cannot be undone.')) return;
  showLoading('Deleting clinic\u2026');
  await dbDeleteClinic(id);
  clinics = await dbGetClinics();
  hideLoading();
  if (activeClinicId === id) {
    activeClinicId = null;
    localStorage.removeItem(ACTIVE_CLINIC_KEY);
  }
  showClinicGate();
  renderClinicGate();
}

// ════════════════════════════════════════════════════════════
//  TOPBAR
// ════════════════════════════════════════════════════════════
function renderTopbarClinic() {
  var clinic = getActiveClinic();
  var nameEl = document.getElementById('topbarClinicName');
  var iconEl = document.getElementById('topbarClinicIcon');
  if (nameEl) nameEl.textContent = clinic ? clinic.name         : 'No Clinic';
  if (iconEl) iconEl.textContent = clinic ? (clinic.logo || '🏥') : '🏥';
}