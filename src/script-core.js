//  SCRIPT-CORE.JS — State, data loading, app init & boot
//  Depends on: script-utils.js, supabase.js, auth.js, clinic.js
// ════════════════════════════════════════════════════════════

// ─── Global state ─────────────────────────────────────────
var prescriptions      = [];
var editingId          = null;
var activeNoteCategories = new Set();
var currentView        = 'all';
var currentTypeFilter  = 'all';
var deleteTargetId     = null;
var doctorRegistry     = [];
var isAdminUnlocked    = false;
var editingDoctorIdx   = null;
var patientRegistry    = [];
var appointmentRegistry = [];
var billingRegistry    = [];

var TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// ─── Quick chips & note templates data ───────────────────
var QUICK_CHIPS_DATA    = null;
var NOTE_TEMPLATES_DATA = null;

async function loadQuickChips() {
  try { QUICK_CHIPS_DATA = await fetch('data/quick-chips.json').then(function(r){ return r.json(); }); }
  catch(e) { QUICK_CHIPS_DATA = null; }
}
async function loadNoteTemplates() {
  try {
    NOTE_TEMPLATES_DATA = await fetch('data/note-templates.json').then(function(r){ return r.json(); });
    var sel = document.getElementById('noteTemplate');
    if (sel && NOTE_TEMPLATES_DATA) {
      sel.innerHTML = '<option value="">— Choose a template —</option>' +
        NOTE_TEMPLATES_DATA.map(function(t){ return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('');
    }
  } catch(e) { NOTE_TEMPLATES_DATA = null; }
}

// ─── Admin PIN ────────────────────────────────────────────
function getAdminPin() { return getActiveClinic()?.pin || 'admin1234'; }

// ─── Data loaders ─────────────────────────────────────────
async function loadData() {
  await Promise.all([
    dbGetPrescriptions(activeClinicId).then(function(d){ prescriptions = d; }),
    loadStaffData()
  ]);
}
async function loadStaffData() {
  if (typeof dbGetClinicStaff !== 'function') return;
  var staff = await dbGetClinicStaff(activeClinicId);
  window.staffStatusMap = {};
  if (staff) {
    staff.forEach(function(s) {
      if (s.status && s.status !== 'available') {
        window.staffStatusMap[s.name] = { status: s.status, until: s.status_until };
      }
    });
  }
}

async function loadPatientRegistry() {
  patientRegistry = await dbGetPatients(activeClinicId);
}

async function loadDoctorRegistry() {
  doctorRegistry = await dbGetDoctors(activeClinicId);
}

async function loadAppointmentRegistry() {
  if (typeof dbGetAppointments !== 'function') return;
  appointmentRegistry = await dbGetAppointments(activeClinicId);
}

async function loadBillingRegistry() {
  if (typeof dbGetInvoices !== 'function') return;
  billingRegistry = await dbGetInvoices(activeClinicId);
}

function genId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function genPatientId() { return 'PID-' + Date.now().toString(36).toUpperCase(); }

// ─── Main init — called after clinic is selected ─────────
async function initAppForClinic() {
  isAdminUnlocked = false;
  
  if (typeof window.showLoading === 'function') window.showLoading('Loading clinic data…');
  renderTopbarClinic();

  // Restore current user's status for this clinic
  if (typeof currentUser !== 'undefined' && currentUser) {
    var member = await dbGetStaffMember(activeClinicId, currentUser.id);
    if (member) {
      currentUser.status = member.status;
      currentUser.status_until = member.status_until;
      if (typeof updateStatusUI === 'function') updateStatusUI();
    }
  }

  await Promise.all([
    loadData(),
    loadPatientRegistry(),
    loadDoctorRegistry(),
    loadQuickChips(),
    loadNoteTemplates(),
    (async () => { if (typeof loadAppointmentRegistry === 'function') await loadAppointmentRegistry(); })(),
    (async () => { if (typeof loadBillingRegistry === 'function') await loadBillingRegistry(); })()
  ]);

  if (typeof window.hideLoading === 'function') window.hideLoading();
  
  render();
  updateStats();
  if (currentView === 'doctors')  renderAdminDoctorList();
  if (currentView === 'patients') renderPatientsPage(patientRegistry);
  if (typeof applyPermissionGuards === 'function') applyPermissionGuards();
  if (typeof initAiSearchPanel    === 'function') initAiSearchPanel();
}

// ─── Stats ────────────────────────────────────────────────
function updateStats() {
  var total  = prescriptions.length;
  var allo   = prescriptions.filter(function(p){ return p.type === 'allopathy'; }).length;
  var homo   = prescriptions.filter(function(p){ return p.type === 'homeopathy'; }).length;
  var ayur   = prescriptions.filter(function(p){ return p.type === 'ayurveda'; }).length;
  var now    = new Date();
  var thirty = new Date(now - 30 * 24 * 60 * 60 * 1000);
  var recent = prescriptions.filter(function(p){ return new Date(p.date) >= thirty; }).length;
  var active = prescriptions.filter(function(p){ return p.status === 'active'; }).length;

  var setEl = function(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };

  ['statTotal','statsTotal'].forEach(function(id){ setEl(id, total); });
  ['statAllo','statsAllo'].forEach(function(id){ setEl(id, allo); });
  ['statHomo','statsHomo'].forEach(function(id){ setEl(id, homo); });
  ['statAyur','statsAyur'].forEach(function(id){ setEl(id, ayur); });

  setEl('badgeAll', total);
  setEl('badgeRecent', recent);
  setEl('badgeActive', active);
  setEl('badgeDoctors', doctorRegistry.length);
  setEl('badgePatients', patientRegistry.length);
  
  // Appointments
  if (typeof appointmentRegistry !== 'undefined') {
    setEl('badgeAppointments', appointmentRegistry.length);
  }

  // Pharmacy
  var pendingRx = prescriptions.filter(function(p){ return !p.dispenseDate; }).length;
  setEl('badgePharmacy', pendingRx);

  // Billing
  if (typeof billingRegistry !== 'undefined') {
    setEl('badgeBilling', billingRegistry.length);
  }

  // Lab Orders
  var labOrders = prescriptions.reduce(function(acc, p){ return acc + (p.diagnostics ? p.diagnostics.length : 0); }, 0);
  setEl('badgeLabOrders', labOrders);

  // Follow-up & Vaccination
  setEl('badgeFollowup', 0);
  setEl('badgeVaccination', 0);
}

// ─── Render entry point ───────────────────────────────────
function render() { updateStats(); if (typeof applyFilters === 'function') applyFilters(); applyPermissionUI(); }

// ─── Permission UI ────────────────────────────────────────
function applyPermissionUI() {
  if (typeof can === 'undefined') return;
  document.querySelectorAll('[data-perm]').forEach(function(el) {
    var perm    = el.dataset.perm;
    var allowed = (can[perm] && typeof can[perm] === 'function') ? can[perm]() : true;
    el.style.display = allowed ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="openAddModal"]').forEach(function(btn){
    btn.style.display = can.addPrescription() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="openRegisterModal"]').forEach(function(btn){
    btn.style.display = can.registerPatient() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="exportAll"]').forEach(function(btn){
    btn.style.display = can.exportData() ? '' : 'none';
  });
}


// ─── Clinic Calls (Digital Bell) ──────────────────────────
var lastActiveCallIds = new Set();
async function ringBell() {
  if (!activeClinicId || !currentUser) return;
  var msg = 'Staff requested at OPD / Consultation Room';
  var ok = await dbRingBell(activeClinicId, currentUser.name, msg);
  if (ok) {
    if (typeof showToast === 'function') showToast('🔔 Bell rung! Staff notified.', 'success');
    checkClinicCalls();
  }
}

async function checkClinicCalls() {
  if (!activeClinicId) return;
  var calls = await dbGetActiveCalls(activeClinicId);
  renderClinicCalls(calls);
}

function renderClinicCalls(calls) {
  var container = document.getElementById('clinicCallNotifications');
  if (!container) return;

  var currentIds = new Set(calls.map(function(c){ return c.id; }));
  var newCalls = calls.filter(function(c){ return !lastActiveCallIds.has(c.id); });
  
  if (newCalls.length > 0) {
    playBellSound();
  }
  lastActiveCallIds = currentIds;

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  container.innerHTML = calls.map(function(c) {
    return '<div class="call-notif" style="pointer-events:all; background:var(--surface); border:2px solid var(--teal); border-radius:var(--radius); padding:12px 16px; box-shadow:var(--shadow-lg); animation:slideIn 0.3s ease; display:flex; flex-direction:column; gap:4px; min-width:240px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; gap:12px">' +
        '<div style="font-weight:700; color:var(--teal); font-size:13px;">🔔 CALL FROM ' + escHtml(c.caller_name).toUpperCase() + '</div>' +
        '<button onclick="clearClinicCall(\'' + c.id + '\')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; padding:4px;">✕</button>' +
      '</div>' +
      '<div style="font-size:12.5px; color:var(--text-primary); font-weight:500;">' + escHtml(c.message) + '</div>' +
      '<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">' + new Date(c.created_at).toLocaleTimeString() + '</div>' +
    '</div>';
  }).join('');
}

async function clearClinicCall(id) {
  await dbClearCall(id);
  checkClinicCalls();
}

function playBellSound() {
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch(e) {}
}

setInterval(function() {
  if (typeof activeClinicId !== 'undefined' && activeClinicId) checkClinicCalls();
}, 10000);
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof activeClinicId !== 'undefined' && activeClinicId) checkClinicCalls();
  }, 2000);
});

// ─── Phase 5 Modular Transition ──────────────────────────────
// Redundant legacy boot() removed in favor of ES6 main.js
// ════════════════════════════════════════════════════════════