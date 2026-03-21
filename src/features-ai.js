// ════════════════════════════════════════════════════════════
//  FEATURES-AI.JS — AI-Powered Modules for Rx Vault
//  Modules: Lab Analyser, Diet Planner, Patient Portal, Medical Image AI
//  Load order: after features.js
// ════════════════════════════════════════════════════════════

//  5. LAB REPORT ANALYSER (AI-Powered)
// ════════════════════════════════════════════════════════════
function showLabView() {
  currentView = 'lab';
  hideAllViews();
  var lv = document.getElementById('labView');
  if (!lv) {
    lv = document.createElement('div');
    lv.id = 'labView';
    document.querySelector('.main').appendChild(lv);
  }
  lv.style.display = '';
  setNavActive('navLab');
  document.getElementById('pageTitle').textContent    = '🔬 Lab Report Analyser';
  document.getElementById('pageSubtitle').textContent = 'AI-powered interpretation of lab reports and diagnostics';

  lv.innerHTML =
    '<div style="max-width:800px">' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-sm);margin-bottom:16px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:12px">📋 Paste or type your lab report values below</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
          '<div class="field"><label>Patient Name (optional)</label><input type="text" id="labPatientName" placeholder="Patient name"></div>' +
          '<div class="field"><label>Report Type</label>' +
            '<select id="labReportType">' +
              '<option value="CBC">CBC (Complete Blood Count)</option>' +
              '<option value="LFT">LFT (Liver Function Test)</option>' +
              '<option value="KFT">KFT (Kidney Function Test)</option>' +
              '<option value="Lipid">Lipid Profile</option>' +
              '<option value="Thyroid">Thyroid (TSH/T3/T4)</option>' +
              '<option value="Diabetes">HbA1c / Diabetes Panel</option>' +
              '<option value="Urine">Urine Routine</option>' +
              '<option value="Custom">Custom / Multiple</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:14px">' +
          '<label>Lab Report Values <span style="color:var(--red)">*</span></label>' +
          '<textarea id="labReportText" rows="8" placeholder="Paste lab values here, e.g.:\nHemoglobin: 10.2 g/dL\nWBC: 11,500 /μL\nPlatelets: 420,000 /μL\nCreatinine: 1.8 mg/dL\nBilirubin: 2.1 mg/dL&#10;&#10;Or describe: Patient is a 45-year-old diabetic. HbA1c is 9.2%, fasting sugar 210 mg/dL." style="resize:vertical;min-height:180px"></textarea>' +
        '</div>' +
        '<div style="display:flex;gap:10px">' +
          '<button class="btn-add" onclick="analyseLabReport()" id="labAnalyseBtn">🤖 Analyse with AI</button>' +
          '<button class="btn-sm btn-outline-teal" onclick="document.getElementById(\'labReportText\').value=\'\';document.getElementById(\'labResult\').innerHTML=\'\'">✕ Clear</button>' +
        '</div>' +
      '</div>' +
      '<div id="labResult"></div>' +
    '</div>';
}

async function analyseLabReport() {
  var report  = (document.getElementById('labReportText')?.value || '').trim();
  var type    = document.getElementById('labReportType')?.value || 'Custom';
  var patient = document.getElementById('labPatientName')?.value || '';
  if (!report) { showToast('Please enter lab report values.', 'error'); return; }

  var btn = document.getElementById('labAnalyseBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Analysing…'; }

  var resultEl = document.getElementById('labResult');
  if (resultEl) resultEl.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;text-align:center;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">🔬</div>Interpreting lab values…</div>';

  var prompt = 'You are a clinical lab report interpreter for an Indian medical clinic app called Rx Vault.\n\n' +
    'Report Type: '+type+'\n'+(patient?'Patient: '+patient+'\n':'')+'\nLab Values:\n'+report+'\n\n' +
    'Provide a structured analysis in this exact format:\n\n' +
    '## Summary\n[2-3 sentence plain-language summary for the doctor]\n\n' +
    '## Abnormal Values\n[List each abnormal value, flag as HIGH/LOW, and brief clinical significance]\n\n' +
    '## Normal Values\n[Briefly list what is within normal range]\n\n' +
    '## Clinical Interpretation\n[What might these results suggest clinically? Be specific but note this is AI-assisted interpretation]\n\n' +
    '## Recommended Actions\n[Specific follow-up tests, referrals, or monitoring suggestions]\n\n' +
    '## Important Notes\n[Any limitations, need for repeat testing, or urgent flags]\n\n' +
    'Use ✅ for normal, ⚠️ for mildly abnormal, 🔴 for significantly abnormal values. Be concise and clinically relevant. Do not diagnose — support the treating physician.';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await response.json();
    var text = (data.content||[]).map(function(b){ return b.text||''; }).join('');

    if (resultEl) {
      var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-sm)">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">' +
          '<span style="font-size:24px">🔬</span>' +
          '<div><div style="font-weight:700;font-size:16px;color:var(--text-primary)">Lab Report Analysis</div>' +
          '<div style="font-size:12px;color:var(--text-muted)">'+(patient?escHtml(patient)+' · ':'')+type+' · AI-assisted interpretation</div></div>' +
          '<button class="btn-sm btn-outline-teal" style="margin-left:auto" onclick="printLabReport()">🖨️ Print</button>' +
        '</div>' +
        '<div id="labReportContent" style="font-size:13.5px;line-height:1.7;color:var(--text-primary)">'+markdownToHtml(text)+'</div>' +
        '<div style="margin-top:16px;padding:10px 14px;background:var(--ayurveda-bg);border-radius:var(--radius);border-left:3px solid var(--ayurveda);font-size:12px;color:var(--ayurveda)">' +
          '⚠️ This is an AI-assisted interpretation for clinical reference only. Always correlate with patient history and clinical examination.' +
        '</div>' +
      '</div>';
      resultEl.innerHTML = html;
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:20px;color:var(--red)">Failed to analyse. Please check your connection and try again.<br><small>'+e.message+'</small></div>';
  }

  if (btn) { btn.disabled=false; btn.textContent='🤖 Analyse with AI'; }
}

function printLabReport() {
  var content = document.getElementById('labReportContent')?.innerHTML || '';
  var w = window.open('','_blank'); if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><title>Lab Report Analysis</title>' +
    '<style>body{font-family:DM Sans,sans-serif;padding:30px;font-size:13px;color:#1a1a2e}h2{color:#0a7c6e;font-size:16px;margin:16px 0 8px}@media print{body{padding:0}}</style>' +
    '</head><body onload="window.print()"><h1 style="font-size:22px;color:#0f2240;margin-bottom:4px">🔬 Lab Report Analysis</h1>' +
    '<div style="color:#888;font-size:12px;margin-bottom:20px">Generated by Rx Vault · '+new Date().toLocaleDateString('en-IN')+'</div>' +
    content+'<p style="color:#888;font-size:11px;margin-top:30px;border-top:1px solid #eee;padding-top:12px">AI-assisted interpretation. Not a substitute for clinical judgment.</p></body></html>');
  w.document.close();
}

// ════════════════════════════════════════════════════════════
//  6. DIET PLANNER (AI-Powered)
// ════════════════════════════════════════════════════════════
function showDietView() {
  currentView = 'diet';
  hideAllViews();
  var dv = document.getElementById('dietView');
  if (!dv) { dv = document.createElement('div'); dv.id='dietView'; document.querySelector('.main').appendChild(dv); }
  dv.style.display = '';
  setNavActive('navDiet');
  document.getElementById('pageTitle').textContent    = '🥗 Diet Planner';
  document.getElementById('pageSubtitle').textContent = 'AI-generated personalised diet plans for patients';

  dv.innerHTML =
    '<div style="display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start">' +
      // Left panel — inputs
      '<div>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-sm)">' +
          '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:16px">👤 Patient Details</div>' +
          '<div class="field" style="margin-bottom:10px"><label>Patient Name</label><input type="text" id="dietPatient" list="dietPatList" placeholder="Select or type patient name" oninput="autofillDietPatient(this.value)"><datalist id="dietPatList">'+patientRegistry.map(function(p){return'<option value="'+escAttr(p.name)+'">';}).join('')+'</datalist></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
            '<div class="field"><label>Age</label><input type="number" id="dietAge" placeholder="Years" min="1" max="120"></div>' +
            '<div class="field"><label>Gender</label><select id="dietGender"><option>Male</option><option>Female</option><option>Other</option></select></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
            '<div class="field"><label>Weight (kg)</label><input type="number" id="dietWeight" placeholder="70"></div>' +
            '<div class="field"><label>Height (cm)</label><input type="number" id="dietHeight" placeholder="165"></div>' +
          '</div>' +
          '<div class="field" style="margin-bottom:10px"><label>Medical Conditions</label><input type="text" id="dietConditions" placeholder="e.g. Type 2 Diabetes, Hypertension"></div>' +
          '<div class="field" style="margin-bottom:10px"><label>Activity Level</label>' +
            '<select id="dietActivity"><option value="sedentary">🪑 Sedentary (desk job)</option><option value="light">🚶 Light (walk 1-2x/week)</option><option value="moderate" selected>🏃 Moderate (exercise 3-4x/week)</option><option value="active">💪 Active (daily exercise)</option><option value="very-active">🏋️ Very Active (intense training)</option></select></div>' +
          '<div class="field" style="margin-bottom:10px"><label>Diet Preference</label>' +
            '<select id="dietPref"><option value="veg">🌿 Vegetarian</option><option value="nonveg">🍗 Non-Vegetarian</option><option value="vegan">🥦 Vegan</option><option value="eggetarian">🥚 Eggetarian</option></select></div>' +
          '<div class="field" style="margin-bottom:10px"><label>Food Allergies / Restrictions</label><input type="text" id="dietAllergies" placeholder="e.g. lactose intolerant, no nuts"></div>' +
          '<div class="field" style="margin-bottom:14px"><label>Goal</label>' +
            '<select id="dietGoal"><option value="weight-loss">⬇️ Weight Loss</option><option value="weight-gain">⬆️ Weight Gain</option><option value="maintain" selected>⚖️ Maintain Weight</option><option value="muscle">💪 Muscle Building</option><option value="disease">🏥 Disease Management</option></select></div>' +
          '<button class="btn-add" onclick="generateDietPlan()" id="dietGenBtn" style="width:100%;justify-content:center">🤖 Generate Diet Plan</button>' +
        '</div>' +
      '</div>' +
      // Right panel — result
      '<div id="dietResult"><div style="background:var(--surface);border:1px dashed var(--border2);border-radius:var(--radius-lg);padding:40px;text-align:center;color:var(--text-muted)">' +
        '<div style="font-size:52px;margin-bottom:12px">🥗</div>' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:6px">AI Diet Plan</div>' +
        '<div style="font-size:13px">Fill patient details and click "Generate Diet Plan"<br>to create a personalised nutrition plan.</div>' +
      '</div></div>' +
    '</div>';
}

function autofillDietPatient(name) {
  // Find exact match in patient registry
  var p = patientRegistry.find(function(x) {
    return (x.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase();
  });
  if (!p) return;

  // Age
  var ageEl = document.getElementById('dietAge');
  if (ageEl && p.age) ageEl.value = p.age;

  // Gender
  var genEl = document.getElementById('dietGender');
  if (genEl && p.gender) genEl.value = p.gender;

  // Weight & Height from latest vitals if available
  if (typeof dbGetVitals === 'function') {
    dbGetVitals(activeClinicId, p.name).then(function(vitals) {
      if (!vitals || !vitals.length) return;
      // Most recent record first
      var latest = vitals[0];
      var wtEl = document.getElementById('dietWeight');
      var htEl = document.getElementById('dietHeight');
      if (wtEl && latest.weight) wtEl.value = latest.weight;
      if (htEl && latest.height) htEl.value = latest.height;
    }).catch(function(){});
  }

  // Medical conditions from active prescriptions
  var activeRx = prescriptions.filter(function(rx) {
    return (rx.patientName || '').trim().toLowerCase() === p.name.trim().toLowerCase()
      && rx.status === 'active' && rx.diagnosis;
  });
  if (activeRx.length) {
    var conditions = [...new Set(activeRx.map(function(rx){ return rx.diagnosis.split(/[,\n]/)[0].trim(); }))].join(', ');
    var condEl = document.getElementById('dietConditions');
    if (condEl && conditions) condEl.value = conditions;
  }
}

async function generateDietPlan() {
  var patient    = document.getElementById('dietPatient')?.value  || 'Patient';
  var age        = document.getElementById('dietAge')?.value      || '';
  var gender     = document.getElementById('dietGender')?.value   || 'Male';
  var weight     = document.getElementById('dietWeight')?.value   || '';
  var height     = document.getElementById('dietHeight')?.value   || '';
  var conditions = document.getElementById('dietConditions')?.value || 'None';
  var activity   = document.getElementById('dietActivity')?.value  || 'moderate';
  var pref       = document.getElementById('dietPref')?.value      || 'veg';
  var allergies  = document.getElementById('dietAllergies')?.value || 'None';
  var goal       = document.getElementById('dietGoal')?.value      || 'maintain';

  var btn = document.getElementById('dietGenBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Generating…'; }

  var resultEl = document.getElementById('dietResult');
  if (resultEl) resultEl.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;text-align:center;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🥗</div>Creating personalised diet plan…</div>';

  var bmi = '';
  if (weight && height) { var b = parseFloat(weight)/Math.pow(parseFloat(height)/100,2); bmi = 'BMI: '+b.toFixed(1); }

  var prompt = 'You are a clinical nutritionist for an Indian medical clinic (Rx Vault). Create a detailed, practical 7-day diet plan.\n\n' +
    'Patient: '+patient+'\nAge: '+(age||'Not specified')+' | Gender: '+gender+' | Weight: '+(weight?weight+'kg':'?')+' | Height: '+(height?height+'cm':'?')+' '+bmi+'\n' +
    'Medical Conditions: '+conditions+'\nActivity Level: '+activity+'\nDiet Type: '+pref+'\n' +
    'Allergies/Restrictions: '+allergies+'\nGoal: '+goal+'\n\n' +
    'Provide the plan in this format:\n\n' +
    '## Calorie Target\n[Daily calorie requirement and macro breakdown — protein/carbs/fats in grams]\n\n' +
    '## Key Dietary Guidelines\n[5-7 specific rules for this patient based on their conditions]\n\n' +
    '## 7-Day Meal Plan\n[For each day: Breakfast, Mid-Morning Snack, Lunch, Evening Snack, Dinner — with Indian foods and approximate calories]\n\n' +
    '## Foods to Include\n[10-15 specific beneficial foods for this patient]\n\n' +
    '## Foods to Avoid\n[10-12 specific foods to avoid based on conditions]\n\n' +
    '## Hydration & Supplements\n[Water intake, any supplements to consider]\n\n' +
    'Keep it practical, affordable, and use common Indian foods. Be specific with quantities. Focus on the medical conditions mentioned.';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000, messages:[{role:'user',content:prompt}] })
    });
    var data = await response.json();
    var text = (data.content||[]).map(function(b){return b.text||'';}).join('');

    if (resultEl) {
      resultEl.innerHTML =
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-sm)">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">' +
            '<span style="font-size:24px">🥗</span>' +
            '<div><div style="font-weight:700;font-size:16px">Personalised Diet Plan</div>' +
            '<div style="font-size:12px;color:var(--text-muted)">'+escHtml(patient)+' · '+capitalize(goal.replace('-',' '))+' · '+capitalize(pref)+'</div></div>' +
            '<button class="btn-sm btn-outline-teal" style="margin-left:auto" onclick="printDietPlan(\''+escAttr(patient)+'\')">🖨️ Print</button>' +
          '</div>' +
          '<div id="dietPlanContent" style="font-size:13.5px;line-height:1.7">'+markdownToHtml(text)+'</div>' +
          '<div style="margin-top:16px;padding:10px 14px;background:var(--teal-pale);border-radius:var(--radius);border-left:3px solid var(--teal);font-size:12px;color:var(--teal)">' +
            '💚 AI-generated plan. Adjust based on patient\'s response, lab reports, and clinical judgment.' +
          '</div>' +
        '</div>';
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:20px;color:var(--red)">Failed to generate plan. Check connection.<br><small>'+e.message+'</small></div>';
  }

  if (btn) { btn.disabled=false; btn.textContent='🤖 Generate Diet Plan'; }
}

function printDietPlan(patient) {
  var content = document.getElementById('dietPlanContent')?.innerHTML || '';
  var w = window.open('','_blank'); if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><title>Diet Plan — '+patient+'</title>' +
    '<style>body{font-family:DM Sans,sans-serif;padding:30px;font-size:13px;color:#1a1a2e}h2{color:#0a7c6e;margin:16px 0 8px}ul{padding-left:20px}@media print{body{padding:0}}</style>' +
    '</head><body onload="window.print()"><h1 style="font-size:20px;color:#0f2240">🥗 Personalised Diet Plan</h1>' +
    '<p style="color:#888;font-size:12px;margin-bottom:20px">Patient: '+patient+' · Generated by Rx Vault · '+new Date().toLocaleDateString('en-IN')+'</p>' +
    content+'</body></html>');
  w.document.close();
}

// ════════════════════════════════════════════════════════════
//  7. PATIENT PORTAL (AI Chat for patients)
// ════════════════════════════════════════════════════════════
var portalMessages = [];
var portalPatientContext = '';

function showPortalView() {
  currentView = 'portal';
  hideAllViews();
  var pv = document.getElementById('portalView');
  if (!pv) { pv = document.createElement('div'); pv.id='portalView'; document.querySelector('.main').appendChild(pv); }
  pv.style.display = '';
  setNavActive('navPortal');
  document.getElementById('pageTitle').textContent    = '👤 Patient Portal';
  document.getElementById('pageSubtitle').textContent = 'AI health assistant for patient queries and education';

  portalMessages = [];

  pv.innerHTML =
    '<div style="display:grid;grid-template-columns:280px 1fr;gap:20px;height:calc(100vh - 220px)">' +
      // Left — patient selector
      '<div>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;margin-bottom:14px">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px">👤 Select Patient</div>' +
          '<div class="field" style="margin-bottom:10px">' +
            '<input type="text" id="portalPatientSearch" placeholder="Search patient…" oninput="filterPortalPatients(this.value)" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">' +
          '</div>' +
          '<div id="portalPatientList" style="max-height:300px;overflow-y:auto"></div>' +
        '</div>' +
        '<div id="portalPatientCard" style="display:none"></div>' +
      '</div>' +
      // Right — chat
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="padding:16px 20px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,var(--teal),var(--teal-light));display:flex;align-items:center;gap:10px">' +
          '<span style="font-size:20px">🤖</span>' +
          '<div><div style="font-weight:700;color:#fff;font-size:15px">Rx Vault Health Assistant</div>' +
          '<div id="portalActivePatient" style="font-size:12px;color:rgba(255,255,255,0.8)">Select a patient to begin</div></div>' +
        '</div>' +
        '<div id="portalChat" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px">' +
          '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:40px 0">' +
            '<div style="font-size:48px;margin-bottom:12px">💬</div>' +
            '<div style="font-weight:600;margin-bottom:4px">Patient Health Assistant</div>' +
            '<div>Select a patient on the left, then ask health questions.</div>' +
          '</div>' +
        '</div>' +
        '<div style="padding:16px;border-top:1px solid var(--border);background:var(--surface2)">' +
          '<div style="display:flex;gap:8px">' +
            '<input type="text" id="portalInput" placeholder="Ask a health question… (e.g. What should I eat for diabetes?)" ' +
              'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey)sendPortalMessage()" ' +
              'style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif">' +
            '<button class="btn-add" onclick="sendPortalMessage()" id="portalSendBtn" style="padding:10px 18px;white-space:nowrap">Send ➤</button>' +
          '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
            ['💊 Medicine queries','🍽️ Diet advice','⚠️ Side effects','📋 Understand my report','💪 Exercise guidance','😰 Managing symptoms'].map(function(q) {
              return '<button onclick="document.getElementById(\'portalInput\').value=\''+q.replace(/['"]/g,'').slice(2).trim()+'\'" ' +
                'style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:10px;background:var(--surface);cursor:pointer;color:var(--text-secondary)">'+q+'</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  renderPortalPatientList(patientRegistry);
}

function renderPortalPatientList(list) {
  var el = document.getElementById('portalPatientList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12.5px;padding:10px 0">No patients found.</div>';
    return;
  }
  el.innerHTML = list.map(function(p) {
    return '<div class="portal-patient-item" data-patient-id="'+escAttr(p.id)+'" ' +
      'style="padding:10px 12px;border-radius:var(--radius);cursor:pointer;border:1px solid transparent;transition:all 0.15s;margin-bottom:4px" ' +
      'onmouseenter="this.style.background=\'var(--teal-pale)\';this.style.borderColor=\'var(--teal)\'" ' +
      'onmouseleave="if(!this.classList.contains(\'portal-selected\')){this.style.background=\'\';this.style.borderColor=\'transparent\'}" ' +
      'id="portalPat_'+escAttr(p.id)+'">' +
      '<div style="font-weight:600;font-size:13px">'+escHtml(p.name)+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">'+(p.age?p.age+' yrs · ':'')+escHtml(p.consultantDoctor||'')+'</div>' +
    '</div>';
  }).join('');

  // Attach click listeners safely — no inline JS with IDs
  el.querySelectorAll('.portal-patient-item').forEach(function(item) {
    item.addEventListener('click', function() {
      selectPortalPatient(this.dataset.patientId);
    });
  });
}

function filterPortalPatients(q) {
  var filtered = q
    ? patientRegistry.filter(function(p){ return (p.name||'').toLowerCase().includes(q.toLowerCase()); })
    : patientRegistry;
  renderPortalPatientList(filtered);
}

function selectPortalPatient(patientId) {
  var p = patientRegistry.find(function(x){ return x.id===patientId; });
  if (!p) return;
  // Build context from patient data
  var rxList = prescriptions.filter(function(rx){ return (rx.patientName||'').trim().toLowerCase()===(p.name||'').trim().toLowerCase(); });
  var activeRx = rxList.filter(function(rx){ return rx.status==='active'; });
  portalPatientContext = 'Patient: '+p.name+(p.age?' | Age: '+p.age:'')+(p.gender?' | '+p.gender:'')+(p.bloodGroup?' | Blood Group: '+p.bloodGroup:'') +
    (activeRx.length ? '\n\nActive Prescriptions:\n'+activeRx.map(function(rx){
      return '- Diagnosis: '+(rx.diagnosis||'Not specified')+' | Doctor: Dr. '+(rx.doctorName||'?')+
        (rx.medicines&&rx.medicines.length ? ' | Medicines: '+rx.medicines.map(function(m){return m.name+(m.dosage?' '+m.dosage:'');}).join(', ') : '');
    }).join('\n') : '') +
    '\n\nNote: This patient portal is for health education and general guidance only.';

  portalMessages = [];
  var activeEl = document.getElementById('portalActivePatient');
  if (activeEl) activeEl.textContent = p.name+(p.age?' · '+p.age+' yrs':'');

  var chatEl = document.getElementById('portalChat');
  if (chatEl) {
    chatEl.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px">' +
      '<div style="font-size:32px;margin-bottom:8px">👋</div>' +
      'Hello! I\'m your health assistant for <strong>'+escHtml(p.name)+'</strong>.<br>Ask me anything about your medicines, diet, symptoms, or health queries.' +
    '</div>';
  }

  // Highlight selected — use class-based approach
  document.querySelectorAll('.portal-patient-item').forEach(function(el) {
    el.classList.remove('portal-selected');
    el.style.background = '';
    el.style.borderColor = 'transparent';
  });
  var selEl = document.getElementById('portalPat_'+patientId);
  if (selEl) {
    selEl.classList.add('portal-selected');
    selEl.style.background = 'var(--teal-pale)';
    selEl.style.borderColor = 'var(--teal)';
  }

  var cardEl = document.getElementById('portalPatientCard');
  if (cardEl) {
    cardEl.style.display = '';
    cardEl.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px">Active Rx</div>' +
      (activeRx.length ? activeRx.map(function(rx){ return '<div style="background:var(--teal-pale);border-radius:var(--radius);padding:8px 10px;margin-bottom:6px;font-size:12px"><div style="font-weight:600">'+escHtml(rx.diagnosis||'No diagnosis')+'</div><div style="color:var(--text-muted);margin-top:2px">Dr. '+escHtml(rx.doctorName||'—')+'</div></div>'; }).join('') : '<div style="color:var(--text-muted);font-size:12px">No active prescriptions.</div>') +
    '</div>';
  }
}

async function sendPortalMessage() {
  var input = document.getElementById('portalInput');
  var msg   = (input?.value || '').trim();
  if (!msg) return;
  if (!portalPatientContext) { showToast('Please select a patient first.', 'error'); return; }

  input.value = '';
  portalMessages.push({ role:'user', content: msg });

  var chatEl = document.getElementById('portalChat');
  if (!chatEl) return;

  // Add user bubble
  chatEl.innerHTML += '<div style="display:flex;justify-content:flex-end"><div style="background:var(--teal);color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px;max-width:75%;font-size:13.5px;line-height:1.5">'+escHtml(msg)+'</div></div>';

  // Add loading bubble
  var loadId = 'portalLoad_'+Date.now();
  chatEl.innerHTML += '<div id="'+loadId+'" style="display:flex;justify-content:flex-start"><div style="background:var(--surface2);border:1px solid var(--border);padding:10px 14px;border-radius:16px 16px 16px 4px;color:var(--text-muted);font-size:13px">⏳ Thinking…</div></div>';
  chatEl.scrollTop = chatEl.scrollHeight;

  var btn = document.getElementById('portalSendBtn');
  if (btn) btn.disabled = true;

  var systemPrompt = 'You are a compassionate health assistant at an Indian medical clinic called Rx Vault. ' +
    'You help patients understand their health, medicines, and lifestyle.\n\n' +
    'Current patient context:\n'+portalPatientContext+'\n\n' +
    'Guidelines:\n- Be warm, empathetic, and use simple language\n- Refer to their actual medicines and conditions when relevant\n- Always encourage them to consult their doctor for medical decisions\n- Keep responses concise (3-5 sentences max unless a detailed explanation is needed)\n- Use Hindi medical terms only if helpful\n- Never diagnose or prescribe';

  var messages = [{ role:'user', content: 'Context about my patient: '+portalPatientContext }];
  portalMessages.forEach(function(m){ messages.push(m); });

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:600, system:systemPrompt, messages:portalMessages })
    });
    var data = await response.json();
    var reply = (data.content||[]).map(function(b){return b.text||'';}).join('').trim();

    portalMessages.push({ role:'assistant', content: reply });

    var loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = '<div style="display:flex;justify-content:flex-start"><div style="background:var(--surface2);border:1px solid var(--border);padding:10px 14px;border-radius:16px 16px 16px 4px;max-width:80%;font-size:13.5px;line-height:1.6;color:var(--text-primary)">'+escHtml(reply)+'</div></div>';
  } catch(e) {
    var loadEl2 = document.getElementById(loadId);
    if (loadEl2) loadEl2.outerHTML = '<div style="display:flex;justify-content:flex-start"><div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.2);padding:10px 14px;border-radius:16px;font-size:13px;color:var(--red)">Sorry, I couldn\'t connect. Please try again.</div></div>';
  }

  if (btn) btn.disabled = false;
  if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
}

// ════════════════════════════════════════════════════════════
//  8. MEDICAL IMAGE AI
// ════════════════════════════════════════════════════════════
function showMedImageView() {
  currentView = 'medimage';
  hideAllViews();
  var mv = document.getElementById('medImageView');
  if (!mv) { mv = document.createElement('div'); mv.id='medImageView'; document.querySelector('.main').appendChild(mv); }
  mv.style.display = '';
  setNavActive('navMedImage');
  document.getElementById('pageTitle').textContent    = '🩻 Medical Image AI';
  document.getElementById('pageSubtitle').textContent = 'AI-assisted interpretation of X-rays, ECGs, skin, retinal and other medical images';

  mv.innerHTML =
    '<div style="display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start">' +
      '<div>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-sm)">' +
          '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:16px">🩻 Upload Medical Image</div>' +
          // Upload zone
          '<div id="medImgDropZone" style="border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:32px 16px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:14px"' +
            ' onclick="document.getElementById(\'medImgInput\').click()"' +
            ' ondragover="event.preventDefault();this.style.borderColor=\'var(--teal)\';this.style.background=\'var(--teal-pale)\'"' +
            ' ondragleave="this.style.borderColor=\'\';this.style.background=\'\'"' +
            ' ondrop="handleMedImgDrop(event)">' +
            '<div style="font-size:36px;margin-bottom:8px">🩻</div>' +
            '<div style="font-weight:600;color:var(--text-secondary)">Click to upload or drag & drop</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">X-Ray, ECG, Skin, Retinal, Pathology slides<br>JPG, PNG, WEBP (max 5MB)</div>' +
          '</div>' +
          '<input type="file" id="medImgInput" accept="image/*" style="display:none" onchange="handleMedImgSelect(event)">' +
          '<div id="medImgPreviewWrap" style="display:none;margin-bottom:14px">' +
            '<img id="medImgPreview" style="width:100%;border-radius:var(--radius-lg);border:1px solid var(--border);max-height:220px;object-fit:contain;background:#000">' +
            '<button onclick="clearMedImg()" style="margin-top:6px;width:100%;padding:5px;border:1px solid var(--border);border-radius:var(--radius);background:transparent;cursor:pointer;font-size:12px;color:var(--text-muted)">✕ Remove Image</button>' +
          '</div>' +
          '<div class="field" style="margin-bottom:10px"><label>Image Type</label>' +
            '<select id="medImgType">' +
              '<option value="xray">🫁 X-Ray (Chest/Bone)</option>' +
              '<option value="ecg">❤️ ECG / EKG</option>' +
              '<option value="skin">🩹 Skin Condition / Dermatology</option>' +
              '<option value="retinal">👁️ Retinal Scan / Fundoscopy</option>' +
              '<option value="pathology">🔬 Pathology Slide</option>' +
              '<option value="mri">🧠 MRI / CT Scan</option>' +
              '<option value="wound">🩸 Wound Assessment</option>' +
              '<option value="general">🏥 General Medical Image</option>' +
            '</select>' +
          '</div>' +
          '<div class="field" style="margin-bottom:10px"><label>Patient (optional)</label><input type="text" id="medImgPatient" placeholder="Patient name" list="medImgPatList"><datalist id="medImgPatList">'+patientRegistry.map(function(p){return'<option value="'+escAttr(p.name)+'">';}).join('')+'</datalist></div>' +
          '<div class="field" style="margin-bottom:14px"><label>Clinical Notes (optional)</label><textarea id="medImgNotes" rows="2" placeholder="e.g. 55M, smoker, presenting with chest pain and dyspnoea" style="resize:vertical"></textarea></div>' +
          '<button class="btn-add" onclick="analyseMedImage()" id="medImgBtn" style="width:100%;justify-content:center">🤖 Analyse Image</button>' +
        '</div>' +
      '</div>' +
      '<div id="medImgResult">' +
        '<div style="background:var(--surface);border:1px dashed var(--border2);border-radius:var(--radius-lg);padding:48px;text-align:center;color:var(--text-muted)">' +
          '<div style="font-size:52px;margin-bottom:14px">🩻</div>' +
          '<div style="font-size:16px;font-weight:600;margin-bottom:6px">Medical Image Analysis</div>' +
          '<div style="font-size:13px">Upload a medical image and click "Analyse Image"<br>to receive AI-assisted interpretation.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

var medImgBase64 = null;
var medImgMime   = 'image/jpeg';

function handleMedImgSelect(event) {
  var file = event.target.files[0];
  if (file) loadMedImg(file);
}

function handleMedImgDrop(event) {
  event.preventDefault();
  document.getElementById('medImgDropZone').style.borderColor='';
  document.getElementById('medImgDropZone').style.background='';
  var file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadMedImg(file);
}

function loadMedImg(file) {
  if (file.size > 5*1024*1024) { showToast('Image too large. Max 5MB.', 'error'); return; }
  medImgMime = file.type || 'image/jpeg';
  var reader = new FileReader();
  reader.onload = function(e) {
    medImgBase64 = e.target.result.split(',')[1];
    document.getElementById('medImgPreview').src = e.target.result;
    document.getElementById('medImgPreviewWrap').style.display = '';
    document.getElementById('medImgDropZone').style.display    = 'none';
  };
  reader.readAsDataURL(file);
}

function clearMedImg() {
  medImgBase64 = null;
  document.getElementById('medImgPreviewWrap').style.display = 'none';
  document.getElementById('medImgDropZone').style.display    = '';
  document.getElementById('medImgInput').value = '';
}

async function analyseMedImage() {
  if (!medImgBase64) { showToast('Please upload an image first.', 'error'); return; }

  var imgType  = document.getElementById('medImgType')?.value    || 'general';
  var patient  = document.getElementById('medImgPatient')?.value || '';
  var notes    = document.getElementById('medImgNotes')?.value   || '';

  var btn = document.getElementById('medImgBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Analysing…'; }

  var resultEl = document.getElementById('medImgResult');
  if (resultEl) resultEl.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;text-align:center;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🔍</div>Analysing image with AI…</div>';

  var typeLabels = { xray:'Chest/Bone X-Ray', ecg:'ECG/EKG', skin:'Dermatology', retinal:'Retinal/Fundoscopy', pathology:'Pathology Slide', mri:'MRI/CT Scan', wound:'Wound Assessment', general:'Medical Image' };
  var typeLabel = typeLabels[imgType] || 'Medical Image';

  var prompt = 'You are an expert radiologist and medical image interpreter at an Indian hospital.\n\n' +
    'Image Type: '+typeLabel+'\n'+(patient?'Patient: '+patient+'\n':'')+(notes?'Clinical context: '+notes+'\n':'')+'\n' +
    'Analyse this medical image and provide:\n\n' +
    '## Overall Impression\n[1-2 sentence summary of what you observe]\n\n' +
    '## Key Findings\n[Detailed description of visible structures, abnormalities, or notable features]\n\n' +
    '## Assessment\n[Clinical interpretation — what conditions or diagnoses do the findings suggest?]\n\n' +
    '## Differential Diagnosis\n[List possible conditions in order of likelihood]\n\n' +
    '## Recommended Actions\n[Follow-up imaging, tests, or clinical correlation needed]\n\n' +
    '## Image Quality\n[Comment on image quality and any limitations affecting interpretation]\n\n' +
    'Be specific, use proper medical terminology, and flag any urgent or critical findings with 🚨.';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1200,
        messages:[{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:medImgMime, data:medImgBase64 } },
          { type:'text', text:prompt }
        ]}]
      })
    });
    var data = await response.json();
    var text = (data.content||[]).map(function(b){return b.text||'';}).join('').trim();

    if (resultEl) {
      resultEl.innerHTML =
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-sm)">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">' +
            '<span style="font-size:24px">🩻</span>' +
            '<div><div style="font-weight:700;font-size:16px">Medical Image Analysis</div>' +
            '<div style="font-size:12px;color:var(--text-muted)">'+escHtml(typeLabel)+(patient?' · '+escHtml(patient):'')+' · AI-assisted</div></div>' +
            '<button class="btn-sm btn-outline-teal" style="margin-left:auto" onclick="printMedImageReport(\''+escAttr(patient||typeLabel)+'\')">🖨️ Print Report</button>' +
          '</div>' +
          '<div id="medImgReportContent" style="font-size:13.5px;line-height:1.7">'+markdownToHtml(text)+'</div>' +
          '<div style="margin-top:16px;padding:10px 14px;background:var(--red-bg);border-radius:var(--radius);border-left:3px solid var(--red);font-size:12px;color:var(--red)">' +
            '🔴 This is an AI-assisted interpretation for clinical reference only. Always correlate with clinical findings. Not a substitute for radiologist review.' +
          '</div>' +
        '</div>';
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:20px;color:var(--red)">Analysis failed. Check connection.<br><small>'+e.message+'</small></div>';
  }

  if (btn) { btn.disabled=false; btn.textContent='🤖 Analyse Image'; }
}

function printMedImageReport(label) {
  var content = document.getElementById('medImgReportContent')?.innerHTML || '';
  var imgSrc  = document.getElementById('medImgPreview')?.src || '';
  var w = window.open('','_blank'); if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><title>Medical Image Report</title>' +
    '<style>body{font-family:DM Sans,sans-serif;padding:30px;font-size:13px;color:#1a1a2e}h2{color:#0a7c6e;margin:16px 0 8px}img{max-width:320px;border-radius:8px}@media print{body{padding:0}}</style>' +
    '</head><body onload="window.print()"><h1 style="font-size:20px;color:#0f2240">🩻 Medical Image Analysis Report</h1>' +
    '<p style="color:#888;font-size:12px;margin-bottom:20px">'+escHtml(label)+' · Rx Vault · '+new Date().toLocaleDateString('en-IN')+'</p>' +
    (imgSrc?'<img src="'+imgSrc+'" style="margin-bottom:20px"><br>':'') +
    content+'<p style="color:#888;font-size:11px;margin-top:30px;border-top:1px solid #eee;padding-top:12px">AI-assisted report. Not a substitute for specialist radiological review.</p></body></html>');
  w.document.close();
}

// ════════════════════════════════════════════════════════════
//  UTILITY — Markdown to HTML converter (minimal)
// ════════════════════════════════════════════════════════════
function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.+)$/gm,'<h3 style="font-family:\'DM Serif Display\',serif;font-size:15px;color:var(--teal);margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border)">$1</h3>')
    .replace(/^### (.+)$/gm,'<h4 style="font-size:14px;font-weight:700;color:var(--text-primary);margin:12px 0 6px">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^- (.+)$/gm,'<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g,'<ul style="padding-left:20px;margin:6px 0">$&</ul>')
    .replace(/🔴/g,'<span style="color:var(--red)">🔴</span>')
    .replace(/⚠️/g,'<span style="color:var(--ayurveda)">⚠️</span>')
    .replace(/✅/g,'<span style="color:var(--green)">✅</span>')
    .replace(/🚨/g,'<span style="color:var(--red);font-weight:700">🚨</span>')
    .replace(/\n\n/g,'</p><p style="margin:6px 0">')
    .replace(/\n/g,'<br>');
}

// ════════════════════════════════════════════════════════════