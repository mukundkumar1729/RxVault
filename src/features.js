// ════════════════════════════════════════════════════════════
//  FEATURES.JS — Complete Feature Modules for Rx Vault
//  Modules: Appointments, Billing, Vitals, Timeline,
//           Lab Analyser, Diet Planner, Patient Portal, Medical Image AI
// ════════════════════════════════════════════════════════════

// ─── Shared helpers ──────────────────────────────────────
function hideAllViews() {
  var ids = ['statsRow','controlsBar','prescriptionsList','aiSearchPanel',
             'doctorsView','patientsView','pharmacyView',
             'appointmentView','billingView','vitalsView',
             'labView','dietView','portalView','medImageView'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function setNavActive(navId) {
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nb = document.getElementById(navId);
  if (nb) nb.classList.add('active');
}

// ════════════════════════════════════════════════════════════
//  1. APPOINTMENTS / QUEUE MANAGEMENT
// ════════════════════════════════════════════════════════════
var appointments = [];

async function showAppointmentView() {
  currentView = 'appointments';
  hideAllViews();
  var av = document.getElementById('appointmentView');
  if (av) av.style.display = '';
  setNavActive('navAppointments');
  document.getElementById('pageTitle').textContent    = '📅 Appointments & Queue';
  document.getElementById('pageSubtitle').textContent = 'Today\'s patient queue and appointment management';
  var dateEl = document.getElementById('apptDateFilter');
  // Removed: if (dateEl && dateEl.tagName === 'INPUT' && !dateEl.value) dateEl.value = todayISO();
  await loadAppointmentView();
}

// ─── Queue filter state ───────────────────────────────────
var apptFilterState = { patient:'', doctor:'', phone:'', time:'' };

function applyApptFilters() {
  apptFilterState.patient = (document.getElementById('apptFPatient')?.value || '').toLowerCase().trim();
  apptFilterState.doctor  = (document.getElementById('apptFDoctor')?.value  || '').toLowerCase().trim();
  apptFilterState.phone   = (document.getElementById('apptFPhone')?.value   || '').toLowerCase().trim();
  apptFilterState.time    = (document.getElementById('apptFTime')?.value    || '').toLowerCase().trim();
  renderApptList();
}

function clearApptFilters() {
  ['apptFPatient','apptFDoctor','apptFPhone','apptFTime'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  apptFilterState = { patient:'', doctor:'', phone:'', time:'' };
  renderApptList();
}

async function loadAppointmentView() {
  var dateEl = document.getElementById('apptDateFilter');
  var date   = dateEl ? dateEl.value : '';
  var list   = document.getElementById('apptList');
  var stats  = document.getElementById('apptStats');
  if (!list) return;

  list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">⏳</div>Loading queue…</div>';

  // Load ALL appointments for clinic, filter by date client-side
  var all = await dbGetAppointments(activeClinicId, null);

  // Filter by selected date (empty = show all)
  appointments = date
    ? all.filter(function(a) { return (a.appt_date || '').slice(0, 10) === date; })
    : all;

  // Build date options from what's actually in DB
  var allDates = [...new Set(all.map(function(a){ return (a.appt_date||'').slice(0,10); }).filter(Boolean))].sort();
  if (dateEl && allDates.length) {
    // Rebuild date selector as a <select> if not already
    var dateWrap = dateEl.parentElement;
    if (dateEl.tagName === 'INPUT') {
      var sel = document.createElement('select');
      sel.id = 'apptDateFilter';
      sel.onchange = loadAppointmentView;
      sel.style.cssText = 'padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface);cursor:pointer';
      sel.innerHTML = '<option value="">📅 All Dates</option>' +
        allDates.map(function(d) {
          var label = d === todayISO() ? '📌 Today ('+formatDate(d)+')' :
                      d === addDays(todayISO(),1) ? '🔜 Tomorrow ('+formatDate(d)+')' :
                      formatDate(d);
          return '<option value="'+d+'"'+(d===date?' selected':'')+'>'+label+'</option>';
        }).join('');
      dateWrap.replaceChild(sel, dateEl);
    }
  }

  // ── Stats ──
  var total   = appointments.length;
  var waiting = appointments.filter(function(a){ return a.status === 'waiting'; }).length;
  var inRoom  = appointments.filter(function(a){ return a.status === 'in-room'; }).length;
  var done    = appointments.filter(function(a){ return a.status === 'done'; }).length;
  var arrived = appointments.filter(function(a){ return !!a.arrived; }).length;

  if (stats) {
    stats.innerHTML = [
      { label:'Total',   val:total,   icon:'📋', bg:'var(--surface2)',         clr:'var(--text-primary)' },
      { label:'Arrived', val:arrived, icon:'🟢', bg:'#e8f5e9',                 clr:'var(--green)' },
      { label:'Waiting', val:waiting, icon:'⏳', bg:'var(--allopathy-bg)',      clr:'var(--allopathy)' },
      { label:'In Room', val:inRoom,  icon:'🔵', bg:'var(--teal-pale)',         clr:'var(--teal)' },
      { label:'Done',    val:done,    icon:'✅', bg:'var(--green-bg,#e8f5e9)', clr:'var(--green)' },
    ].map(function(s) {
      return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 18px;display:flex;align-items:center;gap:10px;flex:1;min-width:100px">' +
             '<div style="font-size:22px">'+s.icon+'</div>' +
             '<div><div style="font-size:24px;font-weight:700;color:'+s.clr+';font-family:\'DM Serif Display\',serif">'+s.val+'</div>' +
             '<div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em">'+s.label+'</div></div>' +
             '</div>';
    }).join('');
  }

  // ── Filter bar ──
  var filterBar = document.getElementById('apptFilterBar');
  if (filterBar) {
    filterBar.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 0 8px">' +
        '<div style="position:relative;flex:1;min-width:140px">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">👤</span>' +
          '<input id="apptFPatient" type="text" placeholder="Patient name" oninput="applyApptFilters()" ' +
            'style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:20px;font-size:12.5px;font-family:DM Sans,sans-serif;background:var(--surface);box-sizing:border-box">' +
        '</div>' +
        '<div style="position:relative;flex:1;min-width:140px">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">🩺</span>' +
          '<input id="apptFDoctor" type="text" placeholder="Doctor name" oninput="applyApptFilters()" ' +
            'style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:20px;font-size:12.5px;font-family:DM Sans,sans-serif;background:var(--surface);box-sizing:border-box">' +
        '</div>' +
        '<div style="position:relative;flex:1;min-width:130px">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">📱</span>' +
          '<input id="apptFPhone" type="text" placeholder="Mobile number" oninput="applyApptFilters()" ' +
            'style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:20px;font-size:12.5px;font-family:DM Sans,sans-serif;background:var(--surface);box-sizing:border-box">' +
        '</div>' +
        '<div style="position:relative;flex:1;min-width:120px">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">🕐</span>' +
          '<input id="apptFTime" type="text" placeholder="Time slot" oninput="applyApptFilters()" ' +
            'style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:20px;font-size:12.5px;font-family:DM Sans,sans-serif;background:var(--surface);box-sizing:border-box">' +
        '</div>' +
        '<button onclick="clearApptFilters()" style="padding:7px 14px;border:1px solid var(--border);border-radius:20px;background:var(--surface);font-size:12px;cursor:pointer;color:var(--text-muted);font-family:DM Sans,sans-serif;white-space:nowrap">✕ Clear</button>' +
      '</div>';
  }

  if (!appointments.length) {
    list.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📅</div>' +
        '<div class="empty-title">No appointments for ' + (date === todayISO() ? 'today' : formatDate(date)) + '</div>' +
        '<div class="empty-sub">Click "+ Book Appointment" to schedule a patient visit.</div>' +
      '</div>';
    return;
  }

  renderApptList();
  setEl('badgeAppointments', waiting || total);
}

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

function renderApptList() {
  var list = document.getElementById('apptList');
  if (!list) return;

  // Apply filters
  var f = apptFilterState;
  var filtered = appointments.filter(function(a) {
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
    var sc      = statusConfig[a.status] || statusConfig['waiting'];
    var vtc     = visitTypeConfig[a.visit_type] || visitTypeConfig['consultation'];
    var arrived = !!a.arrived;

    // Arrival toggle pill
    var arrivalPill = arrived
      ? '<span style="background:#e8f5e9;color:var(--green);border:1px solid rgba(22,163,74,0.3);font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;cursor:pointer;white-space:nowrap" ' +
          'data-id="'+a.id+'" onclick="toggleArrival(this.dataset.id)">🟢 In Clinic</span>'
      : '<span style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border);font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;cursor:pointer;white-space:nowrap" ' +
          'data-id="'+a.id+'" onclick="toggleArrival(this.dataset.id)" title="Mark patient as arrived">⚪ Not Arrived</span>';

    return (
      '<div style="background:var(--surface);border:1px solid '+(arrived?'rgba(10,124,110,0.25)':'var(--border)')+';border-radius:var(--radius-lg);'+
        'box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:14px;padding:14px 18px;transition:box-shadow 0.2s;'+
        (arrived?'':'opacity:0.82;')+'"' +
        ' onmouseenter="this.style.boxShadow=\'var(--shadow)\'" onmouseleave="this.style.boxShadow=\'var(--shadow-sm)\'">' +

        // Token
        '<div style="background:linear-gradient(135deg,var(--teal-light),var(--teal));color:#fff;width:46px;height:46px;border-radius:50%;'+
          'display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;flex-shrink:0;'+
          'font-family:\'DM Serif Display\',serif;box-shadow:0 3px 10px rgba(10,124,110,0.3)">' +
          a.token_no +
        '</div>' +

        // Info
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<span style="font-size:15px;font-weight:700;color:var(--text-primary)">'+escHtml(a.patient_name)+'</span>' +
            '<span style="background:'+vtc.clr+'18;color:'+vtc.clr+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+vtc.icon+' '+vtc.label+'</span>' +
            arrivalPill +
          '</div>' +
          '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;display:flex;flex-wrap:wrap;gap:12px">' +
            (a.doctor_name   ? '<span>🩺 Dr. '+escHtml(a.doctor_name)+'</span>'   : '') +
            (a.patient_phone ? '<span>📱 '+escHtml(a.patient_phone)+'</span>'     : '') +
            (a.appt_time     ? '<span>🕐 '+escHtml(a.appt_time)+'</span>'         : '') +
            (a.notes         ? '<span>💬 '+escHtml(a.notes)+'</span>'             : '') +
          '</div>' +
        '</div>' +

        // Status badge
        '<div style="background:'+sc.bg+';color:'+sc.clr+';border:1px solid '+sc.border+';padding:5px 12px;border-radius:20px;'+
          'font-size:11px;font-weight:700;flex-shrink:0;white-space:nowrap">'+sc.label+'</div>' +

        // Actions — Call and Rx only enabled if patient has arrived
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          (a.status === 'waiting' && arrived ?
            '<button class="btn-sm btn-teal" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'in-room\')" style="font-size:11px;padding:5px 10px">▶ Call</button>' :
           a.status === 'waiting' && !arrived ?
            '<button class="btn-sm" disabled title="Patient not yet arrived" style="font-size:11px;padding:5px 10px;border:1px solid var(--border);background:var(--surface2);border-radius:7px;cursor:not-allowed;color:var(--text-muted);opacity:0.5">▶ Call</button>' : '') +
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

// ─── Toggle patient arrival in clinic ────────────────────
async function toggleArrival(id) {
  var appt = appointments.find(function(a){ return a.id === id; });
  if (!appt) return;
  appt.arrived = !appt.arrived;
  await dbUpsertAppointment(appt);
  renderApptList();
  // Update arrived stat
  var arrived = appointments.filter(function(a){ return !!a.arrived; }).length;
  // Quick stat refresh without full reload
  var statEls = document.querySelectorAll('#apptStats > div');
  if (statEls[1]) statEls[1].querySelector('[style*="Serif"]').textContent = arrived;
}

async function updateApptStatus(id, status) {
  var appt = appointments.find(function(a){ return a.id === id; });
  if (!appt) return;
  appt.status = status;
  await dbUpsertAppointment(appt);
  await loadAppointmentView();
}

function apptOpenRx(apptId, patientName) {
  var patient = patientRegistry.find(function(p){
    return (p.name||'').trim().toLowerCase() === (patientName||'').trim().toLowerCase();
  });
  if (patient) { openPrescriptionForPatient(patient); }
  else { openAddModal(); setTimeout(function(){ setVal('fPatientName', patientName); }, 100); }
}

async function deleteAppt(id) {
  if (!confirm('Delete this appointment?')) return;
  await dbDeleteAppointment(id);
  await loadAppointmentView();
}

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
        '<button class="btn-sm btn-teal" onclick="saveAppointment()">📅 Confirm Booking</button>' +
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
function closeOverlay(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

async function saveAppointment() {
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
    if (phone && phone.replace(/[\s\-\+]/g, '').length < 10) { 
        if (errEl) errEl.textContent = 'Please enter a valid phone number (min 10 digits).'; 
        return; 
    }
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
//  2. BILLING & INVOICES
// ════════════════════════════════════════════════════════════
var invoices = [];

async function showBillingView() {
  currentView = 'billing';
  hideAllViews();
  var bv = document.getElementById('billingView');
  if (bv) bv.style.display = '';
  setNavActive('navBilling');
  document.getElementById('pageTitle').textContent    = '💰 Billing & Invoices';
  document.getElementById('pageSubtitle').textContent = 'Patient invoices and payment tracking';
  await loadBillingView();
}

async function loadBillingView() {
  invoices = await dbGetInvoices(activeClinicId);
  renderBillingStats(invoices);
  renderBillingList(invoices);
}

function filterBilling() {
  var q      = (document.getElementById('billingSearch')?.value || '').toLowerCase().trim();
  var status = document.getElementById('billingStatusFilter')?.value || 'all';
  var filtered = invoices.filter(function(inv) {
    if (status !== 'all' && inv.status !== status) return false;
    if (q) {
      var hay = [inv.patient_name, inv.invoice_no, inv.doctor_name].join(' ').toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
  renderBillingList(filtered);
}

function renderBillingStats(list) {
  var statsEl = document.getElementById('billingStats');
  if (!statsEl) return;
  var total   = list.reduce(function(s,i){ return s + (parseFloat(i.total_amount)||0); }, 0);
  var paid    = list.filter(function(i){ return i.status==='paid'; }).reduce(function(s,i){ return s+(parseFloat(i.total_amount)||0); }, 0);
  var unpaid  = list.filter(function(i){ return i.status!=='paid' && i.status!=='cancelled'; }).reduce(function(s,i){ return s+(parseFloat(i.total_amount)||0); }, 0);
  statsEl.innerHTML = [
    { label:'Total Invoices', val:list.length, icon:'📄', bg:'var(--surface2)', clr:'var(--text-primary)' },
    { label:'Total Revenue',  val:'₹'+total.toLocaleString('en-IN'), icon:'💰', bg:'var(--teal-pale)', clr:'var(--teal)' },
    { label:'Collected',      val:'₹'+paid.toLocaleString('en-IN'),  icon:'✅', bg:'#e8f5e9',          clr:'var(--green)' },
    { label:'Pending',        val:'₹'+unpaid.toLocaleString('en-IN'),icon:'⏳', bg:'var(--red-bg)',    clr:'var(--red)' },
  ].map(function(s) {
    return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 20px;display:flex;align-items:center;gap:12px;flex:1;min-width:120px">' +
           '<div style="font-size:24px">'+s.icon+'</div>' +
           '<div><div style="font-size:20px;font-weight:700;color:'+s.clr+'">'+s.val+'</div>' +
           '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em">'+s.label+'</div></div>' +
           '</div>';
  }).join('');
}

function renderBillingList(list) {
  var container = document.getElementById('billingList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">No invoices yet</div><div class="empty-sub">Click "+ New Invoice" to create one.</div></div>';
    return;
  }
  container.innerHTML = list.map(function(inv) {
    var paid = inv.status === 'paid';
    var items = [];
    try { items = JSON.parse(inv.items_json || '[]'); } catch(e) {}
    var disc = parseFloat(inv.discount_amount) || 0;
    var tax  = parseFloat(inv.tax_percent) || 0;
    var itemsHtml = items.map(function(it) {
      return '<tr><td style="padding:6px 10px">'+escHtml(it.desc)+'</td>' +
             '<td style="padding:6px 10px;text-align:right;font-weight:600">₹'+Number(it.amount||0).toLocaleString('en-IN')+'</td></tr>';
    }).join('');
    if (disc) itemsHtml += '<tr><td style="padding:6px 10px;color:var(--green)">Discount</td><td style="padding:6px 10px;text-align:right;color:var(--green)">−₹'+disc.toLocaleString('en-IN')+'</td></tr>';
    if (tax)  itemsHtml += '<tr><td style="padding:6px 10px;color:var(--text-muted)">Tax ('+tax+'%)</td><td style="padding:6px 10px;text-align:right;color:var(--text-muted)">+calculated</td></tr>';
    return (
      '<div class="rx-card" style="margin-bottom:12px">' +
        '<div style="padding:16px 20px;display:flex;align-items:flex-start;gap:14px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              '<div style="font-size:15px;font-weight:700">'+escHtml(inv.patient_name)+'</div>' +
              '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--bg);padding:2px 8px;border-radius:6px;border:1px solid var(--border);color:var(--text-secondary)">'+escHtml(inv.invoice_no)+'</div>' +
              '<div style="background:'+(paid?'#e8f5e9':'var(--ayurveda-bg)')+';color:'+(paid?'var(--green)':'var(--ayurveda)')+';font-size:10px;font-weight:700;padding:2px 10px;border-radius:10px">'+(paid?'✅ PAID':'⏳ UNPAID')+'</div>' +
            '</div>' +
            '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:5px;display:flex;gap:14px;flex-wrap:wrap">' +
              (inv.doctor_name ? '<span>🩺 Dr. '+escHtml(inv.doctor_name)+'</span>' : '') +
              '<span>📅 '+formatDate(inv.invoice_date)+'</span>' +
              (inv.payment_method ? '<span>💳 '+escHtml(inv.payment_method)+'</span>' : '') +
              (inv.paid_at ? '<span>✅ Paid: '+formatDate(inv.paid_at.split('T')[0])+'</span>' : '') +
            '</div>' +
          '</div>' +
          '<div style="font-size:22px;font-weight:700;color:var(--teal);font-family:\'DM Serif Display\',serif;flex-shrink:0">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</div>' +
        '</div>' +
        (itemsHtml ? '<div style="border-top:1px solid var(--border);padding:8px 20px"><table style="width:100%;font-size:13px;border-collapse:collapse"><tbody>'+itemsHtml+'</tbody>'+
          '<tfoot><tr style="border-top:1px solid var(--border2)"><td style="padding:8px 10px;font-weight:700">Total</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--teal)">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</td></tr></tfoot></table></div>' : '') +
        '<div class="rx-footer-actions">' +
          '<button class="btn-sm btn-outline-teal" data-id="'+inv.id+'" onclick="printInvoice(this.dataset.id)">🖨️ Print</button>' +
          (!paid ? '<button class="btn-sm btn-teal" data-id="'+inv.id+'" onclick="markInvoicePaid(this.dataset.id)">✅ Mark Paid</button>' : '') +
          '<button class="btn-sm btn-outline-red" data-id="'+inv.id+'" onclick="deleteInvoice(this.dataset.id)">🗑️</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openNewInvoice() {
  var overlay = document.getElementById('newInvoiceOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='newInvoiceOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  var docOpts = doctorRegistry.map(function(d){ return '<option value="'+escAttr(d.name)+'">Dr. '+escHtml(d.name)+'</option>'; }).join('');
  var patOpts = patientRegistry.map(function(p){ return '<option value="'+escAttr(p.name)+'">'; }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:600px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">💰 New Invoice</div><div class="modal-subtitle">Create patient invoice with line items</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'newInvoiceOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Patient Name <span>*</span></label>' +
            '<input type="text" id="invPatientInp" list="invPatList" placeholder="Patient name"><datalist id="invPatList">'+patOpts+'</datalist></div>' +
          '<div class="field"><label>Doctor</label><select id="invDocInp"><option value="">— Select —</option>'+docOpts+'</select></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Invoice Date <span>*</span></label><input type="date" id="invDateInp" value="'+todayISO()+'"></div>' +
          '<div class="field"><label>Payment Method</label><select id="invPayInp"><option>Cash</option><option>Card</option><option>UPI</option><option>Online</option><option>Insurance</option></select></div>' +
        '</div>' +
        '<div style="margin-bottom:12px">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px">📋 Line Items</div>' +
          '<div style="display:grid;grid-template-columns:1fr 110px 36px;gap:6px;margin-bottom:6px">' +
            '<span style="font-size:11px;font-weight:600;color:var(--text-muted);padding:0 4px">Description</span>' +
            '<span style="font-size:11px;font-weight:600;color:var(--text-muted);padding:0 4px">Amount (₹)</span><span></span>' +
          '</div>' +
          '<div id="invItemsWrap"></div>' +
          '<button class="btn-add-medicine" onclick="addInvoiceItem()" style="margin-top:4px">＋ Add Item</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
          '<div class="field"><label>Discount (₹)</label><input type="number" id="invDiscInp" value="0" min="0" oninput="updateInvTotal()"></div>' +
          '<div class="field"><label>Tax (%)</label><input type="number" id="invTaxInp" value="0" min="0" max="100" oninput="updateInvTotal()"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:14px 0;border-top:2px solid var(--border)">' +
          '<span style="font-size:14px;color:var(--text-muted);font-weight:600">TOTAL</span>' +
          '<span id="invTotalDisplay" style="font-size:24px;font-weight:700;color:var(--teal);font-family:\'DM Serif Display\',serif">₹0</span>' +
        '</div>' +
        '<div id="invErrMsg" style="color:var(--red);font-size:12.5px;min-height:18px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'newInvoiceOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-outline-teal" onclick="saveInvoice(false)">💾 Save</button>' +
        '<button class="btn-sm btn-teal" onclick="saveInvoice(true)">🖨️ Save & Print</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Add a default first line item
  addInvoiceItem('Consultation Fee', 500);
}

function addInvoiceItem(desc, amt) {
  var wrap = document.getElementById('invItemsWrap');
  if (!wrap) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 110px 36px;gap:6px;margin-bottom:6px;align-items:center';
  row.innerHTML =
    '<input type="text" placeholder="e.g. Consultation Fee" class="inv-desc" value="'+(desc||'')+'" oninput="updateInvTotal()" style="padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:DM Sans,sans-serif">' +
    '<input type="number" placeholder="0" class="inv-amt" value="'+(amt||'')+'" min="0" oninput="updateInvTotal()" style="padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:DM Sans,sans-serif;text-align:right">' +
    '<button onclick="this.parentElement.remove();updateInvTotal()" style="width:32px;height:32px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">✕</button>';
  wrap.appendChild(row);
  updateInvTotal();
}

function updateInvTotal() {
  var subtotal = Array.from(document.querySelectorAll('.inv-amt')).reduce(function(s,el){ return s+(parseFloat(el.value)||0); }, 0);
  var disc = parseFloat(document.getElementById('invDiscInp')?.value) || 0;
  var tax  = parseFloat(document.getElementById('invTaxInp')?.value)  || 0;
  var total = (subtotal - disc) * (1 + tax/100);
  total = Math.max(0, total);
  var el = document.getElementById('invTotalDisplay');
  if (el) el.textContent = '₹' + total.toLocaleString('en-IN', {maximumFractionDigits:2});
}

async function saveInvoice(andPrint) {
  var patient = (document.getElementById('invPatientInp')?.value || '').trim();
  var date    = document.getElementById('invDateInp')?.value || todayISO();
  var doctor  = document.getElementById('invDocInp')?.value  || '';
  var method  = document.getElementById('invPayInp')?.value  || 'Cash';
  var disc    = parseFloat(document.getElementById('invDiscInp')?.value) || 0;
  var tax     = parseFloat(document.getElementById('invTaxInp')?.value)  || 0;
  var errEl   = document.getElementById('invErrMsg');
  if (!patient) { if(errEl) errEl.textContent='Patient name is required.'; return; }

  var items = [];
  document.querySelectorAll('#invItemsWrap > div').forEach(function(row) {
    var desc = row.querySelector('.inv-desc')?.value.trim() || '';
    var amt  = parseFloat(row.querySelector('.inv-amt')?.value || '0') || 0;
    if (desc || amt) items.push({ desc: desc, amount: amt });
  });
  if (!items.length) { if(errEl) errEl.textContent='Add at least one item.'; return; }

  var subtotal = items.reduce(function(s,i){ return s+(i.amount||0); }, 0);
  var total    = Math.max(0, (subtotal - disc) * (1 + tax/100));
  var invNo    = await dbGetNextInvoiceNo(activeClinicId);

  var inv = {
    id: 'inv_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    clinic_id: activeClinicId, invoice_no: invNo, patient_name: patient,
    doctor_name: doctor, invoice_date: date, items_json: JSON.stringify(items),
    total_amount: Math.round(total*100)/100, discount_amount: disc, tax_percent: tax,
    payment_method: method, status: 'unpaid', created_at: new Date().toISOString()
  };

  var ok = await dbUpsertInvoice(inv);
  if (!ok) { if(errEl) errEl.textContent='Failed to save. Try again.'; return; }

  closeOverlay('newInvoiceOverlay');
  showToast('✅ Invoice '+invNo+' created · ₹'+total.toLocaleString('en-IN'), 'success');
  if (andPrint) { invoices.unshift(inv); printInvoice(inv.id); }
  await loadBillingView();
}

async function markInvoicePaid(id) {
  var inv = invoices.find(function(i){ return i.id===id; });
  if (!inv) return;
  inv.status = 'paid'; inv.paid_at = new Date().toISOString();
  await dbUpsertInvoice(inv);
  showToast('✅ Invoice marked as paid', 'success');
  await loadBillingView();
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  await db.from('invoices').delete().eq('id', id);
  showToast('Invoice deleted.', 'info');
  await loadBillingView();
}

function printInvoice(id) {
  var inv = invoices.find(function(i){ return i.id===id; });
  if (!inv) return;
  var clinic = getActiveClinic();
  var items  = []; try { items = JSON.parse(inv.items_json||'[]'); } catch(e){}
  var disc   = parseFloat(inv.discount_amount)||0;
  var tax    = parseFloat(inv.tax_percent)||0;
  var subtotal = items.reduce(function(s,i){ return s+(i.amount||0); }, 0);
  var itemsHtml = items.map(function(it) {
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">'+escHtml(it.desc)+'</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹'+Number(it.amount||0).toLocaleString('en-IN')+'</td></tr>';
  }).join('');
  if(disc) itemsHtml += '<tr><td style="padding:8px;color:#16a34a">Discount</td><td style="padding:8px;text-align:right;color:#16a34a">−₹'+disc.toLocaleString('en-IN')+'</td></tr>';
  if(tax)  itemsHtml += '<tr><td style="padding:8px;color:#666">Tax ('+tax+'%)</td><td style="padding:8px;text-align:right;color:#666">₹'+((subtotal-disc)*tax/100).toFixed(2)+'</td></tr>';
  var html = '<!DOCTYPE html><html><head><title>Invoice '+escHtml(inv.invoice_no)+'</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">' +
    '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:DM Sans,sans-serif;padding:32px;color:#1a1a2e;font-size:13px}' +
    '.header{display:flex;justify-content:space-between;padding-bottom:20px;margin-bottom:24px;border-bottom:3px solid #0a7c6e}' +
    '.brand{font-family:"DM Serif Display",serif;font-size:26px;color:#0a7c6e}.clinic{font-size:12px;color:#666;margin-top:3px}' +
    'table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px;background:#f0f4f8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em}' +
    '.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.05em}' +
    '.total-row{font-size:18px;font-weight:700;color:#0a7c6e;border-top:2px solid #0a7c6e}' +
    '.footer{margin-top:48px;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:16px}' +
    '.sig-line{width:160px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;text-align:center}' +
    '@media print{body{padding:20px}}</style></head>' +
    '<body onload="window.print()">' +
    '<div class="header"><div>' +
      '<div class="brand">💊 Rx Vault</div>' +
      '<div class="clinic">'+(clinic?escHtml(clinic.logo+' '+clinic.name):'')+(clinic&&clinic.address?'<br>'+escHtml(clinic.address):'')+'</div>' +
    '</div><div style="text-align:right">' +
      '<div style="font-family:DM Serif Display,serif;font-size:22px;font-weight:700;color:#1a1a2e">INVOICE</div>' +
      '<div style="font-family:monospace;font-size:15px;color:#0a7c6e;margin-top:4px">'+escHtml(inv.invoice_no)+'</div>' +
      '<div style="font-size:12px;color:#666;margin-top:4px">Date: '+formatDate(inv.invoice_date)+'</div>' +
      '<div class="badge" style="margin-top:8px;background:'+(inv.status==='paid'?'#e8f5e9':'#fff7ed')+';color:'+(inv.status==='paid'?'#16a34a':'#d97706')+'">'+( inv.status==='paid'?'PAID':'UNPAID')+'</div>' +
    '</div></div>' +
    '<div style="margin-bottom:20px;padding:14px;background:#f7fafc;border-radius:8px">' +
      '<div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#888;margin-bottom:6px">Billed To</div>' +
      '<div style="font-size:15px;font-weight:700">'+escHtml(inv.patient_name)+'</div>' +
      (inv.doctor_name?'<div style="color:#555;margin-top:2px">Attending: Dr. '+escHtml(inv.doctor_name)+'</div>':'') +
      (inv.payment_method?'<div style="color:#555;margin-top:2px">Payment: '+escHtml(inv.payment_method)+'</div>':'') +
    '</div>' +
    '<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>' +
    '<tbody>'+itemsHtml+'</tbody>' +
    '<tfoot><tr class="total-row"><td style="padding:10px 8px;font-weight:700">Total</td><td style="padding:10px 8px;text-align:right;font-weight:700">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</td></tr></tfoot></table>' +
    '<div class="footer"><div style="font-size:11px;color:#888">Generated by Rx Vault · '+new Date().toLocaleDateString('en-IN')+'</div><div class="sig-line">Authorised Signature</div></div>' +
    '</body></html>';
  var w = window.open('','_blank','width=800,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

// ════════════════════════════════════════════════════════════
//  3. VITAL SIGNS TRACKER
// ════════════════════════════════════════════════════════════
var vitalsData = [];
var vitalsPatientName = '';

async function openVitalsModal(patientName) {
  vitalsPatientName = patientName;
  var overlay = document.getElementById('vitalsModalOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='vitalsModalOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }

  vitalsData = await dbGetVitals(activeClinicId, patientName);
  renderVitalsModal(overlay);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderVitalsModal(overlay) {
  var rows = vitalsData.slice(0, 15).map(function(v) {
    var bp = v.bp_systolic ? v.bp_systolic+'/'+v.bp_diastolic : '—';
    var bpFlag = (v.bp_systolic>140||v.bp_diastolic>90)?'🔴':(v.bp_systolic<90?'🔵':'');
    var sugar  = v.sugar_fasting||v.blood_sugar||'—';
    var sugarFlag = (parseFloat(sugar)>200)?'🔴':(parseFloat(sugar)<70?'🔵':'');
    var spo2Flag  = v.spo2 && v.spo2<95 ? '🔴':'';
    var tempFlag  = v.temperature && v.temperature>100.4 ? '🔴':'';
    var bmi = '';
    if (v.weight && v.height) {
      var b = parseFloat(v.weight) / Math.pow(parseFloat(v.height)/100, 2);
      bmi = b.toFixed(1) + (b<18.5?' 🔵':b>30?' 🔴':'');
    }
    return '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:8px 10px;font-size:11px;color:var(--text-muted)">'+formatDate(v.recorded_at)+'</td>' +
      '<td style="padding:8px 10px;font-weight:600">'+bpFlag+' '+bp+'</td>' +
      '<td style="padding:8px 10px">'+escHtml(v.pulse?v.pulse+' bpm':'—')+'</td>' +
      '<td style="padding:8px 10px">'+(v.temperature?v.temperature+'°F '+tempFlag:'—')+'</td>' +
      '<td style="padding:8px 10px">'+sugarFlag+' '+(sugar!=='—'?sugar+' mg/dL':'—')+'</td>' +
      '<td style="padding:8px 10px">'+(v.spo2?v.spo2+'% '+spo2Flag:'—')+'</td>' +
      '<td style="padding:8px 10px">'+(v.weight?v.weight+' kg':'—')+'</td>' +
      '<td style="padding:8px 10px">'+bmi+'</td>' +
    '</tr>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:820px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📊 Vitals — '+escHtml(vitalsPatientName)+'</div>' +
          '<div class="modal-subtitle">Record and track health vitals · 🔴=Abnormal high 🔵=Abnormal low</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'vitalsModalOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        // Entry form
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;margin-bottom:20px">' +
          '<div class="form-section-title" style="margin-bottom:14px">➕ Record New Vitals</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">' +
            vitalInputField('vBpSys','BP Systolic','number','120','mmHg') +
            vitalInputField('vBpDia','BP Diastolic','number','80','mmHg') +
            vitalInputField('vPulse','Pulse Rate','number','72','bpm') +
            vitalInputField('vTemp','Temperature','number','98.6','°F') +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">' +
            vitalInputField('vSugarF','Sugar — Fasting','number','90','mg/dL') +
            vitalInputField('vSugarPP','Sugar — Post-Meal','number','130','mg/dL') +
            vitalInputField('vSugarR','Sugar — Random','number','110','mg/dL') +
            vitalInputField('vSpo2','SpO2','number','98','%') +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">' +
            vitalInputField('vWeight','Weight','number','70','kg') +
            vitalInputField('vHeight','Height','number','165','cm') +
            '<div id="vBmiCalc" style="grid-column:span 2;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:8px"><span>📐 BMI will calculate automatically</span></div>' +
          '</div>' +
          '<div id="vitalsAlertBox" style="margin-bottom:10px"></div>' +
          '<button class="btn-sm btn-teal" onclick="saveVitals()" style="width:100%;justify-content:center;padding:10px;font-size:13px">💾 Save Vital Signs</button>' +
        '</div>' +
        // History table
        '<div class="form-section-title" style="margin-bottom:10px">📈 Vitals History</div>' +
        (rows ?
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">' +
            '<thead><tr style="background:var(--surface2)">' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Date</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">BP</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Pulse</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Temp</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Sugar</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">SpO2</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Weight</th>' +
              '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">BMI</th>' +
            '</tr></thead><tbody>'+rows+'</tbody></table></div>'
          : '<div style="padding:24px;text-align:center;color:var(--text-muted)">No vitals recorded yet for this patient.</div>') +
      '</div>' +
    '</div>';

  // BMI auto-calc
  setTimeout(function() {
    ['vWeight','vHeight'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', calcBMI);
    });
  }, 100);
}

function vitalInputField(id, label, type, placeholder, unit) {
  return '<div><label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">'+label+' <span style="font-weight:400;color:var(--text-muted)">('+unit+')</span></label>' +
    '<input type="'+type+'" id="'+id+'" placeholder="'+placeholder+'" step="any" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;box-sizing:border-box;background:var(--surface)"></div>';
}

function calcBMI() {
  var w = parseFloat(document.getElementById('vWeight')?.value);
  var h = parseFloat(document.getElementById('vHeight')?.value);
  var el = document.getElementById('vBmiCalc');
  if (!el) return;
  if (w && h && h > 0) {
    var bmi = w / Math.pow(h/100, 2);
    var cat = bmi < 18.5 ? ['Underweight','var(--allopathy)'] : bmi < 25 ? ['Normal','var(--green)'] : bmi < 30 ? ['Overweight','var(--ayurveda)'] : ['Obese','var(--red)'];
    el.innerHTML = '<span style="font-size:15px">📐</span><span>BMI: <strong style="color:'+cat[1]+';font-size:16px">'+bmi.toFixed(1)+'</strong> <span style="color:'+cat[1]+';font-size:12px;font-weight:600">'+cat[0]+'</span></span>';
  } else {
    el.innerHTML = '<span>📐 BMI will calculate automatically</span>';
  }
}

async function saveVitals() {
  var record = {
    id: 'vit_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    clinic_id:    activeClinicId,
    patient_name: vitalsPatientName,
    bp_systolic:  parseFloat(document.getElementById('vBpSys')?.value)  || null,
    bp_diastolic: parseFloat(document.getElementById('vBpDia')?.value)  || null,
    pulse:        parseFloat(document.getElementById('vPulse')?.value)  || null,
    temperature:  parseFloat(document.getElementById('vTemp')?.value)   || null,
    sugar_fasting: parseFloat(document.getElementById('vSugarF')?.value)  || null,
    sugar_pp:     parseFloat(document.getElementById('vSugarPP')?.value) || null,
    sugar_random: parseFloat(document.getElementById('vSugarR')?.value)  || null,
    spo2:         parseFloat(document.getElementById('vSpo2')?.value)   || null,
    weight:       parseFloat(document.getElementById('vWeight')?.value) || null,
    height:       parseFloat(document.getElementById('vHeight')?.value) || null,
    recorded_at:  new Date().toISOString()
  };

  var hasValue = Object.keys(record).some(function(k){ return !['id','clinic_id','patient_name','recorded_at'].includes(k) && record[k]!==null; });
  if (!hasValue) { showToast('Enter at least one vital sign value.', 'error'); return; }

  // Flag abnormals
  var alerts = [];
  if (record.bp_systolic > 140 || record.bp_diastolic > 90) alerts.push('⚠️ High Blood Pressure ('+record.bp_systolic+'/'+record.bp_diastolic+' mmHg)');
  if (record.bp_systolic < 90) alerts.push('⚠️ Low Blood Pressure');
  if (record.sugar_fasting > 126) alerts.push('⚠️ High Fasting Blood Sugar');
  if (record.sugar_fasting < 70 || record.sugar_pp < 70) alerts.push('⚠️ Low Blood Sugar (Hypoglycemia risk)');
  if (record.spo2 && record.spo2 < 95) alerts.push('🚨 Low SpO2 — seek immediate attention');
  if (record.temperature > 103) alerts.push('🚨 High Fever (>103°F)');
  else if (record.temperature > 100.4) alerts.push('⚠️ Fever ('+record.temperature+'°F)');
  if (record.pulse > 100) alerts.push('⚠️ Elevated Pulse Rate');
  if (record.pulse < 60) alerts.push('⚠️ Low Pulse Rate (Bradycardia)');

  var alertBox = document.getElementById('vitalsAlertBox');
  if (alertBox && alerts.length) {
    alertBox.innerHTML = '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius);padding:10px 14px;margin-bottom:0">' +
      alerts.map(function(a){ return '<div style="font-size:12.5px;color:var(--red);font-weight:600;padding:2px 0">'+a+'</div>'; }).join('') + '</div>';
  } else if (alertBox) { alertBox.innerHTML = ''; }

  var ok = await dbInsertVitals(record);
  if (!ok) { showToast('Failed to save vitals.', 'error'); return; }

  if (alerts.length) showToast('⚠️ Saved with alerts: '+alerts.length+' abnormal value(s)', 'error');
  else showToast('✅ Vitals recorded for '+vitalsPatientName, 'success');

  vitalsData = await dbGetVitals(activeClinicId, vitalsPatientName);
  var overlay = document.getElementById('vitalsModalOverlay');
  if (overlay) renderVitalsModal(overlay);
}

// ════════════════════════════════════════════════════════════
//  4. PATIENT HEALTH TIMELINE
// ════════════════════════════════════════════════════════════
async function openPatientTimeline(patientName) {
  var overlay = document.getElementById('timelineOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='timelineOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }

  overlay.innerHTML =
    '<div class="modal" style="max-width:700px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📋 Health Timeline</div><div class="modal-subtitle">'+escHtml(patientName)+' — complete medical history</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'timelineOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body" id="timelineBody" style="padding:20px;min-height:200px">' +
        '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">⏳</div>Building timeline…</div>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Gather all events
  var rxList    = prescriptions.filter(function(rx){ return (rx.patientName||'').trim().toLowerCase()===patientName.trim().toLowerCase(); }).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var vitsList  = await dbGetVitals(activeClinicId, patientName);
  var invList   = (typeof invoices!=='undefined' ? invoices : []).filter(function(i){ return (i.patient_name||'').trim().toLowerCase()===patientName.trim().toLowerCase(); });
  var apptList  = (typeof appointments!=='undefined' ? appointments : []).filter(function(a){ return (a.patient_name||'').trim().toLowerCase()===patientName.trim().toLowerCase(); });

  var events = [];
  rxList.forEach(function(rx) { events.push({date:rx.date,type:'rx',data:rx}); });
  vitsList.forEach(function(v){ events.push({date:(v.recorded_at||'').split('T')[0],type:'vitals',data:v}); });
  invList.forEach(function(i){ events.push({date:i.invoice_date,type:'invoice',data:i}); });
  apptList.forEach(function(a){ events.push({date:a.appt_date,type:'appt',data:a}); });
  events.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var body = document.getElementById('timelineBody');
  if (!body) return;
  if (!events.length) { body.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:12px">🗒️</div><div>No history found for this patient.</div></div>'; return; }

  var typeConfig = {
    rx:      { icon:'💊', color:'var(--teal)',       bg:'var(--teal-pale)' },
    vitals:  { icon:'📊', color:'var(--allopathy)',  bg:'var(--allopathy-bg)' },
    invoice: { icon:'💰', color:'var(--green)',       bg:'#e8f5e9' },
    appt:    { icon:'📅', color:'var(--ayurveda)',    bg:'var(--ayurveda-bg)' },
  };

  var html = '<div style="position:relative;padding-left:36px">' +
    '<div style="position:absolute;left:16px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--teal),var(--border))"></div>';

  events.forEach(function(ev) {
    var tc  = typeConfig[ev.type] || typeConfig.rx;
    var content = '';

    if (ev.type === 'rx') {
      var rx = ev.data;
      var typeIcon = {allopathy:'💉',homeopathy:'🌿',ayurveda:'🌱'}[rx.type]||'💊';
      content = '<div style="font-weight:700;font-size:14px">'+typeIcon+' Prescription <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:6px">'+capitalize(rx.type||'')+'</span></div>'+
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">🩺 Dr. '+escHtml(rx.doctorName||'—')+(rx.diagnosis?' · 🔬 '+escHtml(rx.diagnosis):'')+'</div>'+
        (rx.medicines&&rx.medicines.length?'<div style="font-size:12px;color:var(--text-muted);margin-top:3px">💊 '+rx.medicines.slice(0,4).map(function(m){return escHtml(m.name);}).join(', ')+(rx.medicines.length>4?' +more':'')+'</div>':'')+
        '<div style="margin-top:6px"><span style="background:'+(rx.status==='active'?'var(--green)':rx.status==='expired'?'var(--red)':'var(--text-muted)')+';color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.04em">'+capitalize(rx.status||'')+'</span></div>';
    } else if (ev.type === 'vitals') {
      var v = ev.data;
      var parts=[], flags=[];
      if(v.bp_systolic){parts.push('BP: <strong>'+v.bp_systolic+'/'+v.bp_diastolic+'</strong>'); if(v.bp_systolic>140)flags.push('⚠️ High BP');}
      if(v.pulse)parts.push('Pulse: <strong>'+v.pulse+' bpm</strong>');
      if(v.temperature){parts.push('Temp: <strong>'+v.temperature+'°F</strong>'); if(v.temperature>100.4)flags.push('⚠️ Fever');}
      if(v.sugar_fasting){parts.push('Sugar(F): <strong>'+v.sugar_fasting+'</strong>'); if(v.sugar_fasting>126)flags.push('⚠️ High Sugar');}
      if(v.spo2){parts.push('SpO2: <strong>'+v.spo2+'%</strong>'); if(v.spo2<95)flags.push('🚨 Low SpO2');}
      if(v.weight&&v.height){var b=v.weight/Math.pow(v.height/100,2);parts.push('BMI: <strong>'+b.toFixed(1)+'</strong>');}
      content = '<div style="font-weight:700;font-size:14px">📊 Vital Signs Recorded</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;line-height:1.8">'+parts.join(' &nbsp;·&nbsp; ')+'</div>' +
        (flags.length?'<div style="margin-top:4px">'+flags.map(function(f){return'<span style="background:var(--red-bg);color:var(--red);font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;margin-right:4px">'+f+'</span>';}).join('')+'</div>':'');
    } else if (ev.type === 'invoice') {
      var inv = ev.data;
      content = '<div style="font-weight:700;font-size:14px">💰 Invoice '+escHtml(inv.invoice_no)+'</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+(inv.payment_method?' via '+escHtml(inv.payment_method):'')+'</div>' +
        '<div style="margin-top:6px"><span style="background:'+(inv.status==='paid'?'#e8f5e9':'var(--ayurveda-bg)')+';color:'+(inv.status==='paid'?'var(--green)':'var(--ayurveda)')+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+(inv.status==='paid'?'✅ Paid':'⏳ Unpaid')+'</span></div>';
    } else {
      var a = ev.data;
      content = '<div style="font-weight:700;font-size:14px">📅 Appointment — Token #'+a.token_no+'</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">'+(a.doctor_name?'Dr. '+escHtml(a.doctor_name)+' · ':'')+capitalize(a.visit_type||'Consultation')+(a.appt_time?' · '+escHtml(a.appt_time):'')+'</div>' +
        '<div style="margin-top:6px"><span style="background:var(--surface2);color:var(--text-secondary);font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid var(--border)">'+capitalize(a.status||'waiting')+'</span></div>';
    }

    html += '<div style="position:relative;margin-bottom:20px">' +
      '<div style="position:absolute;left:-28px;top:6px;width:14px;height:14px;border-radius:50%;background:'+tc.bg+';border:2px solid '+tc.color+';box-shadow:0 0 0 3px white"></div>' +
      '<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:5px;letter-spacing:.03em">'+formatDate(ev.date)+'</div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;box-shadow:var(--shadow-sm)">'+content+'</div>' +
    '</div>';
  });
  html += '</div>';
  body.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
//  WIRE VITALS + TIMELINE BUTTONS INTO PATIENT CARDS
// ════════════════════════════════════════════════════════════
function addPatientActionButtons(card, p) {
  var footer = card.querySelector('.rx-footer-actions');
  if (!footer) return;

  var vitalsBtn = document.createElement('button');
  vitalsBtn.className = 'btn-sm btn-outline-teal';
  vitalsBtn.textContent = '📊 Vitals';
  vitalsBtn.addEventListener('click', function(e){ e.stopPropagation(); openVitalsModal(p.name); });

  var timelineBtn = document.createElement('button');
  timelineBtn.className = 'btn-sm btn-outline-teal';
  timelineBtn.textContent = '📋 Timeline';
  timelineBtn.addEventListener('click', function(e){ e.stopPropagation(); openPatientTimeline(p.name); });

  footer.insertBefore(vitalsBtn, footer.firstChild);
  footer.insertBefore(timelineBtn, footer.firstChild);
}

// ════════════════════════════════════════════════════════════
//  SAFE PATCHES — applied after DOM is ready to avoid
//  hoisting-related infinite recursion bugs.
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {

  // ── Patch initAppForClinic to also load invoices for billing badge ──
  var _scriptInitApp = initAppForClinic;
  initAppForClinic = async function() {
    await _scriptInitApp();
    try {
      if (typeof dbGetInvoices === 'function') {
        invoices = await dbGetInvoices(activeClinicId);
        var unpaidCount = invoices.filter(function(i){ return i.status !== 'paid'; }).length;
        setEl('badgeBilling', unpaidCount);
      }
    } catch(e) { console.warn('[Features] billing badge load failed:', e); }
  };

  // ── Patch show-view functions to also hide appointment/billing views ──
  var _scriptShowDoctor = showDoctorView;
  showDoctorView = function() {
    var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
    var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
    _scriptShowDoctor();
  };

  var _scriptShowPatients = showPatientsView;
  showPatientsView = function() {
    var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
    var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
    _scriptShowPatients();
  };

  var _scriptShowPharmacy = showPharmacyView;
  showPharmacyView = function() {
    var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
    var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
    _scriptShowPharmacy();
  };
});
