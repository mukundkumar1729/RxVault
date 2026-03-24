// ════════════════════════════════════════════════════════════
//  FEATURES-LAB.JS
//  Lab Order Integration:
//  • Doctor sends lab investigation orders
//  • External results upload (file / manual entry)
//  • Tests done outside clinic — attach to patient record
//  • AI interpretation of results
//  Load order: after features-ai.js (uses callClaude / AI_PROXY_URL)
// ════════════════════════════════════════════════════════════

var labOrders = [];

// ─── DB helpers ───────────────────────────────────────────
async function dbGetLabOrders(clinicId) {
  var { data, error } = await db.from('lab_orders').select('*').eq('clinic_id', clinicId).order('ordered_on', { ascending: false });
  if (error) { console.error('[Lab]', error); return []; }
  return data || [];
}
async function dbUpsertLabOrder(order) {
  var { error } = await db.from('lab_orders').upsert(order, { onConflict:'id' });
  if (error) { console.error('[Lab upsert]', error); return false; }
  return true;
}

// ════════════════════════════════════════════════════════════
//  LAB VIEW — main entry point
// ════════════════════════════════════════════════════════════

async function showLabOrdersView() {
  currentView = 'labOrders';
  if (typeof hideAllViews === 'function') hideAllViews();
  ['stockView','analyticsView','outbreakView','vaccinationView','followupView','opdBoardView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var v = document.getElementById('labOrdersView');
  if (!v) { v = document.createElement('div'); v.id = 'labOrdersView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  if (typeof setNavActive === 'function') setNavActive('navLabOrders');
  document.getElementById('pageTitle').textContent    = '🔬 Lab Orders & Results';
  document.getElementById('pageSubtitle').textContent = 'Send investigation orders, upload results, attach external lab reports';
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';

  labOrders = await dbGetLabOrders(activeClinicId);
  renderLabView(v);
}

function renderLabView(container) {
  var pending  = labOrders.filter(function(o){ return o.status === 'ordered'; }).length;
  var received = labOrders.filter(function(o){ return o.status === 'received'; }).length;
  var reviewed = labOrders.filter(function(o){ return o.status === 'reviewed'; }).length;

  container.innerHTML =
    // Stats
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
      statCardLab('🔬', labOrders.length, 'Total Orders',  'var(--surface2)',      'var(--text-primary)') +
      statCardLab('⏳', pending,           'Awaiting Results','var(--allopathy-bg)','var(--allopathy)') +
      statCardLab('📥', received,          'Results In',   'var(--ayurveda-bg)',   'var(--ayurveda)') +
      statCardLab('✅', reviewed,          'Reviewed',     '#e8f5e9',             'var(--green)') +
    '</div>' +

    // Controls
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
      '<input type="text" id="labSearch" placeholder="🔍 Search patient, test, doctor…" oninput="filterLabOrders()" ' +
        'style="flex:1;min-width:200px;padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif">' +
      '<select id="labStatusFilter" onchange="filterLabOrders()" style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="all">All Status</option>' +
        '<option value="ordered">⏳ Awaiting Results</option>' +
        '<option value="received">📥 Results In</option>' +
        '<option value="reviewed">✅ Reviewed</option>' +
        '<option value="external">📎 External / Outside</option>' +
      '</select>' +
      '<button class="btn-add" onclick="openNewLabOrder()" style="padding:9px 16px;font-size:13px;white-space:nowrap">🔬 New Order</button>' +
      '<button class="btn-sm btn-outline-teal" onclick="openExternalResult()" style="white-space:nowrap">📎 Attach External</button>' +
    '</div>' +

    '<div id="labOrdersList"></div>';

  filterLabOrders();
}

function statCardLab(icon, value, label, bg, clr) {
  return '<div style="background:' + bg + ';border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 18px;display:flex;align-items:center;gap:10px;flex:1;min-width:110px">' +
    '<div style="font-size:22px">' + icon + '</div>' +
    '<div><div style="font-size:22px;font-weight:700;color:' + clr + ';font-family:\'DM Serif Display\',serif">' + value + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">' + label + '</div></div>' +
  '</div>';
}

function filterLabOrders() {
  var q      = (document.getElementById('labSearch')?.value || '').toLowerCase().trim();
  var status = document.getElementById('labStatusFilter')?.value || 'all';
  var list   = labOrders.filter(function(o) {
    if (status !== 'all' && o.status !== status) return false;
    if (q) {
      return [(o.patient_name||''), (o.test_name||''), (o.doctor_name||''), (o.lab_name||'')].join(' ').toLowerCase().includes(q);
    }
    return true;
  });
  var container = document.getElementById('labOrdersList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:10px">🔬</div>No lab orders found.</div>';
    return;
  }
  var statusColors = {
    ordered:  ['var(--allopathy-bg)', 'var(--allopathy)', '⏳ Awaiting'],
    received: ['var(--ayurveda-bg)',  'var(--ayurveda)',  '📥 Results In'],
    reviewed: ['#e8f5e9',             'var(--green)',     '✅ Reviewed'],
    external: ['var(--teal-pale)',    'var(--teal)',      '📎 External'],
  };
  container.innerHTML = list.map(function(order) {
    var sc = statusColors[order.status] || statusColors.ordered;
    var hasResult = !!(order.result_text || order.result_file_url);
    var daysSince = Math.floor((Date.now() - new Date(order.ordered_on)) / 86400000);
    var urgent    = order.status === 'ordered' && daysSince > 2;
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:10px;overflow:hidden' + (urgent ? ';border-left:3px solid var(--red)' : '') + '">' +
      '<div style="padding:14px 18px;display:flex;align-items:flex-start;gap:12px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<span style="font-weight:700;font-size:14px">' + escHtml(order.patient_name||'—') + '</span>' +
            '<span style="background:var(--bg);border:1px solid var(--border);font-size:11px;padding:2px 8px;border-radius:6px;font-family:monospace">' + escHtml(order.test_name||'—') + '</span>' +
            (order.external ? '<span style="background:var(--teal-pale);color:var(--teal);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">📎 External Lab</span>' : '') +
          '</div>' +
          '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap">' +
            (order.doctor_name ? '<span>🩺 Dr. ' + escHtml(order.doctor_name) + '</span>' : '') +
            '<span>📅 ' + formatDate((order.ordered_on||'').split('T')[0]) + '</span>' +
            (order.lab_name ? '<span>🏥 ' + escHtml(order.lab_name) + '</span>' : '') +
            (urgent ? '<span style="color:var(--red);font-weight:600">⚠️ ' + daysSince + ' days, no result</span>' : '') +
          '</div>' +
          (order.clinical_notes ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">' + escHtml(order.clinical_notes) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">' +
          '<span style="background:' + sc[0] + ';color:' + sc[1] + ';font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px">' + sc[2] + '</span>' +
        '</div>' +
      '</div>' +
      // Result section
      (hasResult
        ? '<div style="padding:12px 18px;border-top:1px solid var(--border);background:var(--surface2)">' +
            '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">Result</div>' +
            (order.result_text ? '<div style="font-size:13px;line-height:1.6;white-space:pre-wrap">' + escHtml(order.result_text) + '</div>' : '') +
            (order.result_file_url ? '<a href="' + escAttr(order.result_file_url) + '" target="_blank" style="font-size:12px;color:var(--teal)">📄 View attached report</a>' : '') +
            (order.ai_interpretation ? '<div style="margin-top:10px;background:var(--teal-pale);border-left:3px solid var(--teal);padding:10px 14px;border-radius:4px;font-size:12.5px">' +
              '<div style="font-weight:700;color:var(--teal);margin-bottom:4px">🤖 AI Interpretation</div>' +
              '<div>' + escHtml(order.ai_interpretation) + '</div></div>' : '') +
          '</div>'
        : '') +
      // Actions
      '<div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
        (order.status === 'ordered'
          ? '<button onclick="openUploadResult(\'' + order.id + '\')" class="btn-sm btn-teal" style="font-size:12px">📥 Upload Result</button>'
          : '') +
        (hasResult && order.status !== 'reviewed'
          ? '<button onclick="markLabReviewed(\'' + order.id + '\')" class="btn-sm btn-outline-teal" style="font-size:12px">✅ Mark Reviewed</button>'
          : '') +
        (hasResult && !order.ai_interpretation
          ? '<button onclick="interpretLabResult(\'' + order.id + '\')" class="btn-sm" style="font-size:12px;border:1px solid var(--homeopathy);color:var(--homeopathy);background:transparent;border-radius:7px;padding:6px 12px;cursor:pointer;font-family:DM Sans,sans-serif">🤖 AI Interpret</button>'
          : '') +
        '<button onclick="deleteLabOrder(\'' + order.id + '\')" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─── New Lab Order modal ──────────────────────────────────
function openNewLabOrder(patientName) {
  var overlay = document.getElementById('labOrderOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'labOrderOverlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }
  var patOpts = patientRegistry.map(function(p){ return '<option value="' + escAttr(p.name) + '">'; }).join('');
  var docOpts = doctorRegistry.map(function(d){ return '<option value="' + escAttr(d.name) + '">Dr. ' + escHtml(d.name) + '</option>'; }).join('');
  var commonTests = ['CBC (Complete Blood Count)','LFT (Liver Function Test)','KFT (Kidney Function Test)',
    'Blood Sugar Fasting','Blood Sugar PP','HbA1c','Thyroid (TSH/T3/T4)','Lipid Profile','Urine Routine',
    'Urine Culture','Blood Culture','Chest X-Ray','ECG','2D Echo','Ultrasound Abdomen','CT Scan','MRI',
    'Dengue NS1/IgM','Malaria Antigen','Widal Test','CRP/ESR','Serum Electrolytes','Vitamin D','Vitamin B12',
    'Iron Studies','HIV','HBsAg','HCV','Coagulation profile','Sputum AFB','HRCT Chest','Bone Marrow Biopsy'];

  overlay.innerHTML =
    '<div class="modal" style="max-width:560px">' +
      '<div class="modal-header"><div><div class="modal-title">🔬 New Lab Order</div>' +
        '<div class="modal-subtitle">Send investigation order — internal lab or outside lab</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'labOrderOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Patient <span>*</span></label>' +
            '<input type="text" id="loPatient" list="loPats" placeholder="Patient name" value="' + escAttr(patientName||'') + '">' +
            '<datalist id="loPats">' + patOpts + '</datalist></div>' +
          '<div class="field"><label>Ordering Doctor</label>' +
            '<select id="loDoctor"><option value="">— Select —</option>' + docOpts + '</select></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:12px"><label>Investigation / Test <span>*</span></label>' +
          '<input type="text" id="loTest" list="loTests" placeholder="e.g. CBC, LFT, Chest X-Ray">' +
          '<datalist id="loTests">' + commonTests.map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</datalist></div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Lab / Centre</label>' +
            '<input type="text" id="loLab" placeholder="e.g. Dr. Lal PathLabs, SRL, Internal"></div>' +
          '<div class="field"><label>Urgency</label>' +
            '<select id="loUrgency"><option value="routine">Routine</option><option value="urgent">Urgent (24h)</option><option value="stat">STAT (immediate)</option></select></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:12px"><label>Clinical Notes / Indication</label>' +
          '<textarea id="loNotes" rows="2" placeholder="e.g. Fever for 5 days, suspect dengue. Check NS1 and CBC." style="resize:vertical"></textarea></div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
            '<input type="checkbox" id="loExternal"> ' +
            '<span>Test done at <strong>outside / external</strong> lab (not ordered by this clinic)</span>' +
          '</label></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'labOrderOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveLabOrder()">🔬 Send Order</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

async function saveLabOrder() {
  var patient  = (document.getElementById('loPatient')?.value || '').trim();
  var test     = (document.getElementById('loTest')?.value    || '').trim();
  var doctor   = document.getElementById('loDoctor')?.value   || '';
  var lab      = (document.getElementById('loLab')?.value     || '').trim();
  var urgency  = document.getElementById('loUrgency')?.value  || 'routine';
  var notes    = (document.getElementById('loNotes')?.value   || '').trim();
  var external = !!document.getElementById('loExternal')?.checked;
  if (!patient || !test) { showToast('Patient and test name are required.', 'error'); return; }
  var order = {
    id:            'lab_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    clinic_id:     activeClinicId,
    patient_name:  patient,
    test_name:     test,
    doctor_name:   doctor,
    lab_name:      lab,
    urgency,
    clinical_notes: notes,
    external,
    status:        external ? 'received' : 'ordered',
    ordered_on:    new Date().toISOString(),
  };
  var ok = await dbUpsertLabOrder(order);
  if (!ok) { showToast('Failed to save order.', 'error'); return; }
  labOrders.unshift(order);
  closeOverlay('labOrderOverlay');
  showToast('🔬 Lab order created for ' + patient, 'success');
  renderLabView(document.getElementById('labOrdersView'));
}

// ─── Upload Result modal ─────────────────────────────────
function openUploadResult(orderId) {
  var order = labOrders.find(function(o){ return o.id === orderId; }); if (!order) return;
  var overlay = document.getElementById('labResultOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'labResultOverlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }
  overlay.innerHTML =
    '<div class="modal" style="max-width:560px">' +
      '<div class="modal-header"><div><div class="modal-title">📥 Upload Lab Result</div>' +
        '<div class="modal-subtitle">' + escHtml(order.patient_name) + ' · ' + escHtml(order.test_name) + '</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'labResultOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Paste Result Values</label>' +
          '<textarea id="lrResultText" rows="6" placeholder="Paste lab report values here:\ne.g. Hemoglobin: 10.2 g/dL\nWBC: 11,500 /µL\nPlatelets: 420,000 /µL\nCreatinine: 1.8 mg/dL" style="resize:vertical;min-height:140px"></textarea></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Or Upload PDF / Image</label>' +
          '<div id="lrDropZone" style="border:2px dashed var(--border2);border-radius:var(--radius);padding:20px;text-align:center;cursor:pointer" ' +
            'onclick="document.getElementById(\'lrFile\').click()" ' +
            'ondragover="event.preventDefault();this.style.borderColor=\'var(--teal)\'" ' +
            'ondragleave="this.style.borderColor=\'\'" ' +
            'ondrop="lrHandleDrop(event)">' +
            '<div style="font-size:24px;margin-bottom:6px">📄</div>' +
            '<div style="font-size:13px;color:var(--text-muted)">Click or drag PDF/image here</div>' +
          '</div>' +
          '<input type="file" id="lrFile" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="lrHandleSelect(event)">' +
          '<div id="lrFileInfo" style="font-size:12px;color:var(--teal);margin-top:6px"></div></div>' +
        '<div class="field" style="margin-bottom:0"><label>Lab / Reference Range Notes</label>' +
          '<input type="text" id="lrLabNotes" placeholder="e.g. Values from Dr. Lal PathLabs, report date 18 Mar 2026"></div>' +
        '<div id="lrError" style="color:var(--red);font-size:12.5px;min-height:16px;margin-top:8px"></div>' +
        '<div id="smartParseLoader" style="display:none; margin-top:10px; padding:10px; background:var(--teal-pale); border-radius:8px; font-size:12px; color:var(--teal);">' +
          '✨ AI is parsing your report... Please wait.' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer" style="justify-content:space-between">' +
        '<button class="btn-sm" onclick="smartParseLabReport()" style="background:var(--indigo); color:#fff; border:none; border-radius:7px; padding:8px 16px; cursor:pointer; font-weight:600; font-size:12px;">✨ Smart Parse (AI)</button>' +
        '<div>' +
          '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'labResultOverlay\')">Cancel</button>' +
          '<button class="btn-sm btn-teal" onclick="saveLabResult(\'' + orderId + '\')">💾 Save Result</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

var _lrFileBase64 = null;
var _lrFileMime   = null;
function lrHandleDrop(e) {
  e.preventDefault();
  document.getElementById('lrDropZone').style.borderColor = '';
  var file = e.dataTransfer.files[0]; if (file) lrLoadFile(file);
}
function lrHandleSelect(e) {
  var file = e.target.files[0]; if (file) lrLoadFile(file);
}
function lrLoadFile(file) {
  if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', 'error'); return; }
  _lrFileMime = file.type;
  var r = new FileReader();
  r.onload = function(e) {
    _lrFileBase64 = e.target.result;
    var info = document.getElementById('lrFileInfo');
    if (info) info.textContent = '✅ ' + file.name + ' (' + Math.round(file.size/1024) + ' KB) attached';
  };
  r.readAsDataURL(file);
}

async function saveLabResult(orderId) {
  var order     = labOrders.find(function(o){ return o.id === orderId; }); if (!order) return;
  var resultText = (document.getElementById('lrResultText')?.value || '').trim();
  var labNotes  = (document.getElementById('lrLabNotes')?.value || '').trim();
  if (!resultText && !_lrFileBase64) {
    document.getElementById('lrError').textContent = 'Enter result values or attach a file.';
    return;
  }
  order.result_text    = resultText;
  order.result_file_b64 = _lrFileBase64 || null;
  order.result_file_mime = _lrFileMime || null;
  order.result_lab_notes = labNotes;
  order.received_on    = new Date().toISOString();
  order.status         = 'received';
  _lrFileBase64 = null; _lrFileMime = null;
  var ok = await dbUpsertLabOrder(order);
  if (!ok) { showToast('Failed to save result.', 'error'); return; }
  closeOverlay('labResultOverlay');
  showToast('📥 Result saved for ' + order.patient_name, 'success');
  renderLabView(document.getElementById('labOrdersView'));
}

// ─── Attach External Result ───────────────────────────────
function openExternalResult() {
  // Same as new order but pre-checked as external
  openNewLabOrder();
  setTimeout(function() {
    var cb = document.getElementById('loExternal');
    if (cb) cb.checked = true;
    var title = document.querySelector('#labOrderOverlay .modal-title');
    if (title) title.textContent = '📎 Attach External Lab Result';
    var sub = document.querySelector('#labOrderOverlay .modal-subtitle');
    if (sub) sub.textContent = 'Record a test done outside this clinic — attaches to patient record';
  }, 50);
}

// ─── Mark Reviewed ────────────────────────────────────────
async function markLabReviewed(orderId) {
  var order = labOrders.find(function(o){ return o.id === orderId; }); if (!order) return;
  order.status      = 'reviewed';
  order.reviewed_on = new Date().toISOString();
  await dbUpsertLabOrder(order);
  showToast('✅ Marked as reviewed', 'success');
  renderLabView(document.getElementById('labOrdersView'));
}

async function deleteLabOrder(orderId) {
  if (!confirm('Delete this lab order?')) return;
  await db.from('lab_orders').delete().eq('id', orderId);
  labOrders = labOrders.filter(function(o){ return o.id !== orderId; });
  showToast('Deleted.', 'info');
  renderLabView(document.getElementById('labOrdersView'));
}

// ─── AI Interpretation ────────────────────────────────────
async function interpretLabResult(orderId) {
  var order = labOrders.find(function(o){ return o.id === orderId; }); if (!order) return;
  if (!order.result_text) { showToast('No text result to interpret. Paste values first.', 'error'); return; }
  showToast('🤖 Running AI interpretation…', 'info');

  var proxyUrl = typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://wavakcolrtrwmjcjkdfc.supabase.co/functions/v1/claude-proxy';
  try {
    var resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: 'You are a clinical assistant interpreting a lab report for Indian clinic Rx Vault. ' +
            'Test: ' + order.test_name + '\nPatient: ' + order.patient_name + '\n\nResults:\n' + order.result_text + '\n\n' +
            'Provide a brief (3-5 sentence) clinical interpretation: what is notable, what is normal, and one key clinical recommendation. Be concise and direct.'
        }]
      })
    });
    var data = await resp.json();
    var text = (data.content||[]).map(function(b){ return b.text||''; }).join('').trim();
    order.ai_interpretation = text;
    await dbUpsertLabOrder(order);
    showToast('🤖 AI interpretation complete', 'success');
    renderLabView(document.getElementById('labOrdersView'));
  } catch(e) {
    showToast('AI interpretation failed: ' + e.message, 'error');
  }
}

// ─── Wire "Lab" button onto Rx cards ─────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (typeof renderAdminDoctorList !== 'undefined') return; // guard
});

// Add "🔬 Order Lab" quick action to prescription cards
document.addEventListener('DOMContentLoaded', function() {
  if (typeof renderCard === 'function') {
    var _origCard = renderCard;
    renderCard = function(p, q, allTerms) {
      var html = _origCard(p, q, allTerms);
      return html.replace(
        '<button class="icon-btn print"',
        '<button class="icon-btn" title="Order Lab Test" onclick="event.stopPropagation();openNewLabOrder(\'' + escAttr(p.patientName||'') + '\')" style="font-size:14px">🔬</button>' +
        '<button class="icon-btn print"'
      );
    };
  }
});
async function smartParseLabReport() {
  var text = document.getElementById('lrResultText')?.value || '';
  if (!text && !_lrFileBase64) {
    showToast('Please paste report text or attach a file first.', 'error');
    return;
  }

  var loader = document.getElementById('smartParseLoader');
  if (loader) loader.style.display = 'block';

  try {
    var proxyUrl = typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://wavakcolrtrwmjcjkdfc.supabase.co/functions/v1/claude-proxy';
    var resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{
          role: 'user',
          content: 'Extract lab test values from this report text/data. Return ONLY a structured plain text list.\n' +
            'Format: Test Name: Value Unit (Reference Range)\n' +
            'Example: Hemoglobin: 13.5 g/dL (12-16)\n\n' +
            'Data:\n' + text + (_lrFileBase64 ? '\n[IMAGE DATA ATTACHED]' : '')
        }]
      })
    });
    var data = await resp.json();
    var result = (data.content||[]).map(b => b.text || '').join('').trim();
    
    if (result) {
      document.getElementById('lrResultText').value = result;
      showToast('✨ Smart Parse successful!', 'success');
    }
  } catch(e) {
    console.error('[SmartParse]', e);
    showToast('AI Parsing failed. Please enter manually.', 'error');
  } finally {
    if (loader) loader.style.display = 'none';
  }
}
