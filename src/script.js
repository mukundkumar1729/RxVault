// ════════════════════════════════════════════════════════════
//  STATE & STORAGE
// ════════════════════════════════════════════════════════════
const STORAGE_KEY = 'prescription_vault_v1';
let prescriptions = [];
let editingId = null;
let activeNoteCategories = new Set();
let currentView = 'all';
let currentTypeFilter = 'all';
let deleteTargetId = null;
let doctorRegistry = [];
const DOCTOR_STORAGE_KEY = 'pv_doctors_v1';
const ADMIN_PIN_STORAGE_KEY = 'pv_admin_pin';
let isAdminUnlocked = false;
let editingDoctorIdx = null;
const TODAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

// Patient Registry
const PATIENTS_STORAGE_KEY = 'pv_patients_v1';
let patientRegistry = [];
function loadPatientRegistry() {
  try { patientRegistry = JSON.parse(localStorage.getItem(PATIENTS_STORAGE_KEY) || '[]'); } catch { patientRegistry = []; }
}
function savePatientRegistry() { localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patientRegistry)); }
function genPatientId() { return 'PID-' + Date.now().toString(36).toUpperCase(); }

async function loadDoctorRegistry() {
  try {
    const seed = await fetch('../data/doctor.json').then(r => r.json());
    const stored = localStorage.getItem(DOCTOR_STORAGE_KEY);
    if (stored) {
      try { doctorRegistry = JSON.parse(stored); }
      catch { doctorRegistry = seed; localStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(seed)); }
    } else {
      doctorRegistry = seed;
      localStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(seed));
    }
  } catch (e) {
    const stored = localStorage.getItem(DOCTOR_STORAGE_KEY);
    try { doctorRegistry = stored ? JSON.parse(stored) : []; } catch { doctorRegistry = []; }
  }
}
function saveDoctorRegistryLocal() {
  localStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(doctorRegistry));
}

// ════════════════════════════════════════════════════════════
//  QUICK CHIPS + NOTE TEMPLATES — loaded from JSON
// ════════════════════════════════════════════════════════════
let QUICK_CHIPS_DATA = null;
let NOTE_TEMPLATES_DATA = null;

async function loadQuickChips() {
  try {
    QUICK_CHIPS_DATA = await fetch('../data/quick-chips.json').then(r => r.json());
  } catch {
    // fallback: already defined as QUICK_CHIPS constant below
    QUICK_CHIPS_DATA = null;
  }
}
async function loadNoteTemplates() {
  try {
    NOTE_TEMPLATES_DATA = await fetch('../data/note-templates.json').then(r => r.json());
    // Populate template select dynamically
    const sel = document.getElementById('noteTemplate');
    if (sel && NOTE_TEMPLATES_DATA) {
      sel.innerHTML = '<option value="">— Choose a template —</option>' +
        NOTE_TEMPLATES_DATA.map(t => `<option value="${t.key}">${t.label}</option>`).join('');
    }
  } catch {
    NOTE_TEMPLATES_DATA = null;
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    prescriptions = raw ? JSON.parse(raw) : [];
  } catch (e) { prescriptions = []; }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(prescriptions)); }
function genId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

// ════════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════════
function render() { updateStats(); applyFilters(); }

function updateStats() {
  const total = prescriptions.length;
  const allo = prescriptions.filter(p => p.type === 'allopathy').length;
  const homo = prescriptions.filter(p => p.type === 'homeopathy').length;
  const ayur = prescriptions.filter(p => p.type === 'ayurveda').length;
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const recent = prescriptions.filter(p => new Date(p.date) >= thirtyDaysAgo).length;
  const active = prescriptions.filter(p => p.status === 'active').length;
  ['statTotal', 'statsTotal'].forEach(id => setEl(id, total));
  ['statAllo', 'statsAllo'].forEach(id => setEl(id, allo));
  ['statHomo', 'statsHomo'].forEach(id => setEl(id, homo));
  ['statAyur', 'statsAyur'].forEach(id => setEl(id, ayur));
  setEl('badgeAll', total); setEl('badgeRecent', recent); setEl('badgeActive', active);
  setEl('badgeDoctors', doctorRegistry.length);
}
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function getSearchVals() {
  return {
    patient: (document.getElementById('srchPatient')?.value || '').toLowerCase().trim(),
    doctor: (document.getElementById('srchDoctor')?.value || '').toLowerCase().trim(),
    diagnosis: (document.getElementById('srchDiagnosis')?.value || '').toLowerCase().trim(),
    phone: (document.getElementById('srchPhone')?.value || '').toLowerCase().trim(),
    email: (document.getElementById('srchEmail')?.value || '').toLowerCase().trim(),
    id: (document.getElementById('srchId')?.value || '').toLowerCase().trim(),
    dateFrom: (document.getElementById('srchDateFrom')?.value || ''),
    dateTo: (document.getElementById('srchDateTo')?.value || ''),
    status: (document.getElementById('statusFilter')?.value || 'all'),
    sort: (document.getElementById('sortSelect')?.value || 'newest'),
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
  if (s.patient) filtered = filtered.filter(p => (p.patientName || '').toLowerCase().includes(s.patient));
  if (s.doctor) filtered = filtered.filter(p => (p.doctorName || '').toLowerCase().includes(s.doctor));
  if (s.diagnosis) filtered = filtered.filter(p => (p.diagnosis || '').toLowerCase().includes(s.diagnosis) || (p.hospital || '').toLowerCase().includes(s.diagnosis));
  if (s.phone) filtered = filtered.filter(p => (p.phone || '').replace(/\s/g, '').includes(s.phone.replace(/\s/g, '')) || (p.doctorPhone || '').replace(/\s/g, '').includes(s.phone.replace(/\s/g, '')));
  if (s.email) filtered = filtered.filter(p => (p.email || '').toLowerCase().includes(s.email));
  if (s.id) filtered = filtered.filter(p => (p.id || '').toLowerCase().includes(s.id) || (p.patientId || '').toLowerCase().includes(s.id));
  if (s.dateFrom) filtered = filtered.filter(p => p.date && p.date >= s.dateFrom);
  if (s.dateTo) filtered = filtered.filter(p => p.date && p.date <= s.dateTo);
  if (s.status !== 'all') filtered = filtered.filter(p => p.status === s.status);
  if (s.sort === 'newest') filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (s.sort === 'oldest') filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (s.sort === 'patient') filtered.sort((a, b) => (a.patientName || '').localeCompare(b.patientName || ''));
  if (s.sort === 'doctor') filtered.sort((a, b) => (a.doctorName || '').localeCompare(b.doctorName || ''));

  const totalEl1 = document.getElementById('resultsShowing');
  const totalEl2 = document.getElementById('resultsShowing2');
  const totalAllEl = document.getElementById('resultsTotal');
  if (totalEl1) totalEl1.textContent = filtered.length;
  if (totalEl2) totalEl2.textContent = filtered.length;
  if (totalAllEl) totalAllEl.textContent = prescriptions.length;

  updateActiveFilterTags(s);
  const allTerms = [s.patient, s.doctor, s.diagnosis, s.phone, s.email, s.id].filter(Boolean);
  renderList(filtered, allTerms.join(' '), allTerms);
}

function updateActiveFilterTags(s) {
  const tags = [];
  if (s.patient) tags.push({ label: `Patient: "${s.patient}"`, clear: () => { document.getElementById('srchPatient').value = ''; applyFilters(); } });
  if (s.doctor) tags.push({ label: `Doctor: "${s.doctor}"`, clear: () => { document.getElementById('srchDoctor').value = ''; applyFilters(); } });
  if (s.diagnosis) tags.push({ label: `Diagnosis: "${s.diagnosis}"`, clear: () => { document.getElementById('srchDiagnosis').value = ''; applyFilters(); } });
  if (s.phone) tags.push({ label: `Phone: "${s.phone}"`, clear: () => { document.getElementById('srchPhone').value = ''; applyFilters(); } });
  if (s.email) tags.push({ label: `Email: "${s.email}"`, clear: () => { document.getElementById('srchEmail').value = ''; applyFilters(); } });
  if (s.id) tags.push({ label: `ID: "${s.id}"`, clear: () => { document.getElementById('srchId').value = ''; applyFilters(); } });
  if (s.dateFrom) tags.push({ label: `From: ${formatDate(s.dateFrom)}`, clear: () => { document.getElementById('srchDateFrom').value = ''; applyFilters(); } });
  if (s.dateTo) tags.push({ label: `To: ${formatDate(s.dateTo)}`, clear: () => { document.getElementById('srchDateTo').value = ''; applyFilters(); } });
  if (s.status !== 'all') tags.push({ label: `Status: ${capitalize(s.status)}`, clear: () => { document.getElementById('statusFilter').value = 'all'; applyFilters(); } });
  if (currentTypeFilter !== 'all') tags.push({ label: `Type: ${capitalize(currentTypeFilter)}`, clear: () => { currentTypeFilter = 'all'; document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active-filter')); document.querySelector('.type-filter-btn').classList.add('active-filter'); applyFilters(); } });

  const badge = document.getElementById('searchActiveBadge');
  if (badge) badge.classList.toggle('show', tags.length > 0);
  const container = document.getElementById('activeFilterTags');
  if (!container) return;
  if (tags.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;font-style:italic">No filters active</span>';
  } else {
    container.innerHTML = '';
    tags.forEach(t => {
      const el = document.createElement('span');
      el.className = 'active-filter-tag';
      el.innerHTML = `${escHtml(t.label)} <span style="font-size:12px">×</span>`;
      el.addEventListener('click', t.clear);
      container.appendChild(el);
    });
  }
}

function renderList(items, searchQuery = '', allTerms = []) {
  const container = document.getElementById('prescriptionsList');
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No prescriptions found</div><div class="empty-sub">${searchQuery ? 'No records match your search criteria.' : 'Start by adding your first prescription.'}</div>${!searchQuery ? `<button class="btn-add" onclick="openAddModal()">＋ Add First Prescription</button>` : ''}</div>`;
    return;
  }
  container.innerHTML = items.map(p => renderCard(p, searchQuery, allTerms)).join('');
}

function renderCard(p, q = '', allTerms = []) {
  const hl = str => {
    if (!str) return escHtml(str || '—');
    let result = escHtml(str);
    const terms = allTerms.length ? allTerms : (q ? [q] : []);
    terms.forEach(term => {
      if (!term) return;
      const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(re, '<mark class="highlight">$1</mark>');
    });
    return result;
  };
  const typeLabel = { allopathy: '💉 Allopathy', homeopathy: '🌿 Homeopathy', ayurveda: '🌱 Ayurveda' };
  const statusColors = { active: 'var(--green)', completed: 'var(--text-muted)', expired: 'var(--red)' };
  const statusIcons = { active: '🟢', completed: '✅', expired: '🔴' };
  const medsTable = p.medicines && p.medicines.length
    ? `<table class="medicine-table"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead><tbody>${p.medicines.map(m => `<tr><td><strong>${escHtml(m.name || '—')}</strong></td><td>${escHtml(m.dosage || '—')}</td><td>${escHtml(m.frequency || '—')}</td><td>${escHtml(m.duration || '—')}</td><td>${escHtml(m.route || '—')}</td></tr>`).join('')}</tbody></table>`
    : '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines recorded.</div>';

  return `<div class="rx-card" id="card_${p.id}">
    <div class="rx-card-header" onclick="toggleCard('${p.id}')">
      <span class="rx-type-badge badge-${p.type}">${typeLabel[p.type] || p.type}</span>
      <div class="rx-main">
        <div class="rx-patient">${hl(p.patientName)}</div>
        <div class="rx-meta">
          <span class="rx-meta-item">🩺 ${hl(p.doctorName)}</span>
          ${p.diagnosis ? `<span class="rx-meta-item">🔬 ${hl(p.diagnosis)}</span>` : ''}
          ${p.hospital ? `<span class="rx-meta-item">🏥 ${hl(p.hospital)}</span>` : ''}
          <span class="rx-meta-item" style="color:${statusColors[p.status] || 'var(--text-muted)'}">
            ${statusIcons[p.status] || ''} ${capitalize(p.status || 'unknown')}
          </span>
        </div>
      </div>
      <div class="rx-date-badge">${formatDate(p.date)}</div>
      <div class="rx-actions" onclick="event.stopPropagation()">
        <button class="icon-btn print" title="Print" onclick="printPrescription('${p.id}')">🖨️</button>
        <button class="icon-btn edit"  title="Edit"  onclick="openEditModal('${p.id}')">✏️</button>
        <button class="icon-btn delete" title="Delete" onclick="confirmDelete('${p.id}')">🗑️</button>
      </div>
      <span class="chevron-icon">▼</span>
    </div>
    <div class="rx-card-body" id="body_${p.id}">
      <div class="rx-details-grid">
        <div class="detail-group"><div class="detail-label">Patient Age & Gender</div><div class="detail-value">${p.age ? p.age + ' yrs' : '—'} ${p.gender ? '· ' + p.gender : ''}</div></div>
        <div class="detail-group"><div class="detail-label">Blood Group</div><div class="detail-value">${p.bloodGroup || '—'}</div></div>
        <div class="detail-group"><div class="detail-label">Contact</div><div class="detail-value mono">${p.phone || '—'}</div></div>
        <div class="detail-group"><div class="detail-label">Specialization</div><div class="detail-value">${p.specialization || '—'}</div></div>
        <div class="detail-group"><div class="detail-label">Hospital / Clinic</div><div class="detail-value">${p.hospital || '—'}</div></div>
        <div class="detail-group"><div class="detail-label">Valid Until</div><div class="detail-value">${p.validUntil ? formatDate(p.validUntil) : '—'}</div></div>
      </div>
      <div class="rx-medicines"><div class="medicines-title">💊 Medicines (${p.medicines ? p.medicines.length : 0})</div>${medsTable}</div>
      ${p.diagnostics && p.diagnostics.length ? `<div class="rx-diagnostics"><div class="medicines-title">🔬 Diagnosis &amp; Tests (${p.diagnostics.length})</div><table class="medicine-table"><thead><tr><th>Test / Investigation</th><th>Observation / Notes</th></tr></thead><tbody>${p.diagnostics.map(d => `<tr><td><strong>${escHtml(d.test)}</strong></td><td>${escHtml(d.notes || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${p.notes ? `<div class="rx-notes"><div class="rx-notes-label">📝 Clinical Notes</div><div class="rx-notes-text">${escHtml(p.notes)}</div></div>` : ''}
      <div class="rx-patient-history">
        ${(() => {
      const cnt = prescriptions.filter(x => x.patientName === p.patientName && x.id !== p.id).length;
      const revCnt = (p.revisions || []).length;
      return `
        ${cnt > 0
          ? `<button class="history-toggle-btn" data-patient="${escHtml(p.patientName)}" data-id="${p.id}" onclick="togglePatientHistory(this)">📋 Patient History <span class="hist-count">${cnt} visit${cnt > 1 ? 's' : ''}</span> <span class="hist-chevron">▼</span></button><div id="hist_${p.id}" class="hist-content" style="display:none"></div>`
          : `<div class="hist-first-visit">⭐ First recorded visit</div>`}
        ${revCnt > 0
          ? `<button class="history-toggle-btn rev-btn" data-id="${p.id}" onclick="toggleRevisionHistory(this)">📜 ${revCnt} Revision${revCnt > 1 ? 's' : ''} <span class="hist-chevron">▼</span></button><div id="rev_${p.id}" class="hist-content" style="display:none"></div>`
          : ''}
      `;
    })()}
      </div>
      <div class="rx-footer-actions">
        <button class="btn-sm btn-outline-teal" onclick="printPrescription('${p.id}')">🖨️ Print</button>
        <button class="btn-sm btn-outline-teal" onclick="openEditModal('${p.id}')">✏️ Edit</button>
        <button class="btn-sm btn-outline-red"  onclick="confirmDelete('${p.id}')">🗑️ Delete</button>
      </div>
    </div>
  </div>`;
}

function toggleCard(id) { document.getElementById('card_' + id).classList.toggle('expanded'); }

// ════════════════════════════════════════════════════════════
//  MODAL — ADD / EDIT
// ════════════════════════════════════════════════════════════
function openAddModal() {
  editingId = null; resetForm();
  document.getElementById('modalTitle').textContent = 'New Rx';
  document.getElementById('saveBtn').textContent = '💾 Save Rx';
  document.getElementById('fDate').value = todayISO();
  document.getElementById('medicinesEditor').innerHTML = '';
  document.getElementById('diagnosticEditor').innerHTML = '';
  expandSection('patientSection'); expandSection('doctorSection');
  addMedicineRow(); addDiagnosticRow(); renderQuickChips(); openModal('formModal');
}
function openEditModal(id) {
  const p = prescriptions.find(x => x.id === id); if (!p) return;
  editingId = id; resetForm();
  document.getElementById('modalTitle').textContent = 'Edit Rx';
  document.getElementById('saveBtn').textContent = '💾 Update Rx';
  document.querySelector(`input[name="medType"][value="${p.type}"]`).checked = true;
  ['fPatientName', 'fAge', 'fGender', 'fBloodGroup', 'fPhone', 'fEmail', 'fDoctorName', 'fSpecialization', 'fHospital', 'fRegNo', 'fDoctorPhone', 'fDate', 'fValidUntil', 'fDiagnosis', 'fStatus', 'fNotes']
    .forEach(fid => setVal(fid, p[fid.replace('f', '').charAt(0).toLowerCase() + fid.slice(2)] || p[{ fPatientName: 'patientName', fAge: 'age', fGender: 'gender', fBloodGroup: 'bloodGroup', fPhone: 'phone', fEmail: 'email', fDoctorName: 'doctorName', fSpecialization: 'specialization', fHospital: 'hospital', fRegNo: 'regNo', fDoctorPhone: 'doctorPhone', fDate: 'date', fValidUntil: 'validUntil', fDiagnosis: 'diagnosis', fStatus: 'status', fNotes: 'notes' }[fid]]));
  // restore note categories
  activeNoteCategories = new Set(p.noteCategories || []);
  document.querySelectorAll('.note-cat-chip').forEach(btn => {
    const cat = btn.getAttribute('data-cat');
    btn.classList.toggle('active', activeNoteCategories.has(cat));
  });
  updateNoteCategoryDisplay();
  const ta = document.getElementById('fNotes');
  if (ta) { updateNotesCounter(ta); setTimeout(() => autoResizeTextarea(ta), 0); }
  const editor = document.getElementById('medicinesEditor'); editor.innerHTML = '';
  if (p.medicines && p.medicines.length) p.medicines.forEach(m => addMedicineRow(m)); else addMedicineRow();
  const diagEditor = document.getElementById('diagnosticEditor'); diagEditor.innerHTML = '';
  if (p.diagnostics && p.diagnostics.length) p.diagnostics.forEach(d => addDiagnosticRow(d)); else addDiagnosticRow();
  renderQuickChips();
  openModal('formModal');
}
function savePrescription() {
  const patientName = getVal('fPatientName'), doctorName = getVal('fDoctorName'), date = getVal('fDate');
  if (!patientName) { showToast('Patient name is required.', 'error'); focusEl('fPatientName'); return; }
  if (!doctorName) { showToast('Doctor name is required.', 'error'); focusEl('fDoctorName'); return; }
  if (!date) { showToast('Please select the date.', 'error'); focusEl('fDate'); return; }
  const rx = {
    id: editingId || genId(), type: document.querySelector('input[name="medType"]:checked').value,
    patientName, age: getVal('fAge'), gender: getVal('fGender'), bloodGroup: getVal('fBloodGroup'),
    phone: getVal('fPhone'), email: getVal('fEmail'), doctorName, specialization: getVal('fSpecialization'),
    hospital: getVal('fHospital'), regNo: getVal('fRegNo'), doctorPhone: getVal('fDoctorPhone'),
    date, validUntil: getVal('fValidUntil'), diagnosis: getVal('fDiagnosis'), status: getVal('fStatus'),
    medicines: getMedicines(), diagnostics: getDiagnostics(), notes: getVal('fNotes'),
    noteCategories: [...activeNoteCategories], updatedAt: new Date().toISOString()
  };
  if (editingId) {
    const idx = prescriptions.findIndex(p => p.id === editingId);
    if (idx > -1) {
      const old = prescriptions[idx];
      // Snapshot the current state before overwriting (preserve revision history)
      const snapshot = { ...old };
      delete snapshot.revisions; // don't nest revisions inside revisions
      rx.revisions = [...(old.revisions || []), { ...snapshot, _savedAt: old.updatedAt || old.createdAt || old.date }];
      rx.createdAt = old.createdAt; // keep original creation date
      prescriptions[idx] = rx;
    }
    showToast(`Rx updated for ${patientName}`, 'success');
  } else { rx.createdAt = new Date().toISOString(); prescriptions.unshift(rx); showToast(`Rx saved for ${patientName}`, 'success'); }
  saveData(); closeModal('formModal'); render();
}

// ════════════════════════════════════════════════════════════
//  MEDICINE ROWS
// ════════════════════════════════════════════════════════════
function addMedicineRow(data = {}) {
  const editor = document.getElementById('medicinesEditor');
  const row = document.createElement('div'); row.className = 'medicine-row';
  const freqOpts = ['', 'Once daily', 'Twice daily (BD)', 'Thrice daily (TDS)', 'Four times daily (QID)', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'Before meals', 'After meals', 'At bedtime', 'As needed (SOS)', 'Weekly', 'Alternate days'];
  const durOpts = ['', '1 day', '2 days', '3 days', '5 days', '7 days (1 week)', '10 days', '14 days (2 weeks)', '21 days', '30 days (1 month)', '45 days', '60 days (2 months)', '90 days (3 months)', 'Ongoing'];
  const routeOpts = ['', 'Oral', 'Topical', 'Sublingual', 'Inhalation', 'IV (Intravenous)', 'IM (Intramuscular)', 'Subcutaneous', 'Rectal', 'Nasal', 'Ophthalmic', 'Otic'];
  const opts = (list, val) => list.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o || 'Select…'}</option>`).join('');
  row.innerHTML = `<input type="text" placeholder="Medicine name" value="${escAttr(data.name || '')}" data-field="name"><input type="text" placeholder="e.g. 500mg" value="${escAttr(data.dosage || '')}" data-field="dosage"><select data-field="frequency">${opts(freqOpts, data.frequency || '')}</select><select data-field="duration">${opts(durOpts, data.duration || '')}</select><select data-field="route">${opts(routeOpts, data.route || '')}</select><button class="btn-remove-med" onclick="removeMedRow(this)" title="Remove">✕</button>`;
  editor.appendChild(row);
}
function removeMedRow(btn) { btn.closest('.medicine-row').remove(); }
function getMedicines() {
  return Array.from(document.querySelectorAll('#medicinesEditor .medicine-row')).map(row => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    dosage: row.querySelector('[data-field="dosage"]').value.trim(),
    frequency: row.querySelector('[data-field="frequency"]').value.trim(),
    duration: row.querySelector('[data-field="duration"]').value.trim(),
    route: row.querySelector('[data-field="route"]').value.trim(),
  })).filter(m => m.name);
}

// ════════════════════════════════════════════════════════════
//  DIAGNOSTIC ROWS
// ════════════════════════════════════════════════════════════
function addDiagnosticRow(data = {}) {
  const editor = document.getElementById('diagnosticEditor');
  const row = document.createElement('div'); row.className = 'diagnostic-row';
  row.innerHTML = `<input type="text" list="testNameList" placeholder="e.g. CBC, MRI, X-Ray" value="${escAttr(data.test || '')}" data-field="test"><input type="text" placeholder="Observation / result notes" value="${escAttr(data.notes || '')}" data-field="notes"><button class="btn-remove-med" onclick="this.closest('.diagnostic-row').remove()" title="Remove">✕</button>`;
  editor.appendChild(row);
}
function getDiagnostics() {
  return Array.from(document.querySelectorAll('#diagnosticEditor .diagnostic-row')).map(row => ({
    test: row.querySelector('[data-field="test"]').value.trim(),
    notes: row.querySelector('[data-field="notes"]').value.trim(),
  })).filter(d => d.test);
}

// ════════════════════════════════════════════════════════════
//  DELETE
// ════════════════════════════════════════════════════════════
function confirmDelete(id) {
  deleteTargetId = id; openModal('confirmModal');
  document.getElementById('confirmDeleteBtn').onclick = () => { deletePrescription(id); closeModal('confirmModal'); };
}
function deletePrescription(id) {
  const p = prescriptions.find(x => x.id === id);
  prescriptions = prescriptions.filter(x => x.id !== id); saveData(); render();
  showToast(`Deleted Rx for ${p?.patientName || 'patient'}`, 'info');
}

// ════════════════════════════════════════════════════════════
//  PRINT
// ════════════════════════════════════════════════════════════
function printPrescription(id) {
  const p = prescriptions.find(x => x.id === id); if (!p) return;
  const tl = { allopathy: 'Allopathy', homeopathy: 'Homeopathy', ayurveda: 'Ayurveda' };
  const medsRows = (p.medicines || []).map(m => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 8px"><strong>${escHtml(m.name)}</strong></td><td style="padding:6px 8px">${escHtml(m.dosage)}</td><td style="padding:6px 8px">${escHtml(m.frequency)}</td><td style="padding:6px 8px">${escHtml(m.duration)}</td><td style="padding:6px 8px">${escHtml(m.route || '')}</td></tr>`).join('');
  const diagRows = (p.diagnostics || []).map(d => `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 8px"><strong>${escHtml(d.test)}</strong></td><td style="padding:6px 8px">${escHtml(d.notes || '—')}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Prescription — ${escHtml(p.patientName)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600&family=DM+Serif+Display&display=swap" rel="stylesheet"><style>body{font-family:'DM Sans',sans-serif;color:#1a1a2e;margin:0;padding:30px;font-size:13px}.rx-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0a7c6e}.rx-logo{font-family:'DM Serif Display',serif;font-size:22px;color:#0f2240}.rx-logo span{color:#0a7c6e}.type-pill{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;background:#e6f5f3;color:#0a7c6e}h2{font-family:'DM Serif Display',serif;font-size:17px;color:#0f2240;margin:20px 0 10px;border-bottom:1px solid #eee;padding-bottom:6px}.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}.info-item label{display:block;font-size:10px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:2px}.info-item span{font-size:13px;font-weight:500}table{width:100%;border-collapse:collapse}thead{background:#f0f4f8}th{text-align:left;padding:8px;font-size:11px;font-weight:600;text-transform:uppercase;color:#666}.notes-box{background:#f7fafc;border-left:3px solid #0a7c6e;padding:12px 16px;border-radius:4px;margin-top:16px}.footer{margin-top:40px;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:16px}.sig-line{width:160px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;text-align:center}@media print{body{padding:20px}}</style></head><body onload="window.print()"><div class="rx-header"><div><div class="rx-logo">💊 Rx<span>Vault</span></div><div style="font-size:11px;color:#888;margin-top:6px">Rx ID: ${p.id}</div></div><div style="text-align:right"><div class="type-pill">${tl[p.type] || p.type}</div><div style="margin-top:6px;font-size:12px;color:#555">Date: ${formatDate(p.date)}</div>${p.validUntil ? `<div style="font-size:11px;color:#888">Valid until: ${formatDate(p.validUntil)}</div>` : ''}</div></div><h2>Patient Details</h2><div class="info-grid"><div class="info-item"><label>Name</label><span>${escHtml(p.patientName)}</span></div><div class="info-item"><label>Age</label><span>${p.age ? p.age + ' yrs' : '—'}</span></div><div class="info-item"><label>Gender</label><span>${p.gender || '—'}</span></div><div class="info-item"><label>Blood Group</label><span>${p.bloodGroup || '—'}</span></div><div class="info-item"><label>Phone</label><span>${p.phone || '—'}</span></div><div class="info-item"><label>Diagnosis</label><span>${p.diagnosis || '—'}</span></div></div><h2>Doctor / Practitioner</h2><div class="info-grid"><div class="info-item"><label>Name</label><span>Dr. ${escHtml(p.doctorName)}</span></div><div class="info-item"><label>Specialization</label><span>${p.specialization || '—'}</span></div><div class="info-item"><label>Reg. No.</label><span>${p.regNo || '—'}</span></div><div class="info-item"><label>Hospital/Clinic</label><span>${p.hospital || '—'}</span></div></div><h2>Prescribed Medicines</h2><table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead><tbody>${medsRows || '<tr><td colspan="5" style="padding:10px;color:#888;text-align:center">No medicines recorded</td></tr>'}</tbody></table>${diagRows ? `<h2>🔬 Diagnosis &amp; Tests</h2><table><thead><tr><th>Test / Investigation</th><th>Observation / Notes</th></tr></thead><tbody>${diagRows}</tbody></table>` : ''}${p.notes ? `<div class="notes-box"><strong style="font-size:11px;text-transform:uppercase;color:#0a7c6e">Clinical Notes</strong><br><br>${escHtml(p.notes)}</div>` : ''}<div class="footer"><div style="font-size:11px;color:#888">Generated by Rx Vault · ${new Date().toLocaleDateString()}</div><div class="sig-line">Doctor's Signature</div></div></body></html>`;
  const w = window.open('', '_blank', 'width=800,height=700'); w.document.write(html); w.document.close();
}

// ════════════════════════════════════════════════════════════
//  EXPORT / IMPORT
// ════════════════════════════════════════════════════════════
function exportAll() {
  if (!prescriptions.length) { showToast('No prescriptions to export.', 'error'); return; }
  const blob = new Blob([JSON.stringify(prescriptions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `prescriptions_${todayISO()}.json`; a.click(); URL.revokeObjectURL(url);
  showToast(`Exported ${prescriptions.length} records`, 'success');
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (!Array.isArray(data)) throw new Error(); const ids = new Set(prescriptions.map(p => p.id)); const newOnes = data.filter(p => !ids.has(p.id)); prescriptions = [...prescriptions, ...newOnes]; saveData(); render(); showToast(`Imported ${newOnes.length} new records`, 'success'); } catch { showToast('Invalid JSON file.', 'error'); } };
  reader.readAsText(file); e.target.value = '';
}

// ════════════════════════════════════════════════════════════
//  CLINICAL NOTES HELPERS
// ════════════════════════════════════════════════════════════
function appendNote(text) {
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  ta.value += sep + text;
  if (typeof updateNotesCounter === 'function') updateNotesCounter(ta);
  if (typeof autoResizeTextarea === 'function') autoResizeTextarea(ta);
  ta.focus();
}
function insertNoteText(text) {
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  if (typeof updateNotesCounter === 'function') updateNotesCounter(ta);
  if (typeof autoResizeTextarea === 'function') autoResizeTextarea(ta);
  ta.focus();
}
function clearNotes() {
  const ta = document.getElementById('fNotes');
  if (ta) { ta.value = ''; if (typeof updateNotesCounter === 'function') updateNotesCounter(ta); if (typeof autoResizeTextarea === 'function') autoResizeTextarea(ta); }
}
function applyNoteTemplate(key) {
  if (!key) return;
  const FALLBACK = {
    fever: '• Drink plenty of warm fluids and rest.\n• Take paracetamol if temperature exceeds 100°F.\n• Avoid cold water and chilled foods.\n• Monitor temperature twice daily.\n• Return immediately if fever exceeds 103°F or lasts more than 3 days.',
    arthritis: '• Rest the affected joint. Avoid heavy lifting.\n• Apply warm/cold compress as comfortable.\n• Gentle range-of-motion exercises daily.\n• Avoid strenuous physical activity.\n• Follow-up after 2 weeks.',
    diabetes: '• Test blood sugar levels before meals and at bedtime.\n• Maintain a low-sugar, low-carbohydrate diet.\n• Take medicines as prescribed — do not skip doses.\n• Exercise for at least 30 minutes daily.\n• Follow-up after 1 month with HbA1c report.',
    hypertension: '• Check blood pressure daily and record readings.\n• Maintain a low-salt diet. Avoid processed foods.\n• Do not skip BP medication.\n• Avoid stress and heavy physical exertion.\n• Follow-up after 2 weeks with BP log.',
    ayurveda: '• Take medicine on an empty stomach with warm water.\n• Avoid sour, spicy, and heavy foods.\n• Practice daily yoga and pranayama.\n• Maintain regular sleep schedule (10 PM – 6 AM).\n• Follow-up after 1 month.',
    homeopathy: '• Avoid coffee, mint, onion, garlic, and camphor during treatment.\n• Take medicine 15 minutes before or after food.\n• Do not touch tablets — dissolve directly under tongue.\n• Follow-up after 4 weeks.',
    postop: '• Keep wound/area clean and dry.\n• Change dressing as instructed.\n• Avoid strenuous activity for 4 weeks.\n• Take prescribed antibiotics for the full course.\n• Return immediately if redness, swelling, or discharge occurs.',
    pediatric: '• Give medicine with food to avoid stomach upset.\n• Maintain hydration — offer fluids frequently.\n• Monitor temperature every 4–6 hours.\n• Do not give adult medications.\n• Return if child becomes lethargic or fever persists.',
    respiratory: '• Use inhaler as prescribed — do not skip.\n• Avoid dust, smoke, and allergens.\n• Drink warm water. Avoid cold or iced drinks.\n• Practice deep breathing exercises twice daily.',
    gastro: '• Eat small, frequent meals. Avoid spicy and oily food.\n• Do not lie down immediately after eating.\n• Avoid coffee, alcohol, and carbonated drinks.\n• Take antacids 30 minutes before meals.',
  };
  let text = '';
  if (NOTE_TEMPLATES_DATA) {
    const t = NOTE_TEMPLATES_DATA.find(t => t.key === key);
    if (t) text = t.text;
  }
  if (!text) text = FALLBACK[key] || '';
  if (!text) return;
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  ta.value = text;
  if (typeof updateNotesCounter === 'function') updateNotesCounter(ta);
  if (typeof autoResizeTextarea === 'function') autoResizeTextarea(ta);
  const sel = document.getElementById('noteTemplate'); if (sel) sel.value = '';
}

// ════════════════════════════════════════════════════════════
//  VIEW / FILTER
// ════════════════════════════════════════════════════════════
function setView(view) {
  // If coming from doctors view, restore prescription view
  if (currentView === 'doctors') {
    document.getElementById('doctorsView').style.display = 'none';
    ['statsRow', 'controlsBar', 'prescriptionsList'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = '';
    });
    const newBtn = document.getElementById('newPrescBtn');
    if (newBtn) newBtn.style.display = '';
  }
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  event.currentTarget.classList.add('active');
  const titles = { all: 'All Rx', recent: 'Recent Rx (Last 30 Days)', active: 'Active Rx' };
  const subs = { all: 'Manage all your medical records', recent: 'Rx issued in the last 30 days', active: 'Currently active treatment records' };
  document.getElementById('pageTitle').textContent = titles[view] || 'Rx';
  document.getElementById('pageSubtitle').textContent = subs[view] || '';
  applyFilters();
}
function filterByType(type) {
  currentTypeFilter = type;
  document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active-filter'));
  event.currentTarget.classList.add('active-filter'); applyFilters();
}
function clearFilters() {
  ['srchPatient', 'srchDoctor', 'srchDiagnosis', 'srchPhone', 'srchEmail', 'srchId', 'srchDateFrom', 'srchDateTo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sortSelect').value = 'newest'; document.getElementById('statusFilter').value = 'all';
  currentTypeFilter = 'all';
  document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active-filter'));
  const first = document.querySelector('.type-filter-btn'); if (first) first.classList.add('active-filter');
  applyFilters();
}

// ════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(overlay => { overlay.addEventListener('click', function (e) { if (e.target === this) closeModal(this.id); }); });

// ════════════════════════════════════════════════════════════
//  FORM HELPERS
// ════════════════════════════════════════════════════════════
function resetForm() {
  document.querySelectorAll('#formModal input:not([type=radio]), #formModal select, #formModal textarea').forEach(el => { el.value = ''; });
  document.querySelector('input[name="medType"][value="allopathy"]').checked = true;
  document.getElementById('fStatus').value = 'active';
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  // reset note categories
  activeNoteCategories = new Set();
  document.querySelectorAll('.note-cat-chip').forEach(b => b.classList.remove('active'));
  updateNoteCategoryDisplay();
  const ta = document.getElementById('fNotes');
  if (ta) { updateNotesCounter(ta); ta.style.height = ''; }
  const tmpl = document.getElementById('noteTemplate');
  if (tmpl) tmpl.value = '';
  clearDoctorAvailPanel();
  const diagEditor = document.getElementById('diagnosticEditor');
  if (diagEditor) diagEditor.innerHTML = '';
}
function getVal(id) { return (document.getElementById(id)?.value || '').trim(); }
function setVal(id, val) { const el = document.getElementById(id); if (el && val != null) el.value = val; }
function focusEl(id) { document.getElementById(id)?.focus(); }

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div'); toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-fade'); setTimeout(() => toast.remove(), 350); }, 3200);
}

// ════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════
function escHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(str) { return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function formatDate(d) { if (!d) return '—'; try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

// ════════════════════════════════════════════════════════════
//  CLINICAL NOTES — ENHANCED FEATURES
// ════════════════════════════════════════════════════════════
const NOTE_TEMPLATES = {
  fever: `• Drink 3–4 litres of warm fluids daily.
• Take complete bed rest for 2–3 days.
• Avoid cold water, cold foods, and chilled beverages.
• Paracetamol may be taken for fever above 38.5°C.
• Follow-up: Return after 3 days or sooner if fever persists.`,
  arthritis: `• Apply warm fomentation to affected joints twice daily.
• Avoid prolonged weight-bearing and strenuous activity.
• Physiotherapy sessions recommended 3×/week.
• Maintain a healthy body weight.
• Follow-up: 1 month or earlier if pain worsens.`,
  diabetes: `• Maintain fasting blood glucose between 80–130 mg/dL.
• Low-sugar, low-GI diet strictly recommended.
• Daily 30-minute brisk walk.
• Check blood glucose levels twice daily.
• Avoid skipping meals.
• Follow-up: 1 month (HbA1c check).`,
  hypertension: `• Low-salt diet (< 5 g/day).
• Avoid smoking and alcohol.
• Daily 30–45 minutes of moderate aerobic exercise.
• Monitor BP at home daily—target < 130/80 mmHg.
• Reduce stress; practice deep breathing or meditation.
• Follow-up: 2 weeks for BP review.`,
  ayurveda: `• Follow Vata/Pitta/Kapha-balancing diet as advised.
• Prefer warm, freshly cooked, oily foods over raw/cold food.
• Avoid incompatible food combinations (viruddha ahara).
• Morning oil massage (abhyanga) recommended.
• Follow-up: 1 month.`,
  homeopathy: `• Avoid mint, menthol, strong perfumes, and coffee during treatment.
• Dissolve pills under the tongue; do not touch with hands.
• Take remedies 30 min before or after meals.
• Avoid camphor-based products.
• Follow-up: 4 weeks.`,
  postop: `• Keep the wound clean, dry, and covered.
• Do not submerge wound in water for 2 weeks.
• Monitor for signs of infection: redness, swelling, pus, fever.
• No heavy lifting or strenuous activity for 6 weeks.
• Return immediately if fever > 38°C, excessive bleeding, or wound opens.
• Follow-up: 7 days for wound review.`,
  pediatric: `• Ensure adequate fluid intake throughout the day.
• Child should rest and avoid school for 2–3 days.
• Monitor temperature every 4 hours; paracetamol as prescribed for fever.
• Maintain regular feeding schedule; no force-feeding.
• Follow-up: 3 days or earlier if condition worsens.`
};

function applyNoteTemplate(key) {
  if (!key) return;
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  const tpl = NOTE_TEMPLATES[key] || '';
  if (ta.value && !confirm('This will replace the current notes. Continue?')) {
    document.getElementById('noteTemplate').value = ''; return;
  }
  ta.value = tpl;
  updateNotesCounter(ta);
  autoResizeTextarea(ta);
  ta.focus();
  document.getElementById('noteTemplate').value = '';
}

function appendNote(text) {
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  ta.value = ta.value + sep + text;
  updateNotesCounter(ta);
  autoResizeTextarea(ta);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = ta.value.length;
}

function insertNoteText(text) {
  const ta = document.getElementById('fNotes');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const before = ta.value.substring(0, start), after = ta.value.substring(end);
  ta.value = before + text + after;
  ta.selectionStart = ta.selectionEnd = start + text.length;
  updateNotesCounter(ta);
  autoResizeTextarea(ta);
  ta.focus();
}

function clearNotes() {
  const ta = document.getElementById('fNotes');
  if (!ta || !ta.value) return;
  if (!confirm('Clear all clinical notes?')) return;
  ta.value = '';
  updateNotesCounter(ta);
  ta.style.height = '';
  ta.focus();
}

function updateNotesCounter(ta) {
  const el = document.getElementById('notesCounter');
  if (!el) return;
  const text = ta.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = ta.value.length;
  el.textContent = `${words} word${words !== 1 ? 's' : ''} · ${chars} char${chars !== 1 ? 's' : ''}`;
  el.classList.toggle('notes-counter-warn', chars > 800);
}

function autoResizeTextarea(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 320) + 'px';
}

function toggleNoteCategory(btn) {
  const cat = btn.getAttribute('data-cat');
  if (activeNoteCategories.has(cat)) {
    activeNoteCategories.delete(cat);
    btn.classList.remove('active');
  } else {
    activeNoteCategories.add(cat);
    btn.classList.add('active');
  }
  updateNoteCategoryDisplay();
}

function updateNoteCategoryDisplay() {
  const el = document.getElementById('notesCategoryDisplay');
  if (!el) return;
  if (!activeNoteCategories.size) { el.innerHTML = ''; return; }
  const labels = { dietary: '🥗 Dietary', lifestyle: '🏃 Lifestyle', warning: '⚠️ Warning', followup: '📅 Follow-up', medication: '💊 Medication', rest: '😴 Rest' };
  el.innerHTML = [...activeNoteCategories].map(c => `<span class="notes-cat-badge cat-${c}">${labels[c] || c}</span>`).join('');
}

// ════════════════════════════════════════════════════════════
//  KEYBOARD
// ════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal('formModal'); closeModal('confirmModal'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openAddModal(); }
});

// ════════════════════════════════════════════════════════════
//  SEED DATA (first run)
// ════════════════════════════════════════════════════════════
function seedIfEmpty() {
  if (prescriptions.length > 0) return;
  prescriptions = [
    { id: genId(), type: 'allopathy', patientName: 'Aarav Sharma', age: '34', gender: 'Male', bloodGroup: 'B+', phone: '+91 98765 43210', email: 'aarav@email.com', doctorName: 'Priya Mehta', specialization: 'General Physician', hospital: 'Apollo Clinic, Patna', regNo: 'MCI/2045', date: '2026-02-18', validUntil: '2026-03-18', diagnosis: 'Viral Fever & Upper Respiratory Tract Infection', status: 'active', medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS (3x/day)', duration: '5 days', route: 'Oral' }, { name: 'Cetirizine', dosage: '10mg', frequency: 'OD at bedtime', duration: '5 days', route: 'Oral' }, { name: 'Azithromycin', dosage: '500mg', frequency: 'OD after food', duration: '3 days', route: 'Oral' }], notes: 'Drink plenty of warm fluids. Rest adequately. Avoid cold water.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: genId(), type: 'homeopathy', patientName: 'Sunita Devi', age: '52', gender: 'Female', bloodGroup: 'O+', phone: '+91 87654 32109', email: '', doctorName: 'Rakesh Kumar Jha', specialization: 'Classical Homeopath', hospital: 'Jha Homeo Clinic', regNo: 'HCI/567', date: '2026-01-30', validUntil: '2026-04-30', diagnosis: 'Chronic Arthritis & Joint Pain', status: 'active', medicines: [{ name: 'Rhus Tox 200C', dosage: '4 pills', frequency: 'BD (morning & evening)', duration: '30 days', route: 'Sublingual' }, { name: 'Calc Carb 30C', dosage: '4 pills', frequency: 'OD at night', duration: '15 days', route: 'Sublingual' }], notes: 'Avoid mint, coffee during treatment. Dissolve pills under the tongue.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: genId(), type: 'ayurveda', patientName: 'Rajan Gupta', age: '45', gender: 'Male', bloodGroup: 'A+', phone: '+91 76543 21098', email: 'rajan.g@email.com', doctorName: 'Vaidya S. Tripathi', specialization: 'Ayurvedic Practitioner', hospital: 'Dhanwantari Ayurveda Center', regNo: 'BAMS/2019', date: '2026-02-05', validUntil: '2026-05-05', diagnosis: 'Vata Imbalance — Digestive Disorders & Fatigue', status: 'active', medicines: [{ name: 'Triphala Churna', dosage: '5g', frequency: 'BD before meals', duration: '60 days', route: 'Oral' }, { name: 'Ashwagandha Capsule', dosage: '500mg', frequency: 'BD with warm milk', duration: '45 days', route: 'Oral' }], notes: 'Follow Vata-pacifying diet. Prefer warm, cooked, oily foods.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];
  saveData();
}

// ════════════════════════════════════════════════════════════
//  DOCTOR AUTO-POPULATE (registry + past prescriptions)
// ════════════════════════════════════════════════════════════
let regDropdownTimer = null;
function onRegNoInput(val) { clearTimeout(regDropdownTimer); regDropdownTimer = setTimeout(() => showRegSuggestions(val.trim()), 150); }

function showRegSuggestions(val) {
  const dropdown = document.getElementById('regNoDropdown');
  if (!val || val.length < 2) { dropdown.classList.remove('open'); return; }

  const seen = new Map();
  // 1. doctor.json registry (preferred)
  doctorRegistry.forEach(d => {
    const key = d.regNo.toLowerCase();
    seen.set(key, { regNo: d.regNo, doctorName: d.name, specialization: d.specialization || '', hospital: d.hospital || '', doctorPhone: d.phone || '' });
  });
  // 2. Past prescriptions (fallback)
  prescriptions.forEach(p => {
    if (!p.regNo || !p.doctorName) return;
    const key = p.regNo.toLowerCase();
    if (!seen.has(key)) seen.set(key, { regNo: p.regNo, doctorName: p.doctorName, specialization: p.specialization || '', hospital: p.hospital || '', doctorPhone: p.doctorPhone || '' });
  });

  const matches = [...seen.values()].filter(d => d.regNo.toLowerCase().includes(val.toLowerCase()) || d.doctorName.toLowerCase().includes(val.toLowerCase()));
  if (!matches.length) { dropdown.innerHTML = `<div class="reg-no-results">No saved doctors found for "<strong>${escHtml(val)}</strong>"</div>`; dropdown.classList.add('open'); return; }
  dropdown.innerHTML = matches.map((d, i) => `<div class="reg-dropdown-item" onmousedown="autoFillDoctor(${i})" data-idx="${i}"><div class="reg-item-name">Dr. ${escHtml(d.doctorName)} <span class="reg-item-badge">${escHtml(d.regNo)}</span></div><div class="reg-item-meta">${[d.specialization, d.hospital].filter(Boolean).join(' · ') || 'No additional info'}</div></div>`).join('');
  dropdown._matches = matches; dropdown.classList.add('open');
}

function autoFillDoctor(idx) {
  const dropdown = document.getElementById('regNoDropdown');
  const d = dropdown._matches && dropdown._matches[idx]; if (!d) return;
  setVal('fRegNo', d.regNo); setVal('fDoctorName', d.doctorName); setVal('fSpecialization', d.specialization); setVal('fHospital', d.hospital); setVal('fDoctorPhone', d.doctorPhone);
  dropdown.classList.remove('open');
  document.getElementById('doctorAutoMsg').textContent = `Filled: Dr. ${d.doctorName}`;
  document.getElementById('doctorAutoStatus').classList.remove('hidden');
  // Show availability panel
  const fullDoc = doctorRegistry.find(dr => dr.regNo === d.regNo);
  if (fullDoc) renderDoctorAvailPanel(fullDoc);
}

function hideRegDropdown() { setTimeout(() => { document.getElementById('regNoDropdown').classList.remove('open'); }, 200); }

function clearDoctorFields() {
  setVal('fRegNo', ''); setVal('fDoctorName', ''); setVal('fSpecialization', ''); setVal('fHospital', ''); setVal('fDoctorPhone', '');
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  clearDoctorAvailPanel();
  focusEl('fRegNo');
}

// ════════════════════════════════════════════════════════════
//  ADMIN — PIN GATE
// ════════════════════════════════════════════════════════════
function getAdminPin() { return localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || 'admin1234'; }

function openAdminPanel() {
  const pinInp = document.getElementById('adminPinInput');
  const pinErr = document.getElementById('adminPinError');
  if (pinInp) pinInp.value = '';
  if (pinErr) pinErr.textContent = '';
  if (isAdminUnlocked) {
    document.getElementById('adminPinView').style.display = 'none';
    document.getElementById('adminDoctorView').style.display = '';
    renderAdminDoctorList();
  } else {
    document.getElementById('adminPinView').style.display = '';
    document.getElementById('adminDoctorView').style.display = 'none';
  }
  openModal('adminModal');
  setTimeout(() => { if (!isAdminUnlocked && pinInp) pinInp.focus(); }, 200);
}

function checkAdminPin() {
  const entered = (document.getElementById('adminPinInput')?.value || '').trim();
  if (entered === getAdminPin()) {
    isAdminUnlocked = true;
    document.getElementById('adminPinView').style.display = 'none';
    document.getElementById('adminDoctorView').style.display = '';
    renderAdminDoctorList();
    const btn = document.getElementById('addDoctorBtn'); if (btn) btn.style.display = '';
  } else {
    const err = document.getElementById('adminPinError');
    if (err) err.textContent = 'Incorrect PIN. Try again.';
    const inp = document.getElementById('adminPinInput');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

function lockAdmin() {
  isAdminUnlocked = false;
  const btn = document.getElementById('addDoctorBtn'); if (btn) btn.style.display = 'none';
  closeModal('adminModal');
  showToast('Admin panel locked', 'info');
}

// ════════════════════════════════════════════════════════════
//  ADMIN — DOCTOR CRUD
// ════════════════════════════════════════════════════════════
function renderAdminDoctorList() {
  const c = document.getElementById('adminDoctorList');
  if (!doctorRegistry.length) {
    c.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-muted)">No doctors registered yet. Click ＋ Add Doctor.</div>';
    return;
  }
  const typeBg = { allopathy: 'var(--allopathy-bg)', homeopathy: 'var(--homeopathy-bg)', ayurveda: 'var(--ayurveda-bg)' };
  const typeClr = { allopathy: 'var(--allopathy)', homeopathy: 'var(--homeopathy)', ayurveda: 'var(--ayurveda)' };
  c.innerHTML = doctorRegistry.map((d, i) => `
    <div class="admin-doctor-row">
      <div class="admin-dr-info">
        <div class="admin-dr-name">Dr. ${escHtml(d.name)}
          <span class="admin-dr-reg">${escHtml(d.regNo)}</span>
          <span style="background:${typeBg[d.type] || '#eee'};color:${typeClr[d.type] || '#555'};font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600">${capitalize(d.type || '')}</span>
        </div>
        <div class="admin-dr-sub">${escHtml(d.specialization || '')}${d.hospital ? ' · ' + escHtml(d.hospital) : ''}</div>
        <div class="admin-dr-sub">${d.phone ? '📞 ' + escHtml(d.phone) + '&nbsp; ' : ''}${d.email ? '✉️ ' + escHtml(d.email) : ''}</div>
      </div>
      <div class="admin-dr-actions">
        <button class="btn-sm btn-outline-teal" onclick="openEditDoctorForm(${i})">✏️ Edit</button>
        <button class="btn-sm btn-outline-red" onclick="deleteDoctor(${i})">🗑️</button>
      </div>
    </div>`).join('');
}

function openAddDoctorForm() {
  editingDoctorIdx = null;
  document.getElementById('doctorFormTitle').textContent = '➕ Add Doctor';
  ['dfRegNo', 'dfName', 'dfQualification', 'dfSpecialization', 'dfHospital', 'dfPhone', 'dfEmail', 'dfAddress'].forEach(id => setVal(id, ''));
  document.getElementById('dfType').value = 'allopathy';
  document.getElementById('dfUnavailable').checked = false;
  document.getElementById('availEditor').innerHTML = '';
  addAvailRow();
  closeModal('adminModal');
  openModal('doctorFormModal');
}

function openEditDoctorForm(idx) {
  editingDoctorIdx = idx;
  const d = doctorRegistry[idx]; if (!d) return;
  document.getElementById('doctorFormTitle').textContent = '✏️ Edit Doctor';
  setVal('dfRegNo', d.regNo); setVal('dfName', d.name); setVal('dfQualification', d.qualification || '');
  setVal('dfSpecialization', d.specialization || ''); setVal('dfHospital', d.hospital || '');
  setVal('dfPhone', d.phone || ''); setVal('dfEmail', d.email || ''); setVal('dfAddress', d.address || '');
  document.getElementById('dfType').value = d.type || 'allopathy';
  document.getElementById('dfUnavailable').checked = !!d.unavailable;
  const editor = document.getElementById('availEditor'); editor.innerHTML = '';
  (d.availability || []).forEach(s => addAvailRow(s)); if (!d.availability?.length) addAvailRow();
  closeModal('adminModal');
  openModal('doctorFormModal');
}

function saveDoctor() {
  const regNo = getVal('dfRegNo'), name = getVal('dfName');
  if (!regNo) { showToast('Reg. Number is required.', 'error'); return; }
  if (!name) { showToast('Doctor name is required.', 'error'); return; }
  if (editingDoctorIdx === null) {
    const dup = doctorRegistry.find(d => d.regNo.toLowerCase() === regNo.toLowerCase());
    if (dup) { showToast(`Reg No "${regNo}" already exists.`, 'error'); return; }
  }
  const d = {
    regNo, name, qualification: getVal('dfQualification'),
    specialization: getVal('dfSpecialization'), hospital: getVal('dfHospital'),
    phone: getVal('dfPhone'), email: getVal('dfEmail'), address: getVal('dfAddress'),
    type: document.getElementById('dfType').value, availability: getAvailSlots(),
    unavailable: document.getElementById('dfUnavailable').checked
  };
  if (editingDoctorIdx !== null) {
    doctorRegistry[editingDoctorIdx] = d;
    showToast(`Updated Dr. ${name}`, 'success');
  } else {
    doctorRegistry.push(d);
    showToast(`Added Dr. ${name}`, 'success');
  }
  saveDoctorRegistryLocal(); updateStats();
  closeModal('doctorFormModal');
  openModal('adminModal');
  document.getElementById('adminPinView').style.display = 'none';
  document.getElementById('adminDoctorView').style.display = '';
  renderAdminDoctorList();
  if (currentView === 'doctors') renderDoctorsPage();
}

function deleteDoctor(idx) {
  const d = doctorRegistry[idx]; if (!d) return;
  if (!confirm(`Delete Dr. ${d.name} (${d.regNo})?\nThis cannot be undone.`)) return;
  doctorRegistry.splice(idx, 1);
  saveDoctorRegistryLocal(); updateStats(); renderAdminDoctorList();
  if (currentView === 'doctors') renderDoctorsPage();
  showToast(`Deleted Dr. ${d.name}`, 'info');
}

// Availability slot editor rows — time pickers
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function formatTime12to24(str) {
  if (!str) return '';
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return str;
  let h = parseInt(m[1]); const min = m[2], p = m[3].toUpperCase();
  if (p === 'AM' && h === 12) h = 0;
  if (p === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${min}`;
}
function formatTime24to12(t) {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  const p = hh < 12 ? 'AM' : 'PM'; const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${p}`;
}
function parseAvailTime(timeStr) {
  const parts = (timeStr || '').split('–').map(s => s.trim());
  return { from: formatTime12to24(parts[0] || ''), to: formatTime12to24(parts[1] || '') };
}
function addAvailRow(data = {}) {
  const editor = document.getElementById('availEditor');
  const row = document.createElement('div'); row.className = 'avail-row';
  const dayOpts = DAYS_OF_WEEK.map(d => `<option value="${d}" ${d === data.day ? 'selected' : ''}>${d}</option>`).join('');
  const times = parseAvailTime(data.time || '');
  row.innerHTML = `<select class="avail-day-select">${dayOpts}</select>
    <div class="avail-time-range">
      <input type="time" class="avail-time-from" value="${escAttr(times.from)}">
      <span class="avail-time-sep">–</span>
      <input type="time" class="avail-time-to" value="${escAttr(times.to)}">
    </div>
    <button class="btn-remove-med" onclick="this.closest('.avail-row').remove()" title="Remove">✕</button>`;
  editor.appendChild(row);
}
function getAvailSlots() {
  return Array.from(document.querySelectorAll('#availEditor .avail-row')).map(row => {
    const from = row.querySelector('.avail-time-from')?.value || '';
    const to = row.querySelector('.avail-time-to')?.value || '';
    if (!from && !to) return null;
    return { day: row.querySelector('.avail-day-select').value, time: `${formatTime24to12(from)} – ${formatTime24to12(to)}` };
  }).filter(s => s && s.time.trim() !== '–');
}

// ════════════════════════════════════════════════════════════
//  DOCTORS VIEW — AVAILABILITY PAGE
// ════════════════════════════════════════════════════════════
function showDoctorView() {
  currentView = 'doctors';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navDoctors').classList.add('active');
  ['statsRow', 'controlsBar', 'prescriptionsList'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const newBtn = document.getElementById('newPrescBtn'); if (newBtn) newBtn.style.display = 'none';
  document.getElementById('doctorsView').style.display = '';
  document.getElementById('pageTitle').textContent = '👨‍⚕️ Doctors & Availability';
  document.getElementById('pageSubtitle').textContent = 'Registered practitioners and their consultation schedules';
  // Build dynamic availability filter (next 7 days)
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const avSel = document.getElementById('doctorAvailFilter');
  if (avSel) {
    avSel.innerHTML = '<option value="">📅 All Availability</option>';
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dayName = DAY_NAMES[d.getDay()];
      const label = i === 0 ? `🟢 Today (${dayName})` : i === 1 ? `🔵 Tomorrow (${dayName})` : `📅 ${dayName}`;
      const opt = document.createElement('option'); opt.value = dayName; opt.textContent = label;
      avSel.appendChild(opt);
    }
  }
  // Clear filter inputs
  const fi = document.getElementById('doctorFilterInput'); if (fi) fi.value = '';
  const ft = document.getElementById('doctorTypeFilter'); if (ft) ft.value = '';
  if (avSel) avSel.value = '';
  renderDoctorsPage(doctorRegistry);
}

function renderDoctorsPage(list = doctorRegistry) {
  const grid = document.getElementById('doctorsGrid');
  const banner = document.getElementById('todayBanner');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">👨‍⚕️</div>
      <div class="empty-title">${doctorRegistry.length ? 'No doctors match your filter.' : 'No Doctors Registered'}</div>
      <div class="empty-sub">${doctorRegistry.length ? 'Try clearing the filter.' : 'Contact the admin to register doctors.'}</div></div>`;
    if (banner) banner.style.display = 'none'; return;
  }
  const todayDrs = list.filter(d => d.availability?.some(s => s.day === TODAY_NAME));
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = todayDrs.length
      ? `<span class="today-dot">🟢</span> <strong>${todayDrs.length} doctor${todayDrs.length > 1 ? 's' : ''} available today</strong> (${TODAY_NAME}) — ${todayDrs.map(d => `Dr. ${escHtml(d.name)}`).join(', ')}`
      : `<span>📅</span> No doctors available today (${TODAY_NAME})`;
  }
  const typeIcon = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱' };
  const typeBg = { allopathy: 'var(--allopathy-bg)', homeopathy: 'var(--homeopathy-bg)', ayurveda: 'var(--ayurveda-bg)' };
  const typeClr = { allopathy: 'var(--allopathy)', homeopathy: 'var(--homeopathy)', ayurveda: 'var(--ayurveda)' };
  grid.innerHTML = list.map(d => {
    const availToday = d.availability?.find(s => s.day === TODAY_NAME);
    const isUnavailable = !!d.unavailable;
    const slotsHtml = (d.availability || []).map(s =>
      `<div class="dr-slot${s.day === TODAY_NAME && !isUnavailable ? ' dr-slot-today' : ''}">
        <span class="dr-slot-day">${s.day.substring(0, 3)}</span>
        <span class="dr-slot-time">${escHtml(s.time)}</span>
      </div>`).join('');
    return `<div class="dr-card${availToday && !isUnavailable ? ' dr-card-available' : ''}${isUnavailable ? ' dr-card-unavailable' : ''}">
      <div class="dr-card-header">
        <div class="dr-avatar" style="background:${typeBg[d.type] || '#eee'};color:${typeClr[d.type] || '#333'}">
          ${typeIcon[d.type] || '🩺'}
        </div>
        <div class="dr-info">
          <div class="dr-name">Dr. ${escHtml(d.name)}</div>
          <div class="dr-spec">${escHtml(d.specialization || '')}</div>
          <div class="dr-reg-badge">${escHtml(d.regNo)}</div>
        </div>
        ${isUnavailable
        ? `<div class="dr-unavail-badge">🔴 Not Available</div>`
        : (availToday ? `<div class="dr-today-badge">Today ✓<br><small>${escHtml(availToday.time)}</small></div>` : '')}
      </div>
      <div class="dr-card-body">
        ${d.hospital ? `<div class="dr-detail">🏥 ${escHtml(d.hospital)}</div>` : ''}
        ${d.qualification ? `<div class="dr-detail">🎓 ${escHtml(d.qualification)}</div>` : ''}
        ${d.phone ? `<div class="dr-detail">📞 ${escHtml(d.phone)}</div>` : ''}
        ${d.email ? `<div class="dr-detail">✉️ ${escHtml(d.email)}</div>` : ''}
        ${d.address ? `<div class="dr-detail">📍 ${escHtml(d.address)}</div>` : ''}
        <div class="dr-schedule">
          <div class="dr-schedule-title">📅 Weekly Schedule</div>
          ${isUnavailable ? `<div class="dr-unavail-notice">⚠️ Doctor is currently marked as unavailable. Schedule shown for reference only.</div>` : ''}
          <div class="dr-slots">${slotsHtml || '<span style="color:var(--text-muted);font-size:12px">No schedule listed</span>'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterDoctors() {
  const q = (document.getElementById('doctorFilterInput')?.value || '').toLowerCase().trim();
  const type = document.getElementById('doctorTypeFilter')?.value || '';
  const avail = document.getElementById('doctorAvailFilter')?.value || ''; // now a day name string e.g. 'Monday'
  let list = [...doctorRegistry];
  if (q) list = list.filter(d =>
    d.name.toLowerCase().includes(q) || d.regNo.toLowerCase().includes(q) ||
    (d.specialization || '').toLowerCase().includes(q) || (d.hospital || '').toLowerCase().includes(q));
  if (type) list = list.filter(d => d.type === type);
  if (avail) list = list.filter(d => d.availability?.some(s => s.day === avail));
  renderDoctorsPage(list);
}
function clearDoctorFilter() {
  ['doctorFilterInput', 'doctorTypeFilter', 'doctorAvailFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderDoctorsPage(doctorRegistry);
}

// ════════════════════════════════════════════════════════════
//  PATIENT HISTORY (on demand)
// ════════════════════════════════════════════════════════════
function togglePatientHistory(btn) {
  const patientName = btn.dataset.patient;
  const cardId = btn.dataset.id;
  const el = document.getElementById(`hist_${cardId}`);
  if (!el) return;
  const chevron = btn.querySelector('.hist-chevron');
  if (el.dataset.loaded === '1') {
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (chevron) chevron.textContent = open ? '▼' : '▲';
    return;
  }
  el.dataset.loaded = '1';
  const history = prescriptions
    .filter(p => p.patientName === patientName && p.id !== cardId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!history.length) {
    el.innerHTML = '<div class="hist-empty">No previous visits found.</div>';
  } else {
    const statusClr = { active: 'var(--green)', completed: 'var(--text-muted)', expired: 'var(--red)' };
    el.innerHTML = history.map(p => `
      <div class="hist-row">
        <div class="hist-date">${formatDate(p.date)}</div>
        <div class="hist-info">
          <span class="hist-diag">${escHtml(p.diagnosis || 'No diagnosis recorded')}</span>
          ${p.doctorName ? `<span class="hist-dr">🩺 ${escHtml(p.doctorName)}</span>` : ''}
          <span class="hist-status" style="color:${statusClr[p.status] || 'var(--text-muted)'}">${capitalize(p.status || '')}</span>
        </div>
        ${p.medicines?.length ? `<div class="hist-meds">💊 ${p.medicines.slice(0, 3).map(m => escHtml(m.name)).join(', ')}${p.medicines.length > 3 ? ` +${p.medicines.length - 3} more` : ''}</div>` : ''}
      </div>`).join('');
  }
  el.style.display = '';
  if (chevron) chevron.textContent = '▲';
}

// ════════════════════════════════════════════════════════════
//  REVISION HISTORY (per-prescription versions)
// ════════════════════════════════════════════════════════════
function toggleRevisionHistory(btn) {
  const cardId = btn.dataset.id;
  const el = document.getElementById(`rev_${cardId}`);
  if (!el) return;
  const chevron = btn.querySelector('.hist-chevron');
  if (el.dataset.loaded === '1') {
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (chevron) chevron.textContent = open ? '▼' : '▲';
    return;
  }
  el.dataset.loaded = '1';
  const p = prescriptions.find(x => x.id === cardId);
  const revisions = (p?.revisions || []).slice().reverse(); // newest first
  if (!revisions.length) {
    el.innerHTML = '<div class="hist-empty">No previous revisions.</div>';
    el.style.display = '';
    return;
  }
  const typeLabel = { allopathy: '💉 Allopathy', homeopathy: '🌿 Homeopathy', ayurveda: '🌱 Ayurveda' };
  el.innerHTML = revisions.map((rv, i) => {
    const savedLabel = rv._savedAt
      ? `Saved ${new Date(rv._savedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
      : `Version ${revisions.length - i}`;
    const medsSummary = (rv.medicines || []).slice(0, 3).map(m => escHtml(m.name)).join(', ') +
      (rv.medicines?.length > 3 ? ` +${rv.medicines.length - 3} more` : '');
    return `<div class="rev-row">
      <div class="rev-header">
        <span class="rev-version">v${revisions.length - i}</span>
        <span class="rev-date">${savedLabel}</span>
        <span class="rev-type">${typeLabel[rv.type] || rv.type}</span>
        <button class="rev-restore-btn" onclick="restoreRevision('${cardId}', ${revisions.length - 1 - i})">↩ Restore</button>
      </div>
      <div class="rev-body">
        ${rv.diagnosis ? `<div class="rev-field"><span class="rev-label">Diagnosis:</span> ${escHtml(rv.diagnosis)}</div>` : ''}
        ${rv.status ? `<div class="rev-field"><span class="rev-label">Status:</span> ${capitalize(rv.status)}</div>` : ''}
        ${medsSummary ? `<div class="rev-field"><span class="rev-label">Medicines:</span> 💊 ${medsSummary}</div>` : ''}
        ${rv.notes ? `<div class="rev-field"><span class="rev-label">Notes:</span> ${escHtml(rv.notes.substring(0, 120))}${rv.notes.length > 120 ? '…' : ''}</div>` : ''}
        ${rv.validUntil ? `<div class="rev-field"><span class="rev-label">Valid until:</span> ${formatDate(rv.validUntil)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  el.style.display = '';
  if (chevron) chevron.textContent = '▲';
}

function restoreRevision(cardId, revIdx) {
  if (!confirm('Restore this revision? The current prescription will become a new revision.')) return;
  const pIdx = prescriptions.findIndex(x => x.id === cardId);
  if (pIdx === -1) return;
  const p = prescriptions[pIdx];
  const revToRestore = (p.revisions || [])[revIdx];
  if (!revToRestore) return;
  // snapshot current before restoring
  const snap = { ...p }; delete snap.revisions;
  const newRevisions = [...(p.revisions || [])];
  newRevisions.splice(revIdx, 1); // remove the one we're restoring
  newRevisions.push({ ...snap, _savedAt: p.updatedAt || p.createdAt || p.date });
  prescriptions[pIdx] = { ...revToRestore, id: cardId, revisions: newRevisions, updatedAt: new Date().toISOString() };
  saveData(); render();
  showToast('Revision restored successfully', 'success');
}

// ════════════════════════════════════════════════════════════
//  QUICK CHIPS — DYNAMIC RENDER WITH FILTER
// ════════════════════════════════════════════════════════════
const QUICK_CHIPS = [
  { icon: '💧', label: 'Warm fluids', text: 'Drink plenty of warm fluids.' },
  { icon: '🛏️', label: 'Bed rest', text: 'Take complete bed rest for 2–3 days.' },
  { icon: '🧊', label: 'Avoid cold', text: 'Avoid cold water and chilled foods.' },
  { icon: '🍽️', label: 'After meals', text: 'Take medicines after meals.' },
  { icon: '🥄', label: 'Before meals', text: 'Take medicines before meals.' },
  { icon: '🚭', label: 'No alcohol/smoking', text: 'Avoid alcohol and smoking.' },
  { icon: '📅', label: 'F/U 7 days', text: 'Follow-up after 7 days.' },
  { icon: '📅', label: 'F/U 1 month', text: 'Follow-up after 1 month.' },
  { icon: '🚨', label: 'Return if worse', text: 'Return immediately if symptoms worsen.' },
  { icon: '🏋️', label: 'Avoid exertion', text: 'Avoid strenuous physical activity.' },
  { icon: '🧂', label: 'Low-salt diet', text: 'Maintain a low-salt diet.' },
  { icon: '🍬', label: 'Low-sugar diet', text: 'Maintain a low-sugar diet.' },
  { icon: '😴', label: 'Sleep 7-8h', text: 'Get adequate sleep (7–8 hours per night).' },
  { icon: '🩹', label: 'Keep clean/dry', text: 'Keep wound/area clean and dry.' },
  { icon: '💊', label: 'Take with water', text: 'Take medicine with a full glass of water.' },
  { icon: '☀️', label: 'Morning dose', text: 'Take morning dose before 8 AM.' },
  { icon: '🌙', label: 'Bedtime dose', text: 'Take dose at bedtime.' },
  { icon: '❄️', label: 'Keep refrigerated', text: 'Store medicine in refrigerator.' },
];
function renderQuickChips(filter = '') {
  const scroll = document.getElementById('quickChipsScroll');
  if (!scroll) return;
  const chips = QUICK_CHIPS_DATA || QUICK_CHIPS;
  const q = filter.toLowerCase().trim();
  const filtered = q
    ? chips.filter(c => c.label.toLowerCase().includes(q) || c.text.toLowerCase().includes(q))
    : chips;
  if (!filtered.length) {
    scroll.innerHTML = '<span style="color:var(--text-muted);font-size:12px;padding:5px 0">No chips match</span>';
    return;
  }
  scroll.innerHTML = filtered.map(c =>
    `<button type="button" class="quick-chip" data-text="${escHtml(c.text)}" onclick="appendNote(this.dataset.text)">${c.icon} ${c.label}</button>`
  ).join('');
}


// ════════════════════════════════════════════════════════════
//  INLINE AVAILABILITY PANEL (inside prescription form)
// ════════════════════════════════════════════════════════════
function renderDoctorAvailPanel(d) {
  const panel = document.getElementById('doctorAvailPanel');
  const slotsEl = document.getElementById('availInlineSlots');
  const nameEl = document.getElementById('availInlineDoctorName');
  if (!panel) return;
  if (nameEl) nameEl.textContent = `Dr. ${d.name}`;
  let slotsHtml = '';
  if (d.unavailable) {
    slotsHtml = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:12px;font-weight:600">🔴 Dr. ${escHtml(d.name)} is currently marked as unavailable.</div>`;
  } else if (!d.availability || !d.availability.length) {
    slotsHtml = '<span style="color:var(--text-muted);font-size:12px">No availability listed.</span>';
  } else {
    slotsHtml = d.availability.map(s =>
      `<div class="avail-slot${s.day === TODAY_NAME ? ' avail-slot-today' : ''}">
        <span class="avail-day">${s.day}${s.day === TODAY_NAME ? ' ✓' : ''}</span>
        <span class="avail-time">${escHtml(s.time)}</span>
      </div>`).join('');
  }
  if (slotsEl) slotsEl.innerHTML = slotsHtml;
  panel.classList.remove('hidden');
}
function clearDoctorAvailPanel() {
  const panel = document.getElementById('doctorAvailPanel');
  if (panel) panel.classList.add('hidden');
}

// ════════════════════════════════════════════════════════════
//  COLLAPSIBLE FORM SECTIONS
// ════════════════════════════════════════════════════════════
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.toggle('collapsed');
}
function expandSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.classList.remove('collapsed');
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
loadData();
loadPatientRegistry();
seedIfEmpty();
Promise.all([
  loadDoctorRegistry(),
  loadQuickChips(),
  loadNoteTemplates()
]).then(() => render());

// ════════════════════════════════════════════════════════════
//  PATIENT REGISTRATION
// ════════════════════════════════════════════════════════════
function openRegisterModal() {
  // Reset all fields
  ['regName', 'regAge', 'regPhone', 'regEmail', 'regAddress', 'regFee'].forEach(id => setVal(id, ''));
  setVal('regGender', ''); setVal('regBloodGroup', '');
  document.querySelector('input[name="regPayment"][value="Cash"]').checked = true;
  document.getElementById('regDate').value = todayISO();
  // Auto-generate patient ID
  document.getElementById('regPid').textContent = genPatientId();
  // Populate doctor dropdown
  const sel = document.getElementById('regDoctor');
  sel.innerHTML = '<option value="">— Select Doctor —</option>' +
    doctorRegistry.map(d =>
      `<option value="${escAttr(d.name)}" data-reg="${escAttr(d.regNo)}"${d.unavailable ? ' disabled' : ''}>Dr. ${escHtml(d.name)}${d.unavailable ? ' (Unavailable)' : ''} — ${escHtml(d.specialization || d.type)}</option>`
    ).join('');
  openModal('registerModal');
}

function registerPatient() {
  const name = getVal('regName');
  const doctor = getVal('regDoctor');
  const fee = parseFloat(document.getElementById('regFee').value || '0');
  if (!name) { showToast('Patient name is required.', 'error'); focusEl('regName'); return; }
  if (!doctor) { showToast('Please select a consultant doctor.', 'error'); focusEl('regDoctor'); return; }
  if (!fee || fee <= 0) { showToast('Please enter a valid consultation fee.', 'error'); focusEl('regFee'); return; }
  const paymentMethod = document.querySelector('input[name="regPayment"]:checked')?.value || 'Cash';
  const pid = document.getElementById('regPid').textContent;
  if (!confirm(`Confirm Payment\n\nConsultation Fee: ₹${fee}\nPayment Method: ${paymentMethod}\nDoctor: Dr. ${doctor}\n\nProceed with registration?`)) return;
  const patient = {
    id: pid,
    name,
    age: getVal('regAge'),
    gender: getVal('regGender'),
    bloodGroup: getVal('regBloodGroup'),
    phone: getVal('regPhone'),
    email: getVal('regEmail'),
    address: getVal('regAddress'),
    consultantDoctor: doctor,
    consultantFee: fee,
    paymentMethod,
    registrationDate: document.getElementById('regDate').value || todayISO(),
    registeredAt: new Date().toISOString()
  };
  patientRegistry.unshift(patient);
  savePatientRegistry();
  closeModal('registerModal');
  showToast(`✅ Patient registered! ID: ${pid} · Fee ₹${fee} received via ${paymentMethod}`, 'success');
}
