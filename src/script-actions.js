// ════════════════════════════════════════════════════════════
//  SCRIPT-ACTIONS.JS — Delete, print, export/import, renew
//  Depends on: script-utils.js, script-core.js, script-render.js
// ════════════════════════════════════════════════════════════

// ─── Delete ───────────────────────────────────────────────
function confirmDelete(id) {
  deleteTargetId = id;
  openModal('confirmModal');
  document.getElementById('confirmDeleteBtn').onclick = function() {
    deletePrescription(id); closeModal('confirmModal');
  };
}
async function deletePrescription(id) {
  if (typeof can !== 'undefined' && !can.deletePrescription()) {
    showToast('You do not have permission to delete prescriptions.', 'error'); return;
  }
  var p  = prescriptions.find(function(x){ return x.id === id; });
  var ok = await dbDeletePrescription(id);
  if (!ok) { showToast('Delete failed — check console', 'error'); return; }
  prescriptions = prescriptions.filter(function(x){ return x.id !== id; });
  render();
  showToast('Deleted Rx for ' + (p?.patientName || 'patient'), 'info');
}

// ─── Print ────────────────────────────────────────────────
function printPrescription(id) {
  var p = prescriptions.find(function(x){ return x.id === id; }); if (!p) return;
  var clinic = getActiveClinic();
  var tl = {allopathy:'Allopathy', homeopathy:'Homeopathy', ayurveda:'Ayurveda'};
  var medsRows = (p.medicines || []).map(function(m) {
    return '<tr style="border-bottom:1px solid #eee">' +
      '<td style="padding:6px 8px"><strong>' + escHtml(m.name) + '</strong></td>' +
      '<td style="padding:6px 8px">' + escHtml(m.dosage) + '</td>' +
      '<td style="padding:6px 8px">' + escHtml(m.frequency) + '</td>' +
      '<td style="padding:6px 8px">' + escHtml(m.duration) + '</td>' +
      '<td style="padding:6px 8px">' + escHtml(m.route||'') + '</td></tr>';
  }).join('');
  var diagRows = (p.diagnostics || []).map(function(d) {
    return '<tr style="border-bottom:1px solid #eee">' +
      '<td style="padding:6px 8px"><strong>' + escHtml(d.test) + '</strong></td>' +
      '<td style="padding:6px 8px">' + escHtml(d.notes||'—') + '</td></tr>';
  }).join('');
  var clinicHeader = clinic
    ? '<div style="margin-bottom:4px;font-size:13px;color:#555">' + escHtml(clinic.logo||'🏥') + ' ' + escHtml(clinic.name) + (clinic.address ? ' · ' + escHtml(clinic.address) : '') + '</div>'
    : '';
  var html =
    '<!DOCTYPE html><html><head><title>Prescription — ' + escHtml(p.patientName) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600&family=DM+Serif+Display&display=swap" rel="stylesheet">' +
    '<style>body{font-family:"DM Sans",sans-serif;color:#1a1a2e;margin:0;padding:30px;font-size:13px}' +
    '.rx-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0a7c6e}' +
    '.rx-logo{font-family:"DM Serif Display",serif;font-size:22px;color:#0f2240}.rx-logo span{color:#0a7c6e}' +
    '.type-pill{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;background:#e6f5f3;color:#0a7c6e}' +
    'h2{font-family:"DM Serif Display",serif;font-size:17px;color:#0f2240;margin:20px 0 10px;border-bottom:1px solid #eee;padding-bottom:6px}' +
    '.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}' +
    '.info-item label{display:block;font-size:10px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:2px}' +
    '.info-item span{font-size:13px;font-weight:500}table{width:100%;border-collapse:collapse}' +
    'thead{background:#f0f4f8}th{text-align:left;padding:8px;font-size:11px;font-weight:600;text-transform:uppercase;color:#666}' +
    '.notes-box{background:#f7fafc;border-left:3px solid #0a7c6e;padding:12px 16px;border-radius:4px;margin-top:16px}' +
    '.footer{margin-top:40px;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:16px}' +
    '.sig-line{width:160px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;text-align:center}' +
    '@media print{body{padding:20px}}</style></head>' +
    '<body onload="window.print()">' +
    '<div class="rx-header"><div>' + clinicHeader +
      '<div class="rx-logo">💊 Rx<span>Vault</span></div>' +
      '<div style="font-size:11px;color:#888;margin-top:6px">Rx ID: ' + p.id + '</div>' +
    '</div><div style="text-align:right">' +
      '<div class="type-pill">' + (tl[p.type]||p.type) + '</div>' +
      '<div style="margin-top:6px;font-size:12px;color:#555">Date: ' + formatDate(p.date) + '</div>' +
      (p.validUntil ? '<div style="font-size:11px;color:#888">Valid until: ' + formatDate(p.validUntil) + '</div>' : '') +
    '</div></div>' +
    '<h2>Patient Details</h2>' +
    '<div class="info-grid">' +
      '<div class="info-item"><label>Name</label><span>' + escHtml(p.patientName) + '</span></div>' +
      '<div class="info-item"><label>Age</label><span>' + (p.age ? p.age + ' yrs' : '—') + '</span></div>' +
      '<div class="info-item"><label>Gender</label><span>' + (p.gender||'—') + '</span></div>' +
      '<div class="info-item"><label>Blood Group</label><span>' + (p.bloodGroup||'—') + '</span></div>' +
      '<div class="info-item"><label>Phone</label><span>' + (p.phone||'—') + '</span></div>' +
      '<div class="info-item"><label>Diagnosis</label><span>' + (p.diagnosis||'—') + '</span></div>' +
    '</div>' +
    '<h2>Doctor / Practitioner</h2>' +
    '<div class="info-grid">' +
      '<div class="info-item"><label>Name</label><span>Dr. ' + escHtml(p.doctorName) + '</span></div>' +
      '<div class="info-item"><label>Specialization</label><span>' + (p.specialization||'—') + '</span></div>' +
      '<div class="info-item"><label>Reg. No.</label><span>' + (p.regNo||'—') + '</span></div>' +
      '<div class="info-item"><label>Hospital/Clinic</label><span>' + (p.hospital||'—') + '</span></div>' +
    '</div>' +
    '<h2>Prescribed Medicines</h2>' +
    '<table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead>' +
    '<tbody>' + (medsRows || '<tr><td colspan="5" style="padding:10px;color:#888;text-align:center">No medicines recorded</td></tr>') + '</tbody></table>' +
    (diagRows ? '<h2>🔬 Diagnosis &amp; Tests</h2><table><thead><tr><th>Test / Investigation</th><th>Observation / Notes</th></tr></thead><tbody>' + diagRows + '</tbody></table>' : '') +
    (p.notes ? '<div class="notes-box"><strong style="font-size:11px;text-transform:uppercase;color:#0a7c6e">Clinical Notes</strong><br><br>' + escHtml(p.notes) + '</div>' : '') +
    '<div class="footer"><div style="font-size:11px;color:#888">Generated by Rx Vault · ' + new Date().toLocaleDateString() + '</div><div class="sig-line">Doctor\'s Signature</div></div>' +
    '</body></html>';
  var w = window.open('', '_blank', 'width=800,height=700');
  w.document.write(html); w.document.close();
}

// ─── Export / Import ──────────────────────────────────────
function exportAll() {
  if (typeof can !== 'undefined' && !can.exportData()) {
    showToast('You do not have permission to export data.', 'error'); return;
  }
  if (!prescriptions.length) { showToast('No prescriptions to export.', 'error'); return; }
  var clinic     = getActiveClinic();
  var exportData = { clinicId: activeClinicId, clinicName: clinic?.name || '', exportedAt: new Date().toISOString(), prescriptions };
  var blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
  var url  = URL.createObjectURL(blob); var a = document.createElement('a');
  a.href   = url;
  a.download = 'rxvault_' + (clinic?.name||'clinic').replace(/\s+/g,'_') + '_' + todayISO() + '.json';
  a.click(); URL.revokeObjectURL(url);
  showToast('Exported ' + prescriptions.length + ' records', 'success');
}
function importData(e) {
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data     = JSON.parse(ev.target.result);
      var incoming = Array.isArray(data) ? data : (data.prescriptions || []);
      if (!Array.isArray(incoming)) throw new Error();
      var ids     = new Set(prescriptions.map(function(p){ return p.id; }));
      var newOnes = incoming.filter(function(p){ return !ids.has(p.id); }).map(function(p){ return {...p, clinicId: activeClinicId}; });
      prescriptions = [...prescriptions, ...newOnes]; render();
      showToast('Imported ' + newOnes.length + ' new records', 'success');
    } catch(err) { showToast('Invalid JSON file.', 'error'); }
  };
  reader.readAsText(file); e.target.value = '';
}

// ─── Renew prescription ───────────────────────────────────
function renewPrescription(id) {
  var original = prescriptions.find(function(x){ return x.id === id; });
  if (!original) return;
  if (!confirm('Renew prescription for ' + original.patientName + '?\n\nA new prescription will be created with today\'s date, pre-filled with the same medicines.\nYou can review and edit before saving.')) return;
  if (typeof can !== 'undefined' && !can.addPrescription()) { showToast('Permission denied.', 'error'); return; }

  editingId = null; resetForm();
  document.getElementById('modalTitle').textContent = '🔄 Renew Rx';
  document.getElementById('saveBtn').textContent    = '💾 Save Renewed Rx';

  var today = todayISO();
  document.getElementById('fDate').value       = today;
  document.getElementById('fValidUntil').value = addDays(today, 30);

  var fields = {
    fPatientName: original.patientName, fAge: original.age, fGender: original.gender,
    fBloodGroup: original.bloodGroup, fPhone: original.phone, fEmail: original.email,
    fDoctorName: original.doctorName, fSpecialization: original.specialization,
    fHospital: original.hospital, fRegNo: original.regNo, fDoctorPhone: original.doctorPhone,
    fDiagnosis: original.diagnosis, fNotes: original.notes,
  };
  Object.keys(fields).forEach(function(id){ setVal(id, fields[id]); });

  var typeEl = document.querySelector('input[name="medType"][value="' + (original.type||'allopathy') + '"]');
  if (typeEl) typeEl.checked = true;
  document.getElementById('fStatus').value = 'active';

  var medEditor = document.getElementById('medicinesEditor');
  if (medEditor) {
    medEditor.innerHTML = '';
    (original.medicines || []).forEach(addMedicineRow);
    if (!original.medicines || !original.medicines.length) addMedicineRow();
  }
  var diagEditor = document.getElementById('diagnosticEditor');
  if (diagEditor) {
    diagEditor.innerHTML = '';
    (original.diagnostics || []).forEach(addDiagnosticRow);
    if (!original.diagnostics || !original.diagnostics.length) addDiagnosticRow();
  }

  renderQuickChips();
  expandSection('patientSection');
  expandSection('doctorSection');
  openModal('formModal');
  showToast('📋 Pre-filled from original · Review and save', 'info');
}
