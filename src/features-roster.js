// ════════════════════════════════════════════════════════════
//  FEATURES-ROSTER.JS
//  Shift & Duty Roster — weekly schedule for nursing staff
//  Features:
//  • Weekly grid view — staff × day
//  • Shift assignment (Morning / Afternoon / Night / Off)
//  • On-call designation
//  • Shift swap requests
//  • Export weekly roster as PDF-ready HTML
//  Load order: after features.js
// ════════════════════════════════════════════════════════════

var SHIFTS = {
  M:   { label:'Morning',   time:'7am–2pm',   bg:'#e8f5e9',             clr:'var(--green)',     short:'MOR' },
  A:   { label:'Afternoon', time:'2pm–9pm',   bg:'var(--allopathy-bg)', clr:'var(--allopathy)', short:'AFT' },
  N:   { label:'Night',     time:'9pm–7am',   bg:'var(--homeopathy-bg)',clr:'var(--homeopathy)','short':'NGT' },
  OC:  { label:'On-Call',   time:'standby',   bg:'var(--ayurveda-bg)',  clr:'var(--ayurveda)',  short:'ONC' },
  OFF: { label:'Off',       time:'rest day',  bg:'var(--surface2)',     clr:'var(--text-muted)','short':'OFF' },
};

var DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
var rosterData = {}; // { staffId: { 'Mon_2026-03-23': 'M', ... } }
var staffList  = [];

function showRosterView() {
  currentView = 'roster';
  if (typeof hideAllViews === 'function') hideAllViews();
  ['stockView','analyticsView','outbreakView','vaccinationView','followupView','opdBoardView','labOrdersView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var v = document.getElementById('rosterView');
  if (!v) { v = document.createElement('div'); v.id = 'rosterView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  if (typeof setNavActive === 'function') setNavActive('navRoster');
  document.getElementById('pageTitle').textContent    = '🗓️ Shift & Duty Roster';
  document.getElementById('pageSubtitle').textContent = 'Weekly schedule, on-call assignments and shift management for nursing staff';
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  loadRosterView(v);
}

async function loadRosterView(container) {
  // Load staff from clinic_members table (staff registered in the app)
  try {
    var { data } = await db.from('clinic_members').select('*').eq('clinic_id', activeClinicId);
    staffList = (data || []).filter(function(m){ return m.role !== 'superadmin'; });
  } catch(e) { staffList = []; }

  // Load roster data
  try {
    var { data: rData } = await db.from('shift_roster').select('*').eq('clinic_id', activeClinicId);
    rosterData = {};
    (rData || []).forEach(function(row) {
      if (!rosterData[row.staff_id]) rosterData[row.staff_id] = {};
      rosterData[row.staff_id][row.slot_key] = row.shift_code;
    });
  } catch(e) { rosterData = {}; }

  renderRosterView(container);
}

function getWeekDates(offset) {
  // Returns array of 7 Date objects for the week containing today + offset weeks
  var today = new Date(); today.setHours(0,0,0,0);
  var dayOfWeek = today.getDay(); // 0=Sun
  var mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  var monday = new Date(today.getTime() + (mondayDiff + offset * 7) * 86400000);
  return Array.from({ length:7 }, function(_, i){
    return new Date(monday.getTime() + i * 86400000);
  });
}

var _rosterWeekOffset = 0;

function renderRosterView(container) {
  var weekDates = getWeekDates(_rosterWeekOffset);
  var weekLabel = weekDates[0].toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' – ' + weekDates[6].toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

  // Count on-call per day
  var onCallToday = {};
  weekDates.forEach(function(d, di) {
    var key = DAYS[di] + '_' + d.toISOString().split('T')[0];
    var oc  = staffList.filter(function(s){ return (rosterData[s.id]||{})[key] === 'OC'; }).length;
    onCallToday[di] = oc;
  });

  container.innerHTML =
    // Shift legend
    '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
      Object.entries(SHIFTS).map(function(e) {
        var k = e[0], s = e[1];
        return '<div style="display:flex;align-items:center;gap:5px;background:' + s.bg + ';padding:4px 12px;border-radius:20px">' +
          '<span style="font-size:11px;font-weight:700;color:' + s.clr + '">' + s.short + '</span>' +
          '<span style="font-size:11px;color:var(--text-muted)">' + s.label + ' · ' + s.time + '</span></div>';
      }).join('') +
    '</div>' +

    // Week nav
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
      '<button onclick="_rosterWeekOffset--;renderRosterView(document.getElementById(\'rosterView\'))" class="btn-sm btn-outline-teal">← Prev</button>' +
      '<div style="font-size:14px;font-weight:700;flex:1;text-align:center">' + weekLabel + '</div>' +
      '<button onclick="_rosterWeekOffset++;renderRosterView(document.getElementById(\'rosterView\'))" class="btn-sm btn-outline-teal">Next →</button>' +
      '<button onclick="exportRoster()" class="btn-sm btn-outline-teal">📤 Export</button>' +
    '</div>' +

    // Grid
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:700px">' +
    '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:10px 14px;text-align:left;font-weight:700;min-width:140px;border-bottom:1px solid var(--border)">Staff</th>' +
      weekDates.map(function(d, i) {
        var isToday = d.toDateString() === new Date().toDateString();
        return '<th style="padding:10px 8px;text-align:center;font-weight:700;border-bottom:1px solid var(--border);' + (isToday ? 'background:var(--teal-pale);color:var(--teal)' : '') + '">' +
          DAYS[i].substring(0,3) + '<br><span style="font-size:10px;font-weight:400;color:var(--text-muted)">' + d.getDate() + '/' + (d.getMonth()+1) + '</span>' +
          (onCallToday[i] === 0 ? '<br><span style="font-size:9px;color:var(--red);font-weight:700">No on-call!</span>' : '') +
        '</th>';
      }).join('') +
      '<th style="padding:10px 8px;text-align:center;border-bottom:1px solid var(--border);min-width:70px">Status</th>' +
      '<th style="padding:10px 8px;text-align:center;border-bottom:1px solid var(--border)">Total</th>' +
    '</tr></thead>' +
    '<tbody>' +
    (staffList.length === 0
      ? '<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--text-muted)">No staff registered. Add staff via Administration → Staff Management.</td></tr>'
      : staffList.map(function(staff) {
          var shifts = rosterData[staff.id] || {};
          var nightCount = 0, onCallCount = 0, workDays = 0;
          var cells = weekDates.map(function(d, di) {
            var key   = DAYS[di] + '_' + d.toISOString().split('T')[0];
            var code  = shifts[key] || 'OFF';
            var shift = SHIFTS[code] || SHIFTS.OFF;
            if (code === 'N') nightCount++;
            if (code === 'OC') onCallCount++;
            if (code !== 'OFF') workDays++;
            return '<td style="padding:6px 4px;text-align:center;border-bottom:1px solid var(--border)">' +
              '<select onchange="updateShift(\'' + escAttr(staff.id) + '\',\'' + key + '\',this.value)" ' +
                'style="font-size:11px;padding:4px 2px;border:1px solid var(--border);border-radius:6px;background:' + shift.bg + ';color:' + shift.clr + ';font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;width:58px">' +
                Object.entries(SHIFTS).map(function(e) {
                  return '<option value="' + e[0] + '"' + (code === e[0] ? ' selected' : '') + '>' + e[1].short + '</option>';
                }).join('') +
              '</select></td>';
          }).join('');

          var roleIcon = { doctor:'🩺', receptionist:'🧑‍💼', pharmacist:'💊', admin:'🔐', nurse:'💉', viewer:'👁️' }[staff.role] || '👤';
          return '<tr onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">' +
            '<td style="padding:10px 14px;border-bottom:1px solid var(--border)">' +
              '<div style="font-weight:600">' + roleIcon + ' ' + escHtml(staff.name||staff.email||'Staff') + '</div>' +
              '<div style="font-size:10.5px;color:var(--text-muted)">' + capitalize(staff.role||'') + '</div>' +
              '<div style="font-size:10px;margin-top:2px;display:flex;gap:4px">' +
                (nightCount > 1 ? '<span style="background:var(--homeopathy-bg);color:var(--homeopathy);padding:1px 5px;border-radius:6px">🌙 ' + nightCount + 'N</span>' : '') +
                (onCallCount > 0 ? '<span style="background:var(--ayurveda-bg);color:var(--ayurveda);padding:1px 5px;border-radius:6px">📞 ' + onCallCount + 'OC</span>' : '') +
              '</div>' +
            '</td>' + cells +
            '<td style="padding:6px 4px;text-align:center;border-bottom:1px solid var(--border)">' +
              (function() {
                var sts = staff.status || 'available';
                var cls = sts.includes('_') ? sts.split('_')[0] : 'custom';
                if (sts.startsWith('on_')) cls = sts.split('_')[1];
                return '<small class="status-badge status-' + cls + '" style="font-size:8.5px">' + formatStatusLabel(sts) + '</small>';
              })() +
            '</td>' +
            '<td style="padding:6px 10px;text-align:center;font-weight:700;border-bottom:1px solid var(--border);color:var(--teal)">' + workDays + '/7</td>' +
          '</tr>';
        }).join('')
    ) +
    '</tbody></table></div>' +

    // Swap requests section
    '<div id="swapRequests" style="margin-top:20px"></div>';

  loadSwapRequests();
}

async function updateShift(staffId, slotKey, shiftCode) {
  if (!rosterData[staffId]) rosterData[staffId] = {};
  rosterData[staffId][slotKey] = shiftCode;
  try {
    await db.from('shift_roster').upsert({
      clinic_id: activeClinicId,
      staff_id:  staffId,
      slot_key:  slotKey,
      shift_code: shiftCode,
      updated_at: new Date().toISOString()
    }, { onConflict: 'clinic_id,staff_id,slot_key' });
  } catch(e) { console.error('[Roster] save error', e); }
}

function openAddStaffToRoster() {
  showToast('Add staff via Administration → Manage Staff, then they will appear here automatically.', 'info');
}

// ─── Shift Swap Requests ──────────────────────────────────
async function loadSwapRequests() {
  var container = document.getElementById('swapRequests');
  if (!container) return;
  try {
    var { data } = await db.from('shift_swaps').select('*').eq('clinic_id', activeClinicId).eq('status','pending').order('requested_on', { ascending:false });
    if (!data || !data.length) { container.innerHTML = ''; return; }
    container.innerHTML =
      '<div style="font-size:13px;font-weight:700;margin-bottom:10px">🔄 Pending Shift Swap Requests (' + data.length + ')</div>' +
      data.map(function(req) {
        var requester = staffList.find(function(s){ return s.id === req.requester_id; });
        var target    = staffList.find(function(s){ return s.id === req.target_id; });
        return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600">' + escHtml(requester?.name || req.requester_id) + ' ↔ ' + escHtml(target?.name || req.target_id) + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">' + escHtml(req.slot_key_a) + ' ↔ ' + escHtml(req.slot_key_b) + '</div>' +
            (req.message ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">"' + escHtml(req.message) + '"</div>' : '') +
          '</div>' +
          '<button onclick="approveSwap(\'' + req.id + '\')" class="btn-sm btn-teal" style="font-size:12px">✅ Approve</button>' +
          '<button onclick="rejectSwap(\'' + req.id + '\')" class="btn-sm btn-outline-red" style="font-size:12px">✕ Reject</button>' +
        '</div>';
      }).join('');
  } catch(e) { container.innerHTML = ''; }
}

async function approveSwap(swapId) {
  try {
    var { data } = await db.from('shift_swaps').select('*').eq('id', swapId).single();
    if (!data) return;
    // Execute the swap
    var codeA = (rosterData[data.requester_id]||{})[data.slot_key_a] || 'OFF';
    var codeB = (rosterData[data.target_id]||{})[data.slot_key_b]    || 'OFF';
    await updateShift(data.requester_id, data.slot_key_b, codeA);
    await updateShift(data.target_id,    data.slot_key_a, codeB);
    await db.from('shift_swaps').update({ status:'approved', resolved_on: new Date().toISOString() }).eq('id', swapId);
    showToast('✅ Shift swap approved and applied', 'success');
    loadRosterView(document.getElementById('rosterView'));
  } catch(e) { showToast('Failed to approve swap.', 'error'); }
}

async function rejectSwap(swapId) {
  await db.from('shift_swaps').update({ status:'rejected', resolved_on: new Date().toISOString() }).eq('id', swapId);
  showToast('Swap request rejected.', 'info');
  loadSwapRequests();
}

// ─── Export roster ────────────────────────────────────────
function exportRoster() {
  var weekDates = getWeekDates(_rosterWeekOffset);
  var weekLabel = weekDates[0].toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' – ' + weekDates[6].toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  var clinic = typeof getActiveClinic === 'function' ? getActiveClinic() : null;

  var rows = staffList.map(function(staff) {
    var shifts = rosterData[staff.id] || {};
    return '<tr>' +
      '<td style="padding:8px 12px;font-weight:600;border:1px solid #ddd">' + escHtml(staff.name||staff.email||'Staff') + '<br><small style="color:#888">' + (staff.role||'') + '</small></td>' +
      weekDates.map(function(d, di) {
        var key   = DAYS[di] + '_' + d.toISOString().split('T')[0];
        var code  = shifts[key] || 'OFF';
        var shift = SHIFTS[code] || SHIFTS.OFF;
        return '<td style="padding:8px;text-align:center;border:1px solid #ddd;background:' + shift.bg + ';color:' + shift.clr + ';font-weight:700">' + shift.short + '</td>';
      }).join('') +
    '</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><title>Roster ' + weekLabel + '</title>' +
    '<style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}table{width:100%;border-collapse:collapse}th{background:#f0f4f8;padding:8px;border:1px solid #ddd;text-align:center}@media print{body{padding:0}}</style></head>' +
    '<body onload="window.print()">' +
    '<h2 style="color:#0f2240">🗓️ Weekly Duty Roster</h2>' +
    '<p>' + (clinic?.name||'Rx Vault') + ' · ' + weekLabel + '</p>' +
    '<table><thead><tr><th>Staff</th>' + DAYS.map(function(d,i){ return '<th>' + d.substring(0,3) + ' ' + weekDates[i].getDate() + '</th>'; }).join('') + '</tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<p style="margin-top:20px;font-size:11px;color:#888">MOR=Morning(7am–2pm) | AFT=Afternoon(2pm–9pm) | NGT=Night(9pm–7am) | ONC=On-Call | OFF=Rest day</p>' +
    '</body></html>';

  var w = window.open('','_blank'); w.document.write(html); w.document.close();
}
