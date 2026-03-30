// ════════════════════════════════════════════════════════════
//  FEATURES-VITALS.JS — Services & Vitals Panel
//  Inline vitals entry from prescription cards.
//  Services: BP, Height/Weight/BMI, Blood Sugar, Temp/SpO2/Pulse
//  Load order: after features.js, before features-ai.js
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  DB HELPERS
// ════════════════════════════════════════════════════════════

async function dbGetVitalsForPrescription(prescriptionId) {
  var { data, error } = await db
    .from('vitals')
    .select('*')
    .eq('prescription_id', prescriptionId)
    .order('recorded_at', { ascending: false });
  if (error) { console.error('[Vitals]', error); return []; }
  return data || [];
}

async function dbGetVitalsForPatient(clinicId, patientName) {
  var { data, error } = await db
    .from('vitals')
    .select('*')
    .eq('clinic_id', clinicId)
    .ilike('patient_name', patientName)
    .order('recorded_at', { ascending: false })
    .limit(20);
  if (error) { console.error('[Vitals]', error); return []; }
  return data || [];
}

async function dbSaveVitals(record) {
  var { error } = await db.from('vitals').insert(record);
  if (error) { console.error('[Vitals save]', error); return false; }
  return true;
}

async function dbDeleteVitals(id) {
  var { error } = await db.from('vitals').delete().eq('id', id);
  if (error) { console.error('[Vitals delete]', error); return false; }
  return true;
}

// ════════════════════════════════════════════════════════════
//  OPEN SERVICES PANEL (inline, from Rx card)
// ════════════════════════════════════════════════════════════

/**
 * Opens the floating services overlay, pre-linked to a prescription.
 * @param {string} rxId - The prescription ID
 */
async function openServicesPanel(rxId) {
  var rx = prescriptions.find(function(p) { return p.id === rxId; });
  if (!rx) { showToast('Prescription not found.', 'error'); return; }

  // Create overlay if needed
  var overlay = document.getElementById('servicesPanelOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'servicesPanelOverlay';
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeServicesPanel();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = _renderServicesPanel(rx, []);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

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
  // Load existing vitals for this prescription in background
  var existing = await dbGetVitalsForPrescription(rxId);
  // Re-render with history
  overlay.innerHTML = _renderServicesPanel(rx, existing);
  _bindServicesPanelEvents(rxId);
}

function closeServicesPanel() {
  var overlay = document.getElementById('servicesPanelOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ════════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════════

function _renderServicesPanel(rx, existingVitals) {
  var hasHistory = existingVitals && existingVitals.length > 0;
  var latest     = existingVitals && existingVitals[0];

  // Pre-fill from latest if available
  var pre = latest || {};

  var bmi = '';
  if (pre.weight && pre.height) {
    var b = parseFloat(pre.weight) / Math.pow(parseFloat(pre.height) / 100, 2);
    bmi = b.toFixed(1);
  }

  return (
    '<div class="modal" style="max-width:680px">' +

      // ── Header ──
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-title" style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:22px">🩺</span> Services &amp; Vitals' +
          '</div>' +
          '<div class="modal-subtitle">' +
            escHtml(rx.patientName) + ' &nbsp;·&nbsp; ' +
            'Rx ' + escHtml(rx.date) +
            (rx.doctorName ? ' &nbsp;·&nbsp; Dr. ' + escHtml(rx.doctorName) : '') +
          '</div>' +
        '</div>' +
        '<button class="modal-close" onclick="closeServicesPanel()">✕</button>' +
      '</div>' +

      '<div class="modal-body" style="padding:0">' +

        // ── Service tabs ──
        '<div style="display:flex;border-bottom:2px solid var(--border);background:var(--surface2);overflow-x:auto">' +
          _serviceTab('svc-bp',     'svgTabBtn', '❤️', 'Blood Pressure', true) +
          _serviceTab('svc-anthro', 'svgTabBtn', '⚖️', 'Height & Weight') +
          _serviceTab('svc-sugar',  'svgTabBtn', '🩸', 'Blood Sugar') +
          _serviceTab('svc-temp',   'svgTabBtn', '🌡️', 'Temp / SpO2 / Pulse') +
        '</div>' +

        // ── Service panels ──
        '<div style="padding:22px 24px">' +

          // — BP Panel —
          '<div id="svc-bp" class="svc-panel">' +
            _svcSectionTitle('❤️ Blood Pressure', 'Normal: 90–120 / 60–80 mmHg') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
              _svcInput('svcBpSys',  'Systolic (mmHg)',  'number', pre.bp_systolic  || '', '120', 'e.g. 120') +
              _svcInput('svcBpDia',  'Diastolic (mmHg)', 'number', pre.bp_diastolic || '', '80',  'e.g. 80') +
            '</div>' +
            _svcInput('svcPulse',  'Pulse Rate (bpm)',  'number', pre.pulse || '', '72', 'e.g. 72') +
            '<div id="svcBpAlert" style="margin-top:12px"></div>' +
          '</div>' +

          // — Height/Weight Panel —
          '<div id="svc-anthro" class="svc-panel" style="display:none">' +
            _svcSectionTitle('⚖️ Height & Weight', 'BMI: &lt;18.5 Underweight · 18.5–25 Normal · 25–30 Overweight · &gt;30 Obese') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
              _svcInput('svcWeight', 'Weight (kg)', 'number', pre.weight || '', '70', 'e.g. 70') +
              _svcInput('svcHeight', 'Height (cm)', 'number', pre.height || '', '165', 'e.g. 165') +
            '</div>' +
            '<div id="svcBmiResult" style="background:linear-gradient(135deg,var(--teal-pale),#f0fdf4);border:1px solid rgba(10,124,110,0.2);border-radius:var(--radius-lg);padding:16px 20px;text-align:center">' +
              (bmi
                ? _bmiDisplay(bmi)
                : '<div style="color:var(--text-muted);font-size:13px">Enter height and weight to calculate BMI</div>') +
            '</div>' +
          '</div>' +

          // — Blood Sugar Panel —
          '<div id="svc-sugar" class="svc-panel" style="display:none">' +
            _svcSectionTitle('🩸 Blood Sugar', 'Normal: Fasting &lt;100 · PP &lt;140 · Random &lt;200 (mg/dL)') +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">' +
              _svcInput('svcSugarF',  'Fasting (mg/dL)',    'number', pre.sugar_fasting || '', '90',  'e.g. 90') +
              _svcInput('svcSugarPP', 'Post-Meal (mg/dL)',  'number', pre.sugar_pp      || '', '130', 'e.g. 130') +
              _svcInput('svcSugarR',  'Random (mg/dL)',     'number', pre.sugar_random  || '', '110', 'e.g. 110') +
            '</div>' +
            '<div id="svcSugarAlert" style="margin-top:4px"></div>' +
          '</div>' +

          // — Temp / SpO2 / Pulse Panel —
          '<div id="svc-temp" class="svc-panel" style="display:none">' +
            _svcSectionTitle('🌡️ Temperature, SpO₂ & Other', 'Normal Temp: 97–99°F · SpO₂: 95–100%') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
              _svcInput('svcTemp',  'Temperature (°F)',  'number', pre.temperature || '', '98.6', 'e.g. 98.6') +
              _svcInput('svcSpo2',  'SpO₂ (%)',          'number', pre.spo2        || '', '98',   'e.g. 98') +
            '</div>' +
            '<div id="svcTempAlert" style="margin-top:4px"></div>' +
          '</div>' +

          // ── Abnormality alerts ──
          '<div id="svcAbnormAlerts" style="margin-top:4px"></div>' +

          // ── Notes for this recording ──
          '<div class="field" style="margin-top:16px">' +
            '<label style="font-size:12px;font-weight:600;color:var(--text-secondary)">Recording Notes</label>' +
            '<input type="text" id="svcNotes" placeholder="e.g. Patient was seated for 5 minutes before BP measurement" ' +
              'value="' + escAttr(pre.notes || '') + '" ' +
              'style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;margin-top:5px">' +
          '</div>' +

        '</div>' + // end panels container

        // ── History ──
        (hasHistory ? _renderVitalsHistory(existingVitals) : '') +

      '</div>' + // end modal-body

      // ── Footer ──
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeServicesPanel()">Cancel</button>' +
        '<button class="btn-sm btn-teal" id="svcSaveBtn" onclick="saveServicesVitals(\'' + rx.id + '\')">' +
          '💾 Save Vitals' +
        '</button>' +
      '</div>' +

    '</div>'
  );
}

// ── Tab helper ──
function _serviceTab(targetId, cls, icon, label, active) {
  return (
    '<button class="svc-tab-btn' + (active ? ' svc-tab-active' : '') + '" ' +
      'onclick="switchServiceTab(\'' + targetId + '\')" ' +
      'style="flex-shrink:0;display:flex;align-items:center;gap:7px;padding:13px 18px;border:none;' +
        'background:transparent;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;' +
        'cursor:pointer;color:' + (active ? 'var(--teal)' : 'var(--text-muted)') + ';' +
        'border-bottom:' + (active ? '2px solid var(--teal)' : '2px solid transparent') + ';' +
        'transition:all 0.15s;white-space:nowrap" ' +
      'data-tab="' + targetId + '">' +
      '<span style="font-size:16px">' + icon + '</span>' + label +
    '</button>'
  );
}

// ── Section title ──
function _svcSectionTitle(title, hint) {
  return (
    '<div style="margin-bottom:16px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text-primary)">' + title + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">' + hint + '</div>' +
    '</div>'
  );
}

// ── Input helper ──
function _svcInput(id, label, type, value, placeholder, title) {
  return (
    '<div class="field">' +
      '<label style="font-size:12px;font-weight:600;color:var(--text-secondary)">' + label + '</label>' +
      '<input type="' + type + '" id="' + id + '" ' +
        'value="' + escAttr(value) + '" ' +
        'placeholder="' + escAttr(placeholder) + '" ' +
        'title="' + escAttr(title) + '" ' +
        'step="any" min="0" ' +
        'oninput="onSvcInputChange()" ' +
        'style="margin-top:5px;width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:DM Sans,sans-serif;font-size:14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s" ' +
        'onfocus="this.style.borderColor=\'var(--teal)\';this.style.boxShadow=\'0 0 0 3px rgba(10,124,110,0.1)\'" ' +
        'onblur="this.style.borderColor=\'\';this.style.boxShadow=\'\'">' +
    '</div>'
  );
}

// ── BMI display ──
function _bmiDisplay(bmi) {
  var b = parseFloat(bmi);
  var cat, clr, bg, emoji;
  if (b < 18.5)      { cat = 'Underweight'; clr = 'var(--allopathy)'; bg = 'var(--allopathy-bg)'; emoji = '🔵'; }
  else if (b < 25)   { cat = 'Normal';      clr = 'var(--green)';     bg = '#e8f5e9';              emoji = '✅'; }
  else if (b < 30)   { cat = 'Overweight';  clr = 'var(--ayurveda)';  bg = 'var(--ayurveda-bg)';  emoji = '⚠️'; }
  else               { cat = 'Obese';       clr = 'var(--red)';       bg = 'var(--red-bg)';        emoji = '🔴'; }

  return (
    '<div style="display:flex;align-items:center;justify-content:center;gap:24px">' +
      '<div style="text-align:center">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:4px">BMI</div>' +
        '<div style="font-family:DM Serif Display,serif;font-size:42px;font-weight:700;color:' + clr + ';line-height:1">' + b.toFixed(1) + '</div>' +
      '</div>' +
      '<div style="background:' + bg + ';border:1px solid ' + clr + '22;padding:10px 20px;border-radius:12px;text-align:center">' +
        '<div style="font-size:22px;margin-bottom:4px">' + emoji + '</div>' +
        '<div style="font-size:14px;font-weight:700;color:' + clr + '">' + cat + '</div>' +
      '</div>' +
    '</div>'
  );
}

// ── Vitals history table ──
function _renderVitalsHistory(vitals) {
  var rows = vitals.slice(0, 8).map(function(v) {
    var bmi = '';
    if (v.weight && v.height) {
      var b = parseFloat(v.weight) / Math.pow(parseFloat(v.height) / 100, 2);
      bmi = b.toFixed(1);
    }
    var bp = v.bp_systolic ? (v.bp_systolic + '/' + v.bp_diastolic) : '—';
    var bpFlag  = (v.bp_systolic > 140 || v.bp_diastolic > 90) ? '🔴' : (v.bp_systolic < 90 ? '🔵' : '');
    var sugarF  = v.sugar_fasting || '—';
    var tempFlag = (v.temperature && v.temperature > 100.4) ? (v.temperature > 103 ? '🔴' : '🟠') : '';
    var spo2Flag = (v.spo2 && v.spo2 < 95) ? '🔴' : '';
    return (
      '<tr style="border-bottom:1px solid var(--border);transition:background 0.12s" ' +
        'onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">' +
        '<td style="padding:8px 12px;font-size:11.5px;color:var(--text-muted);white-space:nowrap">' +
          new Date(v.recorded_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) +
        '</td>' +
        '<td style="padding:8px 12px;font-weight:600">' + bpFlag + ' ' + escHtml(bp) + '</td>' +
        '<td style="padding:8px 12px">' + (v.pulse ? v.pulse + ' bpm' : '—') + '</td>' +
        '<td style="padding:8px 12px">' + (v.temperature ? v.temperature + '°F ' + tempFlag : '—') + '</td>' +
        '<td style="padding:8px 12px">' + (v.sugar_fasting ? sugarF + ' mg/dL' : '—') + '</td>' +
        '<td style="padding:8px 12px">' + (v.spo2 ? v.spo2 + '% ' + spo2Flag : '—') + '</td>' +
        '<td style="padding:8px 12px">' + (v.weight ? v.weight + ' kg' : '—') + '</td>' +
        '<td style="padding:8px 12px">' + (bmi ? bmi : '—') + '</td>' +
        '<td style="padding:8px 12px">' +
          '<button onclick="deleteVitalsRecord(\'' + v.id + '\')" ' +
            'style="font-size:11px;padding:2px 7px;border:1px solid var(--border);border-radius:5px;background:transparent;color:var(--text-muted);cursor:pointer" ' +
            'title="Delete">🗑️</button>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  return (
    '<div style="border-top:1px solid var(--border)">' +
      '<div style="padding:14px 24px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">📈 Previous Recordings</div>' +
      '<div style="overflow-x:auto;padding:0 0 4px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:700px">' +
          '<thead><tr style="background:var(--surface2)">' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Date & Time</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">BP</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Pulse</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Temp</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Sugar (F)</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">SpO₂</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Weight</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">BMI</th>' +
            '<th style="padding:8px 12px"></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>'
  );
}

// ════════════════════════════════════════════════════════════
//  TAB SWITCHING
// ════════════════════════════════════════════════════════════

function switchServiceTab(targetId) {
  // Hide all panels
  document.querySelectorAll('.svc-panel').forEach(function(p) { p.style.display = 'none'; });
  var target = document.getElementById(targetId);
  if (target) target.style.display = '';

  // Update tab styles
  document.querySelectorAll('.svc-tab-btn').forEach(function(btn) {
    var isActive = btn.dataset.tab === targetId;
    btn.style.color        = isActive ? 'var(--teal)' : 'var(--text-muted)';
    btn.style.borderBottom = isActive ? '2px solid var(--teal)' : '2px solid transparent';
  });
}

// ════════════════════════════════════════════════════════════
//  LIVE VALIDATION & BMI CALC
// ════════════════════════════════════════════════════════════

function onSvcInputChange() {
  _calcBMILive();
  _checkAbnormalities();
}

function _calcBMILive() {
  var w = parseFloat(document.getElementById('svcWeight')?.value);
  var h = parseFloat(document.getElementById('svcHeight')?.value);
  var el = document.getElementById('svcBmiResult');
  if (!el) return;
  if (w > 0 && h > 0) {
    var bmi = w / Math.pow(h / 100, 2);
    el.innerHTML = _bmiDisplay(bmi.toFixed(1));
  } else {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Enter height and weight to calculate BMI</div>';
  }
}

function _checkAbnormalities() {
  var alerts = [];

  // BP checks
  var sys = parseFloat(document.getElementById('svcBpSys')?.value);
  var dia = parseFloat(document.getElementById('svcBpDia')?.value);
  if (sys > 0 && dia > 0) {
    if (sys >= 180 || dia >= 120) alerts.push({ type: 'red', msg: '🚨 Hypertensive Crisis — BP ' + sys + '/' + dia + ' mmHg. Immediate attention required.' });
    else if (sys >= 140 || dia >= 90) alerts.push({ type: 'orange', msg: '⚠️ Stage 2 Hypertension — BP ' + sys + '/' + dia + ' mmHg.' });
    else if (sys >= 130 || dia >= 80) alerts.push({ type: 'yellow', msg: '⚠️ Stage 1 Hypertension — BP ' + sys + '/' + dia + ' mmHg.' });
    else if (sys < 90 || dia < 60) alerts.push({ type: 'blue', msg: '🔵 Low Blood Pressure (Hypotension) — BP ' + sys + '/' + dia + ' mmHg.' });
  }

  // Pulse
  var pulse = parseFloat(document.getElementById('svcPulse')?.value);
  if (pulse > 0) {
    if (pulse > 100) alerts.push({ type: 'orange', msg: '⚠️ Elevated Pulse Rate — ' + pulse + ' bpm (Tachycardia).' });
    else if (pulse < 60) alerts.push({ type: 'blue', msg: '🔵 Low Pulse Rate — ' + pulse + ' bpm (Bradycardia).' });
  }

  // Temperature
  var temp = parseFloat(document.getElementById('svcTemp')?.value);
  if (temp > 0) {
    if (temp >= 103) alerts.push({ type: 'red', msg: '🚨 High Fever — ' + temp + '°F. Seek immediate attention.' });
    else if (temp >= 100.4) alerts.push({ type: 'orange', msg: '⚠️ Fever — ' + temp + '°F.' });
    else if (temp < 96) alerts.push({ type: 'blue', msg: '🔵 Hypothermia risk — Temp ' + temp + '°F.' });
  }

  // SpO2
  var spo2 = parseFloat(document.getElementById('svcSpo2')?.value);
  if (spo2 > 0) {
    if (spo2 < 90) alerts.push({ type: 'red', msg: '🚨 Critical Low SpO₂ — ' + spo2 + '%. Emergency intervention needed.' });
    else if (spo2 < 95) alerts.push({ type: 'orange', msg: '⚠️ Low SpO₂ — ' + spo2 + '%. Supplemental oxygen may be needed.' });
  }

  // Blood Sugar
  var sugarF = parseFloat(document.getElementById('svcSugarF')?.value);
  var sugarPP= parseFloat(document.getElementById('svcSugarPP')?.value);
  var sugarR = parseFloat(document.getElementById('svcSugarR')?.value);
  if (sugarF > 0) {
    if (sugarF >= 126) alerts.push({ type: 'orange', msg: '⚠️ High Fasting Blood Sugar — ' + sugarF + ' mg/dL (Diabetes range).' });
    else if (sugarF >= 100) alerts.push({ type: 'yellow', msg: '⚠️ Impaired Fasting Glucose — ' + sugarF + ' mg/dL (Pre-diabetes range).' });
    else if (sugarF < 70) alerts.push({ type: 'red', msg: '🚨 Hypoglycemia — Fasting Sugar ' + sugarF + ' mg/dL. Immediate glucose intake needed.' });
  }
  if (sugarPP >= 200) alerts.push({ type: 'orange', msg: '⚠️ High Post-Meal Sugar — ' + sugarPP + ' mg/dL (Diabetic range).' });
  if (sugarR  >= 200) alerts.push({ type: 'orange', msg: '⚠️ High Random Blood Sugar — ' + sugarR + ' mg/dL.' });

  // Render into main alert box
  var container = document.getElementById('svcAbnormAlerts');
  if (!container) return;
  if (!alerts.length) { container.innerHTML = ''; return; }

  var colorMap = {
    red:    { bg: 'var(--red-bg)',       border: 'var(--red)',       text: 'var(--red)' },
    orange: { bg: 'var(--ayurveda-bg)',  border: 'var(--ayurveda)',  text: 'var(--ayurveda)' },
    yellow: { bg: '#fffbeb',             border: '#d97706',          text: '#92600a' },
    blue:   { bg: 'var(--allopathy-bg)', border: 'var(--allopathy)', text: 'var(--allopathy)' },
  };

  container.innerHTML = alerts.map(function(a) {
    var c = colorMap[a.type] || colorMap.orange;
    return (
      '<div style="background:' + c.bg + ';border:1px solid ' + c.border + ';border-radius:var(--radius);' +
        'padding:9px 14px;margin-bottom:6px;font-size:12.5px;color:' + c.text + ';font-weight:600">' +
        a.msg +
      '</div>'
    );
  }).join('');
}

// ════════════════════════════════════════════════════════════
//  SAVE
// ════════════════════════════════════════════════════════════

async function saveServicesVitals(rxId) {
  var rx = prescriptions.find(function(p) { return p.id === rxId; });
  if (!rx) return;

  var getNum = function(id) {
    var el = document.getElementById(id);
    if (!el || !el.value) return null;
    var v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  };
  var getStr = function(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  // Collect all values
  var bpSys  = getNum('svcBpSys');
  var bpDia  = getNum('svcBpDia');
  var pulse  = getNum('svcPulse');
  var weight = getNum('svcWeight');
  var height = getNum('svcHeight');
  var sugarF = getNum('svcSugarF');
  var sugarPP= getNum('svcSugarPP');
  var sugarR = getNum('svcSugarR');
  var temp   = getNum('svcTemp');
  var spo2   = getNum('svcSpo2');
  var notes  = getStr('svcNotes');

  // At least one value required
  var hasAny = [bpSys, bpDia, pulse, weight, height, sugarF, sugarPP, sugarR, temp, spo2]
    .some(function(v) { return v !== null; });
  if (!hasAny) {
    showToast('Please enter at least one measurement.', 'error');
    return;
  }

  // Disable button
  var btn = document.getElementById('svcSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }

  var record = {
    id:              'vit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    clinic_id:       activeClinicId,
    prescription_id: rxId,
    patient_name:    rx.patientName,
    bp_systolic:     bpSys,
    bp_diastolic:    bpDia,
    pulse:           pulse,
    weight:          weight,
    height:          height,
    sugar_fasting:   sugarF,
    sugar_pp:        sugarPP,
    sugar_random:    sugarR,
    temperature:     temp,
    spo2:            spo2,
    notes:           notes || '',
    recorded_at:     new Date().toISOString(),
  };

  var ok = await dbSaveVitals(record);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Save Vitals'; }

  if (!ok) { showToast('Failed to save vitals.', 'error'); return; }

  // Build summary for toast
  var summary = [];
  if (bpSys && bpDia) summary.push('BP ' + bpSys + '/' + bpDia);
  if (pulse)   summary.push('Pulse ' + pulse + ' bpm');
  if (weight)  summary.push(weight + ' kg');
  if (sugarF)  summary.push('Sugar(F) ' + sugarF);
  if (temp)    summary.push(temp + '°F');
  if (spo2)    summary.push('SpO₂ ' + spo2 + '%');

  showToast('✅ Vitals saved: ' + summary.join(' · '), 'success');

  // Update the Rx card badge (shows vitals count)
  _updateRxVitalsBadge(rxId);

  // Re-open panel with updated history
  await openServicesPanel(rxId);
}

// ════════════════════════════════════════════════════════════
//  DELETE
// ════════════════════════════════════════════════════════════

async function deleteVitalsRecord(vitalsId) {
  if (!confirm('Delete this vitals record?')) return;
  var ok = await dbDeleteVitals(vitalsId);
  if (!ok) { showToast('Failed to delete.', 'error'); return; }
  showToast('Deleted.', 'info');
  // Re-render — find the rxId from the currently open panel
  var btn = document.getElementById('svcSaveBtn');
  if (btn && btn.getAttribute('onclick')) {
    var match = btn.getAttribute('onclick').match(/'([^']+)'/);
    if (match) { await openServicesPanel(match[1]); }
  }
}

// ════════════════════════════════════════════════════════════
//  RX CARD BADGE UPDATE
// ════════════════════════════════════════════════════════════

/**
 * After saving, update the "📊 Vitals" badge on the Rx card
 * to show the count of recordings.
 */
async function _updateRxVitalsBadge(rxId) {
  var existing = await dbGetVitalsForPrescription(rxId);
  var badge = document.getElementById('svc_badge_' + rxId);
  if (badge && existing.length > 0) {
    badge.textContent = existing.length;
    badge.style.display = 'inline-flex';
  }
}

/**
 * Load vitals count for all visible Rx cards (called after render).
 */
async function loadAllRxVitalsBadges() {
  var badges = document.querySelectorAll('[id^="svc_badge_"]');
  for (var i = 0; i < badges.length; i++) {
    var rxId = badges[i].id.replace('svc_badge_', '');
    try {
      var data = await dbGetVitalsForPrescription(rxId);
      if (data && data.length > 0) {
        badges[i].textContent = data.length;
        badges[i].style.display = 'inline-flex';
      }
    } catch(e) {}
  }
}

// ════════════════════════════════════════════════════════════
//  VITALS FOR PRINT — called by printPrescription()
// ════════════════════════════════════════════════════════════

/**
 * Returns an HTML string of the latest vitals for a prescription,
 * suitable for inclusion in the printed Rx.
 */
async function getVitalsPrintBlock(rxId) {
  var vitals = await dbGetVitalsForPrescription(rxId);
  if (!vitals || !vitals.length) return '';

  var v = vitals[0]; // latest

  var rows = [];
  var bp = v.bp_systolic ? (v.bp_systolic + '/' + v.bp_diastolic + ' mmHg') : null;
  var bmi = null;
  if (v.weight && v.height) {
    var b = parseFloat(v.weight) / Math.pow(parseFloat(v.height) / 100, 2);
    bmi = b.toFixed(1);
  }

  if (bp)                rows.push(['Blood Pressure', bp]);
  if (v.pulse)           rows.push(['Pulse Rate',     v.pulse + ' bpm']);
  if (v.temperature)     rows.push(['Temperature',    v.temperature + '°F']);
  if (v.spo2)            rows.push(['SpO₂',           v.spo2 + '%']);
  if (v.weight)          rows.push(['Weight',         v.weight + ' kg']);
  if (v.height)          rows.push(['Height',         v.height + ' cm']);
  if (bmi)               rows.push(['BMI',            bmi]);
  if (v.sugar_fasting)   rows.push(['Blood Sugar (Fasting)', v.sugar_fasting + ' mg/dL']);
  if (v.sugar_pp)        rows.push(['Blood Sugar (PP)',      v.sugar_pp + ' mg/dL']);
  if (v.sugar_random)    rows.push(['Blood Sugar (Random)',  v.sugar_random + ' mg/dL']);

  if (!rows.length) return '';

  var recordedDate = new Date(v.recorded_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    '<h2>🩺 Vitals &amp; Measurements <span style="font-size:11px;font-weight:400;color:#888">Recorded: ' + recordedDate + '</span></h2>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">' +
      rows.map(function(r) {
        return '<div style="background:#f7fafc;border-radius:6px;padding:9px 12px;border:1px solid #eee">' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8fa0b3;margin-bottom:3px">' + r[0] + '</div>' +
          '<div style="font-size:14px;font-weight:700;color:#1a1a2e">' + r[1] + '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    (v.notes ? '<div style="font-size:12px;color:#666;margin-bottom:16px;">📝 Vitals note: ' + v.notes + '</div>' : '')
  );
}

// ════════════════════════════════════════════════════════════
//  EVENT BINDING (called after panel renders)
// ════════════════════════════════════════════════════════════

function _bindServicesPanelEvents(rxId) {
  // Trigger initial BMI calc and abnormality check
  onSvcInputChange();
}

// ════════════════════════════════════════════════════════════
//  INIT — hook into applyFilters / renderList to load badges
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  // After any render, load vitals badges with a debounce
  var _badgeTimer = null;
  var _origApplyFilters = typeof applyFilters === 'function' ? applyFilters : null;
  if (_origApplyFilters) {
    applyFilters = function() {
      _origApplyFilters.apply(this, arguments);
      clearTimeout(_badgeTimer);
      _badgeTimer = setTimeout(loadAllRxVitalsBadges, 600);
    };
  }
});
