// ════════════════════════════════════════════════════════════
//  FEATURES-CLINICAL.JS
//  1. Medicine Allergy Registry  — per-patient known drug allergies,
//     loud alert when prescribing an allergic medicine
//  2. Drug Interaction Checker   — cross-checks newly added medicines
//     against the patient's other active prescriptions
//  Load order: after script-form.js
// ════════════════════════════════════════════════════════════

// ─── Known interaction pairs (name fragments, case-insensitive) ──
// Format: [drugA_fragment, drugB_fragment, severity, description]
// Expand this list as needed; matching is substring-based.
var DRUG_INTERACTIONS = [
  ['warfarin',   'aspirin',       'high',   'Major bleeding risk — combined anticoagulant + antiplatelet effect'],
  ['warfarin',   'ibuprofen',     'high',   'Ibuprofen increases warfarin effect → bleeding risk'],
  ['warfarin',   'paracetamol',   'med',    'High-dose paracetamol may enhance warfarin anticoagulation'],
  ['metformin',  'alcohol',       'med',    'Risk of lactic acidosis with heavy alcohol use'],
  ['metformin',  'contrast',      'high',   'Hold metformin 48h before/after iodine contrast studies'],
  ['metformin',  'ibuprofen',     'med',    'NSAIDs may impair renal function and increase metformin levels'],
  ['amlodipine', 'simvastatin',   'high',   'Amlodipine increases simvastatin levels → myopathy risk'],
  ['amlodipine', 'clarithromycin','high',   'CYP3A4 inhibition raises amlodipine → severe hypotension'],
  ['atenolol',   'verapamil',     'high',   'Additive AV block risk — both slow heart rate'],
  ['atenolol',   'diltiazem',     'high',   'Combined bradycardia and heart block risk'],
  ['lisinopril', 'spironolactone','high',   'Dangerous hyperkalaemia — both raise potassium'],
  ['lisinopril', 'ibuprofen',     'med',    'NSAIDs blunt ACE inhibitor effect and stress kidneys'],
  ['ciprofloxacin','antacid',     'med',    'Antacids reduce ciprofloxacin absorption — space 2h apart'],
  ['ciprofloxacin','warfarin',    'high',   'Ciprofloxacin markedly increases warfarin effect'],
  ['clarithromycin','simvastatin','high',   'Severe rhabdomyolysis risk — CYP3A4 inhibition'],
  ['fluconazole', 'warfarin',     'high',   'Fluconazole strongly increases warfarin — serious bleeding risk'],
  ['fluconazole', 'metformin',    'low',    'Mild increase in metformin levels — monitor glucose'],
  ['digoxin',    'amiodarone',    'high',   'Amiodarone nearly doubles digoxin levels → toxicity'],
  ['digoxin',    'clarithromycin','high',   'Clarithromycin raises digoxin to toxic levels'],
  ['ssri',       'tramadol',      'high',   'Serotonin syndrome risk — potentially life-threatening'],
  ['sertraline', 'tramadol',      'high',   'Serotonin syndrome risk'],
  ['fluoxetine', 'tramadol',      'high',   'Serotonin syndrome risk'],
  ['aspirin',    'ibuprofen',     'med',    'Ibuprofen blocks aspirin\'s cardioprotective effect'],
  ['methotrexate','ibuprofen',    'high',   'NSAIDs reduce methotrexate clearance → toxicity'],
  ['phenytoin',  'warfarin',      'high',   'Unpredictable interaction — both levels affected'],
  ['carbamazepine','warfarin',    'high',   'Carbamazepine accelerates warfarin metabolism'],
  ['sildenafil', 'nitrate',       'high',   'Severe hypotension — absolute contraindication'],
  ['sildenafil', 'isosorbide',    'high',   'Severe hypotension — absolute contraindication'],
];

// ════════════════════════════════════════════════════════════
//  MODULE 1: ALLERGY REGISTRY
// ════════════════════════════════════════════════════════════

function openAllergyManager(patientName) {
  var patient = patientRegistry.find(function(p){
    return (p.name||'').trim().toLowerCase() === (patientName||'').trim().toLowerCase();
  });
  if (!patient) { showToast('Patient not found in registry.', 'error'); return; }

  var overlay = document.getElementById('allergyOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'allergyOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  var allergies = patient.allergies || [];

  overlay.innerHTML =
    '<div class="modal" style="max-width:520px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">⚠️ Drug Allergy Registry</div>' +
          '<div class="modal-subtitle">' + escHtml(patient.name) + ' — known drug allergies & reactions</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'allergyOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        // Alert banner if allergies exist
        (allergies.length
          ? '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:12px 16px;margin-bottom:16px;display:flex;gap:10px">' +
              '<span style="font-size:20px">🚨</span>' +
              '<div><div style="font-weight:700;font-size:13px;color:var(--red)">Documented Allergies (' + allergies.length + ')</div>' +
                '<div style="font-size:12.5px;color:var(--red);margin-top:2px">' + allergies.map(function(a){ return escHtml(a.drug); }).join(', ') + '</div></div>' +
            '</div>'
          : '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">No known drug allergies on record.</div>') +

        // Add new allergy form
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:14px">' +
          '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">Add New Allergy</div>' +
          '<div class="form-row" style="margin-bottom:10px">' +
            '<div class="field"><label>Drug / Medicine Name <span>*</span></label>' +
              '<input type="text" id="allergyDrugInp" placeholder="e.g. Penicillin, Aspirin, Sulfa drugs"></div>' +
            '<div class="field"><label>Reaction Severity</label>' +
              '<select id="allergySeverityInp">' +
                '<option value="mild">Mild (rash, itching)</option>' +
                '<option value="moderate">Moderate (hives, swelling)</option>' +
                '<option value="severe" selected>Severe (anaphylaxis, shock)</option>' +
              '</select></div>' +
          '</div>' +
          '<div class="field" style="margin-bottom:10px"><label>Reaction Description</label>' +
            '<input type="text" id="allergyReactionInp" placeholder="e.g. Developed anaphylactic shock, required emergency treatment"></div>' +
          '<button class="btn-sm btn-teal" onclick="addAllergy(\'' + escAttr(patient.name) + '\')">➕ Add Allergy</button>' +
        '</div>' +

        // Allergy list
        '<div id="allergyList">' + renderAllergyList(allergies, patient.name) + '</div>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderAllergyList(allergies, patientName) {
  if (!allergies.length) return '';
  var sevColor = { mild:['var(--ayurveda-bg)','var(--ayurveda)'], moderate:['var(--allopathy-bg)','var(--allopathy)'], severe:['var(--red-bg)','var(--red)'] };
  return allergies.map(function(a, i) {
    var sc = sevColor[a.severity] || sevColor.moderate;
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">' +
      '<div style="flex:1">' +
        '<div style="font-weight:700;font-size:13.5px">' + escHtml(a.drug) + '</div>' +
        (a.reaction ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + escHtml(a.reaction) + '</div>' : '') +
        '<div style="margin-top:4px"><span style="background:' + sc[0] + ';color:' + sc[1] + ';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">' + (a.severity||'moderate').toUpperCase() + '</span></div>' +
      '</div>' +
      '<button onclick="removeAllergy(\'' + escAttr(patientName) + '\',' + i + ')" ' +
        'style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">🗑️</button>' +
    '</div>';
  }).join('');
}

async function addAllergy(patientName) {
  var drug     = (document.getElementById('allergyDrugInp')?.value || '').trim();
  var severity = document.getElementById('allergySeverityInp')?.value || 'severe';
  var reaction = (document.getElementById('allergyReactionInp')?.value || '').trim();
  if (!drug) { showToast('Enter a drug name.', 'error'); return; }

  var patient = patientRegistry.find(function(p){ return (p.name||'').trim().toLowerCase() === patientName.toLowerCase(); });
  if (!patient) return;
  if (!patient.allergies) patient.allergies = [];
  patient.allergies.push({ drug, severity, reaction, addedOn: new Date().toISOString() });
  await dbUpsertPatient(patient);

  showToast('⚠️ Allergy recorded for ' + patient.name, 'success');
  openAllergyManager(patientName); // re-render
}

async function removeAllergy(patientName, idx) {
  var patient = patientRegistry.find(function(p){ return (p.name||'').trim().toLowerCase() === patientName.toLowerCase(); });
  if (!patient || !patient.allergies) return;
  var drug = patient.allergies[idx]?.drug;
  if (!confirm('Remove allergy for ' + drug + '?')) return;
  patient.allergies.splice(idx, 1);
  await dbUpsertPatient(patient);
  showToast('Allergy removed.', 'info');
  openAllergyManager(patientName);
}

// Called from prescription form when patient name is set / medicine is added
function checkAllergyForPatient(patientName, medicineName) {
  var patient = patientRegistry.find(function(p){ return (p.name||'').trim().toLowerCase() === (patientName||'').trim().toLowerCase(); });
  if (!patient || !patient.allergies || !patient.allergies.length) return null;
  var med = (medicineName || '').toLowerCase();
  return patient.allergies.find(function(a) {
    return med.includes(a.drug.toLowerCase().split(' ')[0]) || a.drug.toLowerCase().includes(med.split(' ')[0]);
  }) || null;
}

function showAllergyAlert(allergy, medicineName) {
  var existing = document.getElementById('allergyAlertBanner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = 'allergyAlertBanner';
  banner.style.cssText = 'background:var(--red-bg);border:2px solid var(--red);border-radius:var(--radius-lg);padding:14px 18px;margin:10px 0;display:flex;align-items:center;gap:12px;animation:slideIn 0.2s ease';
  banner.innerHTML =
    '<span style="font-size:24px">🚨</span>' +
    '<div style="flex:1">' +
      '<div style="font-weight:700;font-size:14px;color:var(--red)">ALLERGY ALERT — ' + escHtml(medicineName) + '</div>' +
      '<div style="font-size:12.5px;color:var(--red);margin-top:3px">Patient has a documented <strong>' + (allergy.severity||'').toUpperCase() + '</strong> allergy to ' + escHtml(allergy.drug) + '.' + (allergy.reaction ? ' Reaction: ' + escHtml(allergy.reaction) : '') + '</div>' +
    '</div>' +
    '<button onclick="this.parentElement.remove()" style="font-size:18px;background:none;border:none;cursor:pointer;color:var(--red)">✕</button>';
  var medEditor = document.getElementById('medicinesEditor');
  if (medEditor) medEditor.parentElement.insertBefore(banner, medEditor);
}

// ════════════════════════════════════════════════════════════
//  MODULE 2: DRUG INTERACTION CHECKER
// ════════════════════════════════════════════════════════════

function checkDrugInteractions(patientName, newMedName) {
  if (!patientName || !newMedName) return [];
  var activeMeds = [];
  prescriptions.forEach(function(rx) {
    if ((rx.patientName||'').trim().toLowerCase() !== patientName.trim().toLowerCase()) return;
    if (rx.status !== 'active') return;
    (rx.medicines || []).forEach(function(m){ if (m.name) activeMeds.push(m.name.toLowerCase()); });
  });
  // Also include meds currently being edited in the form
  document.querySelectorAll('#medicinesEditor .med-name').forEach(function(el){
    var n = (el.value||'').toLowerCase().trim();
    if (n && n !== newMedName.toLowerCase()) activeMeds.push(n);
  });

  var alerts = [];
  var newLow = newMedName.toLowerCase();
  DRUG_INTERACTIONS.forEach(function(pair) {
    var a = pair[0], b = pair[1], sev = pair[2], desc = pair[3];
    var newMatchesA = newLow.includes(a);
    var newMatchesB = newLow.includes(b);
    if (!newMatchesA && !newMatchesB) return;
    var counterpart = newMatchesA ? b : a;
    var existingMatch = activeMeds.find(function(m){ return m.includes(counterpart); });
    if (existingMatch) alerts.push({ drug1: newMedName, drug2: existingMatch, severity: sev, description: desc });
  });
  return alerts;
}

function showInteractionAlerts(alerts, medicineName) {
  // Remove stale alerts for this medicine
  document.querySelectorAll('.interaction-alert-banner').forEach(function(el){ el.remove(); });
  if (!alerts.length) return;

  var container = document.getElementById('medicinesEditor');
  if (!container) return;

  alerts.forEach(function(alert) {
    var banner = document.createElement('div');
    banner.className = 'interaction-alert-banner';
    var sevBg  = alert.severity === 'high' ? 'var(--red-bg)'       : alert.severity === 'med' ? 'var(--ayurveda-bg)' : 'var(--surface2)';
    var sevClr = alert.severity === 'high' ? 'var(--red)'          : alert.severity === 'med' ? 'var(--ayurveda)'    : 'var(--text-muted)';
    var sevLbl = alert.severity === 'high' ? '🚨 MAJOR interaction' : alert.severity === 'med' ? '⚠️ Moderate interaction' : 'ℹ️ Minor interaction';
    banner.style.cssText = 'background:' + sevBg + ';border:1px solid ' + sevClr + ';border-radius:var(--radius);padding:10px 14px;margin:6px 0;font-size:12.5px;display:flex;align-items:flex-start;gap:8px';
    banner.innerHTML =
      '<div style="flex:1"><span style="font-weight:700;color:' + sevClr + '">' + sevLbl + ':</span> ' +
        '<strong>' + escHtml(medicineName) + '</strong> + <strong>' + escHtml(alert.drug2) + '</strong><br>' +
        '<span style="color:var(--text-secondary)">' + escHtml(alert.description) + '</span></div>' +
      '<button onclick="this.parentElement.remove()" style="font-size:14px;background:none;border:none;cursor:pointer;color:var(--text-muted)">✕</button>';
    container.parentElement.insertBefore(banner, container);
  });
}

// ─── Hook into the Rx form ────────────────────────────────
// Patch addMedicineRow to add blur listener for allergy + interaction check
document.addEventListener('DOMContentLoaded', function() {
  if (typeof addMedicineRow === 'function') {
    var _origAddMedRow = addMedicineRow;
    addMedicineRow = function() {
      _origAddMedRow();
      var inputs = document.querySelectorAll('#medicinesEditor .med-name');
      var lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.addEventListener('blur', function() {
          var medName = this.value.trim();
          if (!medName) return;
          var patientName = (document.getElementById('fPatientName')?.value || '').trim();

          // 1) Allergy check
          var allergyMatch = checkAllergyForPatient(patientName, medName);
          if (allergyMatch) showAllergyAlert(allergyMatch, medName);

          // 2) Drug interaction check
          var interactions = checkDrugInteractions(patientName, medName);
          if (interactions.length) showInteractionAlerts(interactions, medName);
        });
      }
    };
  }

  // Also hook into patient name field — show any allergy summary on fill
  var patientField = document.getElementById('fPatientName');
  if (patientField) {
    patientField.addEventListener('change', function() {
      var name = this.value.trim();
      var patient = patientRegistry.find(function(p){ return (p.name||'').trim().toLowerCase() === name.toLowerCase(); });
      if (!patient || !patient.allergies || !patient.allergies.length) return;
      showToast('⚠️ ' + patient.name + ' has ' + patient.allergies.length + ' documented drug allerg' + (patient.allergies.length > 1 ? 'ies' : 'y') + ': ' + patient.allergies.map(function(a){ return a.drug; }).join(', '), 'error');
    });
  }
});

// Expose allergy button to patient cards — patch renderPatientsPage
document.addEventListener('DOMContentLoaded', function() {
  if (typeof renderPatientsPage === 'function') {
    var _origRenderPatients = renderPatientsPage;
    renderPatientsPage = function(list) {
      _origRenderPatients(list);
      // Inject allergy button into each patient card
      setTimeout(function() {
        document.querySelectorAll('#patientsGrid .rx-card').forEach(function(card) {
          if (card.querySelector('.allergy-btn')) return;
          var footer = card.querySelector('.rx-footer-actions');
          if (!footer) return;
          var nameEl  = card.querySelector('[style*="font-weight:700"]') || card.querySelector('.patient-name');
          var name    = nameEl ? nameEl.textContent.trim() : '';
          if (!name) return;
          var btn = document.createElement('button');
          btn.className = 'btn-sm allergy-btn';
          btn.innerHTML = '⚠️ Allergies';
          btn.style.cssText = 'border:1px solid var(--red);color:var(--red);background:transparent;border-radius:7px;padding:6px 12px;font-size:12px;font-family:DM Sans,sans-serif;cursor:pointer';
          btn.onclick = function(e) { e.stopPropagation(); openAllergyManager(name); };
          footer.insertBefore(btn, footer.firstChild);
        });
      }, 50);
    };
  }
});

// ─── DB helper ───────────────────────────────────────────
async function dbUpsertPatient(patient) {
  var { error } = await db.from('patients').upsert(patient, { onConflict:'id' });
  if (error) { console.error('[Patient upsert]', error); return false; }
  return true;
}
