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
  ['statsRow','controlsBar','prescriptionsList','doctorsView','pharmacyView','aiSearchPanel',
   'stockView','analyticsView','outbreakView'].forEach(function(id){
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

/** Returns true if Rx is >30 days old, not dispensed, not already self-handled */
function isSelfHandledEligible(rx) {
  if (rx.dispenseDate || rx.selfHandled) return false;
  var diffDays = (new Date() - new Date(rx.date + 'T00:00:00')) / (1000 * 60 * 60 * 24);
  return diffDays > 30;
}

/** Auto-mark all eligible Rxs as self-handled and persist silently */
async function autoMarkSelfHandled() {
  var changed = [];
  for (var i = 0; i < prescriptions.length; i++) {
    var rx = prescriptions[i];
    if (isSelfHandledEligible(rx)) {
      rx.selfHandled     = true;
      rx.selfHandledDate = new Date().toISOString();
      changed.push(rx);
    }
  }
  for (var j = 0; j < changed.length; j++) {
    await dbUpsertPrescription(changed[j]);
  }
  return changed.length;
}

async function markSelfHandled(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.selfHandled     = true;
  rx.selfHandledDate = new Date().toISOString();
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }
  showToast('🙋 Marked as patient handled own', 'info');
  renderPharmacyList();
}

async function unmarkSelfHandled(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.selfHandled     = false;
  rx.selfHandledDate = null;
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }
  showToast('↩️ Unmarked — moved back to pending', 'info');
  renderPharmacyList();
}

function showPharmacyView() {
  currentView = 'pharmacy';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nb = document.getElementById('navPharmacy'); if (nb) nb.classList.add('active');
  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel',
   'doctorsView','patientsView',
   'stockView','analyticsView','outbreakView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  var pv = document.getElementById('pharmacyView'); if (pv) pv.style.display = '';
  document.getElementById('pageTitle').textContent    = '💊 Pharmacy';
  document.getElementById('pageSubtitle').textContent = 'Prescribed medicines queue for dispensing';

  // Auto-mark self-handled silently, re-render if any changed
  autoMarkSelfHandled().then(function(count) {
    if (count > 0) renderPharmacyList();
  });

  renderPharmacyList();
  if (typeof refreshSidebarDots === 'function') setTimeout(refreshSidebarDots, 20);
}

function filterPharmacy() { renderPharmacyList(); }

function pharmacyStatToFilter(label) {
  if (label === 'Pending')         return 'pending';
  if (label === 'Dispensed')       return 'dispensed';
  if (label === 'Patient Handled') return 'self_handled';
  return 'all';
}

function renderPharmacyList() {
  var container    = document.getElementById('pharmacyList');
  var statsEl      = document.getElementById('pharmacyStats');
  var searchVal    = (document.getElementById('pharmacySearch')?.value       || '').toLowerCase().trim();
  var statusFilter = document.getElementById('pharmacyStatusFilter')?.value  || 'all';
  var typeFilter   = document.getElementById('pharmacyTypeFilter')?.value    || 'all';
  if (!container) return;

  // Inject self_handled option into dropdown if not already there
  var statusSel = document.getElementById('pharmacyStatusFilter');
  if (statusSel && !statusSel.querySelector('[value="self_handled"]')) {
    var shOpt = document.createElement('option');
    shOpt.value = 'self_handled'; shOpt.textContent = '🙋 Patient Handled Own';
    statusSel.appendChild(shOpt);
  }

  var list = prescriptions.filter(function(rx) {
    if (typeFilter !== 'all' && rx.type !== typeFilter) return false;
    if (statusFilter === 'pending')      return !rx.dispenseDate && !rx.selfHandled;
    if (statusFilter === 'dispensed')    return !!rx.dispenseDate;
    if (statusFilter === 'active')       return rx.status === 'active';
    if (statusFilter === 'self_handled') return !!rx.selfHandled && !rx.dispenseDate;
    // By default (All Status), hide prescriptions that are marked as 'expired'
    if (statusFilter === 'all' && rx.status === 'expired') return false;
    return true;
  });
  if (searchVal) {
    list = list.filter(function(rx) {
      return [rx.patientName, rx.doctorName, rx.diagnosis, (rx.medicines||[]).map(function(m){return m.name;}).join(' ')].join(' ').toLowerCase().includes(searchVal);
    });
  }
  list.sort(function(a,b){
    if (a.selfHandled && !b.selfHandled) return 1;
    if (!a.selfHandled && b.selfHandled) return -1;
    if (!a.dispenseDate && b.dispenseDate) return -1;
    if (a.dispenseDate && !b.dispenseDate) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  var total       = prescriptions.length;
  var pending     = prescriptions.filter(function(rx){ return !rx.dispenseDate && !rx.selfHandled; }).length;
  var dispensed   = prescriptions.filter(function(rx){ return !!rx.dispenseDate; }).length;
  var selfHandled = prescriptions.filter(function(rx){ return !!rx.selfHandled && !rx.dispenseDate; }).length;
  var todayCount  = prescriptions.filter(function(rx){ return rx.date === todayISO(); }).length;

  // Sidebar badge shows only truly pending
  if (typeof setEl === 'function') setEl('badgePharmacy', pending || '');

  if (statsEl) {
    statsEl.innerHTML = [
      {label:'Total Rx',        val:total,       bg:'var(--surface2)',      clr:'var(--text-primary)',  filter:'all'},
      {label:'Pending',         val:pending,     bg:'var(--allopathy-bg)',  clr:'var(--allopathy)',     filter:'pending'},
      {label:'Dispensed',       val:dispensed,   bg:'#e8f5e9',              clr:'var(--green)',         filter:'dispensed'},
      {label:'Patient Handled', val:selfHandled, bg:'var(--homeopathy-bg)', clr:'var(--homeopathy)',    filter:'self_handled'},
      {label:"Today's Rx",     val:todayCount,  bg:'var(--teal-pale)',     clr:'var(--teal)',          filter:'all'},
    ].map(function(s){
      return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius);padding:10px 18px;' +
        'display:flex;align-items:center;gap:10px;min-width:110px;cursor:pointer;transition:box-shadow 0.15s" ' +
        'onclick="var el=document.getElementById(\'pharmacyStatusFilter\');if(el)el.value=\''+s.filter+'\';renderPharmacyList()" ' +
        'onmouseenter="this.style.boxShadow=\'var(--shadow)\'" onmouseleave="this.style.boxShadow=\'\'">' +
        '<div style="font-size:22px;font-weight:700;color:'+s.clr+'">'+s.val+'</div>' +
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">'+s.label+'</div></div>';
    }).join('');
  }

  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💊</div><div class="empty-title">No prescriptions found</div><div class="empty-sub">Adjust your filters or check back later.</div></div>';
    return;
  }

  var typeIcon  = {allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱'};
  var typeColor = {allopathy:'var(--allopathy)', homeopathy:'var(--homeopathy)', ayurveda:'var(--ayurveda)'};
  var typeBg    = {allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)'};

  container.innerHTML = list.map(function(rx) {
    var disp         = !!rx.dispenseDate;
    var isSH         = !!rx.selfHandled && !disp;
    var eligible     = isSelfHandledEligible(rx);
    var meds         = rx.medicines || [];
    var daysSince    = Math.floor((new Date() - new Date(rx.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));

    var ageBadge = daysSince > 30
      ? '<span style="background:var(--red-bg);color:var(--red);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">📅 '+daysSince+' days ago</span>'
      : daysSince > 14
        ? '<span style="background:var(--ayurveda-bg);color:var(--ayurveda);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">📅 '+daysSince+' days ago</span>'
        : '';

    var medsHtml = meds.length
      ? '<table class="medicine-table" style="margin-top:12px"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead><tbody>' +
        meds.map(function(m){ return '<tr><td><strong>'+escHtml(m.name||'—')+'</strong></td><td>'+escHtml(m.dosage||'—')+'</td><td>'+escHtml(m.frequency||'—')+'</td><td>'+escHtml(m.duration||'—')+'</td><td>'+escHtml(m.route||'—')+'</td></tr>'; }).join('')+'</tbody></table>'
      : '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines listed.</div>';

    var statusBadge = disp
      ? '<span style="background:#e8f5e9;color:var(--green);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">✅ Dispensed</span>'
      : isSH
        ? '<span style="background:var(--homeopathy-bg);color:var(--homeopathy);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">🙋 Patient Handled</span>'
        : eligible
          ? '<span style="background:var(--red-bg);color:var(--red);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">⚠️ Overdue</span>'
          : '<span style="background:var(--allopathy-bg);color:var(--allopathy);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">⏳ Pending</span>';

    var contextNote = isSH
      ? '<div style="margin-top:8px;background:var(--homeopathy-bg);border-left:3px solid var(--homeopathy);padding:8px 14px;border-radius:4px;font-size:12.5px;color:var(--homeopathy)">' +
          '🙋 Marked as patient-handled on ' + formatDate((rx.selfHandledDate||'').split('T')[0]) +
          ' — medicine was not dispensed from pharmacy (patient sourced independently or 30+ days elapsed).' +
        '</div>'
      : eligible
        ? '<div style="margin-top:8px;background:var(--red-bg);border-left:3px solid var(--red);padding:8px 14px;border-radius:4px;font-size:12.5px;color:var(--red)">' +
            '⚠️ This prescription is <strong>'+daysSince+' days old</strong> and has not been dispensed. ' +
            'If the patient sourced the medicine themselves, mark it accordingly.' +
          '</div>'
        : '';

    var actionBtns = disp
      ? '<button class="btn-sm btn-outline-teal" data-rxid="'+rx.id+'" onclick="undispenseMedicine(this.dataset.rxid)" style="font-size:12px">↩️ Undispense</button>'
      : isSH
        ? '<button class="btn-sm" data-rxid="'+rx.id+'" onclick="unmarkSelfHandled(this.dataset.rxid)" ' +
            'style="font-size:12px;border:1px solid var(--border);border-radius:7px;padding:6px 12px;background:transparent;color:var(--text-muted);cursor:pointer;font-family:DM Sans,sans-serif">↩️ Unmark</button>' +
          ' <button class="btn-sm btn-teal" data-rxid="'+rx.id+'" onclick="dispenseMedicine(this.dataset.rxid)" style="font-size:12px">✅ Dispense Instead</button>'
        : '<button class="btn-sm btn-teal" data-rxid="'+rx.id+'" onclick="dispenseMedicine(this.dataset.rxid)" style="font-size:12px">✅ Mark Dispensed</button>' +
          ' <button class="btn-sm" data-rxid="'+rx.id+'" onclick="markSelfHandled(this.dataset.rxid)" ' +
            'style="font-size:12px;border:1px solid var(--homeopathy);border-radius:7px;padding:6px 12px;background:transparent;color:var(--homeopathy);cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600">🙋 Patient Handled Own</button>';

    return '<div class="rx-card" style="margin-bottom:14px;' + ((disp||isSH)?'opacity:0.75;':'') + '">' +
      '<div style="padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border-bottom:1px solid var(--border)">' +
        '<div style="background:'+(typeBg[rx.type]||'var(--bg)')+';color:'+(typeColor[rx.type]||'var(--text-muted)')+';font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;flex-shrink:0;margin-top:2px">'+(typeIcon[rx.type]||'💊')+' '+capitalize(rx.type||'')+'</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:700">'+escHtml(rx.patientName||'—')+'</div>' +
          '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px;display:flex;flex-wrap:wrap;gap:10px">' +
            '<span>🩺 Dr. '+escHtml(rx.doctorName||'—')+'</span>' +
            '<span>📅 '+formatDate(rx.date)+'</span>' +
            (rx.diagnosis ? '<span>🔬 '+escHtml(rx.diagnosis)+'</span>' : '') +
            '<span>📱 '+escHtml(rx.phone||'—')+'</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
          statusBadge + ageBadge +
          '<div style="font-size:11px;color:var(--text-muted)">'+meds.length+' medicine'+(meds.length!==1?'s':'')+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:14px 18px">'+medsHtml+contextNote+
        (rx.notes ? '<div style="margin-top:10px;background:var(--surface2);border-left:3px solid var(--teal);padding:10px 14px;border-radius:4px;font-size:13px">'+escHtml(rx.notes)+'</div>' : '') +
        '<div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px">'+actionBtns+'</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function dispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.dispenseDate    = new Date().toISOString();
  // If it was marked self-handled before, clear that when properly dispensed
  rx.selfHandled     = false;
  rx.selfHandledDate = null;
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }

  // Deduct stock for each dispensed medicine
  if (typeof stockItems !== 'undefined' && stockItems.length && rx.medicines && rx.medicines.length) {
    var deducted = [];
    for (var i = 0; i < rx.medicines.length; i++) {
      var med  = rx.medicines[i];
      var qty  = parseInt(med.quantity || med.dosage || '1') || 1;
      var item = stockItems.find(function(s) {
        return (s.name || '').toLowerCase().includes((med.name || '').toLowerCase().split(' ')[0].toLowerCase()) ||
               (med.name || '').toLowerCase().includes((s.name || '').toLowerCase().split(' ')[0].toLowerCase());
      });
      if (item && item.quantity > 0) {
        var prevQty   = item.quantity;
        item.quantity = Math.max(0, item.quantity - qty);
        item.updated_at = new Date().toISOString();
        if (typeof dbUpsertStock === 'function') await dbUpsertStock(item);
        deducted.push(med.name + ' (' + prevQty + ' → ' + item.quantity + ')');
        if (item.quantity <= item.min_quantity) {
          showToast('⚠️ Low stock: ' + item.name + ' (' + item.quantity + ' left)', 'error');
        }
      }
    }
    if (deducted.length) {
      showToast('✅ Dispensed · Stock updated: ' + deducted.join(', '), 'success');
    } else {
      showToast('✅ Dispensed for ' + rx.patientName, 'success');
    }
  } else {
    showToast('✅ Dispensed for ' + rx.patientName, 'success');
  }
  renderPharmacyList();
}

async function undispenseMedicine(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  rx.dispenseDate = null;
  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('Failed to update.', 'error'); return; }

  // Restore stock when undispensed
  if (typeof stockItems !== 'undefined' && stockItems.length && rx.medicines && rx.medicines.length) {
    for (var i = 0; i < rx.medicines.length; i++) {
      var med  = rx.medicines[i];
      var qty  = parseInt(med.quantity || med.dosage || '1') || 1;
      var item = stockItems.find(function(s) {
        return (s.name || '').toLowerCase().includes((med.name || '').toLowerCase().split(' ')[0].toLowerCase()) ||
               (med.name || '').toLowerCase().includes((s.name || '').toLowerCase().split(' ')[0].toLowerCase());
      });
      if (item) {
        item.quantity   = item.quantity + qty;
        item.updated_at = new Date().toISOString();
        if (typeof dbUpsertStock === 'function') await dbUpsertStock(item);
      }
    }
  }
  showToast('↩️ Marked as undispensed. Stock restored.', 'info');
  renderPharmacyList();
}