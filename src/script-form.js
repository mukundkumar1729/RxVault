// ════════════════════════════════════════════════════════════
//  SCRIPT-FORM.JS — Add/Edit Rx modal, medicine & diagnostic rows
//  Depends on: script-utils.js, script-core.js
// ════════════════════════════════════════════════════════════

// ─── Open add modal ───────────────────────────────────────
function openAddModal() {
  if (typeof can !== 'undefined' && !can.addPrescription()) {
    showToast('You do not have permission to add prescriptions.', 'error'); return;
  }
  editingId = null; resetForm();
  document.getElementById('modalTitle').textContent = 'New Rx';
  document.getElementById('saveBtn').textContent    = '💾 Save Rx';
  document.getElementById('fDate').value            = todayISO();
  document.getElementById('fValidUntil').value      = addDays(todayISO(), 30);
  document.getElementById('medicinesEditor').innerHTML  = '';
  document.getElementById('diagnosticEditor').innerHTML = '';
  expandSection('patientSection'); expandSection('doctorSection');
  addMedicineRow(); addDiagnosticRow(); renderQuickChips(); openModal('rxFormModal');
}

// ─── Open edit modal ──────────────────────────────────────
function openEditModal(id) {
  var p = prescriptions.find(function(x){ return x.id === id; }); if (!p) return;
  
  // Enforce fee check on edit if patient exists and fee logic is available
  if (typeof getPatientFeeStatus === 'function' && typeof patientRegistry !== 'undefined') {
    var patient = patientRegistry.find(function(pat){ 
      return (pat.name || '').trim().toLowerCase() === (p.patientName || '').trim().toLowerCase(); 
    });
    if (patient && getPatientFeeStatus(patient) === 'expired') {
      showToast('⚠️ Fee expired for ' + patient.name + '. Please collect fee before editing.', 'error');
      if (typeof openFeePaymentModal === 'function') {
        openFeePaymentModal(patient);
        return;
      }
    }
  }

  editingId = id; resetForm();
  document.getElementById('modalTitle').textContent = 'Edit Rx';
  document.getElementById('saveBtn').textContent    = '💾 Update Rx';
  document.querySelector('input[name="medType"][value="' + p.type + '"]').checked = true;
  var MAP = {
    fPatientName:'patientName', fAge:'age', fGender:'gender', fBloodGroup:'bloodGroup',
    fPhone:'phone', fEmail:'email', fDoctorName:'doctorName', fSpecialization:'specialization',
    fHospital:'hospital', fRegNo:'regNo', fDoctorPhone:'doctorPhone',
    fDate:'date', fValidUntil:'validUntil', fDiagnosis:'diagnosis', fStatus:'status', fNotes:'notes'
  };
  Object.entries(MAP).forEach(function(e){ setVal(e[0], p[e[1]]); });
  activeNoteCategories = new Set(p.noteCategories || []);
  document.querySelectorAll('.note-cat-chip').forEach(function(btn){
    btn.classList.toggle('active', activeNoteCategories.has(btn.getAttribute('data-cat')));
  });
  updateNoteCategoryDisplay();
  var ta = document.getElementById('fNotes');
  if (ta) { updateNotesCounter(ta); setTimeout(function(){ autoResizeTextarea(ta); }, 0); }
  var dta = document.getElementById('fDiagnosis');
  if (dta) { setTimeout(function(){ autoDiagResize(dta); updateDiagCounter(dta); }, 0); }
  var editor = document.getElementById('medicinesEditor'); editor.innerHTML = '';
  if (p.medicines && p.medicines.length) p.medicines.forEach(addMedicineRow); else addMedicineRow();
  var diagEditor = document.getElementById('diagnosticEditor'); diagEditor.innerHTML = '';
  if (p.diagnostics && p.diagnostics.length) p.diagnostics.forEach(addDiagnosticRow); else addDiagnosticRow();
  renderQuickChips(); openModal('rxFormModal');
}

// ─── Save prescription ────────────────────────────────────
async function savePrescription() {
  var patientName = getVal('fPatientName'), doctorName = getVal('fDoctorName'), date = getVal('fDate');
  if (!patientName) { showToast('Patient name is required.', 'error'); focusEl('fPatientName'); return; }
  if (!doctorName)  { showToast('Doctor name is required.',  'error'); focusEl('fDoctorName');  return; }
  if (!date)        { showToast('Please select the date.',   'error'); focusEl('fDate');         return; }

  var rx = {
    id: editingId || genId(), type: document.querySelector('input[name="medType"]:checked').value,
    clinicId: activeClinicId,
    patientName, age: getVal('fAge'), gender: getVal('fGender'), bloodGroup: getVal('fBloodGroup'),
    phone: getVal('fPhone'), email: getVal('fEmail'), doctorName,
    specialization: getVal('fSpecialization'), hospital: getVal('fHospital'),
    regNo: getVal('fRegNo'), doctorPhone: getVal('fDoctorPhone'),
    date, validUntil: getVal('fValidUntil'), diagnosis: getVal('fDiagnosis'),
    status: getVal('fStatus'), medicines: getMedicines(), diagnostics: getDiagnostics(),
    notes: getVal('fNotes'), noteCategories: [...activeNoteCategories],
    updatedAt: new Date().toISOString()
  };

  if (editingId) {
    var idx = prescriptions.findIndex(function(p){ return p.id === editingId; });
    if (idx > -1) {
      var old = prescriptions[idx];
      var snap = {...old}; delete snap.revisions;
      rx.revisions = [...(old.revisions || []), {...snap, _savedAt: old.updatedAt || old.createdAt || old.date}];
      rx.createdAt = old.createdAt;
      prescriptions[idx] = rx;
    }
    showToast('Rx updated for ' + patientName, 'success');
  } else {
    rx.createdAt = new Date().toISOString();
    prescriptions.unshift(rx);
    showToast('Rx saved for ' + patientName, 'success');
  }

  var ok = await dbUpsertPrescription(rx);
  if (!ok) { showToast('DB save failed — check console', 'error'); return; }

  var interactionWarning = '';
  if (typeof window.fullInteractionCheck === 'function' && rx.medicines && rx.medicines.length > 0) {
      var meds = rx.medicines.map(function(m){ return m.name || m; });
      var check = window.fullInteractionCheck(meds, rx.allergies, null);
      if (check.hasHighSeverity || check.hasModerateSeverity) {
          interactionWarning = window.formatInteractionAlert(check);
          if (interactionWarning) {
              var overlay = document.createElement('div');
              overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
              overlay.innerHTML = '<div style="background:var(--surface);border-radius:16px;max-width:480px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,0.25);padding:24px;text-align:center;animation:slideIn 0.2s ease">' +
                  '<div style="font-size:40px;margin-bottom:12px">💊</div>' +
                  '<div style="font-size:20px;font-weight:600;margin-bottom:6px">Drug Interaction Alert</div>' +
                  '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Review before prescribing:</div>' +
                  '<div style="text-align:left;max-height:300px;overflow-y:auto;margin-bottom:16px">' + interactionWarning + '</div>' +
                  '<button class="btn-sm btn-teal" onclick="this.closest(\'.modal-overlay\').close();">I Understand, Proceed</button>' +
                  '</div>';
              document.body.appendChild(overlay);
              document.body.style.overflow = 'hidden';
              overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); document.body.style.overflow = ''; } };
              return;
          }
      }
  }

  if (typeof storeEmbeddingForRx === 'function') storeEmbeddingForRx(rx).catch(function(){});
  closeModal('rxFormModal'); render();
}

// ─── Medicine rows ────────────────────────────────────────
function addMedicineRow(data) {
  data = data || {};
  var editor = document.getElementById('medicinesEditor');
  var row    = document.createElement('div'); row.className = 'medicine-row';
  var freqOpts  = ['','Once daily','Twice daily (BD)','Thrice daily (TDS)','Four times daily (QID)','Every 6 hours','Every 8 hours','Every 12 hours','Before meals','After meals','At bedtime','As needed (SOS)','Weekly','Alternate days'];
  var durOpts   = ['','1 day','2 days','3 days','5 days','7 days (1 week)','10 days','14 days (2 weeks)','21 days','30 days (1 month)','45 days','60 days (2 months)','90 days (3 months)','Ongoing'];
  var routeOpts = ['','Oral','Topical','Sublingual','Inhalation','IV (Intravenous)','IM (Intramuscular)','Subcutaneous','Rectal','Nasal','Ophthalmic','Otic'];
  var opts = function(list, val) {
    return list.map(function(o){ return '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + (o || 'Select…') + '</option>'; }).join('');
  };
  row.innerHTML =
    '<input type="text" placeholder="Medicine name" value="' + escAttr(data.name||'') + '" data-field="name">' +
    '<input type="text" placeholder="e.g. 500mg" value="' + escAttr(data.dosage||'') + '" data-field="dosage">' +
    '<select data-field="frequency">'  + opts(freqOpts,  data.frequency||'') + '</select>' +
    '<select data-field="duration">'   + opts(durOpts,   data.duration||'')  + '</select>' +
    '<select data-field="route">'      + opts(routeOpts, data.route||'')     + '</select>' +
    '<button class="btn-remove-med" onclick="removeMedRow(this)" title="Remove">✕</button>';
  editor.appendChild(row);
}
function removeMedRow(btn) { btn.closest('.medicine-row').remove(); }
function getMedicines() {
  return Array.from(document.querySelectorAll('#medicinesEditor .medicine-row')).map(function(row) {
    return {
      name:      row.querySelector('[data-field="name"]').value.trim(),
      dosage:    row.querySelector('[data-field="dosage"]').value.trim(),
      frequency: row.querySelector('[data-field="frequency"]').value.trim(),
      duration:  row.querySelector('[data-field="duration"]').value.trim(),
      route:     row.querySelector('[data-field="route"]').value.trim(),
    };
  }).filter(function(m){ return m.name; });
}

// ─── Diagnostic rows ──────────────────────────────────────
function addDiagnosticRow(data) {
  data = data || {};
  var editor = document.getElementById('diagnosticEditor');
  var row    = document.createElement('div'); row.className = 'diagnostic-row';
  row.innerHTML =
    '<input type="text" list="testNameList" placeholder="e.g. CBC, MRI, X-Ray" value="' + escAttr(data.test||'') + '" data-field="test">' +
    '<input type="text" placeholder="Observation / result notes" value="' + escAttr(data.notes||'') + '" data-field="notes">' +
    '<button class="btn-remove-med" onclick="this.closest(\'.diagnostic-row\').remove()" title="Remove">✕</button>';
  editor.appendChild(row);
}
function getDiagnostics() {
  return Array.from(document.querySelectorAll('#diagnosticEditor .diagnostic-row')).map(function(row) {
    return {
      test:  row.querySelector('[data-field="test"]').value.trim(),
      notes: row.querySelector('[data-field="notes"]').value.trim(),
    };
  }).filter(function(d){ return d.test; });
}

// ─── Form reset ───────────────────────────────────────────
function resetForm() {
  document.querySelectorAll('#rxFormModal input:not([type=radio]), #rxFormModal select, #rxFormModal textarea')
    .forEach(function(el){ el.value = ''; });
  document.querySelector('input[name="medType"][value="allopathy"]').checked = true;
  document.getElementById('fStatus').value = 'active';
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  activeNoteCategories = new Set();
  document.querySelectorAll('.note-cat-chip').forEach(function(b){ b.classList.remove('active'); });
  updateNoteCategoryDisplay();
  var ta = document.getElementById('fNotes');
  if (ta) { updateNotesCounter(ta); ta.style.height = ''; }
  var tmpl = document.getElementById('noteTemplate'); if (tmpl) tmpl.value = '';
  clearDoctorAvailPanel();
  var diagEditor = document.getElementById('diagnosticEditor'); if (diagEditor) diagEditor.innerHTML = '';
  var diagTa = document.getElementById('fDiagnosis');
  if (diagTa) { diagTa.style.height = ''; updateDiagCounter(diagTa); }
  if (typeof resetBodyMap === 'function') resetBodyMap();
}

// ─── Doctor auto-populate from reg no ────────────────────
var regDropdownTimer = null;
function onRegNoInput(val) {
  clearTimeout(regDropdownTimer);
  regDropdownTimer = setTimeout(function(){ showRegSuggestions(val.trim()); }, 150);
}
function showRegSuggestions(val) {
  var dropdown = document.getElementById('regNoDropdown');
  if (!val || val.length < 2) { dropdown.classList.remove('open'); return; }
  var seen = new Map();
  doctorRegistry.forEach(function(d) {
    seen.set(d.regNo.toLowerCase(), {regNo:d.regNo, doctorName:d.name, specialization:d.specialization||'', hospital:d.hospital||'', doctorPhone:d.phone||''});
  });
  prescriptions.forEach(function(p) {
    if (!p.regNo || !p.doctorName) return;
    var key = p.regNo.toLowerCase();
    if (!seen.has(key)) seen.set(key, {regNo:p.regNo, doctorName:p.doctorName, specialization:p.specialization||'', hospital:p.hospital||'', doctorPhone:p.doctorPhone||''});
  });
  var matches = [...seen.values()].filter(function(d){
    return d.regNo.toLowerCase().includes(val.toLowerCase()) || d.doctorName.toLowerCase().includes(val.toLowerCase());
  });
  if (!matches.length) {
    dropdown.innerHTML = '<div class="reg-no-results">No saved doctors found for "<strong>' + escHtml(val) + '</strong>"</div>';
    dropdown.classList.add('open'); return;
  }
  dropdown.innerHTML = matches.map(function(d, i) {
    return '<div class="reg-dropdown-item" onmousedown="autoFillDoctor(' + i + ')" data-idx="' + i + '">' +
      '<div class="reg-item-name">Dr. ' + escHtml(d.doctorName) + ' <span class="reg-item-badge">' + escHtml(d.regNo) + '</span></div>' +
      '<div class="reg-item-meta">' + ([d.specialization, d.hospital].filter(Boolean).join(' · ') || 'No additional info') + '</div>' +
    '</div>';
  }).join('');
  dropdown._matches = matches;
  dropdown.classList.add('open');
}
function autoFillDoctor(idx) {
  var dropdown = document.getElementById('regNoDropdown');
  var d = dropdown._matches && dropdown._matches[idx]; if (!d) return;
  setVal('fRegNo', d.regNo); setVal('fDoctorName', d.doctorName);
  setVal('fSpecialization', d.specialization); setVal('fHospital', d.hospital); setVal('fDoctorPhone', d.doctorPhone);
  dropdown.classList.remove('open');
  document.getElementById('doctorAutoMsg').textContent = 'Filled: Dr. ' + d.doctorName;
  document.getElementById('doctorAutoStatus').classList.remove('hidden');
  var fullDoc = doctorRegistry.find(function(dr){ return dr.regNo === d.regNo; });
  if (fullDoc) renderDoctorAvailPanel(fullDoc);
}
function hideRegDropdown() {
  setTimeout(function(){ document.getElementById('regNoDropdown').classList.remove('open'); }, 200);
}
function clearDoctorFields() {
  ['fRegNo','fDoctorName','fSpecialization','fHospital','fDoctorPhone'].forEach(function(id){ setVal(id,''); });
  document.getElementById('doctorAutoStatus').classList.add('hidden');
  document.getElementById('regNoDropdown').classList.remove('open');
  clearDoctorAvailPanel(); focusEl('fRegNo');
}

// ─── Open Rx modal pre-filled with patient data ───────────
function openAddModalForPatient(patient) {
  openAddModal();
  if (!patient) return;
  setTimeout(function() {
    setVal('fPatientName', patient.name        || '');
    setVal('fAge',         patient.age         || '');
    setVal('fGender',      patient.gender      || '');
    setVal('fBloodGroup',  patient.bloodGroup  || '');
    setVal('fPhone',       patient.phone       || '');
    setVal('fEmail',       patient.email       || '');
    if (patient.consultantDoctor) {
      var dr = doctorRegistry.find(function(d){ return d.name === patient.consultantDoctor; });
      if (dr) {
        setVal('fDoctorName',    dr.name           || '');
        setVal('fRegNo',         dr.regNo          || '');
        setVal('fSpecialization',dr.specialization || '');
        setVal('fHospital',      dr.hospital       || '');
        setVal('fDoctorPhone',   dr.phone          || '');
        document.getElementById('doctorAutoMsg').textContent = 'Filled: Dr. ' + dr.name;
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

// ─── Hospital/clinic dropdown helper ─────────────────────
function populateHospitalDropdown(selectId, currentValue) {
  var sel = document.getElementById(selectId); if (!sel) return;
  var clinicNames  = (typeof clinics !== 'undefined' ? clinics : []).map(function(c){ return c.name; }).filter(Boolean);
  var drHospitals  = doctorRegistry.map(function(d){ return d.hospital; }).filter(Boolean);
  var allOptions   = [...new Set([...clinicNames, ...drHospitals])].sort();
  sel.innerHTML = '<option value="">— Select Clinic/Hospital —</option>' +
    allOptions.map(function(h){ return '<option value="' + escAttr(h) + '"' + (h === currentValue ? ' selected' : '') + '>' + escHtml(h) + '</option>'; }).join('');
  if (currentValue && !allOptions.includes(currentValue)) {
    sel.innerHTML += '<option value="' + escAttr(currentValue) + '" selected>' + escHtml(currentValue) + '</option>';
  }
}
