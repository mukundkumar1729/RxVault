// ════════════════════════════════════════════════════════════
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

var TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// ─── Quick chips & note templates data ───────────────────
var QUICK_CHIPS_DATA    = null;
var NOTE_TEMPLATES_DATA = null;

async function loadQuickChips() {
  try { QUICK_CHIPS_DATA = await fetch('../data/quick-chips.json').then(function(r){ return r.json(); }); }
  catch(e) { QUICK_CHIPS_DATA = null; }
}
async function loadNoteTemplates() {
  try {
    NOTE_TEMPLATES_DATA = await fetch('../data/note-templates.json').then(function(r){ return r.json(); });
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
  prescriptions = await dbGetPrescriptions(activeClinicId);
}

async function loadPatientRegistry() {
  console.log('[App] Loading patients for clinic:', activeClinicId);
  patientRegistry = await dbGetPatients(activeClinicId);
  console.log('[App] Patients loaded:', patientRegistry.length, patientRegistry.map(function(p){ return p.name; }));
}

async function loadDoctorRegistry() {
  doctorRegistry = await dbGetDoctors(activeClinicId);
}

function genId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function genPatientId() { return 'PID-' + Date.now().toString(36).toUpperCase(); }

// ─── Main init — called after clinic is selected ─────────
async function initAppForClinic() {
  isAdminUnlocked = false;
  showLoading('Loading clinic data…');
  renderTopbarClinic();
  await Promise.all([
    loadData(),
    loadPatientRegistry(),
    loadDoctorRegistry(),
    loadQuickChips(),
    loadNoteTemplates()
  ]);
  hideLoading();
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
  ['statTotal','statsTotal'].forEach(function(id){ setEl(id, total); });
  ['statAllo','statsAllo'].forEach(function(id){ setEl(id, allo); });
  ['statHomo','statsHomo'].forEach(function(id){ setEl(id, homo); });
  ['statAyur','statsAyur'].forEach(function(id){ setEl(id, ayur); });
  setEl('badgeAll', total);
  setEl('badgeRecent', recent);
  setEl('badgeActive', active);
  setEl('badgeDoctors', doctorRegistry.length);
  setEl('badgePatients', patientRegistry.length);
  var pendingRx = prescriptions.filter(function(p){ return !p.dispenseDate; }).length;
  setEl('badgePharmacy', pendingRx);
}

// ─── Render entry point ───────────────────────────────────
function render() { updateStats(); applyFilters(); applyPermissionUI(); }

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

// ─── Boot ─────────────────────────────────────────────────
(async function boot() {
  var gateShown = await initClinicGate();
  if (!gateShown) await initAppForClinic();
})();
