// ════════════════════════════════════════════════════════════
//  SCRIPT-DOCTORS.JS — Admin panel, doctor CRUD, doctors view
//  Depends on: script-utils.js, script-core.js, script-form.js
// ════════════════════════════════════════════════════════════

// ─── Admin panel ──────────────────────────────────────────
function openAdminPanel() {
  var hasAccess  = (typeof can !== 'undefined') ? can.accessAdminPanel() : false;
  var pinView    = document.getElementById('adminPinView');
  var doctorView = document.getElementById('adminDoctorView');
  if (!pinView || !doctorView) { showToast('Admin panel not found.', 'error'); return; }

  if (hasAccess) {
    isAdminUnlocked = true;
    pinView.style.display    = 'none';
    doctorView.style.display = '';
    renderAdminDoctorList();
    var ps = document.getElementById('adminPremiumSection');
    if (ps && typeof renderPremiumUpgradeSection === 'function') ps.innerHTML = renderPremiumUpgradeSection();
    openModal('adminModal');
  } else {
    isAdminUnlocked = false;
    pinView.style.display    = '';
    doctorView.style.display = 'none';
    var pinInp = document.getElementById('adminPinInput');
    var pinErr = document.getElementById('adminPinError');
    if (pinInp) pinInp.value = '';
    if (pinErr) pinErr.textContent = '';
    openModal('adminModal');
    setTimeout(function(){ if (pinInp) pinInp.focus(); }, 150);
  }
}
function checkAdminPin() {
  var entered = (document.getElementById('adminPinInput')?.value || '').trim();
  if (entered === getAdminPin()) {
    isAdminUnlocked = true;
    document.getElementById('adminPinView').style.display    = 'none';
    document.getElementById('adminDoctorView').style.display = '';
    renderAdminDoctorList();
    var ps = document.getElementById('adminPremiumSection');
    if (ps && typeof renderPremiumUpgradeSection === 'function') ps.innerHTML = renderPremiumUpgradeSection();
  } else {
    var err = document.getElementById('adminPinError'); if (err) err.textContent = 'Incorrect PIN. Try again.';
    var inp = document.getElementById('adminPinInput'); if (inp) { inp.value = ''; inp.focus(); }
  }
}
function lockAdmin() { isAdminUnlocked = false; closeModal('adminModal'); showToast('Admin panel locked', 'info'); }

// ─── Doctor list rendering ────────────────────────────────
function renderAdminDoctorList() {
  var c = document.getElementById('adminDoctorList');
  if (!doctorRegistry.length) { c.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-muted)">No doctors registered yet.</div>'; return; }
  var typeBg  = {allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)'};
  var typeClr = {allopathy:'var(--allopathy)',    homeopathy:'var(--homeopathy)',    ayurveda:'var(--ayurveda)'};
  c.innerHTML = doctorRegistry.map(function(d, i) {
    return '<div class="admin-doctor-row">' +
      '<div class="admin-dr-info">' +
        '<div class="admin-dr-name">Dr. ' + escHtml(d.name) + ' <span class="admin-dr-reg">' + escHtml(d.regNo) + '</span>' +
          '<span style="background:' + (typeBg[d.type]||'#eee') + ';color:' + (typeClr[d.type]||'#555') + ';font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600">' + capitalize(d.type||'') + '</span>' +
        '</div>' +
        '<div class="admin-dr-sub">' + escHtml(d.specialization||'') + (d.hospital ? ' · ' + escHtml(d.hospital) : '') + '</div>' +
        '<div class="admin-dr-sub">' + (d.phone ? '📞 ' + escHtml(d.phone) + '&nbsp; ' : '') + (d.email ? '✉️ ' + escHtml(d.email) : '') + '</div>' +
      '</div>' +
      '<div class="admin-dr-actions">' +
        '<button class="btn-sm btn-outline-teal" onclick="openEditDoctorForm(' + i + ')">✏️ Edit</button>' +
        '<button class="btn-sm btn-outline-red"  onclick="deleteDoctor(' + i + ')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─── Doctor form ──────────────────────────────────────────
function openAddDoctorForm() {
  editingDoctorIdx = null;
  document.getElementById('doctorFormTitle').textContent = '➕ Add Doctor';
  ['dfRegNo','dfName','dfQualification','dfSpecialization','dfPhone','dfEmail','dfAddress'].forEach(function(id){ setVal(id,''); });
  document.getElementById('dfType').value        = 'allopathy';
  document.getElementById('dfUnavailable').checked = false;
  document.getElementById('availEditor').innerHTML = '';
  populateHospitalDropdown('dfHospital', '');
  addAvailRow(); closeModal('adminModal'); openModal('doctorFormModal');
}
function openEditDoctorForm(idx) {
  editingDoctorIdx = idx; var d = doctorRegistry[idx]; if (!d) return;
  document.getElementById('doctorFormTitle').textContent = '✏️ Edit Doctor';
  setVal('dfRegNo', d.regNo); setVal('dfName', d.name); setVal('dfQualification', d.qualification||'');
  setVal('dfSpecialization', d.specialization||''); setVal('dfPhone', d.phone||'');
  setVal('dfEmail', d.email||''); setVal('dfAddress', d.address||'');
  populateHospitalDropdown('dfHospital', d.hospital||'');
  document.getElementById('dfType').value           = d.type || 'allopathy';
  document.getElementById('dfUnavailable').checked  = !!d.unavailable;
  var editor = document.getElementById('availEditor'); editor.innerHTML = '';
  (d.availability || []).forEach(addAvailRow); if (!d.availability?.length) addAvailRow();
  closeModal('adminModal'); openModal('doctorFormModal');
}
async function saveDoctor() {
  var regNo = getVal('dfRegNo'), name = getVal('dfName');
  if (!regNo) { showToast('Reg. Number is required.', 'error'); return; }
  if (!name)  { showToast('Doctor name is required.',  'error'); return; }
  if (editingDoctorIdx === null) {
    var dup = doctorRegistry.find(function(d){ return d.regNo.toLowerCase() === regNo.toLowerCase(); });
    if (dup) { showToast('Reg No "' + regNo + '" already exists.', 'error'); return; }
  }
  var d = {
    regNo, name, qualification: getVal('dfQualification'), specialization: getVal('dfSpecialization'),
    hospital: getVal('dfHospital'), phone: getVal('dfPhone'), email: getVal('dfEmail'),
    address: getVal('dfAddress'), type: document.getElementById('dfType').value,
    availability: getAvailSlots(), unavailable: document.getElementById('dfUnavailable').checked,
    clinicId: activeClinicId
  };
  if (editingDoctorIdx !== null) {
    d.id = doctorRegistry[editingDoctorIdx].id;
    var ok = await dbUpsertDoctor(d, activeClinicId);
    if (!ok) { showToast('DB save failed', 'error'); return; }
    doctorRegistry[editingDoctorIdx] = d;
    showToast('Updated Dr. ' + name, 'success');
  } else {
    d.id = 'dr_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    var ok2 = await dbUpsertDoctor(d, activeClinicId);
    if (!ok2) { showToast('DB save failed', 'error'); return; }
    doctorRegistry.push(d);
    showToast('Added Dr. ' + name, 'success');
  }
  updateStats(); closeModal('doctorFormModal'); renderAdminDoctorList();
  if (currentView === 'doctors') renderDoctorsPage();
  var adminModal = document.getElementById('adminModal');
  if (adminModal && !adminModal.classList.contains('open')) {
    document.getElementById('adminPinView').style.display    = 'none';
    document.getElementById('adminDoctorView').style.display = '';
    openModal('adminModal');
  }
}
async function deleteDoctor(idx) {
  var d = doctorRegistry[idx]; if (!d) return;
  if (!confirm('Delete Dr. ' + d.name + ' (' + d.regNo + ')?\nThis cannot be undone.')) return;
  if (d.id) { var ok = await dbDeleteDoctor(d.id); if (!ok) { showToast('Delete failed', 'error'); return; } }
  doctorRegistry.splice(idx, 1); updateStats(); renderAdminDoctorList();
  if (currentView === 'doctors') renderDoctorsPage();
  showToast('Deleted Dr. ' + d.name, 'info');
}

// ─── Availability rows ────────────────────────────────────
var DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function formatTime12to24(str) {
  if (!str) return '';
  var m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return str;
  var h = parseInt(m[1]), min = m[2], p = m[3].toUpperCase();
  if (p === 'AM' && h === 12) h = 0;
  if (p === 'PM' && h !== 12) h += 12;
  return String(h).padStart(2,'0') + ':' + min;
}
function formatTime24to12(t) {
  if (!t) return '';
  var parts = t.split(':').map(Number); var hh = parts[0], mm = parts[1];
  var p = hh < 12 ? 'AM' : 'PM'; var h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return String(h12).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ' ' + p;
}
function parseAvailTime(timeStr) {
  var parts = (timeStr || '').split('–').map(function(s){ return s.trim(); });
  return { from: formatTime12to24(parts[0]||''), to: formatTime12to24(parts[1]||'') };
}
function addAvailRow(data) {
  var editor = document.getElementById('availEditor');
  if (!data) {
    var rows = editor.querySelectorAll('.avail-row');
    if (rows.length > 0) {
      var last    = rows[rows.length - 1];
      var lastDay = last.querySelector('.avail-day-select')?.value || '';
      var lastFrom= last.querySelector('.avail-time-from')?.value || '';
      var lastTo  = last.querySelector('.avail-time-to')?.value   || '';
      var dayIdx  = DAYS_OF_WEEK.indexOf(lastDay);
      var nextDay = DAYS_OF_WEEK[(dayIdx + 1) % DAYS_OF_WEEK.length];
      data = { day: nextDay, time: (lastFrom && lastTo) ? formatTime24to12(lastFrom) + ' – ' + formatTime24to12(lastTo) : '' };
    } else { data = {}; }
  }
  var row   = document.createElement('div'); row.className = 'avail-row';
  var times = parseAvailTime(data.time || '');
  var dayOpts = DAYS_OF_WEEK.map(function(d){ return '<option value="' + d + '"' + (d === data.day ? ' selected' : '') + '>' + d + '</option>'; }).join('');
  row.innerHTML =
    '<select class="avail-day-select">' + dayOpts + '</select>' +
    '<div class="avail-time-range">' +
      '<input type="time" class="avail-time-from" value="' + escAttr(times.from) + '">' +
      '<span class="avail-time-sep">–</span>' +
      '<input type="time" class="avail-time-to"   value="' + escAttr(times.to)   + '">' +
    '</div>' +
    '<button class="btn-remove-med" onclick="this.parentElement.remove()" title="Remove">✕</button>';
  editor.appendChild(row);
}
function getAvailSlots() {
  return Array.from(document.querySelectorAll('#availEditor .avail-row')).map(function(row) {
    var from = row.querySelector('.avail-time-from')?.value || '';
    var to   = row.querySelector('.avail-time-to')?.value   || '';
    if (!from && !to) return null;
    return { day: row.querySelector('.avail-day-select').value, time: formatTime24to12(from) + ' – ' + formatTime24to12(to) };
  }).filter(function(s){ return s && s.time.trim() !== '–'; });
}

// ─── Doctors view ─────────────────────────────────────────
function showDoctorView() {
  currentView = 'doctors';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('navDoctors').classList.add('active');
  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel','patientsView','pharmacyView',
   'stockView','analyticsView','outbreakView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  document.getElementById('doctorsView').style.display = '';
  document.getElementById('pageTitle').textContent    = '👨‍⚕️ Doctors & Availability';
  document.getElementById('pageSubtitle').textContent = 'Registered practitioners and their consultation schedules';

  var avSel = document.getElementById('doctorAvailFilter');
  if (avSel) {
    avSel.innerHTML = '<option value="">📅 All Availability</option>';
    var today = new Date();
    var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    for (var i = 0; i < 7; i++) {
      var d = new Date(today); d.setDate(today.getDate() + i);
      var dayName = DAY_NAMES[d.getDay()];
      var label   = i === 0 ? '🟢 Today (' + dayName + ')' : i === 1 ? '🔵 Tomorrow (' + dayName + ')' : '📅 ' + dayName;
      var opt = document.createElement('option'); opt.value = dayName; opt.textContent = label;
      avSel.appendChild(opt);
    }
  }
  var fi = document.getElementById('doctorFilterInput'); if (fi) fi.value = '';
  var ft = document.getElementById('doctorTypeFilter');  if (ft) ft.value = '';
  if (avSel) avSel.value = '';
  renderDoctorsPage(doctorRegistry);
  if (typeof refreshSidebarDots === 'function') setTimeout(refreshSidebarDots, 20);
}

function renderDoctorsPage(list) {
  list = list || doctorRegistry;
  var grid   = document.getElementById('doctorsGrid');
  var banner = document.getElementById('todayBanner');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">👨‍⚕️</div>' +
      '<div class="empty-title">' + (doctorRegistry.length ? 'No doctors match your filter.' : 'No Doctors Registered') + '</div>' +
      '<div class="empty-sub">' + (doctorRegistry.length ? 'Try clearing the filter.' : 'Contact the admin to register doctors.') + '</div></div>';
    if (banner) banner.style.display = 'none'; return;
  }
  var todayDrs = list.filter(function(d){ return d.availability?.some(function(s){ return s.day === TODAY_NAME; }); });
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = todayDrs.length
      ? '<span class="today-dot">🟢</span> <strong>' + todayDrs.length + ' doctor' + (todayDrs.length > 1 ? 's' : '') + ' available today</strong> (' + TODAY_NAME + ') — ' + todayDrs.map(function(d){ return 'Dr. ' + escHtml(d.name); }).join(', ')
      : '<span>📅</span> No doctors available today (' + TODAY_NAME + ')';
  }
  var typeIcon = {allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱'};
  var typeBg   = {allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)'};
  var typeClr  = {allopathy:'var(--allopathy)',    homeopathy:'var(--homeopathy)',    ayurveda:'var(--ayurveda)'};
  grid.innerHTML = list.map(function(d) {
    var availToday  = d.availability?.find(function(s){ return s.day === TODAY_NAME; });
    var isUnavail   = !!d.unavailable;
    var slotsHtml   = (d.availability || []).map(function(s) {
      return '<div class="dr-slot' + (s.day === TODAY_NAME && !isUnavail ? ' dr-slot-today' : '') + '">' +
        '<span class="dr-slot-day">' + s.day.substring(0,3) + '</span>' +
        '<span class="dr-slot-time">' + escHtml(s.time) + '</span></div>';
    }).join('');
    return '<div class="dr-card' + (availToday && !isUnavail ? ' dr-card-available' : '') + (isUnavail ? ' dr-card-unavailable' : '') + '">' +
      '<div class="dr-card-header">' +
        '<div class="dr-avatar" style="background:' + (typeBg[d.type]||'#eee') + ';color:' + (typeClr[d.type]||'#333') + '">' + (typeIcon[d.type]||'🩺') + '</div>' +
        '<div class="dr-info"><div class="dr-name">Dr. ' + escHtml(d.name) + '</div><div class="dr-spec">' + escHtml(d.specialization||'') + '</div><div class="dr-reg-badge">' + escHtml(d.regNo) + '</div></div>' +
        (isUnavail ? '<div class="dr-unavail-badge">🔴 Not Available</div>' : (availToday ? '<div class="dr-today-badge">Today ✓<br><small>' + escHtml(availToday.time) + '</small></div>' : '')) +
      '</div>' +
      '<div class="dr-card-body">' +
        (d.hospital     ? '<div class="dr-detail">🏥 ' + escHtml(d.hospital) + '</div>'     : '') +
        (d.qualification? '<div class="dr-detail">🎓 ' + escHtml(d.qualification) + '</div>' : '') +
        (d.phone        ? '<div class="dr-detail">📞 ' + escHtml(d.phone) + '</div>'         : '') +
        (d.email        ? '<div class="dr-detail">✉️ ' + escHtml(d.email) + '</div>'         : '') +
        (d.address      ? '<div class="dr-detail">📍 ' + escHtml(d.address) + '</div>'       : '') +
        '<div class="dr-schedule"><div class="dr-schedule-title">📅 Weekly Schedule</div>' +
          (isUnavail ? '<div class="dr-unavail-notice">⚠️ Doctor is currently marked as unavailable.</div>' : '') +
          '<div class="dr-slots">' + (slotsHtml || '<span style="color:var(--text-muted);font-size:12px">No schedule listed</span>') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterDoctors() {
  var q     = (document.getElementById('doctorFilterInput')?.value || '').toLowerCase().trim();
  var type  = document.getElementById('doctorTypeFilter')?.value  || '';
  var avail = document.getElementById('doctorAvailFilter')?.value || '';
  var list  = [...doctorRegistry];
  if (q)     list = list.filter(function(d){ return d.name.toLowerCase().includes(q) || d.regNo.toLowerCase().includes(q) || (d.specialization||'').toLowerCase().includes(q) || (d.hospital||'').toLowerCase().includes(q); });
  if (type)  list = list.filter(function(d){ return d.type === type; });
  if (avail) list = list.filter(function(d){ return d.availability?.some(function(s){ return s.day === avail; }); });
  renderDoctorsPage(list);
}
function clearDoctorFilter() {
  ['doctorFilterInput','doctorTypeFilter','doctorAvailFilter'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  renderDoctorsPage(doctorRegistry);
}
