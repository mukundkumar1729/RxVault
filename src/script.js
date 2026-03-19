// ════════════════════════════════════════════════════════════
//  STATE & STORAGE  — clinic-namespaced
// ════════════════════════════════════════════════════════════

var prescriptions = [];
var editingId = null;
var activeNoteCategories = new Set();
var currentView = 'all';
var currentTypeFilter = 'all';
var deleteTargetId = null;
var doctorRegistry = [];
var isAdminUnlocked = false;
var editingDoctorIdx = null;
var patientRegistry = [];

const TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// ─── Supabase-backed data layer ──────────────────────────

function getAdminPin() { return getActiveClinic()?.pin || 'admin1234'; }

async function loadPatientRegistry() {
  console.log('[App] Loading patients for clinic:', activeClinicId);
  patientRegistry = await dbGetPatients(activeClinicId);
  console.log('[App] Patients loaded:', patientRegistry.length, patientRegistry.map(p => p.name));
}
function genPatientId() { return 'PID-' + Date.now().toString(36).toUpperCase(); }

async function loadDoctorRegistry() {
  doctorRegistry = await dbGetDoctors(activeClinicId);
}
async function saveDoctorRegistryLocal() { /* individual saves handled per operation */ }

// ════════════════════════════════════════════════════════════
//  QUICK CHIPS + NOTE TEMPLATES
// ════════════════════════════════════════════════════════════
var QUICK_CHIPS_DATA = null;
var NOTE_TEMPLATES_DATA = null;

async function loadQuickChips() {
  try { QUICK_CHIPS_DATA = await fetch('../data/quick-chips.json').then(r => r.json()); } catch { QUICK_CHIPS_DATA = null; }
}
async function loadNoteTemplates() {
  try {
    NOTE_TEMPLATES_DATA = await fetch('../data/note-templates.json').then(r => r.json());
    const sel = document.getElementById('noteTemplate');
    if (sel && NOTE_TEMPLATES_DATA) {
      sel.innerHTML = '<option value="">— Choose a template —</option>' +
        NOTE_TEMPLATES_DATA.map(t => `<option value="${t.key}">${t.label}</option>`).join('');
    }
  } catch { NOTE_TEMPLATES_DATA = null; }
}

async function loadData() {
  prescriptions = await dbGetPrescriptions(activeClinicId);
}
async function saveData() { /* no-op: upserts done individually */ }
function genId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

// ════════════════════════════════════════════════════════════
//  INIT — called after clinic is selected
// ════════════════════════════════════════════════════════════
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
  // Refresh active view if on doctors or patients
  if (currentView === 'doctors') renderAdminDoctorList();
  if (currentView === 'patients') renderPatientsPage(patientRegistry);
  // Apply permission guards based on role
  if (typeof applyPermissionGuards === 'function') applyPermissionGuards();
  // Init AI search panel
  if (typeof initAiSearchPanel === 'function') initAiSearchPanel();
}

// ════════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════════
function render() { updateStats(); applyFilters(); applyPermissionUI(); }

function applyPermissionUI() {
  if (typeof can === 'undefined') return; // auth not loaded yet

  // Generic data-perm handler — covers ALL permission-gated elements
  document.querySelectorAll('[data-perm]').forEach(function(el) {
    var perm = el.dataset.perm;
    var allowed = (can[perm] && typeof can[perm] === 'function') ? can[perm]() : true;
    el.style.display = allowed ? '' : 'none';
  });

  // Specific onclick-based guards
  document.querySelectorAll('[onclick*="openAddModal"]').forEach(function(btn) {
    btn.style.display = can.addPrescription() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="openRegisterModal"]').forEach(function(btn) {
    btn.style.display = can.registerPatient() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="exportAll"]').forEach(function(btn) {
    btn.style.display = can.exportData() ? '' : 'none';
  });
}

function updateStats() {
  const total = prescriptions.length;
  const allo = prescriptions.filter(p => p.type === 'allopathy').length;
  const homo = prescriptions.filter(p => p.type === 'homeopathy').length;
  const ayur = prescriptions.filter(p => p.type === 'ayurveda').length;
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const recent = prescriptions.filter(p => new Date(p.date) >= thirtyDaysAgo).length;
  const active = prescriptions.filter(p => p.status === 'active').length;
  ['statTotal','statsTotal'].forEach(id => setEl(id, total));
  ['statAllo','statsAllo'].forEach(id => setEl(id, allo));
  ['statHomo','statsHomo'].forEach(id => setEl(id, homo));
  ['statAyur','statsAyur'].forEach(id => setEl(id, ayur));
  setEl('badgeAll', total); setEl('badgeRecent', recent); setEl('badgeActive', active);
  setEl('badgeDoctors', doctorRegistry.length);
  setEl('badgePatients', patientRegistry.length);
  var pendingRx = prescriptions.filter(function(p){ return !p.dispenseDate; }).length;
  setEl('badgePharmacy', pendingRx);
}
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function getSearchVals() {
  return {
    patient:   (document.getElementById('srchPatient')?.value   || '').toLowerCase().trim(),
    doctor:    (document.getElementById('srchDoctor')?.value    || '').toLowerCase().trim(),
    diagnosis: (document.getElementById('srchDiagnosis')?.value || '').toLowerCase().trim(),
    phone:     (document.getElementById('srchPhone')?.value     || '').toLowerCase().trim(),
    email:     (document.getElementById('srchEmail')?.value     || '').toLowerCase().trim(),
    id:        (document.getElementById('srchId')?.value        || '').toLowerCase().trim(),
    dateFrom:  (document.getElementById('srchDateFrom')?.value  || ''),
    dateTo:    (document.getElementById('srchDateTo')?.value    || ''),
    status:    (document.getElementById('statusFilter')?.value  || 'all'),
    sort:      (document.getElementById('sortSelect')?.value    || 'newest'),
  };
}

function applyFilters() {
  let filtered = [...prescriptions];
  const s = getSearchVals();
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (currentView === 'recent') filtered = filtered.filter(p => new Date(p.date) >= thirtyDaysAgo);
  if (currentView === 'active') filtered = filtered.filter(p => p.status === 'active');
  if (currentTypeFilter !== 'all') filtered = filtered.filter(p => p.type === currentTypeFilter);
  if (s.patient)   filtered = filtered.filter(p => (p.patientName||'').toLowerCase().includes(s.patient));
  if (s.doctor)    filtered = filtered.filter(p => (p.doctorName||'').toLowerCase().includes(s.doctor));
  if (s.diagnosis) filtered = filtered.filter(p => (p.diagnosis||'').toLowerCase().includes(s.diagnosis)||(p.hospital||'').toLowerCase().includes(s.diagnosis));
  if (s.phone)     filtered = filtered.filter(p => (p.phone||'').replace(/\s/g,'').includes(s.phone.replace(/\s/g,''))||(p.doctorPhone||'').replace(/\s/g,'').includes(s.phone.replace(/\s/g,'')));
  if (s.email)     filtered = filtered.filter(p => (p.email||'').toLowerCase().includes(s.email));
  if (s.id)        filtered = filtered.filter(p => (p.id||'').toLowerCase().includes(s.id)||(p.patientId||'').toLowerCase().includes(s.id));
  if (s.dateFrom)  filtered = filtered.filter(p => p.date && p.date >= s.dateFrom);
  if (s.dateTo)    filtered = filtered.filter(p => p.date && p.date <= s.dateTo);
  if (s.status !== 'all') filtered = filtered.filter(p => p.status === s.status);
  if (s.sort === 'newest')  filtered.sort((a,b) => new Date(b.date)-new Date(a.date));
  if (s.sort === 'oldest')  filtered.sort((a,b) => new Date(a.date)-new Date(b.date));
  if (s.sort === 'patient') filtered.sort((a,b) => (a.patientName||'').localeCompare(b.patientName||''));
  if (s.sort === 'doctor')  filtered.sort((a,b) => (a.doctorName||'').localeCompare(b.doctorName||''));

  setEl('resultsShowing', filtered.length); setEl('resultsShowing2', filtered.length);
  setEl('resultsTotal', prescriptions.length);
  updateActiveFilterTags(s);
  const allTerms = [s.patient,s.doctor,s.diagnosis,s.phone,s.email,s.id].filter(Boolean);
  renderList(filtered, allTerms.join(' '), allTerms);
}

function updateActiveFilterTags(s) {
  const tags = [];
  if (s.patient)    tags.push({label:`Patient: "${s.patient}"`,    clear:()=>{document.getElementById('srchPatient').value='';applyFilters();}});
  if (s.doctor)     tags.push({label:`Doctor: "${s.doctor}"`,      clear:()=>{document.getElementById('srchDoctor').value='';applyFilters();}});
  if (s.diagnosis)  tags.push({label:`Diagnosis: "${s.diagnosis}"`,clear:()=>{document.getElementById('srchDiagnosis').value='';applyFilters();}});
  if (s.phone)      tags.push({label:`Phone: "${s.phone}"`,        clear:()=>{document.getElementById('srchPhone').value='';applyFilters();}});
  if (s.email)      tags.push({label:`Email: "${s.email}"`,        clear:()=>{document.getElementById('srchEmail').value='';applyFilters();}});
  if (s.id)         tags.push({label:`ID: "${s.id}"`,              clear:()=>{document.getElementById('srchId').value='';applyFilters();}});
  if (s.dateFrom)   tags.push({label:`From: ${formatDate(s.dateFrom)}`, clear:()=>{document.getElementById('srchDateFrom').value='';applyFilters();}});
  if (s.dateTo)     tags.push({label:`To: ${formatDate(s.dateTo)}`,     clear:()=>{document.getElementById('srchDateTo').value='';applyFilters();}});
  if (s.status!=='all') tags.push({label:`Status: ${capitalize(s.status)}`, clear:()=>{document.getElementById('statusFilter').value='all';applyFilters();}});
  if (currentTypeFilter!=='all') tags.push({label:`Type: ${capitalize(currentTypeFilter)}`, clear:()=>{currentTypeFilter='all';document.querySelectorAll('.type-filter-btn').forEach(b=>b.classList.remove('active-filter'));document.querySelector('.type-filter-btn').classList.add('active-filter');applyFilters();}});
  const badge = document.getElementById('searchActiveBadge');
  if (badge) badge.classList.toggle('show', tags.length>0);
  const container = document.getElementById('activeFilterTags');
  if (!container) return;
  if (!tags.length) { container.innerHTML='<span style="color:var(--text-muted);font-size:11px;font-style:italic">No filters active</span>'; return; }
  container.innerHTML='';
  tags.forEach(t => { const el=document.createElement('span'); el.className='active-filter-tag'; el.innerHTML=`${escHtml(t.label)} <span style="font-size:12px">×</span>`; el.addEventListener('click',t.clear); container.appendChild(el); });
}

function renderList(items, searchQuery='', allTerms=[]) {
  const container = document.getElementById('prescriptionsList');
  if (!items.length) {
    container.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No prescriptions found</div><div class="empty-sub">${searchQuery?'No records match your search criteria.':'Start by adding your first prescription.'}</div>${!searchQuery?`<button class="btn-add" onclick="openAddModal()">＋ Add First Prescription</button>`:''}</div>`;
    return;
  }
  container.innerHTML = items.map(p => renderCard(p, searchQuery, allTerms)).join('');
}

function renderCard(p, q='', allTerms=[]) {
  const hl = str => {
    if (!str) return escHtml(str||'—');
    let result = escHtml(str);
    const terms = allTerms.length ? allTerms : (q?[q]:[]);
    terms.forEach(term => {
      if (!term) return;
      const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
      result = result.replace(re,'<mark class="highlight">$1</mark>');
    });
    return result;
  };

  const typeLabel    = {allopathy:'💉 Allopathy', homeopathy:'🌿 Homeopathy', ayurveda:'🌱 Ayurveda'};
  const statusColors = {active:'var(--green)', completed:'var(--text-muted)', expired:'var(--red)'};
  const statusIcons  = {active:'🟢', completed:'✅', expired:'🔴'};

  // Medicines table
  let medsTable = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines recorded.</div>';
  if (p.medicines && p.medicines.length) {
    const rows = p.medicines.map(m =>
      '<tr><td><strong>' + escHtml(m.name||'—') + '</strong></td>' +
      '<td>' + escHtml(m.dosage||'—') + '</td>' +
      '<td>' + escHtml(m.frequency||'—') + '</td>' +
      '<td>' + escHtml(m.duration||'—') + '</td>' +
      '<td>' + escHtml(m.route||'—') + '</td></tr>'
    ).join('');
    medsTable = '<table class="medicine-table"><thead><tr>' +
      '<th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // Diagnostics section
  let diagSection = '';
  if (p.diagnostics && p.diagnostics.length) {
    const rows = p.diagnostics.map(d =>
      '<tr><td><strong>' + escHtml(d.test) + '</strong></td>' +
      '<td>' + escHtml(d.notes||'—') + '</td></tr>'
    ).join('');
    diagSection = '<div class="rx-diagnostics">' +
      '<div class="medicines-title">🔬 Diagnosis &amp; Tests (' + p.diagnostics.length + ')</div>' +
      '<table class="medicine-table"><thead><tr>' +
      '<th>Test / Investigation</th><th>Observation / Notes</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // Notes section
  const notesSection = p.notes
    ? '<div class="rx-notes">' +
        '<div class="rx-notes-label">📝 Clinical Notes</div>' +
        '<div class="rx-notes-text">' + escHtml(p.notes) + '</div>' +
      '</div>'
    : '';

  // Patient history section
  const cnt    = prescriptions.filter(x => x.patientName === p.patientName && x.id !== p.id).length;
  const revCnt = (p.revisions||[]).length;

  let historySection = '';
  if (cnt > 0) {
    historySection +=
      '<button class="history-toggle-btn" data-patient="' + escHtml(p.patientName) +
      '" data-id="' + p.id + '" onclick="togglePatientHistory(this)">' +
        '📋 Patient History ' +
        '<span class="hist-count">' + cnt + ' visit' + (cnt>1?'s':'') + '</span> ' +
        '<span class="hist-chevron">▼</span>' +
      '</button>' +
      '<div id="hist_' + p.id + '" class="hist-content" style="display:none"></div>';
  }
  if (revCnt > 0) {
    historySection +=
      '<button class="history-toggle-btn rev-btn" data-id="' + p.id + '" onclick="toggleRevisionHistory(this)">' +
        '📜 ' + revCnt + ' Revision' + (revCnt>1?'s':'') +
        ' <span class="hist-chevron">▼</span>' +
      '</button>' +
      '<div id="rev_' + p.id + '" class="hist-content" style="display:none"></div>';
  }

  // Card header meta
  const diagMeta   = p.diagnosis ? '<span class="rx-meta-item">🔬 ' + hl(p.diagnosis) + '</span>' : '';
  const hospMeta   = p.hospital  ? '<span class="rx-meta-item">🏥 ' + hl(p.hospital)  + '</span>' : '';
  const statusColor = statusColors[p.status] || 'var(--text-muted)';
  const statusIcon  = statusIcons[p.status]  || '';

  return (
    '<div class="rx-card" id="card_' + p.id + '">' +
      '<div class="rx-card-header" onclick="toggleCard(\'' + p.id + '\')">' +
        '<span class="rx-type-badge badge-' + p.type + '">' + (typeLabel[p.type]||p.type) + '</span>' +
        '<div class="rx-main">' +
          '<div class="rx-patient">' + hl(p.patientName) + '</div>' +
          '<div class="rx-meta">' +
            '<span class="rx-meta-item">🩺 ' + hl(p.doctorName) + '</span>' +
            diagMeta + hospMeta +
            '<span class="rx-meta-item" style="color:' + statusColor + '">' +
              statusIcon + ' ' + capitalize(p.status||'unknown') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="rx-date-badge">' + formatDate(p.date) + '</div>' +
        '<div class="rx-actions" onclick="event.stopPropagation()">' +
          '<button class="icon-btn print" title="Print"  onclick="printPrescription(\'' + p.id + '\')">🖨️</button>' +
          '<button class="icon-btn edit"  title="Edit"   onclick="openEditModal(\''    + p.id + '\')">✏️</button>' +
          (p.status === 'expired' ? '<button class="icon-btn" title="Renew" onclick="renewPrescription(\'' + p.id + '\')" style="color:var(--teal)">🔄</button>' : '') +
          '<button class="icon-btn delete" title="Delete" onclick="confirmDelete(\''   + p.id + '\')">🗑️</button>' +
        '</div>' +
        '<span class="chevron-icon">▼</span>' +
      '</div>' +
      '<div class="rx-card-body" id="body_' + p.id + '">' +
        '<div class="rx-details-grid">' +
          '<div class="detail-group"><div class="detail-label">Patient Age &amp; Gender</div><div class="detail-value">' + (p.age ? p.age+' yrs' : '—') + (p.gender ? ' · '+p.gender : '') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Blood Group</div><div class="detail-value">' + (p.bloodGroup||'—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Contact</div><div class="detail-value mono">' + (p.phone||'—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Specialization</div><div class="detail-value">' + (p.specialization||'—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Hospital / Clinic</div><div class="detail-value">' + (p.hospital||'—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Valid Until</div><div class="detail-value">' + (p.validUntil ? formatDate(p.validUntil) : '—') + '</div></div>' +
        '</div>' +
        '<div class="rx-medicines">' +
          '<div class="medicines-title">💊 Medicines (' + (p.medicines?p.medicines.length:0) + ')</div>' +
          medsTable +
        '</div>' +
        diagSection +
        notesSection +
        (historySection ? '<div class="rx-patient-history">' + historySection + '</div>' : '') +
        '<div class="rx-footer-actions">' +
          '<button class="btn-sm btn-outline-teal" onclick="printPrescription(\'' + p.id + '\')">🖨️ Print</button>' +
          '<button class="btn-sm btn-outline-teal" onclick="openEditModal(\''    + p.id + '\')">✏️ Edit</button>' +
          (p.status === 'expired' && can.addPrescription()
            ? '<button class="btn-sm btn-teal" onclick="renewPrescription(\'' + p.id + '\')">🔄 Renew Rx</button>'
            : '') +
          '<button class="btn-sm btn-outline-red"  onclick="confirmDelete(\''   + p.id + '\')">🗑️ Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function toggleCard(id) { document.getElementById('card_'+id).classList.toggle('expanded'); }

// ════════════════════════════════════════════════════════════
//  MODAL — ADD / EDIT
// ════════════════════════════════════════════════════════════
function openAddModal() {
  if (!can.addPrescription()) { showToast('You do not have permission to add prescriptions.', 'error'); return; }
  editingId=null; resetForm();
  document.getElementById('modalTitle').textContent='New Rx';
  document.getElementById('saveBtn').textContent='💾 Save Rx';
  document.getElementById('fDate').value=todayISO();
  document.getElementById('fValidUntil').value=addDays(todayISO(), 30);
  document.getElementById('medicinesEditor').innerHTML='';
  document.getElementById('diagnosticEditor').innerHTML='';
  expandSection('patientSection'); expandSection('doctorSection');
  addMedicineRow(); addDiagnosticRow(); renderQuickChips(); openModal('formModal');
}
function openEditModal(id) {
  const p = prescriptions.find(x=>x.id===id); if (!p) return;
  editingId=id; resetForm();
  document.getElementById('modalTitle').textContent='Edit Rx';
  document.getElementById('saveBtn').textContent='💾 Update Rx';
  document.querySelector(`input[name="medType"][value="${p.type}"]`).checked=true;
  const MAP = {fPatientName:'patientName',fAge:'age',fGender:'gender',fBloodGroup:'bloodGroup',fPhone:'phone',fEmail:'email',fDoctorName:'doctorName',fSpecialization:'specialization',fHospital:'hospital',fRegNo:'regNo',fDoctorPhone:'doctorPhone',fDate:'date',fValidUntil:'validUntil',fDiagnosis:'diagnosis',fStatus:'status',fNotes:'notes'};
  Object.entries(MAP).forEach(([fid,pkey]) => setVal(fid, p[pkey]));
  activeNoteCategories = new Set(p.noteCategories||[]);
  document.querySelectorAll('.note-cat-chip').forEach(btn => {
    btn.classList.toggle('active', activeNoteCategories.has(btn.getAttribute('data-cat')));
  });
  updateNoteCategoryDisplay();
  const ta=document.getElementById('fNotes'); if(ta){updateNotesCounter(ta);setTimeout(()=>autoResizeTextarea(ta),0);}
  const dta=document.getElementById('fDiagnosis'); if(dta){setTimeout(()=>{autoDiagResize(dta);updateDiagCounter(dta);},0);}
  const editor=document.getElementById('medicinesEditor'); editor.innerHTML='';
  if(p.medicines&&p.medicines.length) p.medicines.forEach(m=>addMedicineRow(m)); else addMedicineRow();
  const diagEditor=document.getElementById('diagnosticEditor'); diagEditor.innerHTML='';
  if(p.diagnostics&&p.diagnostics.length) p.diagnostics.forEach(d=>addDiagnosticRow(d)); else addDiagnosticRow();
  renderQuickChips(); openModal('formModal');
}
async function savePrescription() {
  const patientName=getVal('fPatientName'), doctorName=getVal('fDoctorName'), date=getVal('fDate');
  if (!patientName){showToast('Patient name is required.','error');focusEl('fPatientName');return;}
  if (!doctorName) {showToast('Doctor name is required.','error');focusEl('fDoctorName');return;}
  if (!date)       {showToast('Please select the date.','error');focusEl('fDate');return;}
  const rx = {
    id:editingId||genId(), type:document.querySelector('input[name="medType"]:checked').value,
    clinicId: activeClinicId,
    patientName, age:getVal('fAge'), gender:getVal('fGender'), bloodGroup:getVal('fBloodGroup'),
    phone:getVal('fPhone'), email:getVal('fEmail'), doctorName, specialization:getVal('fSpecialization'),
    hospital:getVal('fHospital'), regNo:getVal('fRegNo'), doctorPhone:getVal('fDoctorPhone'),
    date, validUntil:getVal('fValidUntil'), diagnosis:getVal('fDiagnosis'), status:getVal('fStatus'),
    medicines:getMedicines(), diagnostics:getDiagnostics(), notes:getVal('fNotes'),
    noteCategories:[...activeNoteCategories], updatedAt:new Date().toISOString()
  };
  if (editingId) {
    const idx = prescriptions.findIndex(p=>p.id===editingId);
    if (idx>-1) {
      const old=prescriptions[idx];
      const snap={...old}; delete snap.revisions;
      rx.revisions=[...(old.revisions||[]),{...snap,_savedAt:old.updatedAt||old.createdAt||old.date}];
      rx.createdAt=old.createdAt;
      prescriptions[idx]=rx;
    }
    showToast(`Rx updated for ${patientName}`,'success');
  } else {
    rx.createdAt=new Date().toISOString(); prescriptions.unshift(rx);
    showToast(`Rx saved for ${patientName}`,'success');
  }
  const ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('DB save failed — check console','error'); return; }
  // Generate and store embedding in background (premium only, non-blocking)
  storeEmbeddingForRx(rx).catch(() => {});
  closeModal('formModal'); render();
}

// ════════════════════════════════════════════════════════════
//  MEDICINE ROWS
// ════════════════════════════════════════════════════════════
function addMedicineRow(data={}) {
  const editor=document.getElementById('medicinesEditor');
  const row=document.createElement('div'); row.className='medicine-row';
  const freqOpts=['','Once daily','Twice daily (BD)','Thrice daily (TDS)','Four times daily (QID)','Every 6 hours','Every 8 hours','Every 12 hours','Before meals','After meals','At bedtime','As needed (SOS)','Weekly','Alternate days'];
  const durOpts=['','1 day','2 days','3 days','5 days','7 days (1 week)','10 days','14 days (2 weeks)','21 days','30 days (1 month)','45 days','60 days (2 months)','90 days (3 months)','Ongoing'];
  const routeOpts=['','Oral','Topical','Sublingual','Inhalation','IV (Intravenous)','IM (Intramuscular)','Subcutaneous','Rectal','Nasal','Ophthalmic','Otic'];
  const opts=(list,val)=>list.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o||'Select…'}</option>`).join('');
  row.innerHTML=`<input type="text" placeholder="Medicine name" value="${escAttr(data.name||'')}" data-field="name"><input type="text" placeholder="e.g. 500mg" value="${escAttr(data.dosage||'')}" data-field="dosage"><select data-field="frequency">${opts(freqOpts,data.frequency||'')}</select><select data-field="duration">${opts(durOpts,data.duration||'')}</select><select data-field="route">${opts(routeOpts,data.route||'')}</select><button class="btn-remove-med" onclick="removeMedRow(this)" title="Remove">✕</button>`;
  editor.appendChild(row);
}
function removeMedRow(btn){btn.closest('.medicine-row').remove();}
function getMedicines() {
  return Array.from(document.querySelectorAll('#medicinesEditor .medicine-row')).map(row=>({
    name:row.querySelector('[data-field="name"]').value.trim(),
    dosage:row.querySelector('[data-field="dosage"]').value.trim(),
    frequency:row.querySelector('[data-field="frequency"]').value.trim(),
    duration:row.querySelector('[data-field="duration"]').value.trim(),
    route:row.querySelector('[data-field="route"]').value.trim(),
  })).filter(m=>m.name);
}

// ════════════════════════════════════════════════════════════
//  DIAGNOSTIC ROWS
// ════════════════════════════════════════════════════════════
function addDiagnosticRow(data={}) {
  const editor=document.getElementById('diagnosticEditor');
  const row=document.createElement('div'); row.className='diagnostic-row';
  row.innerHTML=`<input type="text" list="testNameList" placeholder="e.g. CBC, MRI, X-Ray" value="${escAttr(data.test||'')}" data-field="test"><input type="text" placeholder="Observation / result notes" value="${escAttr(data.notes||'')}" data-field="notes"><button class="btn-remove-med" onclick="this.closest('.diagnostic-row').remove()" title="Remove">✕</button>`;
  editor.appendChild(row);
}
function getDiagnostics() {
  return Array.from(document.querySelectorAll('#diagnosticEditor .diagnostic-row')).map(row=>({
    test:row.querySelector('[data-field="test"]').value.trim(),
    notes:row.querySelector('[data-field="notes"]').value.trim(),
  })).filter(d=>d.test);
}

// ════════════════════════════════════════════════════════════
//  DELETE
// ════════════════════════════════════════════════════════════
function confirmDelete(id) {
  deleteTargetId=id; openModal('confirmModal');
  document.getElementById('confirmDeleteBtn').onclick=()=>{deletePrescription(id);closeModal('confirmModal');};
}
async function deletePrescription(id) {
  if (!can.deletePrescription()) { showToast('You do not have permission to delete prescriptions.', 'error'); return; }
  const p=prescriptions.find(x=>x.id===id);
  const ok = await dbDeletePrescription(id);
  if (!ok) { showToast('Delete failed — check console','error'); return; }
  prescriptions=prescriptions.filter(x=>x.id!==id); render();
  showToast(`Deleted Rx for ${p?.patientName||'patient'}`,'info');
}

// ════════════════════════════════════════════════════════════
//  PRINT
// ════════════════════════════════════════════════════════════
function printPrescription(id) {
  const p=prescriptions.find(x=>x.id===id); if (!p) return;
  const clinic=getActiveClinic();
  const tl={allopathy:'Allopathy',homeopathy:'Homeopathy',ayurveda:'Ayurveda'};
  const medsRows=(p.medicines||[]).map(m=>`<tr style="border-bottom:1px solid #eee"><td style="padding:6px 8px"><strong>${escHtml(m.name)}</strong></td><td style="padding:6px 8px">${escHtml(m.dosage)}</td><td style="padding:6px 8px">${escHtml(m.frequency)}</td><td style="padding:6px 8px">${escHtml(m.duration)}</td><td style="padding:6px 8px">${escHtml(m.route||'')}</td></tr>`).join('');
  const diagRows=(p.diagnostics||[]).map(d=>`<tr style="border-bottom:1px solid #eee"><td style="padding:6px 8px"><strong>${escHtml(d.test)}</strong></td><td style="padding:6px 8px">${escHtml(d.notes||'—')}</td></tr>`).join('');
  const clinicHeader = clinic ? `<div style="margin-bottom:4px;font-size:13px;color:#555">${escHtml(clinic.logo||'🏥')} ${escHtml(clinic.name)}${clinic.address?` · ${escHtml(clinic.address)}`:''}</div>` : '';
  const html=`<!DOCTYPE html><html><head><title>Prescription — ${escHtml(p.patientName)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600&family=DM+Serif+Display&display=swap" rel="stylesheet"><style>body{font-family:'DM Sans',sans-serif;color:#1a1a2e;margin:0;padding:30px;font-size:13px}.rx-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0a7c6e}.rx-logo{font-family:'DM Serif Display',serif;font-size:22px;color:#0f2240}.rx-logo span{color:#0a7c6e}.type-pill{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;background:#e6f5f3;color:#0a7c6e}h2{font-family:'DM Serif Display',serif;font-size:17px;color:#0f2240;margin:20px 0 10px;border-bottom:1px solid #eee;padding-bottom:6px}.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}.info-item label{display:block;font-size:10px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:2px}.info-item span{font-size:13px;font-weight:500}table{width:100%;border-collapse:collapse}thead{background:#f0f4f8}th{text-align:left;padding:8px;font-size:11px;font-weight:600;text-transform:uppercase;color:#666}.notes-box{background:#f7fafc;border-left:3px solid #0a7c6e;padding:12px 16px;border-radius:4px;margin-top:16px}.footer{margin-top:40px;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:16px}.sig-line{width:160px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;text-align:center}@media print{body{padding:20px}}</style></head><body onload="window.print()"><div class="rx-header"><div>${clinicHeader}<div class="rx-logo">💊 Rx<span>Vault</span></div><div style="font-size:11px;color:#888;margin-top:6px">Rx ID: ${p.id}</div></div><div style="text-align:right"><div class="type-pill">${tl[p.type]||p.type}</div><div style="margin-top:6px;font-size:12px;color:#555">Date: ${formatDate(p.date)}</div>${p.validUntil?`<div style="font-size:11px;color:#888">Valid until: ${formatDate(p.validUntil)}</div>`:''}</div></div><h2>Patient Details</h2><div class="info-grid"><div class="info-item"><label>Name</label><span>${escHtml(p.patientName)}</span></div><div class="info-item"><label>Age</label><span>${p.age?p.age+' yrs':'—'}</span></div><div class="info-item"><label>Gender</label><span>${p.gender||'—'}</span></div><div class="info-item"><label>Blood Group</label><span>${p.bloodGroup||'—'}</span></div><div class="info-item"><label>Phone</label><span>${p.phone||'—'}</span></div><div class="info-item"><label>Diagnosis</label><span>${p.diagnosis||'—'}</span></div></div><h2>Doctor / Practitioner</h2><div class="info-grid"><div class="info-item"><label>Name</label><span>Dr. ${escHtml(p.doctorName)}</span></div><div class="info-item"><label>Specialization</label><span>${p.specialization||'—'}</span></div><div class="info-item"><label>Reg. No.</label><span>${p.regNo||'—'}</span></div><div class="info-item"><label>Hospital/Clinic</label><span>${p.hospital||'—'}</span></div></div><h2>Prescribed Medicines</h2><table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead><tbody>${medsRows||'<tr><td colspan="5" style="padding:10px;color:#888;text-align:center">No medicines recorded</td></tr>'}</tbody></table>${diagRows?`<h2>🔬 Diagnosis &amp; Tests</h2><table><thead><tr><th>Test / Investigation</th><th>Observation / Notes</th></tr></thead><tbody>${diagRows}</tbody></table>`:''}${p.notes?`<div class="notes-box"><strong style="font-size:11px;text-transform:uppercase;color:#0a7c6e">Clinical Notes</strong><br><br>${escHtml(p.notes)}</div>`:''}<div class="footer"><div style="font-size:11px;color:#888">Generated by Rx Vault · ${new Date().toLocaleDateString()}</div><div class="sig-line">Doctor's Signature</div></div></body></html>`;
  const w=window.open('','_blank','width=800,height=700'); w.document.write(html); w.document.close();
}

// ════════════════════════════════════════════════════════════
//  EXPORT / IMPORT (clinic-scoped)
// ════════════════════════════════════════════════════════════
function exportAll() {
  if (!can.exportData()) { showToast('You do not have permission to export data.', 'error'); return; }
  if (!prescriptions.length){showToast('No prescriptions to export.','error');return;}
  const clinic=getActiveClinic();
  const exportData = { clinicId: activeClinicId, clinicName: clinic?.name || '', exportedAt: new Date().toISOString(), prescriptions };
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`rxvault_${(clinic?.name||'clinic').replace(/\s+/g,'_')}_${todayISO()}.json`; a.click(); URL.revokeObjectURL(url);
  showToast(`Exported ${prescriptions.length} records`,'success');
}
function importData(e) {
  const file=e.target.files[0]; if (!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try {
      let data=JSON.parse(ev.target.result);
      // Support both old flat array and new {clinicId, prescriptions} format
      const incoming = Array.isArray(data) ? data : (data.prescriptions || []);
      if (!Array.isArray(incoming)) throw new Error();
      const ids=new Set(prescriptions.map(p=>p.id));
      const newOnes=incoming.filter(p=>!ids.has(p.id)).map(p=>({...p, clinicId: activeClinicId}));
      prescriptions=[...prescriptions,...newOnes]; saveData(); render();
      showToast(`Imported ${newOnes.length} new records`,'success');
    } catch {showToast('Invalid JSON file.','error');}
  };
  reader.readAsText(file); e.target.value='';
}

// ════════════════════════════════════════════════════════════
//  CLINICAL NOTES HELPERS
// ════════════════════════════════════════════════════════════
function appendNote(text) {
  const ta=document.getElementById('fNotes'); if(!ta)return;
  const sep=ta.value&&!ta.value.endsWith('\n')?'\n':'';
  ta.value+=sep+text;
  updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
}
function insertNoteText(text) {
  const ta=document.getElementById('fNotes'); if(!ta)return;
  const start=ta.selectionStart,end=ta.selectionEnd;
  ta.value=ta.value.slice(0,start)+text+ta.value.slice(end);
  ta.selectionStart=ta.selectionEnd=start+text.length;
  updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
}
function clearNotes() {
  const ta=document.getElementById('fNotes');
  if(ta&&ta.value&&confirm('Clear all clinical notes?')){ta.value='';updateNotesCounter(ta);ta.style.height='';}
}
function applyNoteTemplate(key) {
  if(!key)return;
  const FALLBACK={fever:'• Drink plenty of warm fluids and rest.\n• Take paracetamol if temperature exceeds 100°F.',arthritis:'• Rest the affected joint. Avoid heavy lifting.',diabetes:'• Test blood sugar levels before meals and at bedtime.',hypertension:'• Check blood pressure daily and record readings.',ayurveda:'• Take medicine on an empty stomach with warm water.',homeopathy:'• Avoid coffee, mint during treatment.',postop:'• Keep wound clean and dry.',pediatric:'• Maintain hydration.',respiratory:'• Use inhaler as prescribed.',gastro:'• Eat small, frequent meals.'};
  let text='';
  if(NOTE_TEMPLATES_DATA){const t=NOTE_TEMPLATES_DATA.find(t=>t.key===key);if(t)text=t.text;}
  if(!text)text=FALLBACK[key]||'';
  if(!text)return;
  const ta=document.getElementById('fNotes'); if(!ta)return;
  if(ta.value&&!confirm('This will replace the current notes. Continue?')){document.getElementById('noteTemplate').value='';return;}
  ta.value=text; updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
  document.getElementById('noteTemplate').value='';
}

// ════════════════════════════════════════════════════════════
//  VIEW / FILTER
// ════════════════════════════════════════════════════════════
function setView(view) {
  if (currentView==='doctors'){
    document.getElementById('doctorsView').style.display='none';
    ['statsRow','controlsBar','prescriptionsList'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});
    const aiShow=document.getElementById('aiSearchPanel'); if(aiShow) aiShow.style.display='';
  }
  if (currentView==='patients'){
    const pv=document.getElementById('patientsView'); if(pv) pv.style.display='none';
    ['statsRow','controlsBar','prescriptionsList'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});
    const aiShow=document.getElementById('aiSearchPanel'); if(aiShow) aiShow.style.display='';
  }
  currentView=view;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  const titles={all:'All Rx',recent:'Recent Rx (Last 30 Days)',active:'Active Rx'};
  const subs={all:'Manage all your medical records',recent:'Rx issued in the last 30 days',active:'Currently active treatment records'};
  document.getElementById('pageTitle').textContent=titles[view]||'Rx';
  document.getElementById('pageSubtitle').textContent=subs[view]||'';
  applyFilters();
}
// View a specific prescription from patient history
function viewPatientRx(rxId) {
  setView_noNav('all');
  setTimeout(function() {
    var card = document.getElementById('card_' + rxId);
    if (card) {
      card.classList.add('expanded');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 150);
}

// Switch to All Records view programmatically (no event needed)
function setView_noNav(view) {
  if (currentView === 'patients') {
    const pv = document.getElementById('patientsView'); if(pv) pv.style.display = 'none';
    const ai = document.getElementById('aiSearchPanel'); if(ai) ai.style.display = '';
    ['statsRow','controlsBar','prescriptionsList'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = '';
    });
  }
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const allBtn = document.querySelector('.nav-item.active') || document.querySelectorAll('.nav-item')[0];
  if (allBtn) allBtn.classList.add('active');
  document.getElementById('pageTitle').textContent = 'All Rx';
  document.getElementById('pageSubtitle').textContent = 'Manage all your medical records';
  applyFilters();
}

function filterByType(type) {
  currentTypeFilter=type;
  document.querySelectorAll('.type-filter-btn').forEach(b=>b.classList.remove('active-filter'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active-filter');
  applyFilters();
}
function clearFilters() {
  ['srchPatient','srchDoctor','srchDiagnosis','srchPhone','srchEmail','srchId','srchDateFrom','srchDateTo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('sortSelect').value='newest'; document.getElementById('statusFilter').value='all';
  currentTypeFilter='all';
  document.querySelectorAll('.type-filter-btn').forEach(b=>b.classList.remove('active-filter'));
  const first=document.querySelector('.type-filter-btn'); if(first)first.classList.add('active-filter');
  applyFilters();
}

// ════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden';}
function closeModal(id){document.getElementById(id).classList.remove('open');document.body.style.overflow='';}
document.querySelectorAll('.modal-overlay').forEach(overlay=>{overlay.addEventListener('click',function(e){if(e.target===this)closeModal(this.id);});});

// ════════════════════════════════════════════════════════════
//  FORM HELPERS
// ════════════════════════════════════════════════════════════
function resetForm() {
  document.querySelectorAll('#formModal input:not([type=radio]), #formModal select, #formModal textarea').forEach(el=>{el.value='';});
  document.querySelector('input[name="medType"][value="allopathy"]').checked=true;
  document.getElementById('fStatus').value='active';
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  activeNoteCategories=new Set();
  document.querySelectorAll('.note-cat-chip').forEach(b=>b.classList.remove('active'));
  updateNoteCategoryDisplay();
  const ta=document.getElementById('fNotes'); if(ta){updateNotesCounter(ta);ta.style.height='';}
  const tmpl=document.getElementById('noteTemplate'); if(tmpl)tmpl.value='';
  clearDoctorAvailPanel();
  const diagEditor=document.getElementById('diagnosticEditor'); if(diagEditor)diagEditor.innerHTML='';
  const diagTa=document.getElementById('fDiagnosis'); if(diagTa){diagTa.style.height='';updateDiagCounter(diagTa);}
}
function getVal(id){return(document.getElementById(id)?.value||'').trim();}
function setVal(id,val){const el=document.getElementById(id);if(el&&val!=null)el.value=val;}
function focusEl(id){document.getElementById(id)?.focus();}

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════
function showToast(msg, type) {
  type = type || 'info';
  var icons = {success:'✅', error:'❌', info:'ℹ️'};
  var container = document.getElementById('toastContainer');
  if (!container) {
    // Create container if missing
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type]||'ℹ️') + '</span> ' + msg;
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('toast-fade');
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 350);
  }, 3200);
}

// ════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════
function escHtml(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(str){return String(str||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function formatDate(d){if(!d)return'—';try{var ds=String(d).length>10?d:d+'T00:00:00';return new Date(ds).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return d;}}
function addDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function todayISO(){return new Date().toISOString().split('T')[0];}
function capitalize(str){return str?str.charAt(0).toUpperCase()+str.slice(1):'';}

// ════════════════════════════════════════════════════════════
//  NOTES COUNTER / RESIZE
// ════════════════════════════════════════════════════════════
function updateNotesCounter(ta) {
  const el=document.getElementById('notesCounter'); if(!el)return;
  const text=ta.value.trim(); const words=text?text.split(/\s+/).length:0; const chars=ta.value.length;
  el.textContent=`${words} word${words!==1?'s':''} · ${chars} char${chars!==1?'s':''}`;
  el.classList.toggle('notes-counter-warn',chars>800);
}
function autoResizeTextarea(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,320)+'px';}

function toggleNoteCategory(btn) {
  const cat=btn.getAttribute('data-cat');
  if(activeNoteCategories.has(cat)){activeNoteCategories.delete(cat);btn.classList.remove('active');}
  else{activeNoteCategories.add(cat);btn.classList.add('active');}
  updateNoteCategoryDisplay();
}
function updateNoteCategoryDisplay() {
  const el=document.getElementById('notesCategoryDisplay'); if(!el)return;
  if(!activeNoteCategories.size){el.innerHTML='';return;}
  const labels={dietary:'🥗 Dietary',lifestyle:'🏃 Lifestyle',warning:'⚠️ Warning',followup:'📅 Follow-up',medication:'💊 Medication',rest:'😴 Rest'};
  el.innerHTML=[...activeNoteCategories].map(c=>`<span class="notes-cat-badge cat-${c}">${labels[c]||c}</span>`).join('');
}

// ════════════════════════════════════════════════════════════
//  DIAGNOSIS HELPERS
// ════════════════════════════════════════════════════════════
function appendDiag(text) {
  const ta=document.getElementById('fDiagnosis'); if(!ta)return;
  const sep=ta.value&&!ta.value.endsWith('\n')?', ':'';
  ta.value+=sep+text; updateDiagCounter(ta); autoDiagResize(ta); ta.focus();
  ta.selectionStart=ta.selectionEnd=ta.value.length;
}
function insertDiagText(text) {
  const ta=document.getElementById('fDiagnosis'); if(!ta)return;
  const start=ta.selectionStart,end=ta.selectionEnd;
  ta.value=ta.value.slice(0,start)+text+ta.value.slice(end);
  ta.selectionStart=ta.selectionEnd=start+text.length;
  updateDiagCounter(ta); autoDiagResize(ta); ta.focus();
}
function clearDiag() {
  const ta=document.getElementById('fDiagnosis'); if(!ta||!ta.value)return;
  ta.value=''; updateDiagCounter(ta); ta.style.height=''; ta.focus();
}
function updateDiagCounter(ta) {
  const el=document.getElementById('diagCounter'); if(!el)return;
  const text=ta.value.trim(); const words=text?text.split(/\s+/).length:0;
  el.textContent=`${words} word${words!==1?'s':''}`; el.classList.toggle('diag-warn',words>80);
}
function autoDiagResize(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,220)+'px';}

// ════════════════════════════════════════════════════════════
//  KEYBOARD
// ════════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal('formModal');closeModal('confirmModal');}
  if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();openAddModal();}
});

// ════════════════════════════════════════════════════════════
//  SEED DATA
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
//  DOCTOR AUTO-POPULATE
// ════════════════════════════════════════════════════════════
let regDropdownTimer=null;
function onRegNoInput(val){clearTimeout(regDropdownTimer);regDropdownTimer=setTimeout(()=>showRegSuggestions(val.trim()),150);}
function showRegSuggestions(val) {
  const dropdown=document.getElementById('regNoDropdown');
  if(!val||val.length<2){dropdown.classList.remove('open');return;}
  const seen=new Map();
  doctorRegistry.forEach(d=>{seen.set(d.regNo.toLowerCase(),{regNo:d.regNo,doctorName:d.name,specialization:d.specialization||'',hospital:d.hospital||'',doctorPhone:d.phone||''});});
  prescriptions.forEach(p=>{if(!p.regNo||!p.doctorName)return;const key=p.regNo.toLowerCase();if(!seen.has(key))seen.set(key,{regNo:p.regNo,doctorName:p.doctorName,specialization:p.specialization||'',hospital:p.hospital||'',doctorPhone:p.doctorPhone||''});});
  const matches=[...seen.values()].filter(d=>d.regNo.toLowerCase().includes(val.toLowerCase())||d.doctorName.toLowerCase().includes(val.toLowerCase()));
  if(!matches.length){dropdown.innerHTML=`<div class="reg-no-results">No saved doctors found for "<strong>${escHtml(val)}</strong>"</div>`;dropdown.classList.add('open');return;}
  dropdown.innerHTML=matches.map((d,i)=>`<div class="reg-dropdown-item" onmousedown="autoFillDoctor(${i})" data-idx="${i}"><div class="reg-item-name">Dr. ${escHtml(d.doctorName)} <span class="reg-item-badge">${escHtml(d.regNo)}</span></div><div class="reg-item-meta">${[d.specialization,d.hospital].filter(Boolean).join(' · ')||'No additional info'}</div></div>`).join('');
  dropdown._matches=matches; dropdown.classList.add('open');
}
function autoFillDoctor(idx) {
  const dropdown=document.getElementById('regNoDropdown');
  const d=dropdown._matches&&dropdown._matches[idx]; if(!d)return;
  setVal('fRegNo',d.regNo);setVal('fDoctorName',d.doctorName);setVal('fSpecialization',d.specialization);setVal('fHospital',d.hospital);setVal('fDoctorPhone',d.doctorPhone);
  dropdown.classList.remove('open');
  document.getElementById('doctorAutoMsg').textContent=`Filled: Dr. ${d.doctorName}`;
  document.getElementById('doctorAutoStatus').classList.remove('hidden');
  const fullDoc=doctorRegistry.find(dr=>dr.regNo===d.regNo);
  if(fullDoc) renderDoctorAvailPanel(fullDoc);
}
function hideRegDropdown(){setTimeout(()=>{document.getElementById('regNoDropdown').classList.remove('open');},200);}
function clearDoctorFields() {
  ['fRegNo','fDoctorName','fSpecialization','fHospital','fDoctorPhone'].forEach(id=>setVal(id,''));
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  clearDoctorAvailPanel(); focusEl('fRegNo');
}

// ════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ════════════════════════════════════════════════════════════
function openAdminPanel() {
  // Role-based auth check (auth.js) OR fallback to PIN
  var hasAccess = (typeof can !== 'undefined') ? can.accessAdminPanel() : false;
  var pinView   = document.getElementById('adminPinView');
  var doctorView = document.getElementById('adminDoctorView');

  if (!pinView || !doctorView) { showToast('Admin panel not found.', 'error'); return; }

  if (hasAccess) {
    // Logged in as admin/superadmin — bypass PIN
    isAdminUnlocked = true;
    pinView.style.display   = 'none';
    doctorView.style.display = '';
    renderAdminDoctorList();
    var ps = document.getElementById('adminPremiumSection');
    if (ps && typeof renderPremiumUpgradeSection === 'function') ps.innerHTML = renderPremiumUpgradeSection();
    openModal('adminModal');
  } else {
    // Not logged in as admin — show PIN screen
    isAdminUnlocked = false;
    pinView.style.display   = '';
    doctorView.style.display = 'none';
    var pinInp = document.getElementById('adminPinInput');
    var pinErr = document.getElementById('adminPinError');
    if (pinInp) pinInp.value = '';
    if (pinErr) pinErr.textContent = '';
    openModal('adminModal');
    setTimeout(function(){ if(pinInp) pinInp.focus(); }, 150);
  }
}
function checkAdminPin() {
  const entered=(document.getElementById('adminPinInput')?.value||'').trim();
  if(entered===getAdminPin()){
    isAdminUnlocked=true;
    document.getElementById('adminPinView').style.display='none';
    document.getElementById('adminDoctorView').style.display='';
    renderAdminDoctorList();
    const ps = document.getElementById('adminPremiumSection');
    if(ps && typeof renderPremiumUpgradeSection==='function') ps.innerHTML = renderPremiumUpgradeSection();
  } else {
    const err=document.getElementById('adminPinError'); if(err)err.textContent='Incorrect PIN. Try again.';
    const inp=document.getElementById('adminPinInput'); if(inp){inp.value='';inp.focus();}
  }
}
function lockAdmin() {
  isAdminUnlocked=false; closeModal('adminModal'); showToast('Admin panel locked','info');
}

// ─── Doctor CRUD ──────────────────────────────────────────
function renderAdminDoctorList() {
  const c=document.getElementById('adminDoctorList');
  if(!doctorRegistry.length){c.innerHTML='<div style="padding:28px;text-align:center;color:var(--text-muted)">No doctors registered yet.</div>';return;}
  const typeBg={allopathy:'var(--allopathy-bg)',homeopathy:'var(--homeopathy-bg)',ayurveda:'var(--ayurveda-bg)'};
  const typeClr={allopathy:'var(--allopathy)',homeopathy:'var(--homeopathy)',ayurveda:'var(--ayurveda)'};
  c.innerHTML=doctorRegistry.map((d,i)=>`
    <div class="admin-doctor-row">
      <div class="admin-dr-info">
        <div class="admin-dr-name">Dr. ${escHtml(d.name)} <span class="admin-dr-reg">${escHtml(d.regNo)}</span>
          <span style="background:${typeBg[d.type]||'#eee'};color:${typeClr[d.type]||'#555'};font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600">${capitalize(d.type||'')}</span>
        </div>
        <div class="admin-dr-sub">${escHtml(d.specialization||'')}${d.hospital?' · '+escHtml(d.hospital):''}</div>
        <div class="admin-dr-sub">${d.phone?'📞 '+escHtml(d.phone)+'&nbsp; ':''}${d.email?'✉️ '+escHtml(d.email):''}</div>
      </div>
      <div class="admin-dr-actions">
        <button class="btn-sm btn-outline-teal" onclick="openEditDoctorForm(${i})">✏️ Edit</button>
        <button class="btn-sm btn-outline-red" onclick="deleteDoctor(${i})">🗑️</button>
      </div>
    </div>`).join('');
}
function openAddDoctorForm() {
  editingDoctorIdx=null;
  document.getElementById('doctorFormTitle').textContent='➕ Add Doctor';
  ['dfRegNo','dfName','dfQualification','dfSpecialization','dfPhone','dfEmail','dfAddress'].forEach(id=>setVal(id,''));
  document.getElementById('dfType').value='allopathy';
  document.getElementById('dfUnavailable').checked=false;
  document.getElementById('availEditor').innerHTML='';
  populateHospitalDropdown('dfHospital','');
  addAvailRow(); closeModal('adminModal'); openModal('doctorFormModal');
}
function openEditDoctorForm(idx) {
  editingDoctorIdx=idx; const d=doctorRegistry[idx]; if(!d)return;
  document.getElementById('doctorFormTitle').textContent='✏️ Edit Doctor';
  setVal('dfRegNo',d.regNo);setVal('dfName',d.name);setVal('dfQualification',d.qualification||'');
  setVal('dfSpecialization',d.specialization||'');
  setVal('dfPhone',d.phone||'');setVal('dfEmail',d.email||'');setVal('dfAddress',d.address||'');
  populateHospitalDropdown('dfHospital', d.hospital||'');
  document.getElementById('dfType').value=d.type||'allopathy';
  document.getElementById('dfUnavailable').checked=!!d.unavailable;
  const editor=document.getElementById('availEditor'); editor.innerHTML='';
  (d.availability||[]).forEach(s=>addAvailRow(s)); if(!d.availability?.length)addAvailRow();
  closeModal('adminModal'); openModal('doctorFormModal');
}
async function saveDoctor() {
  const regNo=getVal('dfRegNo'),name=getVal('dfName');
  if(!regNo){showToast('Reg. Number is required.','error');return;}
  if(!name){showToast('Doctor name is required.','error');return;}
  if(editingDoctorIdx===null){const dup=doctorRegistry.find(d=>d.regNo.toLowerCase()===regNo.toLowerCase());if(dup){showToast(`Reg No "${regNo}" already exists.`,'error');return;}}
  const d={regNo,name,qualification:getVal('dfQualification'),specialization:getVal('dfSpecialization'),hospital:getVal('dfHospital'),phone:getVal('dfPhone'),email:getVal('dfEmail'),address:getVal('dfAddress'),type:document.getElementById('dfType').value,availability:getAvailSlots(),unavailable:document.getElementById('dfUnavailable').checked,clinicId:activeClinicId};
  if(editingDoctorIdx!==null){
    d.id = doctorRegistry[editingDoctorIdx].id;
    const ok = await dbUpsertDoctor(d, activeClinicId);
    if(!ok){showToast('DB save failed','error');return;}
    doctorRegistry[editingDoctorIdx]=d;showToast(`Updated Dr. ${name}`,'success');
  } else {
    d.id = 'dr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    const ok = await dbUpsertDoctor(d, activeClinicId);
    if(!ok){showToast('DB save failed','error');return;}
    doctorRegistry.push(d);showToast(`Added Dr. ${name}`,'success');
  }
  updateStats();
  closeModal('doctorFormModal');
  renderAdminDoctorList();
  if (currentView === 'doctors') renderDoctorsPage();
  // Reopen admin panel if it was open
  var adminModal = document.getElementById('adminModal');
  if (adminModal && !adminModal.classList.contains('open')) {
    var pinView    = document.getElementById('adminPinView');
    var doctorView = document.getElementById('adminDoctorView');
    if (pinView)    pinView.style.display    = 'none';
    if (doctorView) doctorView.style.display = '';
    openModal('adminModal');
  }
}
async function deleteDoctor(idx) {
  const d=doctorRegistry[idx]; if(!d)return;
  if(!confirm(`Delete Dr. ${d.name} (${d.regNo})?
This cannot be undone.`))return;
  if(d.id){ const ok=await dbDeleteDoctor(d.id); if(!ok){showToast('Delete failed','error');return;} }
  doctorRegistry.splice(idx,1); updateStats(); renderAdminDoctorList();
  if(currentView==='doctors')renderDoctorsPage();
  showToast(`Deleted Dr. ${d.name}`,'info');
}

// Availability rows
const DAYS_OF_WEEK=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function formatTime12to24(str){if(!str)return'';const m=str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return str;let h=parseInt(m[1]);const min=m[2],p=m[3].toUpperCase();if(p==='AM'&&h===12)h=0;if(p==='PM'&&h!==12)h+=12;return`${String(h).padStart(2,'0')}:${min}`;}
function formatTime24to12(t){if(!t)return'';const[hh,mm]=t.split(':').map(Number);const p=hh<12?'AM':'PM';const h12=hh===0?12:hh>12?hh-12:hh;return`${String(h12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${p}`;}
function parseAvailTime(timeStr){const parts=(timeStr||'').split('–').map(s=>s.trim());return{from:formatTime12to24(parts[0]||''),to:formatTime12to24(parts[1]||'')};}
function addAvailRow(data) {
  var editor = document.getElementById('availEditor');
  // If no data passed, copy values from last row
  if (!data) {
    var rows = editor.querySelectorAll('.avail-row');
    if (rows.length > 0) {
      var lastRow = rows[rows.length - 1];
      var lastDay  = lastRow.querySelector('.avail-day-select')?.value || '';
      var lastFrom = lastRow.querySelector('.avail-time-from')?.value || '';
      var lastTo   = lastRow.querySelector('.avail-time-to')?.value   || '';
      // Advance to next day
      var dayIdx = DAYS_OF_WEEK.indexOf(lastDay);
      var nextDay = DAYS_OF_WEEK[(dayIdx + 1) % DAYS_OF_WEEK.length];
      data = { day: nextDay, time: (lastFrom && lastTo) ? formatTime24to12(lastFrom) + ' – ' + formatTime24to12(lastTo) : '' };
    } else {
      data = {};
    }
  }
  var row = document.createElement('div');
  row.className = 'avail-row';
  var times = parseAvailTime(data.time || '');
  var dayOpts = DAYS_OF_WEEK.map(function(d) {
    return '<option value="' + d + '"' + (d === data.day ? ' selected' : '') + '>' + d + '</option>';
  }).join('');
  row.innerHTML =
    '<select class="avail-day-select">' + dayOpts + '</select>' +
    '<div class="avail-time-range">' +
      '<input type="time" class="avail-time-from" value="' + escAttr(times.from) + '">' +
      '<span class="avail-time-sep">–</span>' +
      '<input type="time" class="avail-time-to" value="' + escAttr(times.to) + '">' +
    '</div>' +
    '<button class="btn-remove-med" onclick="this.parentElement.remove()" title="Remove">✕</button>';
  editor.appendChild(row);
}
function getAvailSlots() {
  return Array.from(document.querySelectorAll('#availEditor .avail-row')).map(row=>{
    const from=row.querySelector('.avail-time-from')?.value||'';
    const to=row.querySelector('.avail-time-to')?.value||'';
    if(!from&&!to)return null;
    return{day:row.querySelector('.avail-day-select').value,time:`${formatTime24to12(from)} – ${formatTime24to12(to)}`};
  }).filter(s=>s&&s.time.trim()!=='–');
}

// ════════════════════════════════════════════════════════════
//  DOCTORS VIEW
// ════════════════════════════════════════════════════════════
function showDoctorView() {
  currentView='doctors';
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('navDoctors').classList.add('active');
  ['statsRow','controlsBar','prescriptionsList'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const pvHide=document.getElementById('patientsView'); if(pvHide) pvHide.style.display='none';
  const aiHide=document.getElementById('aiSearchPanel'); if(aiHide) aiHide.style.display='none';
  const phHide2=document.getElementById('pharmacyView'); if(phHide2) phHide2.style.display='none';
  document.getElementById('doctorsView').style.display='';
  document.getElementById('pageTitle').textContent='👨‍⚕️ Doctors & Availability';
  document.getElementById('pageSubtitle').textContent='Registered practitioners and their consultation schedules';
  const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const avSel=document.getElementById('doctorAvailFilter');
  if(avSel){
    avSel.innerHTML='<option value="">📅 All Availability</option>';
    const today=new Date();
    for(let i=0;i<7;i++){const d=new Date(today);d.setDate(today.getDate()+i);const dayName=DAY_NAMES[d.getDay()];const label=i===0?`🟢 Today (${dayName})`:i===1?`🔵 Tomorrow (${dayName})`:`📅 ${dayName}`;const opt=document.createElement('option');opt.value=dayName;opt.textContent=label;avSel.appendChild(opt);}
  }
  const fi=document.getElementById('doctorFilterInput');if(fi)fi.value='';
  const ft=document.getElementById('doctorTypeFilter');if(ft)ft.value='';
  if(avSel)avSel.value='';
  renderDoctorsPage(doctorRegistry);
}
function renderDoctorsPage(list=doctorRegistry) {
  const grid=document.getElementById('doctorsGrid');
  const banner=document.getElementById('todayBanner');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state"><div class="empty-icon">👨‍⚕️</div><div class="empty-title">${doctorRegistry.length?'No doctors match your filter.':'No Doctors Registered'}</div><div class="empty-sub">${doctorRegistry.length?'Try clearing the filter.':'Contact the admin to register doctors.'}</div></div>`;
    if(banner)banner.style.display='none';return;
  }
  const todayDrs=list.filter(d=>d.availability?.some(s=>s.day===TODAY_NAME));
  if(banner){banner.style.display='';banner.innerHTML=todayDrs.length?`<span class="today-dot">🟢</span> <strong>${todayDrs.length} doctor${todayDrs.length>1?'s':''} available today</strong> (${TODAY_NAME}) — ${todayDrs.map(d=>`Dr. ${escHtml(d.name)}`).join(', ')}`:`<span>📅</span> No doctors available today (${TODAY_NAME})`;}
  const typeIcon={allopathy:'💉',homeopathy:'🌿',ayurveda:'🌱'};
  const typeBg={allopathy:'var(--allopathy-bg)',homeopathy:'var(--homeopathy-bg)',ayurveda:'var(--ayurveda-bg)'};
  const typeClr={allopathy:'var(--allopathy)',homeopathy:'var(--homeopathy)',ayurveda:'var(--ayurveda)'};
  grid.innerHTML=list.map(d=>{
    const availToday=d.availability?.find(s=>s.day===TODAY_NAME);
    const isUnavailable=!!d.unavailable;
    const slotsHtml=(d.availability||[]).map(s=>`<div class="dr-slot${s.day===TODAY_NAME&&!isUnavailable?' dr-slot-today':''}"><span class="dr-slot-day">${s.day.substring(0,3)}</span><span class="dr-slot-time">${escHtml(s.time)}</span></div>`).join('');
    return`<div class="dr-card${availToday&&!isUnavailable?' dr-card-available':''}${isUnavailable?' dr-card-unavailable':''}">
      <div class="dr-card-header">
        <div class="dr-avatar" style="background:${typeBg[d.type]||'#eee'};color:${typeClr[d.type]||'#333'}">${typeIcon[d.type]||'🩺'}</div>
        <div class="dr-info"><div class="dr-name">Dr. ${escHtml(d.name)}</div><div class="dr-spec">${escHtml(d.specialization||'')}</div><div class="dr-reg-badge">${escHtml(d.regNo)}</div></div>
        ${isUnavailable?`<div class="dr-unavail-badge">🔴 Not Available</div>`:(availToday?`<div class="dr-today-badge">Today ✓<br><small>${escHtml(availToday.time)}</small></div>`:'')}
      </div>
      <div class="dr-card-body">
        ${d.hospital?`<div class="dr-detail">🏥 ${escHtml(d.hospital)}</div>`:''}
        ${d.qualification?`<div class="dr-detail">🎓 ${escHtml(d.qualification)}</div>`:''}
        ${d.phone?`<div class="dr-detail">📞 ${escHtml(d.phone)}</div>`:''}
        ${d.email?`<div class="dr-detail">✉️ ${escHtml(d.email)}</div>`:''}
        ${d.address?`<div class="dr-detail">📍 ${escHtml(d.address)}</div>`:''}
        <div class="dr-schedule"><div class="dr-schedule-title">📅 Weekly Schedule</div>
          ${isUnavailable?`<div class="dr-unavail-notice">⚠️ Doctor is currently marked as unavailable.</div>`:''}
          <div class="dr-slots">${slotsHtml||'<span style="color:var(--text-muted);font-size:12px">No schedule listed</span>'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function filterDoctors() {
  const q=(document.getElementById('doctorFilterInput')?.value||'').toLowerCase().trim();
  const type=document.getElementById('doctorTypeFilter')?.value||'';
  const avail=document.getElementById('doctorAvailFilter')?.value||'';
  let list=[...doctorRegistry];
  if(q)list=list.filter(d=>d.name.toLowerCase().includes(q)||d.regNo.toLowerCase().includes(q)||(d.specialization||'').toLowerCase().includes(q)||(d.hospital||'').toLowerCase().includes(q));
  if(type)list=list.filter(d=>d.type===type);
  if(avail)list=list.filter(d=>d.availability?.some(s=>s.day===avail));
  renderDoctorsPage(list);
}
function clearDoctorFilter() {
  ['doctorFilterInput','doctorTypeFilter','doctorAvailFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderDoctorsPage(doctorRegistry);
}

// ════════════════════════════════════════════════════════════
//  PATIENT HISTORY
// ════════════════════════════════════════════════════════════
function togglePatientHistory(btn) {
  const patientName=btn.dataset.patient, cardId=btn.dataset.id;
  const el=document.getElementById(`hist_${cardId}`); if(!el)return;
  const chevron=btn.querySelector('.hist-chevron');
  if(el.dataset.loaded==='1'){const open=el.style.display!=='none';el.style.display=open?'none':'';if(chevron)chevron.textContent=open?'▼':'▲';return;}
  el.dataset.loaded='1';
  const history=prescriptions.filter(p=>p.patientName===patientName&&p.id!==cardId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!history.length){el.innerHTML='<div class="hist-empty">No previous visits found.</div>';}
  else{
    const statusClr={active:'var(--green)',completed:'var(--text-muted)',expired:'var(--red)'};
    el.innerHTML=history.map(p=>`<div class="hist-row"><div class="hist-date">${formatDate(p.date)}</div><div class="hist-info"><span class="hist-diag">${escHtml(p.diagnosis||'No diagnosis recorded')}</span>${p.doctorName?`<span class="hist-dr">🩺 ${escHtml(p.doctorName)}</span>`:''}<span class="hist-status" style="color:${statusClr[p.status]||'var(--text-muted)'}">${capitalize(p.status||'')}</span></div>${p.medicines?.length?`<div class="hist-meds">💊 ${p.medicines.slice(0,3).map(m=>escHtml(m.name)).join(', ')}${p.medicines.length>3?` +${p.medicines.length-3} more`:''}</div>`:''}</div>`).join('');
  }
  el.style.display=''; if(chevron)chevron.textContent='▲';
}

// ════════════════════════════════════════════════════════════
//  REVISION HISTORY
// ════════════════════════════════════════════════════════════
function toggleRevisionHistory(btn) {
  const cardId=btn.dataset.id;
  const el=document.getElementById(`rev_${cardId}`); if(!el)return;
  const chevron=btn.querySelector('.hist-chevron');
  if(el.dataset.loaded==='1'){const open=el.style.display!=='none';el.style.display=open?'none':'';if(chevron)chevron.textContent=open?'▼':'▲';return;}
  el.dataset.loaded='1';
  const p=prescriptions.find(x=>x.id===cardId);
  const revisions=(p?.revisions||[]).slice().reverse();
  if(!revisions.length){el.innerHTML='<div class="hist-empty">No previous revisions.</div>';el.style.display='';return;}
  const typeLabel={allopathy:'💉 Allopathy',homeopathy:'🌿 Homeopathy',ayurveda:'🌱 Ayurveda'};
  el.innerHTML=revisions.map((rv,i)=>{
    const savedLabel=rv._savedAt?`Saved ${new Date(rv._savedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}`:`Version ${revisions.length-i}`;
    const medsSummary=(rv.medicines||[]).slice(0,3).map(m=>escHtml(m.name)).join(', ')+(rv.medicines?.length>3?` +${rv.medicines.length-3} more`:'');
    return`<div class="rev-row"><div class="rev-header"><span class="rev-version">v${revisions.length-i}</span><span class="rev-date">${savedLabel}</span><span class="rev-type">${typeLabel[rv.type]||rv.type}</span><button class="rev-restore-btn" onclick="restoreRevision('${cardId}',${revisions.length-1-i})">↩ Restore</button></div><div class="rev-body">${rv.diagnosis?`<div class="rev-field"><span class="rev-label">Diagnosis:</span> ${escHtml(rv.diagnosis)}</div>`:''} ${rv.status?`<div class="rev-field"><span class="rev-label">Status:</span> ${capitalize(rv.status)}</div>`:''} ${medsSummary?`<div class="rev-field"><span class="rev-label">Medicines:</span> 💊 ${medsSummary}</div>`:''} ${rv.notes?`<div class="rev-field"><span class="rev-label">Notes:</span> ${escHtml(rv.notes.substring(0,120))}${rv.notes.length>120?'…':''}</div>`:''}</div></div>`;
  }).join('');
  el.style.display=''; if(chevron)chevron.textContent='▲';
}
function restoreRevision(cardId,revIdx) {
  if(!confirm('Restore this revision? The current prescription will become a new revision.'))return;
  const pIdx=prescriptions.findIndex(x=>x.id===cardId); if(pIdx===-1)return;
  const p=prescriptions[pIdx];
  const revToRestore=(p.revisions||[])[revIdx]; if(!revToRestore)return;
  const snap={...p}; delete snap.revisions;
  const newRevisions=[...(p.revisions||[])]; newRevisions.splice(revIdx,1);
  newRevisions.push({...snap,_savedAt:p.updatedAt||p.createdAt||p.date});
  prescriptions[pIdx]={...revToRestore,id:cardId,revisions:newRevisions,updatedAt:new Date().toISOString()};
  saveData(); render(); showToast('Revision restored successfully','success');
}

// ════════════════════════════════════════════════════════════
//  QUICK CHIPS
// ════════════════════════════════════════════════════════════
const QUICK_CHIPS=[
  {icon:'💧',label:'Warm fluids',text:'Drink plenty of warm fluids.'},
  {icon:'🛏️',label:'Bed rest',text:'Take complete bed rest for 2–3 days.'},
  {icon:'🧊',label:'Avoid cold',text:'Avoid cold water and chilled foods.'},
  {icon:'🍽️',label:'After meals',text:'Take medicines after meals.'},
  {icon:'🥄',label:'Before meals',text:'Take medicines before meals.'},
  {icon:'🚭',label:'No alcohol/smoking',text:'Avoid alcohol and smoking.'},
  {icon:'📅',label:'F/U 7 days',text:'Follow-up after 7 days.'},
  {icon:'📅',label:'F/U 1 month',text:'Follow-up after 1 month.'},
  {icon:'🚨',label:'Return if worse',text:'Return immediately if symptoms worsen.'},
  {icon:'🏋️',label:'Avoid exertion',text:'Avoid strenuous physical activity.'},
  {icon:'🧂',label:'Low-salt diet',text:'Maintain a low-salt diet.'},
  {icon:'🍬',label:'Low-sugar diet',text:'Maintain a low-sugar diet.'},
  {icon:'😴',label:'Sleep 7-8h',text:'Get adequate sleep (7–8 hours per night).'},
  {icon:'🩹',label:'Keep clean/dry',text:'Keep wound/area clean and dry.'},
  {icon:'💊',label:'Take with water',text:'Take medicine with a full glass of water.'},
  {icon:'☀️',label:'Morning dose',text:'Take morning dose before 8 AM.'},
  {icon:'🌙',label:'Bedtime dose',text:'Take dose at bedtime.'},
  {icon:'❄️',label:'Keep refrigerated',text:'Store medicine in refrigerator.'},
];
function renderQuickChips(filter='') {
  const scroll=document.getElementById('quickChipsScroll'); if(!scroll)return;
  const chips=QUICK_CHIPS_DATA||QUICK_CHIPS;
  const q=filter.toLowerCase().trim();
  const filtered=q?chips.filter(c=>c.label.toLowerCase().includes(q)||c.text.toLowerCase().includes(q)):chips;
  if(!filtered.length){scroll.innerHTML='<span style="color:var(--text-muted);font-size:12px;padding:5px 0">No chips match</span>';return;}
  scroll.innerHTML=filtered.map(c=>`<button type="button" class="quick-chip" data-text="${escHtml(c.text)}" onclick="appendNote(this.dataset.text)">${c.icon} ${c.label}</button>`).join('');
}

// ════════════════════════════════════════════════════════════
//  INLINE AVAILABILITY PANEL
// ════════════════════════════════════════════════════════════
function renderDoctorAvailPanel(d) {
  const panel=document.getElementById('doctorAvailPanel');
  const slotsEl=document.getElementById('availInlineSlots');
  const nameEl=document.getElementById('availInlineDoctorName');
  if(!panel)return;
  if(nameEl)nameEl.textContent=`Dr. ${d.name}`;
  let slotsHtml='';
  if(d.unavailable){slotsHtml=`<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:12px;font-weight:600">🔴 Dr. ${escHtml(d.name)} is currently marked as unavailable.</div>`;}
  else if(!d.availability||!d.availability.length){slotsHtml='<span style="color:var(--text-muted);font-size:12px">No availability listed.</span>';}
  else{slotsHtml=d.availability.map(s=>`<div class="avail-slot${s.day===TODAY_NAME?' avail-slot-today':''}"><span class="avail-day">${s.day}${s.day===TODAY_NAME?' ✓':''}</span><span class="avail-time">${escHtml(s.time)}</span></div>`).join('');}
  if(slotsEl)slotsEl.innerHTML=slotsHtml;
  panel.classList.remove('hidden');
}
function clearDoctorAvailPanel(){const panel=document.getElementById('doctorAvailPanel');if(panel)panel.classList.add('hidden');}

// ════════════════════════════════════════════════════════════
//  COLLAPSIBLE SECTIONS
// ════════════════════════════════════════════════════════════
function toggleSection(sectionId){const s=document.getElementById(sectionId);if(s)s.classList.toggle('collapsed');}
function expandSection(sectionId){const el=document.getElementById(sectionId);if(el)el.classList.remove('collapsed');}

// ════════════════════════════════════════════════════════════
//  PATIENT REGISTRATION
// ════════════════════════════════════════════════════════════
function openRegisterModal() {
  if (!can.registerPatient()) { showToast('You do not have permission to register patients.', 'error'); return; }
  ['regName','regAge','regPhone','regEmail','regAddress','regFee'].forEach(id=>setVal(id,''));
  setVal('regGender','');setVal('regBloodGroup','');
  document.querySelector('input[name="regPayment"][value="Cash"]').checked=true;
  document.getElementById('regDate').value=todayISO();
  document.getElementById('regPid').textContent=genPatientId();
  const sel=document.getElementById('regDoctor');
  sel.innerHTML='<option value="">— Select Doctor —</option>'+
    doctorRegistry.map(d=>`<option value="${escAttr(d.name)}" data-reg="${escAttr(d.regNo)}"${d.unavailable?' disabled':''}>Dr. ${escHtml(d.name)}${d.unavailable?' (Unavailable)':''} — ${escHtml(d.specialization||d.type)}</option>`).join('');
  openModal('registerModal');
}
async function registerPatient() {
  const name=getVal('regName'),doctor=getVal('regDoctor');
  const fee=parseFloat(document.getElementById('regFee').value||'0');
  if(!name){showToast('Patient name is required.','error');focusEl('regName');return;}
  if(!doctor){showToast('Please select a consultant doctor.','error');focusEl('regDoctor');return;}
  if(!fee||fee<=0){showToast('Please enter a valid consultation fee.','error');focusEl('regFee');return;}
  const paymentMethod=document.querySelector('input[name="regPayment"]:checked')?.value||'Cash';
  const pid=document.getElementById('regPid').textContent;
  if(!confirm(`Confirm Payment\n\nConsultation Fee: ₹${fee}\nPayment Method: ${paymentMethod}\nDoctor: Dr. ${doctor}\n\nProceed with registration?`))return;
  const patient={id:pid,clinicId:activeClinicId,name,age:getVal('regAge'),gender:getVal('regGender'),bloodGroup:getVal('regBloodGroup'),phone:getVal('regPhone'),email:getVal('regEmail'),address:getVal('regAddress'),consultantDoctor:doctor,consultantFee:fee,paymentMethod,registrationDate:document.getElementById('regDate').value||todayISO(),registeredAt:new Date().toISOString()};
  const ok = await dbInsertPatient(patient);
  if(!ok){showToast('DB save failed — check console','error');return;}
  patientRegistry.unshift(patient);
  updateStats();
  // Refresh patients list immediately if currently viewing it
  if (currentView === 'patients') renderPatientsPage(patientRegistry);
  closeModal('registerModal');
  showToast('✅ Patient registered! ID: ' + pid + ' · Fee ₹' + fee + ' received via ' + paymentMethod, 'success');
  // Open new prescription modal pre-filled with patient data
  openAddModalForPatient(patient);
}


// ════════════════════════════════════════════════════════════
//  PATIENT FEE VALIDITY (7-day window)
// ════════════════════════════════════════════════════════════
var FEE_VALIDITY_DAYS = 7;

function getPatientFeeStatus(patient) {
  // Returns: 'valid' | 'expired' | 'never'
  if (!patient) return 'never';
  // Check if there's a payment within last 7 days
  var lastPayment = getLastPaymentDate(patient);
  if (!lastPayment) return 'never';
  var diffMs   = Date.now() - lastPayment.getTime();
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= FEE_VALIDITY_DAYS ? 'valid' : 'expired';
}

function getLastPaymentDate(patient) {
  // Check patient.registeredAt first (initial registration payment)
  // Then check prescriptions for this patient to find any re-payment entries
  var dates = [];
  if (patient.registeredAt) dates.push(new Date(patient.registeredAt));
  if (patient.lastFeeDate)   dates.push(new Date(patient.lastFeeDate));
  // Also check prescriptions tagged with fee payment
  prescriptions.forEach(function(rx) {
    if ((rx.patientName||'').trim().toLowerCase() === (patient.name||'').trim().toLowerCase()) {
      if (rx.feePaidDate) dates.push(new Date(rx.feePaidDate));
    }
  });
  if (!dates.length) return null;
  return dates.reduce(function(a, b) { return a > b ? a : b; });
}

function getFeeExpiryDate(patient) {
  var last = getLastPaymentDate(patient);
  if (!last) return null;
  var exp = new Date(last.getTime() + FEE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  return exp;
}

function getDaysRemaining(patient) {
  var exp = getFeeExpiryDate(patient);
  if (!exp) return 0;
  return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// Open prescription for existing patient — checks fee validity first
function openPrescriptionForPatient(patient) {
  var status = getPatientFeeStatus(patient);
  if (status === 'valid') {
    var days = getDaysRemaining(patient);
    showToast('✅ Fee valid for ' + days + ' more day' + (days !== 1 ? 's' : ''), 'success');
    openAddModalForPatient(patient);
  } else {
    // Fee expired or never paid — show payment modal
    openFeePaymentModal(patient);
  }
}

function openFeePaymentModal(patient) {
  var status = getPatientFeeStatus(patient);
  var overlay = document.getElementById('feePaymentOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'feePaymentOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  var exp = getFeeExpiryDate(patient);
  var expStr = exp ? formatDate(exp.toISOString().split('T')[0]) : '—';
  var statusMsg = status === 'expired'
    ? '<div style="background:var(--red-bg);color:var(--red);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">⚠️ Consultation fee expired on <strong>' + expStr + '</strong>. Payment required to continue.</div>'
    : '<div style="background:var(--allopathy-bg);color:var(--allopathy);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">ℹ️ No prior payment found. Please collect consultation fee.</div>';

  // Pre-fill fee from patient record
  var defaultFee = patient.consultantFee || 0;
  var defaultDoctor = patient.consultantDoctor || '';

  overlay.innerHTML =
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-title">💳 Collect Consultation Fee</div>' +
          '<div class="modal-subtitle">' + escHtml(patient.name) + ' · ' + escHtml(patient.id) + '</div>' +
        '</div>' +
        '<button class="modal-close" onclick="document.getElementById(&quot;feePaymentOverlay&quot;).classList.remove(&quot;open&quot;)">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        statusMsg +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field">' +
            '<label>Consultation Fee (₹) <span style="color:var(--red)">*</span></label>' +
            '<input type="number" id="feeAmount" value="' + defaultFee + '" min="0" placeholder="Enter fee amount">' +
          '</div>' +
          '<div class="field">' +
            '<label>Doctor</label>' +
            '<select id="feeDoctorSelect">' +
              '<option value="">— Select Doctor —</option>' +
              doctorRegistry.map(function(d) {
                return '<option value="' + escAttr(d.name) + '"' +
                  (d.name === defaultDoctor ? ' selected' : '') +
                  (d.unavailable ? ' disabled' : '') + '>Dr. ' + escHtml(d.name) + ' — ' + escHtml(d.specialization||d.type) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Payment Method</label>' +
          '<div style="display:flex;gap:12px;margin-top:6px">' +
            ['Cash','Card','UPI','Online'].map(function(m) {
              return '<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer">' +
                '<input type="radio" name="feePayment" value="' + m + '"' + (m === 'Cash' ? ' checked' : '') + '> ' + m +
              '</label>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="document.getElementById(&quot;feePaymentOverlay&quot;).classList.remove(&quot;open&quot;)">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="collectFeeAndProceed(' + JSON.stringify(patient).replace(/"/g,'&quot;') + ')">✅ Collect & Proceed to Prescription</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function collectFeeAndProceed(patient) {
  var fee    = parseFloat(document.getElementById('feeAmount')?.value || '0');
  var doctor = document.getElementById('feeDoctorSelect')?.value || patient.consultantDoctor || '';
  var method = document.querySelector('input[name="feePayment"]:checked')?.value || 'Cash';

  if (!fee || fee <= 0) { showToast('Please enter a valid fee amount.', 'error'); return; }

  // Record the payment date on patient record
  patient.lastFeeDate = new Date().toISOString();
  patient.consultantFee    = fee;
  patient.consultantDoctor = doctor;
  patient.paymentMethod    = method;

  // Update patient in DB
  await dbInsertPatient(Object.assign({}, patient, {
    registeredAt: patient.registeredAt || new Date().toISOString()
  })).catch(function() {});

  // Update local registry
  var idx = patientRegistry.findIndex(function(p) { return p.id === patient.id; });
  if (idx > -1) patientRegistry[idx] = patient;

  // Close fee modal
  var overlay = document.getElementById('feePaymentOverlay');
  if (overlay) { overlay.classList.remove('open'); }
  document.body.style.overflow = '';

  showToast('✅ Fee ₹' + fee + ' collected via ' + method + ' · Valid for ' + FEE_VALIDITY_DAYS + ' days', 'success');
  openAddModalForPatient(patient);
}

// ════════════════════════════════════════════════════════════
//  HOSPITAL / CLINIC DROPDOWN HELPER
// ════════════════════════════════════════════════════════════
function populateHospitalDropdown(selectId, currentValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // Build options from all clinics + any distinct hospitals already in doctorRegistry
  const clinicNames = clinics.map(c => c.name).filter(Boolean);
  const drHospitals = doctorRegistry.map(d => d.hospital).filter(Boolean);
  const allOptions  = [...new Set([...clinicNames, ...drHospitals])].sort();
  sel.innerHTML = '<option value="">— Select Clinic/Hospital —</option>' +
    allOptions.map(h =>
      `<option value="${escAttr(h)}" ${h === currentValue ? 'selected' : ''}>${escHtml(h)}</option>`
    ).join('');
  // Also allow typing custom value via a text fallback
  if (currentValue && !allOptions.includes(currentValue)) {
    sel.innerHTML += `<option value="${escAttr(currentValue)}" selected>${escHtml(currentValue)}</option>`;
  }
}

// ════════════════════════════════════════════════════════════
//  OPEN PRESCRIPTION MODAL PRE-FILLED WITH PATIENT DATA
// ════════════════════════════════════════════════════════════
function openAddModalForPatient(patient) {
  openAddModal();
  // Pre-fill patient fields
  if (!patient) return;
  setTimeout(() => {
    setVal('fPatientName', patient.name        || '');
    setVal('fAge',         patient.age         || '');
    setVal('fGender',      patient.gender      || '');
    setVal('fBloodGroup',  patient.bloodGroup  || '');
    setVal('fPhone',       patient.phone       || '');
    setVal('fEmail',       patient.email       || '');
    // Pre-fill doctor from consultant
    if (patient.consultantDoctor) {
      const dr = doctorRegistry.find(d => d.name === patient.consultantDoctor);
      if (dr) {
        setVal('fDoctorName',    dr.name           || '');
        setVal('fRegNo',         dr.regNo          || '');
        setVal('fSpecialization',dr.specialization || '');
        setVal('fHospital',      dr.hospital       || '');
        setVal('fDoctorPhone',   dr.phone          || '');
        document.getElementById('doctorAutoMsg').textContent = `Filled: Dr. ${dr.name}`;
        document.getElementById('doctorAutoStatus').classList.remove('hidden');
        renderDoctorAvailPanel(dr);
      } else {
        setVal('fDoctorName', patient.consultantDoctor);
      }
    }
    expandSection('patientSection');
    expandSection('doctorSection');
  }, 100);
}

// ════════════════════════════════════════════════════════════
//  PATIENTS VIEW
// ════════════════════════════════════════════════════════════
function showPatientsView() {
  currentView = 'patients';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('navPatients');
  if (navBtn) navBtn.classList.add('active');
  // Hide prescription view
  ['statsRow','controlsBar','prescriptionsList'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('doctorsView').style.display = 'none';
  var phHide3 = document.getElementById('pharmacyView'); if(phHide3) phHide3.style.display='none';
  document.getElementById('patientsView').style.display = '';
  const aiPanelHide = document.getElementById('aiSearchPanel');
  if (aiPanelHide) aiPanelHide.style.display = 'none';
  document.getElementById('pageTitle').textContent = '👥 Patients';
  document.getElementById('pageSubtitle').textContent = 'Registered patients for this clinic';
  renderPatientsPage(patientRegistry);
}

function renderPatientsPage(list) {
  var grid = document.getElementById('patientsGrid');
  if (!grid) return;

  if (!list || !list.length) {
    grid.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">👥</div>' +
        '<div class="empty-title">No Patients Registered</div>' +
        '<div class="empty-sub">Use "Register Patient" to add your first patient.</div>' +
        '<button class="btn-add" onclick="openRegisterModal()">👤 Register Patient</button>' +
      '</div>';
    return;
  }

  // Use DOM createElement to avoid all quote escaping issues
  var fragment = document.createDocumentFragment();

  list.forEach(function(p) {
    var cardId = 'pt_' + p.id;
    var rxList = prescriptions.filter(function(rx) {
      return (rx.patientName||'').trim().toLowerCase() === (p.name||'').trim().toLowerCase();
    });
    var rxCount = rxList.length;

    // ── Create card wrapper ──────────────────────────────────
    var card = document.createElement('div');
    card.className = 'rx-card';
    card.id = cardId;

    // ── Create header ────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'rx-card-header';
    header.style.cursor = 'pointer';
    header.addEventListener('click', function(e) {
      // Only toggle if not clicking the button
      if (!e.target.closest('button')) {
        card.classList.toggle('expanded');
      }
    });

    // Badge
    var badge = document.createElement('div');
    badge.className = 'rx-type-badge';
    badge.style.cssText = 'background:#e8f0fe;color:#1a6fdb';
    badge.textContent = '👤 Patient';
    header.appendChild(badge);

    // Main info
    var main = document.createElement('div');
    main.className = 'rx-main';
    var patientName = document.createElement('div');
    patientName.className = 'rx-patient';
    patientName.textContent = p.name;
    var meta = document.createElement('div');
    meta.className = 'rx-meta';
    var metaItems = [
      p.age    ? '🎂 ' + p.age + ' yrs'          : null,
      p.gender ? '⚧ '  + p.gender                : null,
      p.phone  ? '📱 '  + p.phone                 : null,
      p.consultantDoctor ? '🩺 Dr. ' + p.consultantDoctor : null,
    ].filter(Boolean);
    metaItems.forEach(function(txt) {
      var s = document.createElement('span');
      s.className = 'rx-meta-item';
      s.textContent = txt;
      meta.appendChild(s);
    });
    // Fee
    var fee = document.createElement('span');
    fee.className = 'rx-meta-item';
    fee.style.color = 'var(--green)';
    fee.textContent = '💰 ₹' + (p.consultantFee||0) + ' via ' + (p.paymentMethod||'Cash');
    meta.appendChild(fee);
    // Rx count badge
    if (rxCount > 0) {
      var rxBadge = document.createElement('span');
      rxBadge.className = 'rx-meta-item';
      rxBadge.innerHTML = '<span class="nav-badge" style="background:var(--teal);color:#fff">' + rxCount + ' Rx</span>';
      meta.appendChild(rxBadge);
    // Fee status badge
    var feeStatus = getPatientFeeStatus(p);
    var feeBadge = document.createElement('span');
    feeBadge.className = 'rx-meta-item';
    var feeBadgeInner = document.createElement('span');
    feeBadgeInner.className = 'nav-badge';
    if (feeStatus === 'valid') {
      var d = getDaysRemaining(p);
      feeBadgeInner.style.cssText = 'background:var(--green);color:#fff';
      feeBadgeInner.textContent = '✅ ' + d + 'd left';
    } else if (feeStatus === 'expired') {
      feeBadgeInner.style.cssText = 'background:var(--red-bg);color:var(--red)';
      feeBadgeInner.textContent = '⚠️ Fee expired';
    } else {
      feeBadgeInner.style.cssText = 'background:var(--bg);color:var(--text-muted);border:1px solid var(--border)';
      feeBadgeInner.textContent = '💳 Fee pending';
    }
    feeBadge.appendChild(feeBadgeInner);
    meta.appendChild(feeBadge);
    }
    main.appendChild(patientName);
    main.appendChild(meta);
    header.appendChild(main);

    // Date badge
    var dateBadge = document.createElement('div');
    dateBadge.className = 'rx-date-badge';
    dateBadge.textContent = formatDate(p.registrationDate);
    header.appendChild(dateBadge);

    // New Rx button
    var actions = document.createElement('div');
    actions.className = 'rx-actions';
    var newRxBtn = document.createElement('button');
    newRxBtn.className = 'btn-sm btn-outline-teal';
    newRxBtn.style.cssText = 'font-size:12px;padding:5px 12px';
    newRxBtn.textContent = '📝 New Rx';
    newRxBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openPrescriptionForPatient(p);
    });
    actions.appendChild(newRxBtn);
    header.appendChild(actions);

    // Chevron
    var chevron = document.createElement('span');
    chevron.className = 'chevron-icon';
    chevron.textContent = '▼';
    header.appendChild(chevron);

    card.appendChild(header);

    // ── Create body ──────────────────────────────────────────
    var body = document.createElement('div');
    body.className = 'rx-card-body';
    body.id = 'body_' + cardId;

    // Details grid
    var grid2 = document.createElement('div');
    grid2.className = 'rx-details-grid';
    grid2.style.paddingTop = '16px';
    var details = [
      ['Age & Gender',  (p.age||'—') + (p.gender ? ' · '+p.gender : '')],
      ['Blood Group',   p.bloodGroup || '—'],
      ['Phone',         p.phone      || '—'],
      ['Email',         p.email      || '—'],
      ['Address',       p.address    || '—'],
      ['Patient ID',    p.id],
    ];
    details.forEach(function(d) {
      var grp = document.createElement('div');
      grp.className = 'detail-group';
      grp.innerHTML = '<div class="detail-label">' + d[0] + '</div>' +
                      '<div class="detail-value">' + escHtml(d[1]) + '</div>';
      grid2.appendChild(grp);
    });
    body.appendChild(grid2);

    // Prescription history
    var histDiv = document.createElement('div');
    histDiv.className = 'rx-medicines';
    histDiv.style.marginTop = '14px';
    if (rxCount > 0) {
      var sorted = rxList.slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
      var titleDiv = document.createElement('div');
      titleDiv.className = 'medicines-title';
      titleDiv.textContent = '📋 Prescription History (' + rxCount + ')';
      histDiv.appendChild(titleDiv);
      var tbl = document.createElement('table');
      tbl.className = 'medicine-table';
      tbl.innerHTML = '<thead><tr><th>Date</th><th>Diagnosis</th><th>Doctor</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      sorted.forEach(function(rx) {
        var tr = document.createElement('tr');
        var statusColor = {active:'var(--green)',completed:'var(--text-muted)',expired:'var(--red)'}[rx.status]||'var(--text-muted)';
        tr.innerHTML =
          '<td>' + formatDate(rx.date) + '</td>' +
          '<td>' + escHtml(rx.diagnosis||'—') + '</td>' +
          '<td>' + escHtml(rx.doctorName||'—') + '</td>' +
          '<td style="color:' + statusColor + '">' + capitalize(rx.status||'') + '</td>';
        var tdBtn = document.createElement('td');
        var viewBtn = document.createElement('button');
        viewBtn.className = 'btn-sm btn-outline-teal';
        viewBtn.style.cssText = 'padding:3px 8px;font-size:11px';
        viewBtn.textContent = 'View Rx';
        viewBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          viewPatientRx(rx.id);
        });
        tdBtn.appendChild(viewBtn);
        tr.appendChild(tdBtn);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      histDiv.appendChild(tbl);
    } else {
      histDiv.innerHTML = '<div style="padding:10px 0;color:var(--text-muted);font-size:13px">📋 No prescriptions yet.</div>';
      var addBtn = document.createElement('button');
      addBtn.className = 'btn-sm btn-outline-teal';
      addBtn.style.marginTop = '6px';
      addBtn.textContent = '📝 Add First Prescription';
      addBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openAddModalForPatient(p);
      });
      histDiv.appendChild(addBtn);
    }
    body.appendChild(histDiv);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'rx-footer-actions';
    var footerBtn = document.createElement('button');
    footerBtn.className = 'btn-sm btn-teal';
    footerBtn.textContent = '📝 New Prescription';
    footerBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openPrescriptionForPatient(p);
    });
    footer.appendChild(footerBtn);
    body.appendChild(footer);

    card.appendChild(body);
    fragment.appendChild(card);
  });

  if (grid) {
    grid.innerHTML = '';
    grid.appendChild(fragment);
  }
}


function filterPatients() {
  const q = (document.getElementById('patientFilterInput')?.value || '').toLowerCase().trim();
  if (!q) { renderPatientsPage(patientRegistry); return; }
  const filtered = patientRegistry.filter(p =>
    (p.name  || '').toLowerCase().includes(q) ||
    (p.phone || '').toLowerCase().includes(q) ||
    (p.id    || '').toLowerCase().includes(q) ||
    (p.consultantDoctor || '').toLowerCase().includes(q)
  );
  renderPatientsPage(filtered);
}

function clearPatientFilter() {
  const inp = document.getElementById('patientFilterInput');
  if (inp) inp.value = '';
  renderPatientsPage(patientRegistry);
}

// ════════════════════════════════════════════════════════════
//  USER MENU
// ════════════════════════════════════════════════════════════
function openUserMenu() {
  var menu = document.getElementById('topbarUserMenu');
  if (!menu) return;
  var isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : '';
  // Hide staff option if no permission
  // staffMenuBtn removed - managed via data-perm in applyPermissionUI
  if (!isOpen) {
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', closeUserMenuOutside, { once: true });
    }, 10);
  }
}
function closeUserMenu() {
  var menu = document.getElementById('topbarUserMenu');
  if (menu) menu.style.display = 'none';
}
function closeUserMenuOutside(e) {
  var pill = document.querySelector('.topbar-user-pill');
  var menu = document.getElementById('topbarUserMenu');
  if (menu && pill && !pill.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
}















// ─── Audit Log ────────────────────────────────────────────



// ─── Change Password ──────────────────────────────────────







// ════════════════════════════════════════════════════════════
//  PHARMACY MODULE
//  Pharmacist can view prescriptions + mark medicines dispensed
// ════════════════════════════════════════════════════════════

function showPharmacyView() {
  currentView = 'pharmacy';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nb = document.getElementById('navPharmacy');
  if (nb) nb.classList.add('active');

  // Hide all other views
  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel','doctorsView','patientsView']
    .forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });

  var pv = document.getElementById('pharmacyView');
  if (pv) pv.style.display = '';

  document.getElementById('pageTitle').textContent    = '💊 Pharmacy';
  document.getElementById('pageSubtitle').textContent = 'Prescribed medicines queue for dispensing';

  renderPharmacyList();
}

function filterPharmacy() { renderPharmacyList(); }

function renderPharmacyList() {
  var container   = document.getElementById('pharmacyList');
  var statsEl     = document.getElementById('pharmacyStats');
  var searchVal   = (document.getElementById('pharmacySearch')?.value    || '').toLowerCase().trim();
  var statusFilter= document.getElementById('pharmacyStatusFilter')?.value || 'all';
  var typeFilter  = document.getElementById('pharmacyTypeFilter')?.value   || 'all';

  if (!container) return;

  // Only show active prescriptions (not expired/completed unless filter says otherwise)
  var list = prescriptions.filter(function(rx) {
    if (typeFilter !== 'all' && rx.type !== typeFilter) return false;
    // Status filter: 'pending' = not yet dispensed (no dispenseDate), 'dispensed' = has dispenseDate
    if (statusFilter === 'pending')   return !rx.dispenseDate;
    if (statusFilter === 'dispensed') return !!rx.dispenseDate;
    if (statusFilter === 'active')    return rx.status === 'active';
    return true;
  });

  // Apply search
  if (searchVal) {
    list = list.filter(function(rx) {
      var haystack = [
        rx.patientName, rx.doctorName, rx.diagnosis,
        (rx.medicines||[]).map(function(m){ return m.name; }).join(' ')
      ].join(' ').toLowerCase();
      return haystack.includes(searchVal);
    });
  }

  // Sort: undispensed first, then by date desc
  list.sort(function(a,b) {
    if (!a.dispenseDate && b.dispenseDate) return -1;
    if (a.dispenseDate && !b.dispenseDate) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  // Stats
  var total       = prescriptions.length;
  var pending     = prescriptions.filter(function(rx){ return !rx.dispenseDate; }).length;
  var dispensed   = prescriptions.filter(function(rx){ return !!rx.dispenseDate; }).length;
  var todayStr    = todayISO();
  var todayCount  = prescriptions.filter(function(rx){ return rx.date === todayStr; }).length;

  if (statsEl) {
    statsEl.innerHTML = [
      { label:'Total Rx',   val: total,     bg:'var(--surface2)', clr:'var(--text-primary)' },
      { label:'Pending',    val: pending,   bg:'var(--allopathy-bg)', clr:'var(--allopathy)' },
      { label:'Dispensed',  val: dispensed, bg:'var(--green-pale,#e8f5e9)', clr:'var(--green)' },
      { label:"Today's Rx", val: todayCount,bg:'var(--teal-pale)',  clr:'var(--teal)' },
    ].map(function(s) {
      return '<div style="background:' + s.bg + ';border:1px solid var(--border);border-radius:var(--radius);' +
             'padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:120px">' +
             '<div style="font-size:22px;font-weight:700;color:' + s.clr + '">' + s.val + '</div>' +
             '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + s.label + '</div>' +
             '</div>';
    }).join('');
  }

  if (!list.length) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">💊</div>' +
        '<div class="empty-title">No prescriptions found</div>' +
        '<div class="empty-sub">Adjust your filters or check back later.</div>' +
      '</div>';
    return;
  }

  var typeIcon  = { allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱' };
  var typeColor = { allopathy:'var(--allopathy)', homeopathy:'var(--homeopathy)', ayurveda:'var(--ayurveda)' };
  var typeBg    = { allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)' };

  container.innerHTML = list.map(function(rx) {
    var dispensed  = !!rx.dispenseDate;
    var meds       = (rx.medicines||[]);
    var medsCount  = meds.length;
    var dispBadge  = dispensed
      ? '<span style="background:var(--green);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">✅ Dispensed</span>'
      : '<span style="background:var(--allopathy-bg);color:var(--allopathy);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">⏳ Pending</span>';
    var dispInfo   = dispensed
      ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Dispensed: ' + formatDate(rx.dispenseDate) + '</div>'
      : '';

    // Medicines table
    var medsHtml = '';
    if (meds.length) {
      medsHtml =
        '<table class="medicine-table" style="margin-top:12px">' +
          '<thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead>' +
          '<tbody>' +
            meds.map(function(m) {
              return '<tr>' +
                '<td><strong>' + escHtml(m.name||'—') + '</strong></td>' +
                '<td>' + escHtml(m.dosage||'—') + '</td>' +
                '<td>' + escHtml(m.frequency||'—') + '</td>' +
                '<td>' + escHtml(m.duration||'—') + '</td>' +
                '<td>' + escHtml(m.route||'—') + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>';
    } else {
      medsHtml = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines listed.</div>';
    }

    // Notes
    var notesHtml = rx.notes
      ? '<div style="margin-top:10px;background:var(--surface2);border-left:3px solid var(--teal);' +
        'padding:10px 14px;border-radius:4px;font-size:13px">' +
        '<strong style="color:var(--teal);font-size:11px;text-transform:uppercase;letter-spacing:.05em">📝 Clinical Notes</strong>' +
        '<div style="margin-top:4px;color:var(--text-secondary)">' + escHtml(rx.notes) + '</div>' +
        '</div>'
      : '';

    // Dispense button
    var actionBtn = dispensed
      ? '<button class="btn-sm btn-outline-teal" data-rxid="' + rx.id + '" ' +
        'onclick="undispenseMedicine(this.dataset.rxid)" style="font-size:12px">↩️ Mark Undispensed</button>'
      : '<button class="btn-sm btn-teal" data-rxid="' + rx.id + '" ' +
        'onclick="dispenseMedicine(this.dataset.rxid)" style="font-size:12px">✅ Mark as Dispensed</button>';

    return (
      '<div class="rx-card" style="margin-bottom:14px;' + (dispensed ? 'opacity:0.7' : '') + '">' +

        // Header
        '<div style="padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border-bottom:1px solid var(--border)">' +
          '<div style="background:' + (typeBg[rx.type]||'var(--bg)') + ';color:' + (typeColor[rx.type]||'var(--text-muted)') + ';' +
            'font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;flex-shrink:0;margin-top:2px">' +
            (typeIcon[rx.type]||'💊') + ' ' + capitalize(rx.type||'') +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:15px;font-weight:700;color:var(--text-primary)">' + escHtml(rx.patientName||'—') + '</div>' +
            '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px;display:flex;flex-wrap:wrap;gap:10px">' +
              '<span>🩺 Dr. ' + escHtml(rx.doctorName||'—') + '</span>' +
              '<span>📅 ' + formatDate(rx.date) + '</span>' +
              (rx.validUntil ? '<span>⏰ Valid till ' + formatDate(rx.validUntil) + '</span>' : '') +
              (rx.diagnosis  ? '<span>🔬 ' + escHtml(rx.diagnosis) + '</span>' : '') +
              '<span>📱 ' + escHtml(rx.phone||'—') + '</span>' +
              '<span>👤 ' + escHtml(rx.age||'—') + (rx.gender ? ' · '+escHtml(rx.gender) : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">' +
            dispBadge +
            dispInfo +
            '<div style="font-size:11px;color:var(--text-muted)">' + medsCount + ' medicine' + (medsCount !== 1 ? 's' : '') + '</div>' +
          '</div>' +
        '</div>' +

        // Medicines + Notes
        '<div style="padding:14px 18px">' +
          medsHtml +
          notesHtml +
          '<div style="margin-top:12px;display:flex;justify-content:flex-end">' +
            actionBtn +
          '</div>' +
        '</div>' +

      '</div>'
    );
  }).join('');
}

async function dispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; });
  if (!rx) return;
  rx.dispenseDate = new Date().toISOString();
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update prescription.', 'error'); return; }
  showToast('✅ Medicines marked as dispensed for ' + rx.patientName, 'success');
  if (typeof dbAudit === 'function') dbAudit('update', 'prescriptions', rxId, null, { dispenseDate: rx.dispenseDate });
  renderPharmacyList();
}

async function undispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; });
  if (!rx) return;
  delete rx.dispenseDate;
  rx.dispenseDate = null;
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }
  showToast('↩️ Marked as undispensed.', 'info');
  renderPharmacyList();
}


// ════════════════════════════════════════════════════════════
//  RENEW PRESCRIPTION
// ════════════════════════════════════════════════════════════
function renewPrescription(id) {
  var original = prescriptions.find(function(x){ return x.id === id; });
  if (!original) return;

  if (!confirm(
    'Renew prescription for ' + original.patientName + '?\n\n' +
    'A new prescription will be created with today\'s date,\n' +
    'pre-filled with the same medicines and details.\n' +
    'You can review and edit before saving.'
  )) return;

  // Open Add modal pre-filled with original data
  if (!can.addPrescription()) { showToast('Permission denied.', 'error'); return; }
  editingId = null;
  resetForm();

  document.getElementById('modalTitle').textContent = '🔄 Renew Rx';
  document.getElementById('saveBtn').textContent    = '💾 Save Renewed Rx';

  // Set today's date and new validity
  var today = todayISO();
  document.getElementById('fDate').value       = today;
  document.getElementById('fValidUntil').value = addDays(today, 30);

  // Pre-fill patient + doctor fields from original
  var fields = {
    fPatientName:   original.patientName   || '',
    fAge:           original.age           || '',
    fGender:        original.gender        || '',
    fBloodGroup:    original.bloodGroup    || '',
    fPhone:         original.phone         || '',
    fEmail:         original.email         || '',
    fDoctorName:    original.doctorName    || '',
    fSpecialization:original.specialization|| '',
    fHospital:      original.hospital      || '',
    fRegNo:         original.regNo         || '',
    fDoctorPhone:   original.doctorPhone   || '',
    fDiagnosis:     original.diagnosis     || '',
    fNotes:         original.notes         || '',
  };
  Object.keys(fields).forEach(function(id) { setVal(id, fields[id]); });

  // Set type
  var typeEl = document.getElementById('fType');
  if (typeEl) typeEl.value = original.type || 'allopathy';

  // Set status to active
  var statusEl = document.getElementById('fStatus');
  if (statusEl) statusEl.value = 'active';

  // Pre-fill medicines
  var medEditor = document.getElementById('medicinesEditor');
  if (medEditor) {
    medEditor.innerHTML = '';
    (original.medicines || []).forEach(function(m) { addMedicineRow(m); });
    if (!original.medicines || !original.medicines.length) addMedicineRow();
  }

  // Pre-fill diagnostics
  var diagEditor = document.getElementById('diagnosticEditor');
  if (diagEditor) {
    diagEditor.innerHTML = '';
    (original.diagnostics || []).forEach(function(d) { addDiagnosticRow(d); });
    if (!original.diagnostics || !original.diagnostics.length) addDiagnosticRow();
  }

  // Populate doctor dropdown
  if (typeof populateHospitalDropdown === 'function') {
    populateHospitalDropdown('dfHospital', original.hospital);
  }

  renderQuickChips();
  expandSection('patientSection');
  expandSection('doctorSection');
  openModal('formModal');

  showToast('📋 Pre-filled from original prescription · Review and save', 'info');
}

// ════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════
(async function boot() {
  var gateShown = await initClinicGate();
  if (!gateShown) await initAppForClinic();
})();