// ════════════════════════════════════════════════════════════
//  SCRIPT-PATIENTS.JS — Patient registration, view, fee validity, pharmacy
//  Depends on: script-utils.js, script-core.js, script-form.js
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  PATIENT REGISTRATION
// ════════════════════════════════════════════════════════════
function openRegisterModal() {
  if (typeof can !== 'undefined' && !can.registerPatient()) {
    showToast('You do not have permission to register patients.', 'error'); return;
  }
  ['regName','regAge','regPhone','regEmail','regAddress','regFee'].forEach(function(id){ setVal(id,''); });
  setVal('regGender',''); setVal('regBloodGroup','');
  document.querySelector('input[name="regPayment"][value="Cash"]').checked = true;
  document.getElementById('regDate').value = todayISO();
  document.getElementById('regPid').textContent = genPatientId();
  var sel = document.getElementById('regDoctor');
  sel.innerHTML = '<option value="">— Select Doctor —</option>' +
    doctorRegistry.map(function(d) {
      return '<option value="' + escAttr(d.name) + '" data-reg="' + escAttr(d.regNo) + '"' + (d.unavailable ? ' disabled' : '') + '>' +
        'Dr. ' + escHtml(d.name) + (d.unavailable ? ' (Unavailable)' : '') + ' — ' + escHtml(d.specialization||d.type) + '</option>';
    }).join('');
  openModal('registerModal');
}

async function registerPatient() {
  var name   = getVal('regName'), doctor = getVal('regDoctor');
  var fee    = parseFloat(document.getElementById('regFee').value || '0');
  if (!name)         { showToast('Patient name is required.', 'error'); focusEl('regName');   return; }
  if (!doctor)       { showToast('Please select a consultant doctor.', 'error');               return; }
  if (!fee || fee<=0){ showToast('Please enter a valid consultation fee.', 'error');           return; }

  var paymentMethod = document.querySelector('input[name="regPayment"]:checked')?.value || 'Cash';
  var pid           = document.getElementById('regPid').textContent;

  if (!confirm('Confirm Payment\n\nConsultation Fee: ₹' + fee + '\nPayment Method: ' + paymentMethod + '\nDoctor: Dr. ' + doctor + '\n\nProceed with registration?')) return;

  var patient = {
    id: pid, clinicId: activeClinicId, name,
    age: getVal('regAge'), gender: getVal('regGender'), bloodGroup: getVal('regBloodGroup'),
    phone: getVal('regPhone'), email: getVal('regEmail'), address: getVal('regAddress'),
    consultantDoctor: doctor, consultantFee: fee, paymentMethod,
    registrationDate: document.getElementById('regDate').value || todayISO(),
    registeredAt: new Date().toISOString()
  };

  var ok = await dbInsertPatient(patient);
  if (!ok) { showToast('DB save failed — check console', 'error'); return; }

  patientRegistry.unshift(patient);
  updateStats();
  if (currentView === 'patients') renderPatientsPage(patientRegistry);
  closeModal('registerModal');
  showToast('✅ Patient registered! ID: ' + pid + ' · Fee ₹' + fee + ' received via ' + paymentMethod, 'success');
  openAddModalForPatient(patient);
}

// ════════════════════════════════════════════════════════════
//  FEE VALIDITY (7-day window)
// ════════════════════════════════════════════════════════════
var FEE_VALIDITY_DAYS = 7;

function getPatientFeeStatus(patient) {
  if (!patient) return 'never';
  var lastPayment = getLastPaymentDate(patient);
  if (!lastPayment) return 'never';
  var diffDays = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= FEE_VALIDITY_DAYS ? 'valid' : 'expired';
}
function getLastPaymentDate(patient) {
  var dates = [];
  if (patient.registeredAt) dates.push(new Date(patient.registeredAt));
  if (patient.lastFeeDate)  dates.push(new Date(patient.lastFeeDate));
  prescriptions.forEach(function(rx) {
    if ((rx.patientName||'').trim().toLowerCase() === (patient.name||'').trim().toLowerCase() && rx.feePaidDate) {
      dates.push(new Date(rx.feePaidDate));
    }
  });
  if (!dates.length) return null;
  return dates.reduce(function(a,b){ return a > b ? a : b; });
}
function getFeeExpiryDate(patient) {
  var last = getLastPaymentDate(patient); if (!last) return null;
  return new Date(last.getTime() + FEE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}
function getDaysRemaining(patient) {
  var exp = getFeeExpiryDate(patient); if (!exp) return 0;
  return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function openPrescriptionForPatient(patient) {
  var status = getPatientFeeStatus(patient);
  if (status === 'valid') {
    showToast('✅ Fee valid for ' + getDaysRemaining(patient) + ' more day(s)', 'success');
    openAddModalForPatient(patient);
  } else {
    openFeePaymentModal(patient);
  }
}

function openFeePaymentModal(patient) {
  var overlay = document.getElementById('feePaymentOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='feePaymentOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }

  var status  = getPatientFeeStatus(patient);
  var exp     = getFeeExpiryDate(patient);
  var expStr  = exp ? formatDate(exp.toISOString().split('T')[0]) : '—';
  var statusMsg = status === 'expired'
    ? '<div style="background:var(--red-bg);color:var(--red);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">⚠️ Fee expired on <strong>' + expStr + '</strong>. Payment required to continue.</div>'
    : '<div style="background:var(--allopathy-bg);color:var(--allopathy);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">ℹ️ No prior payment found. Please collect consultation fee.</div>';

  overlay.innerHTML =
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-header"><div>' +
        '<div class="modal-title">💳 Collect Consultation Fee</div>' +
        '<div class="modal-subtitle">' + escHtml(patient.name) + ' · ' + escHtml(patient.id) + '</div>' +
      '</div><button class="modal-close" onclick="document.getElementById(\'feePaymentOverlay\').classList.remove(\'open\')">✕</button></div>' +
      '<div class="modal-body">' + statusMsg +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Fee (₹) *</label><input type="number" id="feeAmount" value="' + (patient.consultantFee||0) + '" min="0"></div>' +
          '<div class="field"><label>Doctor</label><select id="feeDoctorSelect">' +
            '<option value="">— Select —</option>' +
            doctorRegistry.map(function(d){ return '<option value="' + escAttr(d.name) + '"' + (d.name === patient.consultantDoctor ? ' selected' : '') + (d.unavailable ? ' disabled' : '') + '>Dr. ' + escHtml(d.name) + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0"><label>Payment Method</label>' +
          '<div style="display:flex;gap:12px;margin-top:6px">' +
            ['Cash','Card','UPI','Online'].map(function(m){ return '<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="radio" name="feePayment" value="' + m + '"' + (m==='Cash'?' checked':'') + '> ' + m + '</label>'; }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="document.getElementById(\'feePaymentOverlay\').classList.remove(\'open\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" id="feeCollectBtn" onclick="collectFeeAndProceed(' + JSON.stringify(patient.id) + ')">✅ Collect &amp; Proceed</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

async function collectFeeAndProceed(patientId) {
  var patient = patientRegistry.find(function(p){ return p.id === patientId; });
  if (!patient) return;
  var fee    = parseFloat(document.getElementById('feeAmount')?.value || '0');
  var doctor = document.getElementById('feeDoctorSelect')?.value || patient.consultantDoctor || '';
  var method = document.querySelector('input[name="feePayment"]:checked')?.value || 'Cash';
  if (!fee || fee <= 0) { showToast('Please enter a valid fee amount.', 'error'); return; }

  patient.lastFeeDate      = new Date().toISOString();
  patient.consultantFee    = fee;
  patient.consultantDoctor = doctor;
  patient.paymentMethod    = method;

  await dbInsertPatient(Object.assign({}, patient, { registeredAt: patient.registeredAt || new Date().toISOString() })).catch(function(){});
  var idx = patientRegistry.findIndex(function(p){ return p.id === patientId; });
  if (idx > -1) patientRegistry[idx] = patient;

  var overlay = document.getElementById('feePaymentOverlay');
  if (overlay) { overlay.classList.remove('open'); }
  document.body.style.overflow = '';
  showToast('✅ Fee ₹' + fee + ' collected via ' + method + ' · Valid for ' + FEE_VALIDITY_DAYS + ' days', 'success');
  openAddModalForPatient(patient);
}

// ════════════════════════════════════════════════════════════
//  PATIENTS VIEW
// ════════════════════════════════════════════════════════════
function showPatientsView() {
  currentView = 'patients';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('navPatients').classList.add('active');
  ['statsRow','controlsBar','prescriptionsList','doctorsView','pharmacyView','aiSearchPanel'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  document.getElementById('patientsView').style.display = '';
  document.getElementById('pageTitle').textContent    = '👥 Patients';
  document.getElementById('pageSubtitle').textContent = 'Registered patients for this clinic';
  renderPatientsPage(patientRegistry);
  if (typeof refreshSidebarDots === 'function') setTimeout(refreshSidebarDots, 20);
}

function renderPatientsPage(list) {
  var grid = document.getElementById('patientsGrid'); if (!grid) return;
  if (!list || !list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No Patients Registered</div><div class="empty-sub">Use "Register Patient" to add your first patient.</div><button class="btn-add" onclick="openRegisterModal()">👤 Register Patient</button></div>';
    return;
  }
  var fragment = document.createDocumentFragment();
  list.forEach(function(p) {
    var rxList  = prescriptions.filter(function(rx){ return (rx.patientName||'').trim().toLowerCase() === (p.name||'').trim().toLowerCase(); });
    var rxCount = rxList.length;
    var card    = document.createElement('div'); card.className = 'rx-card';

    // Header
    var header = document.createElement('div'); header.className = 'rx-card-header'; header.style.cursor = 'pointer';
    header.addEventListener('click', function(e){ if (!e.target.closest('button')) card.classList.toggle('expanded'); });

    var badge = document.createElement('div'); badge.className = 'rx-type-badge'; badge.style.cssText = 'background:#e8f0fe;color:#1a6fdb'; badge.textContent = '👤 Patient'; header.appendChild(badge);

    var main = document.createElement('div'); main.className = 'rx-main';
    var pname = document.createElement('div'); pname.className = 'rx-patient'; pname.textContent = p.name; main.appendChild(pname);
    var meta  = document.createElement('div'); meta.className = 'rx-meta';
    [p.age?'🎂 '+p.age+' yrs':null, p.gender?'⚧ '+p.gender:null, p.phone?'📱 '+p.phone:null, p.consultantDoctor?'🩺 Dr. '+p.consultantDoctor:null].filter(Boolean).forEach(function(txt){
      var s = document.createElement('span'); s.className = 'rx-meta-item'; s.textContent = txt; meta.appendChild(s);
    });
    var feeMeta = document.createElement('span'); feeMeta.className = 'rx-meta-item'; feeMeta.style.color = 'var(--green)';
    feeMeta.textContent = '💰 ₹' + (p.consultantFee||0) + ' via ' + (p.paymentMethod||'Cash'); meta.appendChild(feeMeta);
    if (rxCount > 0) {
      var rxBadge = document.createElement('span'); rxBadge.className = 'rx-meta-item';
      rxBadge.innerHTML = '<span class="nav-badge" style="background:var(--teal);color:#fff">' + rxCount + ' Rx</span>'; meta.appendChild(rxBadge);
    }
    // Fee status badge
    var feeStatus = getPatientFeeStatus(p);
    var feeBadge  = document.createElement('span'); feeBadge.className = 'rx-meta-item';
    var fbi       = document.createElement('span'); fbi.className = 'nav-badge';
    if (feeStatus === 'valid') { var d = getDaysRemaining(p); fbi.style.cssText='background:var(--green);color:#fff'; fbi.textContent='✅ '+d+'d left'; }
    else if (feeStatus === 'expired') { fbi.style.cssText='background:var(--red-bg);color:var(--red)'; fbi.textContent='⚠️ Fee expired'; }
    else { fbi.style.cssText='background:var(--bg);color:var(--text-muted);border:1px solid var(--border)'; fbi.textContent='💳 Fee pending'; }
    feeBadge.appendChild(fbi); meta.appendChild(feeBadge);
    main.appendChild(meta); header.appendChild(main);

    var dateBadge = document.createElement('div'); dateBadge.className = 'rx-date-badge'; dateBadge.textContent = formatDate(p.registrationDate); header.appendChild(dateBadge);

    var actions  = document.createElement('div'); actions.className = 'rx-actions';
    var newRxBtn = document.createElement('button'); newRxBtn.className = 'btn-sm btn-outline-teal'; newRxBtn.style.cssText = 'font-size:12px;padding:5px 12px'; newRxBtn.textContent = '📝 New Rx';
    newRxBtn.addEventListener('click', function(e){ e.stopPropagation(); openPrescriptionForPatient(p); }); actions.appendChild(newRxBtn); header.appendChild(actions);

    var chevron = document.createElement('span'); chevron.className = 'chevron-icon'; chevron.textContent = '▼'; header.appendChild(chevron);
    card.appendChild(header);

    // Body
    var body = document.createElement('div'); body.className = 'rx-card-body';
    var g2   = document.createElement('div'); g2.className = 'rx-details-grid'; g2.style.paddingTop = '16px';
    [['Age & Gender',(p.age||'—')+(p.gender?' · '+p.gender:'')],['Blood Group',p.bloodGroup||'—'],['Phone',p.phone||'—'],['Email',p.email||'—'],['Address',p.address||'—'],['Patient ID',p.id]].forEach(function(d){
      var grp = document.createElement('div'); grp.className = 'detail-group';
      grp.innerHTML = '<div class="detail-label">' + d[0] + '</div><div class="detail-value">' + escHtml(d[1]) + '</div>';
      g2.appendChild(grp);
    });
    body.appendChild(g2);

    var histDiv = document.createElement('div'); histDiv.className = 'rx-medicines'; histDiv.style.marginTop = '14px';
    if (rxCount > 0) {
      var sorted = rxList.slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
      histDiv.innerHTML = '<div class="medicines-title">📋 Prescription History (' + rxCount + ')</div>';
      var tbl = document.createElement('table'); tbl.className = 'medicine-table';
      tbl.innerHTML = '<thead><tr><th>Date</th><th>Diagnosis</th><th>Doctor</th><th>Status</th><th></th></tr></thead>';
      var tbody = document.createElement('tbody');
      sorted.forEach(function(rx) {
        var tr = document.createElement('tr');
        var sc = {active:'var(--green)',completed:'var(--text-muted)',expired:'var(--red)'}[rx.status]||'var(--text-muted)';
        tr.innerHTML = '<td>' + formatDate(rx.date) + '</td><td>' + escHtml(rx.diagnosis||'—') + '</td><td>' + escHtml(rx.doctorName||'—') + '</td><td style="color:' + sc + '">' + capitalize(rx.status||'') + '</td>';
        var tdBtn = document.createElement('td'); var vb = document.createElement('button');
        vb.className = 'btn-sm btn-outline-teal'; vb.style.cssText = 'padding:3px 8px;font-size:11px'; vb.textContent = 'View Rx';
        vb.addEventListener('click', function(e){ e.stopPropagation(); viewPatientRx(rx.id); }); tdBtn.appendChild(vb); tr.appendChild(tdBtn); tbody.appendChild(tr);
      });
      tbl.appendChild(tbody); histDiv.appendChild(tbl);
    } else {
      histDiv.innerHTML = '<div style="padding:10px 0;color:var(--text-muted);font-size:13px">📋 No prescriptions yet.</div>';
      var ab = document.createElement('button'); ab.className = 'btn-sm btn-outline-teal'; ab.style.marginTop = '6px'; ab.textContent = '📝 Add First Prescription';
      ab.addEventListener('click', function(e){ e.stopPropagation(); openAddModalForPatient(p); }); histDiv.appendChild(ab);
    }
    body.appendChild(histDiv);

    var footer  = document.createElement('div'); footer.className = 'rx-footer-actions';
    var fBtn    = document.createElement('button'); fBtn.className = 'btn-sm btn-teal'; fBtn.textContent = '📝 New Prescription';
    fBtn.addEventListener('click', function(e){ e.stopPropagation(); openPrescriptionForPatient(p); }); footer.appendChild(fBtn);
    body.appendChild(footer);
    card.appendChild(body);
    fragment.appendChild(card);
  });
  grid.innerHTML = ''; grid.appendChild(fragment);
}

function filterPatients() {
  var q = (document.getElementById('patientFilterInput')?.value || '').toLowerCase().trim();
  if (!q) { renderPatientsPage(patientRegistry); return; }
  renderPatientsPage(patientRegistry.filter(function(p){
    return (p.name||'').toLowerCase().includes(q) || (p.phone||'').toLowerCase().includes(q) ||
           (p.id||'').toLowerCase().includes(q)   || (p.consultantDoctor||'').toLowerCase().includes(q);
  }));
}
function clearPatientFilter() { var inp = document.getElementById('patientFilterInput'); if (inp) inp.value=''; renderPatientsPage(patientRegistry); }

// ════════════════════════════════════════════════════════════
//  PHARMACY VIEW
// ════════════════════════════════════════════════════════════
function showPharmacyView() {
  currentView = 'pharmacy';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nb = document.getElementById('navPharmacy'); if (nb) nb.classList.add('active');
  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel','doctorsView','patientsView'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  var pv = document.getElementById('pharmacyView'); if (pv) pv.style.display = '';
  document.getElementById('pageTitle').textContent    = '💊 Pharmacy';
  document.getElementById('pageSubtitle').textContent = 'Prescribed medicines queue for dispensing';
  renderPharmacyList();
  if (typeof refreshSidebarDots === 'function') setTimeout(refreshSidebarDots, 20);
}

function filterPharmacy() { renderPharmacyList(); }

function renderPharmacyList() {
  var container    = document.getElementById('pharmacyList');
  var statsEl      = document.getElementById('pharmacyStats');
  var searchVal    = (document.getElementById('pharmacySearch')?.value       || '').toLowerCase().trim();
  var statusFilter = document.getElementById('pharmacyStatusFilter')?.value  || 'all';
  var typeFilter   = document.getElementById('pharmacyTypeFilter')?.value    || 'all';
  if (!container) return;

  var list = prescriptions.filter(function(rx) {
    if (typeFilter !== 'all' && rx.type !== typeFilter) return false;
    if (statusFilter === 'pending')   return !rx.dispenseDate;
    if (statusFilter === 'dispensed') return !!rx.dispenseDate;
    if (statusFilter === 'active')    return rx.status === 'active';
    return true;
  });
  if (searchVal) {
    list = list.filter(function(rx) {
      return [rx.patientName, rx.doctorName, rx.diagnosis, (rx.medicines||[]).map(function(m){return m.name;}).join(' ')].join(' ').toLowerCase().includes(searchVal);
    });
  }
  list.sort(function(a,b){ if (!a.dispenseDate && b.dispenseDate) return -1; if (a.dispenseDate && !b.dispenseDate) return 1; return new Date(b.date)-new Date(a.date); });

  var total    = prescriptions.length;
  var pending  = prescriptions.filter(function(rx){ return !rx.dispenseDate; }).length;
  var dispensed= prescriptions.filter(function(rx){ return !!rx.dispenseDate; }).length;
  var todayCount= prescriptions.filter(function(rx){ return rx.date === todayISO(); }).length;
  if (statsEl) {
    statsEl.innerHTML = [
      {label:'Total Rx',   val:total,      bg:'var(--surface2)',      clr:'var(--text-primary)'},
      {label:'Pending',    val:pending,    bg:'var(--allopathy-bg)',  clr:'var(--allopathy)'},
      {label:'Dispensed',  val:dispensed,  bg:'#e8f5e9',              clr:'var(--green)'},
      {label:"Today's Rx", val:todayCount, bg:'var(--teal-pale)',     clr:'var(--teal)'},
    ].map(function(s){
      return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius);padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:120px">' +
        '<div style="font-size:22px;font-weight:700;color:'+s.clr+'">'+s.val+'</div>' +
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">'+s.label+'</div></div>';
    }).join('');
  }

  if (!list.length) { container.innerHTML='<div class="empty-state"><div class="empty-icon">💊</div><div class="empty-title">No prescriptions found</div><div class="empty-sub">Adjust your filters or check back later.</div></div>'; return; }

  var typeIcon  = {allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱'};
  var typeColor = {allopathy:'var(--allopathy)', homeopathy:'var(--homeopathy)', ayurveda:'var(--ayurveda)'};
  var typeBg    = {allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)'};

  container.innerHTML = list.map(function(rx) {
    var disp     = !!rx.dispenseDate;
    var meds     = rx.medicines || [];
    var medsHtml = meds.length
      ? '<table class="medicine-table" style="margin-top:12px"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead><tbody>' +
        meds.map(function(m){ return '<tr><td><strong>' + escHtml(m.name||'—') + '</strong></td><td>' + escHtml(m.dosage||'—') + '</td><td>' + escHtml(m.frequency||'—') + '</td><td>' + escHtml(m.duration||'—') + '</td><td>' + escHtml(m.route||'—') + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines listed.</div>';
    var actionBtn = disp
      ? '<button class="btn-sm btn-outline-teal" data-rxid="' + rx.id + '" onclick="undispenseMedicine(this.dataset.rxid)" style="font-size:12px">↩️ Undispense</button>'
      : '<button class="btn-sm btn-teal"         data-rxid="' + rx.id + '" onclick="dispenseMedicine(this.dataset.rxid)"   style="font-size:12px">✅ Mark Dispensed</button>';
    return '<div class="rx-card" style="margin-bottom:14px;' + (disp?'opacity:0.7':'') + '">' +
      '<div style="padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border-bottom:1px solid var(--border)">' +
        '<div style="background:' + (typeBg[rx.type]||'var(--bg)') + ';color:' + (typeColor[rx.type]||'var(--text-muted)') + ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;flex-shrink:0;margin-top:2px">' + (typeIcon[rx.type]||'💊') + ' ' + capitalize(rx.type||'') + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:700">' + escHtml(rx.patientName||'—') + '</div>' +
          '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px;display:flex;flex-wrap:wrap;gap:10px">' +
            '<span>🩺 Dr. ' + escHtml(rx.doctorName||'—') + '</span>' +
            '<span>📅 ' + formatDate(rx.date) + '</span>' +
            (rx.diagnosis ? '<span>🔬 ' + escHtml(rx.diagnosis) + '</span>' : '') +
            '<span>📱 ' + escHtml(rx.phone||'—') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
          '<span style="background:' + (disp?'#e8f5e9':'var(--allopathy-bg)') + ';color:' + (disp?'var(--green)':'var(--allopathy)') + ';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">' + (disp?'✅ Dispensed':'⏳ Pending') + '</span>' +
          '<div style="font-size:11px;color:var(--text-muted)">' + meds.length + ' medicine' + (meds.length !== 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:14px 18px">' + medsHtml +
        (rx.notes ? '<div style="margin-top:10px;background:var(--surface2);border-left:3px solid var(--teal);padding:10px 14px;border-radius:4px;font-size:13px">' + escHtml(rx.notes) + '</div>' : '') +
        '<div style="margin-top:12px;display:flex;justify-content:flex-end">' + actionBtn + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function dispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.dispenseDate = new Date().toISOString();
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }
  showToast('✅ Dispensed for ' + rx.patientName, 'success');
  renderPharmacyList();
}
async function undispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.dispenseDate = null;
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }
  showToast('↩️ Marked as undispensed.', 'info');
  renderPharmacyList();
}
