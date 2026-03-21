// ════════════════════════════════════════════════════════════
//  FEATURES-OPD.JS
//  1. OPD Token Display Board  — public waiting-room screen URL
//  2. Vaccination Tracker      — paediatric immunisation schedules
//  3. Follow-up Reminders      — auto-schedule next-visit reminders
//  Load order: after features.js
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  MODULE 1: OPD TOKEN DISPLAY BOARD
// ════════════════════════════════════════════════════════════

function showOpdBoardView() {
  currentView = 'opdBoard';
  if (typeof hideAllViews === 'function') hideAllViews();
  ['stockView','analyticsView','outbreakView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var v = document.getElementById('opdBoardView');
  if (!v) { v = document.createElement('div'); v.id = 'opdBoardView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  if (typeof setNavActive === 'function') setNavActive('navOpdBoard');
  document.getElementById('pageTitle').textContent    = '📺 OPD Token Display Board';
  document.getElementById('pageSubtitle').textContent = 'Real-time waiting-room display — open in a separate browser tab for the TV screen';
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  renderOpdBoardManager(v);
}

function renderOpdBoardManager(container) {
  var boardUrl = window.location.origin + window.location.pathname + '?opdboard=' + activeClinicId;
  var todayAppts = (typeof appointments !== 'undefined' ? appointments : []).filter(function(a){
    return a.appt_date === todayISO() || !a.appt_date;
  });
  var currentToken = todayAppts.filter(function(a){ return a.status === 'in-room'; })
    .sort(function(a,b){ return (a.token_no||0) - (b.token_no||0); })[0];
  var waiting = todayAppts.filter(function(a){ return a.status === 'waiting'; }).length;
  var done    = todayAppts.filter(function(a){ return a.status === 'done'; }).length;

  container.innerHTML =
    // Live preview card
    '<div style="background:linear-gradient(135deg,#0f2240 0%,#1a3a60 100%);border-radius:var(--radius-lg);padding:32px;margin-bottom:20px;text-align:center;position:relative;overflow:hidden">' +
      '<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.5);margin-bottom:8px">Now Serving</div>' +
      '<div id="opdBoardTokenDisplay" style="font-family:\'DM Serif Display\',serif;font-size:88px;font-weight:700;color:#fff;line-height:1">' +
        (currentToken ? currentToken.token_no : '—') +
      '</div>' +
      (currentToken
        ? '<div style="font-size:18px;color:rgba(255,255,255,0.8);margin-top:8px">' + escHtml(currentToken.patient_name) + (currentToken.doctor_name ? ' · Dr. ' + escHtml(currentToken.doctor_name) : '') + '</div>'
        : '<div style="font-size:16px;color:rgba(255,255,255,0.5);margin-top:8px">No patient currently in room</div>') +
      '<div style="display:flex;justify-content:center;gap:40px;margin-top:24px">' +
        '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:#fff">' + waiting + '</div><div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em">Waiting</div></div>' +
        '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:#4ade80">' + done + '</div><div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em">Done today</div></div>' +
      '</div>' +
    '</div>' +

    // Share URL
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:16px">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px">📺 Display Board URL — open on the waiting room TV</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<code style="flex:1;background:var(--bg);padding:10px 14px;border-radius:var(--radius);font-size:12.5px;border:1px solid var(--border);overflow-x:auto;white-space:nowrap">' + boardUrl + '</code>' +
        '<button onclick="navigator.clipboard.writeText(\'' + boardUrl + '\').then(function(){ showToast(\'URL copied!\', \'success\'); })" class="btn-sm btn-teal">📋 Copy</button>' +
        '<button onclick="window.open(\'' + boardUrl + '\',\'_blank\')" class="btn-sm btn-outline-teal">📺 Open</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:8px">Auto-refreshes every 10 seconds. Works on any browser — Chromecast, Smart TV, tablet, phone.</div>' +
    '</div>' +

    // Today\'s queue
    '<div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 Today\'s Queue (' + todayAppts.length + ' appointments)</div>' +
    '<div style="display:flex;flex-direction:column;gap:6px">' +
    todayAppts.sort(function(a,b){ return (a.token_no||0)-(b.token_no||0); }).map(function(a) {
      var colors = { waiting:'var(--allopathy)', 'in-room':'var(--teal)', done:'var(--green)', cancelled:'var(--text-muted)' };
      var clr = colors[a.status] || 'var(--text-muted)';
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;display:flex;align-items:center;gap:12px">' +
        '<div style="background:var(--teal);color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0">' + (a.token_no||'?') + '</div>' +
        '<div style="flex:1"><div style="font-weight:600">' + escHtml(a.patient_name) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted)">' + (a.doctor_name ? 'Dr. ' + escHtml(a.doctor_name) + ' · ' : '') + (a.appt_time || '') + '</div></div>' +
        '<span style="color:' + clr + ';font-size:12px;font-weight:700">' + (a.status||'').toUpperCase() + '</span>' +
      '</div>';
    }).join('') +
    (todayAppts.length === 0 ? '<div style="padding:24px;text-align:center;color:var(--text-muted)">No appointments today</div>' : '') +
    '</div>';

  // Auto-refresh every 30s
  if (currentView === 'opdBoard') {
    setTimeout(function(){ if (currentView === 'opdBoard') renderOpdBoardManager(container); }, 30000);
  }
}

// Public display board — rendered when URL has ?opdboard= param
function maybeRenderPublicBoard() {
  var params = new URLSearchParams(window.location.search);
  var clinicId = params.get('opdboard');
  if (!clinicId) return false;

  document.body.style.background = '#0a1628';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.innerHTML = '<div id="publicBoard" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:DM Serif Display,serif;color:#fff;text-align:center;padding:40px"></div>';

  async function refreshBoard() {
    try {
      var data = await db.from('appointments').select('*').eq('clinic_id', clinicId).eq('appt_date', todayISO()).order('token_no');
      var appts = data.data || [];
      var current = appts.find(function(a){ return a.status === 'in-room'; });
      var waiting = appts.filter(function(a){ return a.status === 'waiting'; }).length;
      var done    = appts.filter(function(a){ return a.status === 'done'; }).length;
      var clinic  = await db.from('clinics').select('*').eq('id', clinicId).single();

      document.getElementById('publicBoard').innerHTML =
        '<div style="font-size:18px;font-family:DM Sans,sans-serif;color:rgba(255,255,255,0.5);letter-spacing:.14em;text-transform:uppercase;margin-bottom:12px">' +
          (clinic.data?.name || 'OPD Queue') +
        '</div>' +
        '<div style="font-size:20px;font-family:DM Sans,sans-serif;color:rgba(255,255,255,0.4);margin-bottom:24px">Now Serving</div>' +
        '<div style="font-size:200px;font-weight:700;line-height:1;margin-bottom:20px;color:#fff">' + (current ? current.token_no : '—') + '</div>' +
        (current
          ? '<div style="font-size:32px;color:rgba(255,255,255,0.8);margin-bottom:40px;font-family:DM Sans,sans-serif">' + (current.patient_name||'') + (current.doctor_name ? ' · Dr. ' + current.doctor_name : '') + '</div>'
          : '<div style="font-size:28px;color:rgba(255,255,255,0.3);margin-bottom:40px;font-family:DM Sans,sans-serif">No patient in room</div>') +
        '<div style="display:flex;gap:80px">' +
          '<div><div style="font-size:64px;font-weight:700">' + waiting + '</div><div style="font-size:18px;color:rgba(255,255,255,0.5);font-family:DM Sans,sans-serif;text-transform:uppercase;letter-spacing:.1em">Waiting</div></div>' +
          '<div><div style="font-size:64px;font-weight:700;color:#4ade80">' + done + '</div><div style="font-size:18px;color:rgba(255,255,255,0.5);font-family:DM Sans,sans-serif;text-transform:uppercase;letter-spacing:.1em">Seen Today</div></div>' +
        '</div>' +
        '<div style="position:fixed;bottom:24px;font-size:14px;font-family:DM Sans,sans-serif;color:rgba(255,255,255,0.2)">' + new Date().toLocaleTimeString('en-IN') + '</div>';
    } catch(e) { console.error('Board refresh error', e); }
    setTimeout(refreshBoard, 10000);
  }
  refreshBoard();
  return true;
}

// ════════════════════════════════════════════════════════════
//  MODULE 2: VACCINATION TRACKER
// ════════════════════════════════════════════════════════════

var VACCINE_SCHEDULE = [
  { name:'BCG',            age_days: 0,    type:'birth',    description:'At birth' },
  { name:'OPV-0',          age_days: 0,    type:'birth',    description:'At birth' },
  { name:'Hepatitis B-1',  age_days: 0,    type:'birth',    description:'At birth' },
  { name:'OPV-1 + IPV-1',  age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'DTwP/DTaP-1',    age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'Hib-1',          age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'Hepatitis B-2',  age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'Rotavirus-1',    age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'PCV-1',          age_days: 42,   type:'6w',       description:'6 weeks' },
  { name:'OPV-2 + IPV-2',  age_days: 70,   type:'10w',      description:'10 weeks' },
  { name:'DTwP/DTaP-2',    age_days: 70,   type:'10w',      description:'10 weeks' },
  { name:'Hib-2',          age_days: 70,   type:'10w',      description:'10 weeks' },
  { name:'Hepatitis B-3',  age_days: 70,   type:'10w',      description:'10 weeks' },
  { name:'Rotavirus-2',    age_days: 70,   type:'10w',      description:'10 weeks' },
  { name:'OPV-3',          age_days: 98,   type:'14w',      description:'14 weeks' },
  { name:'DTwP/DTaP-3',    age_days: 98,   type:'14w',      description:'14 weeks' },
  { name:'Hib-3',          age_days: 98,   type:'14w',      description:'14 weeks' },
  { name:'PCV-2',          age_days: 98,   type:'14w',      description:'14 weeks' },
  { name:'Rotavirus-3',    age_days: 98,   type:'14w',      description:'14 weeks' },
  { name:'MMR-1',          age_days: 274,  type:'9m',       description:'9 months' },
  { name:'Typhoid conj.',  age_days: 274,  type:'9m',       description:'9 months' },
  { name:'PCV booster',    age_days: 365,  type:'12m',      description:'12 months' },
  { name:'Hib booster',    age_days: 365,  type:'12m',      description:'12 months' },
  { name:'Hepatitis A-1',  age_days: 365,  type:'12m',      description:'12 months' },
  { name:'Varicella-1',    age_days: 365,  type:'12m',      description:'12 months' },
  { name:'MMR-2',          age_days: 548,  type:'15m',      description:'15 months' },
  { name:'DTwP/DTaP-B1',   age_days: 548,  type:'15m',      description:'15-18 months booster' },
  { name:'IPV booster',    age_days: 548,  type:'15m',      description:'15-18 months booster' },
  { name:'Hepatitis A-2',  age_days: 548,  type:'18m',      description:'18 months' },
  { name:'Varicella-2',    age_days: 548,  type:'18m',      description:'18 months' },
  { name:'DTwP/DTaP-B2',   age_days: 1825, type:'5y',       description:'5 years booster' },
  { name:'OPV booster',    age_days: 1825, type:'5y',       description:'5 years booster' },
  { name:'MMR-3',          age_days: 1825, type:'5y',       description:'5 years' },
  { name:'Tdap / Td',      age_days: 4015, type:'11y',      description:'10–12 years' },
  { name:'HPV-1',          age_days: 4015, type:'11y',      description:'11+ years (girls)' },
];

function showVaccinationView() {
  currentView = 'vaccination';
  if (typeof hideAllViews === 'function') hideAllViews();
  ['stockView','analyticsView','outbreakView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var v = document.getElementById('vaccinationView');
  if (!v) { v = document.createElement('div'); v.id = 'vaccinationView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  if (typeof setNavActive === 'function') setNavActive('navVaccination');
  document.getElementById('pageTitle').textContent    = '💉 Vaccination Tracker';
  document.getElementById('pageSubtitle').textContent = 'Immunisation schedules, due dates and overdue alerts for paediatric patients';
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  renderVaccinationView(v);
}

function renderVaccinationView(container) {
  var paedPatients = patientRegistry.filter(function(p){ return p.age && parseInt(p.age) <= 14; });
  var allOverdue = 0, allDueSoon = 0;
  paedPatients.forEach(function(p) {
    var s = getVaccineStatus(p);
    allOverdue  += s.overdue.length;
    allDueSoon  += s.dueSoon.length;
  });

  container.innerHTML =
    // Stats
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 20px;display:flex;align-items:center;gap:10px;flex:1">' +
        '<div style="font-size:24px">👶</div><div><div style="font-size:24px;font-weight:700">' + paedPatients.length + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Paediatric patients</div></div></div>' +
      '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:14px 20px;display:flex;align-items:center;gap:10px;flex:1;cursor:pointer" onclick="document.getElementById(\'vaccFilter\').value=\'overdue\';renderVaccinationList()">' +
        '<div style="font-size:24px">🔴</div><div><div style="font-size:24px;font-weight:700;color:var(--red)">' + allOverdue + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Overdue doses</div></div></div>' +
      '<div style="background:var(--ayurveda-bg);border:1px solid rgba(180,83,9,0.3);border-radius:var(--radius-lg);padding:14px 20px;display:flex;align-items:center;gap:10px;flex:1;cursor:pointer" onclick="document.getElementById(\'vaccFilter\').value=\'due\';renderVaccinationList()">' +
        '<div style="font-size:24px">⚠️</div><div><div style="font-size:24px;font-weight:700;color:var(--ayurveda)">' + allDueSoon + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Due this month</div></div></div>' +
    '</div>' +

    // Controls
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
      '<input type="text" id="vaccSearch" placeholder="🔍 Search patient…" oninput="renderVaccinationList()" ' +
        'style="flex:1;padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif">' +
      '<select id="vaccFilter" onchange="renderVaccinationList()" style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="all">All patients (≤14 yrs)</option>' +
        '<option value="overdue">🔴 Overdue only</option>' +
        '<option value="due">⚠️ Due this month</option>' +
      '</select>' +
    '</div>' +
    '<div id="vaccList"></div>';

  renderVaccinationList();
}

function getVaccineStatus(patient) {
  if (!patient.dob && !patient.age) return { overdue:[], dueSoon:[], upcoming:[], given:patient.vaccinations||[] };
  var dob = patient.dob ? new Date(patient.dob + 'T00:00:00') : new Date(Date.now() - parseInt(patient.age||0) * 365.25 * 24 * 60 * 60 * 1000);
  var given = (patient.vaccinations || []).map(function(v){ return v.name.toLowerCase(); });
  var today = new Date(); today.setHours(0,0,0,0);
  var overdue = [], dueSoon = [], upcoming = [];

  VACCINE_SCHEDULE.forEach(function(v) {
    if (given.some(function(g){ return g.includes(v.name.toLowerCase().split('-')[0]); })) return;
    var dueDate = new Date(dob.getTime() + v.age_days * 86400000);
    var daysLeft = Math.ceil((dueDate - today) / 86400000);
    if (daysLeft < 0) overdue.push({ vaccine:v, daysOverdue: Math.abs(daysLeft), dueDate });
    else if (daysLeft <= 30) dueSoon.push({ vaccine:v, daysLeft, dueDate });
    else upcoming.push({ vaccine:v, daysLeft, dueDate });
  });
  return { overdue, dueSoon, upcoming, given: patient.vaccinations || [] };
}

function renderVaccinationList() {
  var q      = (document.getElementById('vaccSearch')?.value || '').toLowerCase().trim();
  var filter = document.getElementById('vaccFilter')?.value || 'all';
  var list   = document.getElementById('vaccList');
  if (!list) return;

  var patients = patientRegistry.filter(function(p) {
    if (!p.age || parseInt(p.age) > 14) return false;
    if (q && !(p.name||'').toLowerCase().includes(q)) return false;
    if (filter === 'overdue') return getVaccineStatus(p).overdue.length > 0;
    if (filter === 'due')     return getVaccineStatus(p).dueSoon.length > 0;
    return true;
  });

  if (!patients.length) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No patients match this filter.</div>';
    return;
  }

  list.innerHTML = patients.map(function(p) {
    var s = getVaccineStatus(p);
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:12px;overflow:hidden">' +
      '<div style="padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid var(--border)" ' +
        'onclick="this.nextSibling.style.display=this.nextSibling.style.display===\'none\'?\'block\':\'none\'">' +
        '<div style="flex:1"><div style="font-weight:700;font-size:14px">' + escHtml(p.name) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted)">' + (p.age ? p.age + ' yrs' : '') + (p.dob ? ' · DOB: ' + formatDate(p.dob) : '') + '</div></div>' +
        '<div style="display:flex;gap:6px">' +
          (s.overdue.length ? '<span style="background:var(--red-bg);color:var(--red);font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px">🔴 ' + s.overdue.length + ' Overdue</span>' : '') +
          (s.dueSoon.length ? '<span style="background:var(--ayurveda-bg);color:var(--ayurveda);font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px">⚠️ ' + s.dueSoon.length + ' Due soon</span>' : '') +
          (!s.overdue.length && !s.dueSoon.length ? '<span style="background:#e8f5e9;color:var(--green);font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px">✅ On schedule</span>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:none;padding:14px 18px">' +
        (s.overdue.length ? '<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px">OVERDUE</div>' +
          s.overdue.map(function(item){ return '<div style="background:var(--red-bg);border-radius:6px;padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">' + escHtml(item.vaccine.name) + '</span><span style="font-size:12px;color:var(--red)">' + item.daysOverdue + ' days overdue</span><button onclick="markVaccineGiven(\'' + escAttr(p.name) + '\',\'' + escAttr(item.vaccine.name) + '\')" style="font-size:11px;padding:3px 10px;border:1px solid var(--green);border-radius:6px;background:transparent;color:var(--green);cursor:pointer">✓ Mark Given</button></div>'; }).join('') : '') +
        (s.dueSoon.length ? '<div style="font-size:12px;font-weight:700;color:var(--ayurveda);margin:8px 0">DUE SOON</div>' +
          s.dueSoon.map(function(item){ return '<div style="background:var(--ayurveda-bg);border-radius:6px;padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">' + escHtml(item.vaccine.name) + '</span><span style="font-size:12px;color:var(--ayurveda)">Due in ' + item.daysLeft + ' days</span><button onclick="markVaccineGiven(\'' + escAttr(p.name) + '\',\'' + escAttr(item.vaccine.name) + '\')" style="font-size:11px;padding:3px 10px;border:1px solid var(--green);border-radius:6px;background:transparent;color:var(--green);cursor:pointer">✓ Mark Given</button></div>'; }).join('') : '') +
        (s.given.length ? '<div style="font-size:12px;font-weight:700;color:var(--green);margin:8px 0">COMPLETED (' + s.given.length + ')</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + s.given.map(function(v){ return '<span style="background:#e8f5e9;color:var(--green);font-size:11px;padding:3px 9px;border-radius:10px">✓ ' + escHtml(v.name) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

async function markVaccineGiven(patientName, vaccineName) {
  var patient = patientRegistry.find(function(p){ return (p.name||'').trim().toLowerCase() === patientName.toLowerCase(); });
  if (!patient) return;
  if (!patient.vaccinations) patient.vaccinations = [];
  if (patient.vaccinations.some(function(v){ return v.name.toLowerCase() === vaccineName.toLowerCase(); })) {
    showToast('Already recorded.', 'info'); return;
  }
  patient.vaccinations.push({ name: vaccineName, givenOn: new Date().toISOString(), givenBy: activeClinicId });
  await dbUpsertPatient(patient);
  showToast('✅ ' + vaccineName + ' marked as given for ' + patient.name, 'success');
  renderVaccinationView(document.getElementById('vaccinationView'));
}

// ════════════════════════════════════════════════════════════
//  MODULE 3: FOLLOW-UP REMINDERS
// ════════════════════════════════════════════════════════════

var FOLLOWUP_DEFAULTS = {
  'diabetes':          14, 'diabetic':      14, 'hba1c':        14,
  'hypertension':      14, 'blood pressure': 14, 'thyroid':      30,
  'fever':              7, 'infection':       7, 'urti':          7,
  'asthma':            30, 'copd':           30, 'cardiac':       14,
  'pregnancy':          7, 'antenatal':       7, 'post-op':       7,
  'default':           30,
};

function getFollowupDays(diagnosis) {
  if (!diagnosis) return FOLLOWUP_DEFAULTS.default;
  var d = diagnosis.toLowerCase();
  for (var key in FOLLOWUP_DEFAULTS) {
    if (d.includes(key)) return FOLLOWUP_DEFAULTS[key];
  }
  return FOLLOWUP_DEFAULTS.default;
}

function showFollowupView() {
  currentView = 'followup';
  if (typeof hideAllViews === 'function') hideAllViews();
  ['stockView','analyticsView','outbreakView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var v = document.getElementById('followupView');
  if (!v) { v = document.createElement('div'); v.id = 'followupView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  if (typeof setNavActive === 'function') setNavActive('navFollowup');
  document.getElementById('pageTitle').textContent    = '📅 Follow-up Reminders';
  document.getElementById('pageSubtitle').textContent = 'Auto-scheduled next-visit reminders based on diagnosis';
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  renderFollowupView(v);
}

function renderFollowupView(container) {
  var today = new Date(); today.setHours(0,0,0,0);

  var reminders = prescriptions.filter(function(rx){ return rx.status === 'active'; }).map(function(rx) {
    var followupDate = rx.followupDate
      ? new Date(rx.followupDate + 'T00:00:00')
      : new Date(new Date(rx.date + 'T00:00:00').getTime() + getFollowupDays(rx.diagnosis) * 86400000);
    var daysLeft = Math.ceil((followupDate - today) / 86400000);
    return { rx, followupDate, daysLeft };
  }).sort(function(a,b){ return a.daysLeft - b.daysLeft; });

  var overdue = reminders.filter(function(r){ return r.daysLeft < 0; });
  var today2  = reminders.filter(function(r){ return r.daysLeft === 0; });
  var week    = reminders.filter(function(r){ return r.daysLeft > 0 && r.daysLeft <= 7; });
  var later   = reminders.filter(function(r){ return r.daysLeft > 7; });

  var stats = [
    { label:'Overdue',    val:overdue.length, bg:'var(--red-bg)',       clr:'var(--red)' },
    { label:'Today',      val:today2.length,  bg:'var(--ayurveda-bg)',  clr:'var(--ayurveda)' },
    { label:'This week',  val:week.length,    bg:'var(--allopathy-bg)', clr:'var(--allopathy)' },
    { label:'Upcoming',   val:later.length,   bg:'var(--surface2)',     clr:'var(--text-primary)' },
  ];

  container.innerHTML =
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
      stats.map(function(s){
        return '<div style="background:' + s.bg + ';border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 20px;flex:1;min-width:110px">' +
          '<div style="font-size:26px;font-weight:700;color:' + s.clr + '">' + s.val + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">' + s.label + '</div></div>';
      }).join('') +
    '</div>';

  function renderGroup(title, items, urgency) {
    if (!items.length) return '';
    var urgColors = {
      red:   ['var(--red-bg)',       'var(--red)',       '🔴'],
      amber: ['var(--ayurveda-bg)',  'var(--ayurveda)',  '🟠'],
      blue:  ['var(--allopathy-bg)', 'var(--allopathy)', '🔵'],
      gray:  ['var(--surface2)',     'var(--text-muted)','⚪'],
    };
    var uc = urgColors[urgency] || urgColors.gray;
    return '<div style="font-size:13px;font-weight:700;margin:16px 0 8px;display:flex;align-items:center;gap:6px">' + uc[2] + ' ' + title + ' (' + items.length + ')</div>' +
      items.map(function(r) {
        var label = r.daysLeft < 0 ? Math.abs(r.daysLeft) + ' days overdue'
          : r.daysLeft === 0 ? 'Due TODAY'
          : 'Due in ' + r.daysLeft + ' days — ' + formatDate(r.followupDate.toISOString().split('T')[0]);
        return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:13.5px">' + escHtml(r.rx.patientName) + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">🩺 Dr. ' + escHtml(r.rx.doctorName||'—') + ' · 🔬 ' + escHtml(r.rx.diagnosis||'—') + '</div>' +
            '<div style="font-size:12px;margin-top:3px;color:' + uc[1] + ';font-weight:600">' + label + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<button onclick="setFollowupDate(\'' + r.rx.id + '\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">📅 Reschedule</button>' +
            (r.rx.email || r.rx.phone
              ? '<button onclick="sendFollowupReminder(\'' + r.rx.id + '\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);cursor:pointer">📧 Notify</button>'
              : '') +
          '</div>' +
        '</div>';
      }).join('');
  }

  container.innerHTML +=
    renderGroup('Overdue', overdue, 'red') +
    renderGroup('Due Today', today2, 'amber') +
    renderGroup('Due This Week', week, 'blue') +
    renderGroup('Upcoming', later, 'gray') +
    (reminders.length === 0 ? '<div style="padding:32px;text-align:center;color:var(--text-muted)">No active prescriptions with follow-up reminders.</div>' : '');
}

function setFollowupDate(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  var overlay = document.getElementById('followupDateOverlay');
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'followupDateOverlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay);
  }
  overlay.innerHTML =
    '<div class="modal" style="max-width:380px">' +
      '<div class="modal-header"><div><div class="modal-title">📅 Set Follow-up Date</div>' +
        '<div class="modal-subtitle">' + escHtml(rx.patientName) + '</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'followupDateOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="field"><label>Follow-up Date</label>' +
          '<input type="date" id="followupDateInput" value="' + (rx.followupDate || '') + '"></div>' +
        '<div class="field" style="margin-top:10px"><label>Quick set</label>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
            [7,14,30,60,90].map(function(d){
              var dt = new Date(Date.now() + d*86400000).toISOString().split('T')[0];
              return '<button onclick="document.getElementById(\'followupDateInput\').value=\'' + dt + '\'" ' +
                'style="font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:20px;background:transparent;cursor:pointer;font-family:DM Sans,sans-serif">+' + d + 'd</button>';
            }).join('') +
          '</div></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'followupDateOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveFollowupDate(\'' + rxId + '\')">💾 Save</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

async function saveFollowupDate(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  var dt = document.getElementById('followupDateInput')?.value;
  if (!dt) { showToast('Select a date.', 'error'); return; }
  rx.followupDate = dt;
  await dbUpsertPrescription(rx);
  closeOverlay('followupDateOverlay');
  showToast('📅 Follow-up set for ' + formatDate(dt), 'success');
  renderFollowupView(document.getElementById('followupView'));
}

async function sendFollowupReminder(rxId) {
  var rx = prescriptions.find(function(r){ return r.id === rxId; }); if (!rx) return;
  var email = rx.email;
  if (!email) { showToast('No email address on file for this patient.', 'error'); return; }
  var clinic = typeof getActiveClinic === 'function' ? getActiveClinic() : null;
  var followupDate = rx.followupDate || new Date(new Date(rx.date+'T00:00:00').getTime() + getFollowupDays(rx.diagnosis)*86400000).toISOString().split('T')[0];

  try {
    var SUPABASE_URL = 'https://wavakcolrtrwmjcjkdfc.supabase.co';
    var resp = await fetch(SUPABASE_URL + '/functions/v1/send-rx-notification', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        to: email, patientName: rx.patientName,
        subject: 'Your follow-up appointment reminder — ' + (clinic?.name||'Rx Vault'),
        html: '<p>Dear <strong>' + escHtml(rx.patientName) + '</strong>,</p>' +
          '<p>This is a reminder that your follow-up visit is scheduled for <strong>' + formatDate(followupDate) + '</strong>.</p>' +
          '<p>Diagnosis: ' + escHtml(rx.diagnosis||'—') + '</p>' +
          '<p>Doctor: Dr. ' + escHtml(rx.doctorName||'—') + '</p>' +
          '<p>Please contact the clinic to confirm your appointment.</p>',
        text: 'Dear ' + rx.patientName + ',\nYour follow-up visit is due on ' + followupDate + '.\nDiagnosis: ' + (rx.diagnosis||'—') + '\nDoctor: Dr. ' + (rx.doctorName||'—'),
        clinicName: clinic?.name || 'Rx Vault',
        daysLeft: 0, rxId: rx.id
      })
    });
    if (resp.ok) { showToast('📧 Follow-up reminder sent to ' + rx.patientName, 'success'); }
    else { throw new Error('Server error'); }
  } catch(e) {
    var mailto = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Follow-up appointment reminder') + '&body=' + encodeURIComponent('Dear ' + rx.patientName + ',\nYour follow-up is due on ' + followupDate);
    window.open(mailto, '_blank');
    showToast('📧 Email client opened for ' + rx.patientName, 'info');
  }
}

// Patch savePrescription to auto-set followupDate if not set
document.addEventListener('DOMContentLoaded', function() {
  if (typeof savePrescription === 'function') {
    var _origSave = savePrescription;
    savePrescription = async function() {
      await _origSave();
      // The rx was just saved — find it and set followup if missing
      setTimeout(function() {
        var latest = prescriptions[prescriptions.length - 1];
        if (latest && !latest.followupDate) {
          var days = getFollowupDays(latest.diagnosis);
          latest.followupDate = new Date(new Date(latest.date+'T00:00:00').getTime() + days*86400000).toISOString().split('T')[0];
          if (typeof dbUpsertPrescription === 'function') dbUpsertPrescription(latest);
        }
      }, 500);
    };
  }
});
