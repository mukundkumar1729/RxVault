
// ════════════════════════════════════════════════════════════
//  FIX 2: Add doctor type filter to Book Appointment
// ════════════════════════════════════════════════════════════

var _origOpenBookAppointment = typeof openBookAppointment === 'function' ? openBookAppointment : null;

function openBookAppointment() {
  var overlay = document.getElementById('bookApptOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='bookApptOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  var today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];

  var docOpts = function(filtType) {
    return (doctorRegistry || [])
      .filter(function(d){ return !filtType || d.type === filtType; })
      .map(function(d) {
        return '<option value="'+escAttr(d.name)+'"'+(d.unavailable?' disabled':'')+'>Dr. '+escHtml(d.name)+(d.unavailable?' (Unavailable)':'')+' — '+escHtml(d.specialization||d.type)+'</option>';
      }).join('');
  };

  var patOpts = (patientRegistry||[]).map(function(p){ return '<option value="'+escAttr(p.name)+'" data-pid="'+escAttr(p.id)+'">'+escHtml(p.name)+' ('+escHtml(p.id)+')</option>'; }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:580px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📅 Book Appointment</div><div class="modal-subtitle">Schedule a patient visit and assign token</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'bookApptOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +

        // Patient type toggle
        '<div class="field" style="margin-bottom:14px">' +
          '<label>Patient Type</label>' +
          '<div style="display:flex;gap:10px;margin-top:8px">' +
            '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid var(--teal);border-radius:var(--radius);cursor:pointer;background:var(--teal-pale)">' +
              '<input type="radio" name="bk_patType" value="new" checked onchange="toggleApptPatientType(\'new\')"> 🆕 New Patient' +
            '</label>' +
            '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius);cursor:pointer">' +
              '<input type="radio" name="bk_patType" value="existing" onchange="toggleApptPatientType(\'existing\')"> 👤 Existing Patient' +
            '</label>' +
          '</div>' +
        '</div>' +

        // New patient fields
        '<div id="bk_newPatientFields">' +
          '<div class="form-row" style="margin-bottom:12px">' +
            '<div class="field"><label>Patient Name <span style="color:var(--red)">*</span></label><input type="text" id="bk_patientName" placeholder="Full name"></div>' +
            '<div class="field"><label>Phone</label><input type="tel" id="bk_phone" placeholder="Mobile number"></div>' +
          '</div>' +
        '</div>' +

        // Existing patient fields (hidden initially)
        '<div id="bk_existingPatientFields" style="display:none;margin-bottom:12px">' +
          '<div class="field">' +
            '<label>Patient ID <span style="color:var(--red)">*</span></label>' +
            '<div style="position:relative">' +
              '<input type="text" id="bk_existingPatientId" list="bk_patList_exist" placeholder="Enter Patient ID or name to search" oninput="onExistingPatientSearch(this.value)">' +
              '<datalist id="bk_patList_exist">'+patOpts+'</datalist>' +
            '</div>' +
            '<div id="bk_patientVerifyMsg" style="font-size:12px;margin-top:6px;color:var(--text-muted)">Enter Patient ID (e.g. PID-...) or registered name</div>' +
          '</div>' +
        '</div>' +

        // Doctor type filter + doctor select
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field">' +
            '<label>Medicine System</label>' +
            '<select id="bk_doctorType" onchange="refreshApptDoctorList()">' +
              '<option value="">All Types</option>' +
              '<option value="allopathy">💉 Allopathy</option>' +
              '<option value="homeopathy">🌿 Homeopathy</option>' +
              '<option value="ayurveda">🌱 Ayurveda</option>' +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label>Doctor</label>' +
            '<select id="bk_doctor"><option value="">— Select Doctor —</option>'+docOpts('')+'</select>' +
          '</div>' +
        '</div>' +

        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Visit Type</label>' +
            '<select id="bk_visitType">' +
              '<option value="consultation">🩺 Consultation</option>' +
              '<option value="follow-up">🔄 Follow-up</option>' +
              '<option value="emergency">🚨 Emergency</option>' +
              '<option value="procedure">⚕️ Procedure</option>' +
            '</select></div>' +
          '<div class="field"><label>Date <span style="color:var(--red)">*</span></label>' +
            '<input type="date" id="bk_date" value="'+today+'" min="'+today+'"></div>' +
        '</div>' +

        '<div class="field" style="margin-bottom:12px"><label>Time Slot</label>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<select id="bk_hour" style="flex:1;padding:9px 10px;border:1px solid var(--border);border-radius:var(--radius);font-family:DM Sans,sans-serif;font-size:13px;background:var(--surface)">' +
              '<option value="">HH</option>' +
              Array.from({length:14}, function(_,i){ var h=String(i+7).padStart(2,'0'); return '<option value="'+h+'">'+h+'</option>'; }).join('') +
            '</select>' +
            '<span style="font-weight:700;color:var(--text-muted)">:</span>' +
            '<select id="bk_min" style="flex:1;padding:9px 10px;border:1px solid var(--border);border-radius:var(--radius);font-family:DM Sans,sans-serif;font-size:13px;background:var(--surface)">' +
              '<option value="">MM</option>' +
              ['00','15','30','45'].map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="field" style="margin-bottom:0">' +
          '<label>Notes / Chief Complaint</label>' +
          '<input type="text" id="bk_notes" placeholder="e.g. Fever for 3 days, routine check-up…">' +
        '</div>' +
        '<div id="bk_error" style="color:var(--red);font-size:12.5px;min-height:18px;margin-top:8px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'bookApptOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveAppointmentFixed()">📅 Confirm Booking</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ document.getElementById('bk_patientName')?.focus(); }, 100);
}

function toggleApptPatientType(type) {
  var newFields = document.getElementById('bk_newPatientFields');
  var exFields  = document.getElementById('bk_existingPatientFields');
  var labels    = document.querySelectorAll('input[name="bk_patType"]');
  labels.forEach(function(r) {
    var lbl = r.closest('label');
    if (lbl) { lbl.style.borderColor = r.checked ? 'var(--teal)' : 'var(--border)'; lbl.style.background = r.checked ? 'var(--teal-pale)' : ''; }
  });
  if (type === 'new') {
    if (newFields) newFields.style.display = '';
    if (exFields)  exFields.style.display  = 'none';
  } else {
    if (newFields) newFields.style.display = 'none';
    if (exFields)  exFields.style.display  = '';
  }
}

function refreshApptDoctorList() {
  var type = document.getElementById('bk_doctorType')?.value || '';
  var sel  = document.getElementById('bk_doctor'); if (!sel) return;
  var opts = (doctorRegistry || [])
    .filter(function(d){ return !type || d.type === type; })
    .map(function(d){ return '<option value="'+escAttr(d.name)+'"'+(d.unavailable?' disabled':'')+'>Dr. '+escHtml(d.name)+(d.unavailable?' (Unavailable)':'')+' — '+escHtml(d.specialization||d.type)+'</option>'; }).join('');
  sel.innerHTML = '<option value="">— Select Doctor —</option>' + opts;
}

window._selectedExistingPatient = null;

function onExistingPatientSearch(val) {
  window._selectedExistingPatient = null;
  var msgEl = document.getElementById('bk_patientVerifyMsg'); if (!msgEl) return;
  if (!val) { msgEl.textContent = 'Enter Patient ID or name'; msgEl.style.color = 'var(--text-muted)'; return; }

  var patient = (patientRegistry||[]).find(function(p) {
    return (p.id||'').toLowerCase() === val.toLowerCase() || (p.name||'').toLowerCase() === val.toLowerCase();
  });

  if (patient) {
    window._selectedExistingPatient = patient;
    msgEl.innerHTML = '✅ Found: <strong>'+escHtml(patient.name)+'</strong> · '+escHtml(patient.id)+(patient.phone?' · '+escHtml(patient.phone):'');
    msgEl.style.color = 'var(--green)';
  } else {
    msgEl.textContent = '⚠️ Patient not found. Check ID or name.';
    msgEl.style.color = 'var(--red)';
  }
}

// ════════════════════════════════════════════════════════════
//  FIX 3: Enforce registration before queue entry
// ════════════════════════════════════════════════════════════

async function saveAppointmentFixed() {
  var patType = document.querySelector('input[name="bk_patType"]:checked')?.value || 'new';
  var date    = document.getElementById('bk_date')?.value      || (typeof todayISO === 'function' ? todayISO() : '');
  var bk_h    = document.getElementById('bk_hour')?.value     || '';
  var bk_m    = document.getElementById('bk_min')?.value      || '';
  var time    = (bk_h && bk_m) ? bk_h + ':' + bk_m : '';
  var doctor  = document.getElementById('bk_doctor')?.value    || '';
  var visitType = document.getElementById('bk_visitType')?.value || 'consultation';
  var notes   = document.getElementById('bk_notes')?.value     || '';
  var errEl   = document.getElementById('bk_error');
  if (errEl) errEl.textContent = '';

  var name = '', phone = '', isRegistered = false, patientId = '';

  if (patType === 'existing') {
    var patient = window._selectedExistingPatient;
    if (!patient) {
      if (errEl) errEl.textContent = 'Please enter a valid Patient ID or registered name.'; return;
    }
    name = patient.name; phone = patient.phone || ''; isRegistered = true; patientId = patient.id;
  } else {
    name  = (document.getElementById('bk_patientName')?.value || '').trim();
    phone = (document.getElementById('bk_phone')?.value       || '').trim();
    if (!name) { if (errEl) errEl.textContent = 'Patient name is required.'; return; }
    isRegistered = false;
  }

  var token = await dbGetNextToken(activeClinicId, date);
  var appt  = {
    id:           'appt_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    clinic_id:    activeClinicId,
    patient_name: name,
    patient_phone: phone,
    doctor_name:  doctor,
    appt_date:    date,
    appt_time:    time,
    visit_type:   visitType,
    notes:        notes,
    token_no:     token,
    status:       'waiting',
    arrived:      false,
    is_registered: isRegistered,
    patient_id:   patientId || '',
    created_at:   new Date().toISOString()
  };

  var ok = await dbUpsertAppointment(appt);
  if (!ok) { if (errEl) errEl.textContent = 'Failed to book. Try again.'; return; }

  closeOverlay('bookApptOverlay');
  var msg = isRegistered
    ? '✅ Token #' + token + ' assigned to ' + name + ' (Registered Patient)'
    : '✅ Token #' + token + ' assigned to ' + name + ' (New Patient — registration required before queue entry)';
  showToast(msg, 'success');

  // Refresh appointment view & badge count
  if (typeof appointments !== 'undefined') {
    appointments.unshift(appt);
  }
  refreshAppointmentBadge();
  if (typeof loadAppointmentView === 'function') await loadAppointmentView();
}

// Override arrival and call buttons to enforce registration
var _origRenderApptList = typeof renderApptList === 'function' ? renderApptList : null;

function renderApptList() {
  var list = document.getElementById('apptList');
  if (!list) return;

  var f = typeof apptFilterState !== 'undefined' ? apptFilterState : { patient:'', doctor:'', phone:'', time:'' };
  var filtered = (appointments||[]).filter(function(a) {
    if (f.patient && !(a.patient_name||'').toLowerCase().includes(f.patient)) return false;
    if (f.doctor  && !(a.doctor_name||'').toLowerCase().includes(f.doctor))   return false;
    if (f.phone   && !(a.patient_phone||'').toLowerCase().includes(f.phone))  return false;
    if (f.time    && !(a.appt_time||'').toLowerCase().includes(f.time))       return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">🔍</div>No appointments match your filters.</div>';
    return;
  }

  var visitTypeConfig = {
    'consultation': { icon:'🩺', label:'Consultation', clr:'var(--teal)' },
    'follow-up':    { icon:'🔄', label:'Follow-up',    clr:'var(--allopathy)' },
    'emergency':    { icon:'🚨', label:'Emergency',    clr:'var(--red)' },
    'procedure':    { icon:'⚕️', label:'Procedure',    clr:'var(--homeopathy)' },
  };
  var statusConfig = {
    'waiting':   { label:'⏳ Waiting',   bg:'var(--allopathy-bg)',  clr:'var(--allopathy)', border:'rgba(26,111,219,0.3)' },
    'in-room':   { label:'🔵 In Room',   bg:'var(--teal-pale)',     clr:'var(--teal)',       border:'rgba(10,124,110,0.3)' },
    'done':      { label:'✅ Done',       bg:'#e8f5e9',             clr:'var(--green)',      border:'rgba(22,163,74,0.3)' },
    'cancelled': { label:'❌ Cancelled', bg:'var(--red-bg)',        clr:'var(--red)',        border:'rgba(220,38,38,0.3)' },
  };

  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
    filtered.map(function(a) {
      var sc          = statusConfig[a.status] || statusConfig['waiting'];
      var vtc         = visitTypeConfig[a.visit_type] || visitTypeConfig['consultation'];
      var arrived     = !!a.arrived;
      var isRegistered= !!a.is_registered;

      var regPill = isRegistered
        ? '<span style="background:#e8f5e9;color:var(--green);border:1px solid rgba(22,163,74,0.3);font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px">✅ Registered</span>'
        : '<span style="background:var(--red-bg);color:var(--red);border:1px solid rgba(220,38,38,0.3);font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;cursor:pointer" title="Patient must register first" onclick="promptPatientRegFromAppt(\''+escAttr(a.id)+'\',\''+escAttr(a.patient_name)+'\')">⚠️ Unregistered — Register First</span>';

      var arrivalPill = arrived
        ? '<span style="background:#e8f5e9;color:var(--green);border:1px solid rgba(22,163,74,0.3);font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;cursor:pointer;white-space:nowrap" data-id="'+a.id+'" onclick="toggleArrival(this.dataset.id)">🟢 In Clinic</span>'
        : (isRegistered
            ? '<span style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;cursor:pointer;white-space:nowrap" data-id="'+a.id+'" onclick="toggleArrival(this.dataset.id)" title="Mark as arrived">⚪ Not Arrived</span>'
            : '<span style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;opacity:0.5;cursor:not-allowed" title="Must be registered first">⚪ Not Arrived</span>');

      return (
        '<div style="background:var(--surface);border:1px solid '+(arrived?'rgba(10,124,110,0.25)':'var(--border)')+';border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:14px;padding:14px 18px;transition:box-shadow 0.2s"' +
          ' onmouseenter="this.style.boxShadow=\'var(--shadow)\'" onmouseleave="this.style.boxShadow=\'var(--shadow-sm)\'">' +
          '<div style="background:linear-gradient(135deg,var(--teal-light),var(--teal));color:#fff;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;flex-shrink:0;font-family:\'DM Serif Display\',serif;box-shadow:0 3px 10px rgba(10,124,110,0.3)">' + a.token_no + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<span style="font-size:15px;font-weight:700;color:var(--text-primary)">'+escHtml(a.patient_name)+'</span>' +
              '<span style="background:'+vtc.clr+'18;color:'+vtc.clr+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+vtc.icon+' '+vtc.label+'</span>' +
              regPill + arrivalPill +
            '</div>' +
            '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;display:flex;flex-wrap:wrap;gap:12px">' +
              (a.doctor_name   ? '<span>🩺 Dr. '+escHtml(a.doctor_name)+'</span>'   : '') +
              (a.patient_phone ? '<span>📱 '+escHtml(a.patient_phone)+'</span>'     : '') +
              (a.appt_time     ? '<span>🕐 '+escHtml(a.appt_time)+'</span>'         : '') +
              (a.notes         ? '<span>💬 '+escHtml(a.notes)+'</span>'             : '') +
            '</div>' +
          '</div>' +
          '<div style="background:'+sc.bg+';color:'+sc.clr+';border:1px solid '+sc.border+';padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;white-space:nowrap">'+sc.label+'</div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0">' +
            (a.status === 'waiting' && arrived && isRegistered ?
              '<button class="btn-sm btn-teal" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'in-room\')" style="font-size:11px;padding:5px 10px">▶ Call</button>' :
             a.status === 'waiting' ?
              '<button class="btn-sm" disabled title="'+(isRegistered?'Patient not yet arrived':'Must register first')+'" style="font-size:11px;padding:5px 10px;border:1px solid var(--border);background:var(--surface2);border-radius:7px;cursor:not-allowed;color:var(--text-muted);opacity:0.5">▶ Call</button>' : '') +
            (a.status === 'in-room' ?
              '<button class="btn-sm btn-teal" data-id="'+a.id+'" data-name="'+escAttr(a.patient_name)+'" onclick="apptOpenRx(this.dataset.id,this.dataset.name)" style="font-size:11px;padding:5px 10px">📝 Rx</button>' : '') +
            (a.status !== 'done' && a.status !== 'cancelled' ?
              '<button class="btn-sm btn-outline-teal" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'done\')" style="font-size:11px;padding:5px 10px" title="Mark done">✅</button>' : '') +
            (a.status !== 'cancelled' ?
              '<button class="btn-sm" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'cancelled\')" title="Cancel" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);background:transparent;border-radius:7px;cursor:pointer;color:var(--text-muted)">✕</button>' : '') +
            '<button class="btn-sm btn-outline-red" data-id="'+a.id+'" onclick="deleteAppt(this.dataset.id)" style="font-size:11px;padding:5px 8px" title="Delete">🗑️</button>' +
          '</div>' +
        '</div>'
      );
    }).join('') + '</div>';
}

function promptPatientRegFromAppt(apptId, patientName) {
  if (confirm('Patient "' + patientName + '" is not registered.\n\nWould you like to register them now?\n\nAfter registration, they can be marked as arrived and enter the queue.')) {
    openRegisterModal();
    setTimeout(function() {
      var nameEl = document.getElementById('regName');
      if (nameEl) nameEl.value = patientName;
    }, 200);
  }
}


// ════════════════════════════════════════════════════════════
//  FIX 4: Real-time appointment badge refresh
// ════════════════════════════════════════════════════════════

function refreshAppointmentBadge() {
  var today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];
  var todayAppts = (appointments||[]).filter(function(a){ return (a.appt_date||'').slice(0,10) === today; });
  var waiting    = todayAppts.filter(function(a){ return a.status === 'waiting'; }).length;
  setEl('badgeAppointments', waiting || todayAppts.length);
}

// Patch updateApptStatus and deleteAppt to refresh badge in real time
var _origUpdateApptStatus = typeof updateApptStatus === 'function' ? updateApptStatus : null;
if (_origUpdateApptStatus) {
  updateApptStatus = async function(id, status) {
    var appt = (appointments||[]).find(function(a){ return a.id === id; });
    if (!appt) return;
    appt.status = status;
    await dbUpsertAppointment(appt);
    refreshAppointmentBadge();
    if (typeof loadAppointmentView === 'function') await loadAppointmentView();
  };
}

var _origDeleteAppt = typeof deleteAppt === 'function' ? deleteAppt : null;
if (_origDeleteAppt) {
  deleteAppt = async function(id) {
    if (!confirm('Delete this appointment?')) return;
    await dbDeleteAppointment(id);
    if (typeof appointments !== 'undefined') {
      appointments = appointments.filter(function(a){ return a.id !== id; });
    }
    refreshAppointmentBadge();
    if (typeof loadAppointmentView === 'function') await loadAppointmentView();
  };
}


// ════════════════════════════════════════════════════════════
//  FIX 5: Registration date — system date, not editable
// ════════════════════════════════════════════════════════════

var _origOpenRegisterModal = typeof openRegisterModal === 'function' ? openRegisterModal : null;

function openRegisterModalFixed() {
  if (typeof can !== 'undefined' && !can.registerPatient()) {
    showToast('You do not have permission to register patients.', 'error'); return;
  }
  ['regName','regAge','regPhone','regEmail','regAddress','regFee'].forEach(function(id){ setVal(id,''); });
  setVal('regGender',''); setVal('regBloodGroup','');
  var payRadio = document.querySelector('input[name="regPayment"][value="Cash"]');
  if (payRadio) payRadio.checked = true;

  // Set system date and make it read-only
  var today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];
  var regDateEl = document.getElementById('regDate');
  if (regDateEl) {
    regDateEl.value = today;
    regDateEl.readOnly = true;
    regDateEl.style.background = 'var(--surface2)';
    regDateEl.style.color = 'var(--text-muted)';
    regDateEl.style.cursor = 'not-allowed';
    regDateEl.title = 'Registration date is automatically set to today';
  }

  var pidEl = document.getElementById('regPid');
  if (pidEl) pidEl.textContent = typeof genPatientId === 'function' ? genPatientId() : 'PID-' + Date.now();

  var sel = document.getElementById('regDoctor');
  if (sel) {
    sel.innerHTML = '<option value="">— Select Doctor —</option>' +
      (doctorRegistry||[]).map(function(d) {
        return '<option value="'+escAttr(d.name)+'" data-reg="'+escAttr(d.regNo)+'"'+(d.unavailable?' disabled':'')+'>'+
          'Dr. '+escHtml(d.name)+(d.unavailable?' (Unavailable)':'')+' — '+escHtml(d.specialization||d.type)+'</option>';
      }).join('');
  }
  openModal('registerModal');
}

// Override openRegisterModal globally
if (typeof openRegisterModal !== 'undefined') {
  window.openRegisterModal = openRegisterModalFixed;
}

// Also patch the regDate field styling on DOMContentLoaded if modal is pre-rendered
document.addEventListener('DOMContentLoaded', function() {
  // Patch on each modal open
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.target.id === 'registerModal' && m.target.classList.contains('open')) {
        var regDateEl = document.getElementById('regDate');
        if (regDateEl && !regDateEl.readOnly) {
          var today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];
          regDateEl.value    = today;
          regDateEl.readOnly = true;
          regDateEl.style.background = 'var(--surface2)';
          regDateEl.style.color      = 'var(--text-muted)';
          regDateEl.style.cursor     = 'not-allowed';
          regDateEl.title            = 'Registration date is automatically set to today';
        }
      }
    });
  });
  var regModal = document.getElementById('registerModal');
  if (regModal) observer.observe(regModal, { attributes: true, attributeFilter: ['class'] });
});


// ════════════════════════════════════════════════════════════
//  FIX 8: Vitals — only for registered patients with valid Rx
// ════════════════════════════════════════════════════════════

var _origOpenServicesPanel = typeof openServicesPanel === 'function' ? openServicesPanel : null;

if (_origOpenServicesPanel) {
  openServicesPanel = async function(rxId) {
    var rx = (prescriptions||[]).find(function(p){ return p.id === rxId; });
    if (!rx) { showToast('Prescription not found.', 'error'); return; }

    // Check patient is registered
    var patient = (patientRegistry||[]).find(function(p){
      return (p.name||'').trim().toLowerCase() === (rx.patientName||'').trim().toLowerCase();
    });
    if (!patient) {
      showToast('⚠️ Patient "' + rx.patientName + '" is not registered. Please register the patient before recording vitals.', 'error');
      return;
    }

    // Check valid prescription (status must be active and not expired)
    var today = new Date(); today.setHours(0,0,0,0);
    var isExpired = rx.validUntil && new Date(rx.validUntil + 'T00:00:00') < today;
    if (rx.status !== 'active' || isExpired) {
      if (!confirm('⚠️ This prescription is ' + (isExpired ? 'expired' : rx.status) + '.\n\nDo you still want to record vitals for this patient?')) return;
    }

    await _origOpenServicesPanel(rxId);
  };
}


// ════════════════════════════════════════════════════════════
//  FIX 9 & 10: Password change with token + Staff profile update
// ════════════════════════════════════════════════════════════

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



// ════════════════════════════════════════════════════════════
//  INITIALIZATION: Wire everything together
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  // Override openRegisterModal
  window.openRegisterModal = openRegisterModalFixed;

  // Override openBookAppointment to use our fixed version
  // (the original is already replaced in function declaration above)

  // Refresh appointment badge every 30 seconds
  setInterval(refreshAppointmentBadge, 30000);


});
