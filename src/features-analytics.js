// ════════════════════════════════════════════════════════════
//  FEATURES-ANALYTICS.JS
//  Modules: Clinical Dashboard, Disease Outbreak Tracker
//  Load order: after features-stock.js
//  Depends on: statCard() defined in features-stock.js
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  MODULE 3: CLINICAL DASHBOARD (Analytics)
// ════════════════════════════════════════════════════════════

function showAnalyticsView() {
  currentView = 'analytics';
  var av = document.getElementById('analyticsView');
  if (!av) { av = document.createElement('div'); av.id='analyticsView'; document.querySelector('.main').appendChild(av); }
  _showAnalyticsModule('analyticsView');
  if (typeof setNavActive === 'function') setNavActive('navAnalytics');
  document.getElementById('pageTitle').textContent    = '📊 Clinical Dashboard';
  document.getElementById('pageSubtitle').textContent = 'Analytics, trends and exportable reports';
  renderAnalyticsDashboard(av);
}

function renderAnalyticsDashboard(container) {
  // ── Compute analytics from prescriptions ──
  var total     = prescriptions.length;
  var activeRx  = prescriptions.filter(function(p){ return p.status==='active'; }).length;
  var thisMonth = prescriptions.filter(function(p){
    var d = new Date(p.date); var now = new Date();
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  }).length;

  // Diagnoses frequency
  var diagCount = {};
  prescriptions.forEach(function(p) {
    if (!p.diagnosis) return;
    var diag = p.diagnosis.split(/[,\n]/)[0].trim();
    if (diag) diagCount[diag] = (diagCount[diag]||0) + 1;
  });
  var topDiags = Object.entries(diagCount).sort(function(a,b){return b[1]-a[1];}).slice(0,8);

  // Medicine usage
  var medCount = {};
  prescriptions.forEach(function(p) {
    (p.medicines||[]).forEach(function(m){
      if (m.name) medCount[m.name] = (medCount[m.name]||0) + 1;
    });
  });
  var topMeds = Object.entries(medCount).sort(function(a,b){return b[1]-a[1];}).slice(0,8);

  // Type distribution
  var alloCount = prescriptions.filter(function(p){return p.type==='allopathy';}).length;
  var homoCount = prescriptions.filter(function(p){return p.type==='homeopathy';}).length;
  var ayurCount = prescriptions.filter(function(p){return p.type==='ayurveda';}).length;

  // Doctor performance
  var docCount = {};
  prescriptions.forEach(function(p){ if (p.doctorName) docCount[p.doctorName]=(docCount[p.doctorName]||0)+1; });
  var topDoctors = Object.entries(docCount).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

  // Monthly trend (last 6 months)
  var monthlyData = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(); d.setMonth(d.getMonth()-i);
    var month = d.toLocaleString('en-IN', {month:'short', year:'2-digit'});
    var count = prescriptions.filter(function(p){
      var pd = new Date(p.date);
      return pd.getMonth()===d.getMonth() && pd.getFullYear()===d.getFullYear();
    }).length;
    monthlyData.push({ month, count });
  }

  // Revenue trend (from invoices if available)
  var monthlyRevenue = [];
  var invData = typeof invoices !== 'undefined' ? invoices : [];
  for (var j = 5; j >= 0; j--) {
    var dr = new Date(); dr.setMonth(dr.getMonth()-j);
    var rev = invData.filter(function(inv){
      if (inv.status !== 'paid') return false;
      var id = new Date(inv.invoice_date);
      return id.getMonth()===dr.getMonth() && id.getFullYear()===dr.getFullYear();
    }).reduce(function(s,inv){ return s+(parseFloat(inv.total_amount)||0); }, 0);
    monthlyRevenue.push({ month: dr.toLocaleString('en-IN',{month:'short',year:'2-digit'}), rev });
  }

  // Gender distribution
  var genderCount = { Male:0, Female:0, Other:0 };
  prescriptions.forEach(function(p){ if (p.gender && genderCount[p.gender]!==undefined) genderCount[p.gender]++; });

  container.innerHTML =
    // Export bar
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:16px">' +
      '<select id="analyticsPeriod" onchange="renderAnalyticsDashboard(document.getElementById(\'analyticsView\'))" ' +
        'style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="all">All Time</option>' +
        '<option value="30">Last 30 Days</option>' +
        '<option value="90">Last 90 Days</option>' +
        '<option value="365">Last Year</option>' +
      '</select>' +
      '<button onclick="exportAnalyticsReport()" class="btn-sm btn-outline-teal">📤 Export Report</button>' +
    '</div>' +

    // KPI cards
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">' +
      analyticsKPI('📋', total,       'Total Prescriptions', 'var(--teal)',      'var(--teal-pale)') +
      analyticsKPI('✅', activeRx,    'Active',              'var(--green)',     '#e8f5e9') +
      analyticsKPI('📅', thisMonth,   'This Month',          'var(--allopathy)', 'var(--allopathy-bg)') +
      analyticsKPI('👥', patientRegistry.length, 'Patients', 'var(--homeopathy)','var(--homeopathy-bg)') +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      // Rx trend chart
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:16px;color:var(--text-primary)">📈 Prescription Trend (6 months)</div>' +
        renderBarChart(monthlyData.map(function(d){ return {label:d.month, value:d.count}; }), 'var(--teal)', 200) +
      '</div>' +
      // Revenue trend
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:16px;color:var(--text-primary)">💰 Revenue Trend (6 months)</div>' +
        (invData.length ? renderBarChart(monthlyRevenue.map(function(d){ return {label:d.month, value:d.rev}; }), 'var(--green)', 200, true) :
          '<div style="height:200px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">No invoice data available</div>') +
      '</div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      // Top diagnoses
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:14px;color:var(--text-primary)">🔬 Top Diagnoses</div>' +
        (topDiags.length ? renderHorizontalBars(topDiags, 'var(--allopathy)') :
          '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center">No diagnosis data</div>') +
      '</div>' +
      // Top medicines
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:14px;color:var(--text-primary)">💊 Most Prescribed Medicines</div>' +
        (topMeds.length ? renderHorizontalBars(topMeds, 'var(--teal)') :
          '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center">No medicine data</div>') +
      '</div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">' +
      // Doctor performance
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;grid-column:span 2">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:14px;color:var(--text-primary)">🩺 Doctor Performance</div>' +
        (topDoctors.length ?
          '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
            '<thead><tr style="background:var(--surface2)"><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Doctor</th>' +
            '<th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Rx Count</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Share</th></tr></thead><tbody>' +
            topDoctors.map(function(d) {
              var pct = total > 0 ? Math.round(d[1]/total*100) : 0;
              return '<tr style="border-bottom:1px solid var(--border)">' +
                '<td style="padding:10px 12px;font-weight:600">Dr. ' + escHtml(d[0]) + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--teal)">' + d[1] + '</td>' +
                '<td style="padding:10px 12px">' +
                  '<div style="display:flex;align-items:center;gap:8px">' +
                    '<div style="flex:1;background:var(--bg);border-radius:4px;height:8px;overflow:hidden"><div style="background:var(--teal);height:100%;width:'+pct+'%;transition:width 0.4s"></div></div>' +
                    '<span style="font-size:12px;color:var(--text-muted);width:32px">' + pct + '%</span>' +
                  '</div>' +
                '</td>' +
              '</tr>';
            }).join('') + '</tbody></table>'
          : '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center">No data</div>') +
      '</div>' +

      // Distribution
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:14px;color:var(--text-primary)">🏥 Type Distribution</div>' +
        renderDonutChart([
          { label:'Allopathy',  value:alloCount, color:'var(--allopathy)' },
          { label:'Homeopathy', value:homoCount, color:'var(--homeopathy)' },
          { label:'Ayurveda',   value:ayurCount, color:'var(--ayurveda)' },
        ], total) +
        '<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">' +
          [['💉 Allopathy',alloCount,'var(--allopathy)'],['🌿 Homeopathy',homoCount,'var(--homeopathy)'],['🌱 Ayurveda',ayurCount,'var(--ayurveda)']].map(function(r){
            return '<div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px">' +
              '<span>' + r[0] + '</span>' +
              '<span style="font-weight:700;color:' + r[2] + '">' + r[1] + ' (' + (total>0?Math.round(r[1]/total*100):0) + '%)</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
}

function analyticsKPI(icon, value, label, clr, bg) {
  return '<div style="background:' + bg + ';border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px">' +
    '<div style="font-size:20px;margin-bottom:6px">' + icon + '</div>' +
    '<div style="font-size:26px;font-weight:700;color:' + clr + ';font-family:\'DM Serif Display\',serif">' + value + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">' + label + '</div>' +
  '</div>';
}

function renderBarChart(data, color, height, isCurrency) {
  if (!data.length) return '<div style="height:'+height+'px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">No data</div>';
  var maxVal = Math.max.apply(null, data.map(function(d){return d.value;})) || 1;
  height = height || 200;
  return '<div style="display:flex;align-items:flex-end;gap:6px;height:'+height+'px;padding-bottom:24px;position:relative">' +
    data.map(function(d) {
      var h = Math.round((d.value / maxVal) * (height - 40));
      var label = isCurrency ? '₹'+(d.value>=1000?(d.value/1000).toFixed(1)+'k':d.value) : d.value;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px">' +
        '<div style="font-size:10px;color:var(--text-muted);white-space:nowrap">' + (d.value?label:'') + '</div>' +
        '<div style="width:100%;background:'+color+';border-radius:4px 4px 0 0;height:'+Math.max(h,2)+'px;opacity:0.85;transition:height 0.4s"></div>' +
        '<div style="font-size:10px;color:var(--text-muted);transform:rotate(-35deg);transform-origin:top left;white-space:nowrap;margin-top:4px">' + d.label + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderHorizontalBars(data, color) {
  var max = data[0]?data[0][1]:1;
  return data.map(function(d) {
    var pct = Math.round(d[1]/max*100);
    return '<div style="margin-bottom:10px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">' +
        '<span style="font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">' + escHtml(d[0]) + '</span>' +
        '<span style="font-weight:700;color:'+color+';flex-shrink:0">' + d[1] + '</span>' +
      '</div>' +
      '<div style="background:var(--bg);border-radius:4px;height:8px;overflow:hidden">' +
        '<div style="background:'+color+';height:100%;width:'+pct+'%;transition:width 0.4s;opacity:0.8"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderDonutChart(segments, total) {
  if (!total) return '<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">No data</div>';
  var size = 120, cx = 60, cy = 60, r = 44, innerR = 28;
  var paths = '', angle = -Math.PI/2;
  segments.forEach(function(seg) {
    if (!seg.value) return;
    var sweep = (seg.value / total) * 2 * Math.PI;
    var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    var x2 = cx + r * Math.cos(angle+sweep), y2 = cy + r * Math.sin(angle+sweep);
    var largeArc = sweep > Math.PI ? 1 : 0;
    var xi1 = cx + innerR * Math.cos(angle+sweep), yi1 = cy + innerR * Math.sin(angle+sweep);
    var xi2 = cx + innerR * Math.cos(angle), yi2 = cy + innerR * Math.sin(angle);
    paths += '<path d="M '+x1+' '+y1+' A '+r+' '+r+' 0 '+largeArc+' 1 '+x2+' '+y2+' L '+xi1+' '+yi1+' A '+innerR+' '+innerR+' 0 '+largeArc+' 0 '+xi2+' '+yi2+' Z" fill="' + seg.color + '" opacity="0.85"/>';
    angle += sweep;
  });
  return '<div style="display:flex;justify-content:center">' +
    '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">' + paths +
      '<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="14" font-weight="700" fill="var(--text-primary)">'+total+'</text>' +
      '<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-size="9" fill="var(--text-muted)">Total</text>' +
    '</svg>' +
  '</div>';
}

function exportAnalyticsReport() {
  var clinic = getActiveClinic();
  var diagCount = {};
  prescriptions.forEach(function(p) {
    if (!p.diagnosis) return;
    var diag = p.diagnosis.split(/[,\n]/)[0].trim();
    if (diag) diagCount[diag] = (diagCount[diag]||0) + 1;
  });
  var medCount = {};
  prescriptions.forEach(function(p){ (p.medicines||[]).forEach(function(m){ if(m.name) medCount[m.name]=(medCount[m.name]||0)+1; }); });
  var docCount = {};
  prescriptions.forEach(function(p){ if(p.doctorName) docCount[p.doctorName]=(docCount[p.doctorName]||0)+1; });

  var csv = 'Rx Vault Clinical Report\nClinic: ' + (clinic?.name||'') + '\nGenerated: ' + new Date().toLocaleString('en-IN') + '\n\n';
  csv += 'SUMMARY\nTotal Prescriptions,' + prescriptions.length + '\nActive Prescriptions,' + prescriptions.filter(function(p){return p.status==='active';}).length + '\nTotal Patients,' + patientRegistry.length + '\n\n';
  csv += 'TOP DIAGNOSES\nDiagnosis,Count\n' + Object.entries(diagCount).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){return e[0]+','+e[1];}).join('\n') + '\n\n';
  csv += 'TOP MEDICINES\nMedicine,Prescriptions\n' + Object.entries(medCount).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){return e[0]+','+e[1];}).join('\n') + '\n\n';
  csv += 'DOCTOR PERFORMANCE\nDoctor,Prescriptions\n' + Object.entries(docCount).sort(function(a,b){return b[1]-a[1];}).map(function(e){return 'Dr. '+e[0]+','+e[1];}).join('\n');

  var blob = new Blob([csv], {type:'text/csv'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'rxvault_report_' + (clinic?.name||'clinic').replace(/\s+/g,'_') + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('📤 Report exported as CSV', 'success');
}

// ════════════════════════════════════════════════════════════
//  MODULE 4: DISEASE OUTBREAK TRACKER
// ════════════════════════════════════════════════════════════

async function showOutbreakView() {
  currentView = 'outbreak';
  var ov = document.getElementById('outbreakView');
  if (!ov) { ov = document.createElement('div'); ov.id='outbreakView'; document.querySelector('.main').appendChild(ov); }
  _showAnalyticsModule('outbreakView');
  if (typeof setNavActive === 'function') setNavActive('navOutbreak');
  document.getElementById('pageTitle').textContent    = '🦠 Disease Outbreak Tracker';
  document.getElementById('pageSubtitle').textContent = 'Anonymised diagnosis trends across clinic — early warning for disease clusters';
  renderOutbreakView(ov);
}

function renderOutbreakView(container) {
  // Aggregate diagnosis data by week
  var diagByWeek = {};
  var diagTotal  = {};

  prescriptions.forEach(function(p) {
    if (!p.diagnosis || !p.date) return;
    var week = getWeekLabel(new Date(p.date));
    var diag = p.diagnosis.split(/[,\n]/)[0].trim().toLowerCase();
    if (!diag) return;
    if (!diagByWeek[diag]) diagByWeek[diag] = {};
    diagByWeek[diag][week] = (diagByWeek[diag][week]||0) + 1;
    diagTotal[diag] = (diagTotal[diag]||0) + 1;
  });

  // Top diagnoses
  var topDiags = Object.entries(diagTotal).sort(function(a,b){return b[1]-a[1];}).slice(0,12);

  // Detect spikes — diagnoses where last week count > 1.5x previous week
  var weeks = getLast8Weeks();
  var spikes = [];
  topDiags.forEach(function(d) {
    var diag = d[0];
    var lastW = (diagByWeek[diag] && diagByWeek[diag][weeks[weeks.length-1]]) || 0;
    var prevW = (diagByWeek[diag] && diagByWeek[diag][weeks[weeks.length-2]]) || 0;
    if (lastW > 0 && (prevW === 0 || lastW > prevW * 1.5)) {
      spikes.push({ diag, lastW, prevW, change: prevW === 0 ? '🆕 New' : '+' + Math.round((lastW/prevW-1)*100) + '%' });
    }
  });

  container.innerHTML =
    // Period selector
    '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap">' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<select id="outbreakPeriod" onchange="renderOutbreakView(document.getElementById(\'outbreakView\'))" ' +
          'style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
          '<option value="8">Last 8 Weeks</option>' +
          '<option value="12">Last 12 Weeks</option>' +
          '<option value="24">Last 24 Weeks</option>' +
        '</select>' +
        '<input type="text" id="outbreakSearch" placeholder="Filter diagnosis…" oninput="filterOutbreak()" ' +
          'style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;min-width:180px">' +
      '</div>' +
      '<button onclick="exportOutbreakData()" class="btn-sm btn-outline-teal">📤 Export Data</button>' +
    '</div>' +

    // Spike alerts
    (spikes.length ?
      '<div style="background:var(--red-bg);border:1px solid rgba(220,38,38,0.3);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px">' +
        '<div style="font-weight:700;font-size:13px;color:var(--red);margin-bottom:8px">🚨 Potential Outbreak Signals — Last Week Spike</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          spikes.map(function(s) {
            return '<div style="background:#fff;border:1px solid rgba(220,38,38,0.2);border-radius:8px;padding:6px 12px;font-size:12.5px">' +
              '<strong>' + escHtml(capitalize(s.diag)) + '</strong>' +
              '<span style="margin-left:8px;color:var(--red);font-weight:700">' + s.change + '</span>' +
              '<span style="margin-left:6px;color:var(--text-muted)">('+s.prevW+' → '+s.lastW+')</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' : '') +

    // Heatmap
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:16px">🗓️ Diagnosis Frequency Heatmap — Last ' + weeks.length + ' Weeks</div>' +
      (topDiags.length ? renderHeatmap(topDiags, diagByWeek, weeks) :
        '<div style="padding:32px;text-align:center;color:var(--text-muted)">No diagnosis data available yet.</div>') +
    '</div>' +

    // Trend lines per diagnosis
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:16px">📈 Weekly Trend by Diagnosis</div>' +
      '<div id="outbreakTrends">' + renderOutbreakTrends(topDiags.slice(0,6), diagByWeek, weeks) + '</div>' +
    '</div>';
}

// FIX: getWeekLabel — correctly handles Sunday (getDay()=0)
// Old bug: d.getDate() - d.getDay() + 1 for Sunday gave d.getDate() + 1 (next day = next week's Monday)
function getWeekLabel(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  var day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // For Sunday (0), go back 6 days to previous Monday
  // For Monday (1), diff = 0 (already Monday)
  // For Tue-Sat (2-6), go back (day - 1) days
  var diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toLocaleDateString('en-IN', {day:'2-digit', month:'short'});
}

// FIX: getLast8Weeks — anchored to this week's Monday for consistent key matching
function getLast8Weeks() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find this week's Monday using the same logic as getWeekLabel
  var day = today.getDay();
  var diffToMonday = day === 0 ? -6 : 1 - day;
  var thisMonday = new Date(today.getTime() + diffToMonday * 86400000);

  var weeks = [];
  for (var i = 7; i >= 0; i--) {
    var weekMonday = new Date(thisMonday.getTime() - i * 7 * 86400000);
    weeks.push(weekMonday.toLocaleDateString('en-IN', {day:'2-digit', month:'short'}));
  }
  return weeks;
}

function renderHeatmap(topDiags, diagByWeek, weeks) {
  var maxVal = 0;
  topDiags.forEach(function(d) {
    weeks.forEach(function(w) { var v = (diagByWeek[d[0]] && diagByWeek[d[0]][w]) || 0; if(v>maxVal) maxVal=v; });
  });
  if (maxVal === 0) maxVal = 1;

  var colWidth = Math.max(40, Math.floor((window.innerWidth - 500) / weeks.length));
  colWidth = Math.min(colWidth, 80);

  return '<div style="overflow-x:auto">' +
    '<table style="border-collapse:collapse;font-size:12px;min-width:100%">' +
    '<thead><tr>' +
      '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text-muted);font-weight:600;min-width:140px">Diagnosis</th>' +
      weeks.map(function(w){ return '<th style="padding:6px 4px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:600;width:'+colWidth+'px;white-space:nowrap">' + w + '</th>'; }).join('') +
      '<th style="padding:6px 10px;text-align:right;font-size:11px;color:var(--text-muted);font-weight:600">Total</th>' +
    '</tr></thead>' +
    '<tbody>' +
    topDiags.map(function(d) {
      var diag = d[0];
      return '<tr>' +
        '<td style="padding:5px 10px;font-weight:600;color:var(--text-primary)">' + escHtml(capitalize(diag)) + '</td>' +
        weeks.map(function(w) {
          var val  = (diagByWeek[diag] && diagByWeek[diag][w]) || 0;
          var pct  = val / maxVal;
          var bg   = val === 0 ? 'var(--bg)' :
                     pct >= 0.8 ? '#dc2626' :
                     pct >= 0.5 ? '#d97706' :
                     pct >= 0.25? '#0a7c6e' : '#e6f5f3';
          var clr  = val === 0 ? 'var(--text-muted)' : (pct >= 0.25 ? '#fff' : 'var(--teal)');
          return '<td style="padding:3px;text-align:center">' +
            '<div title="' + escHtml(capitalize(diag)) + ': ' + val + ' cases (' + w + ')" ' +
              'style="background:'+bg+';color:'+clr+';width:'+colWidth+'px;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;cursor:default;transition:transform 0.1s" ' +
              'onmouseenter="this.style.transform=\'scale(1.1)\'" onmouseleave="this.style.transform=\'\'">' +
              (val || '') + '</div></td>';
        }).join('') +
        '<td style="padding:5px 10px;text-align:right;font-weight:700;color:var(--teal)">' + d[1] + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

function renderOutbreakTrends(topDiags, diagByWeek, weeks) {
  if (!topDiags.length) return '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">No data available</div>';
  var colors = ['var(--allopathy)','var(--teal)','var(--red)','var(--homeopathy)','var(--ayurveda)','var(--green)'];

  return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
    topDiags.map(function(d, i) {
      var diag   = d[0];
      var values = weeks.map(function(w){ return (diagByWeek[diag] && diagByWeek[diag][w]) || 0; });
      var maxV   = Math.max.apply(null, values) || 1;
      var clr    = colors[i % colors.length];
      var bars   = values.map(function(v) {
        var h = Math.round((v/maxV)*40);
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:44px">' +
          '<div style="width:100%;background:'+clr+';border-radius:2px 2px 0 0;height:'+Math.max(h,1)+'px;opacity:0.8"></div>' +
        '</div>';
      }).join('');
      var trend = values[values.length-1] > values[values.length-2] ? '↗️' : values[values.length-1] < values[values.length-2] ? '↘️' : '➡️';
      return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<div style="font-weight:600;font-size:12.5px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%">' + escHtml(capitalize(diag)) + '</div>' +
          '<span>' + trend + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:flex-end;gap:2px;height:44px">' + bars + '</div>' +
        '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:right">Total: <strong>' + d[1] + '</strong></div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function filterOutbreak() {
  renderOutbreakView(document.getElementById('outbreakView'));
}

function exportOutbreakData() {
  var clinic = getActiveClinic();
  var diagCount = {};
  var diagByWeek = {};
  var weeks = getLast8Weeks();

  prescriptions.forEach(function(p) {
    if (!p.diagnosis || !p.date) return;
    var diag = p.diagnosis.split(/[,\n]/)[0].trim();
    if (!diag) return;
    diagCount[diag] = (diagCount[diag]||0) + 1;
    var week = getWeekLabel(new Date(p.date));
    if (!diagByWeek[diag]) diagByWeek[diag] = {};
    diagByWeek[diag][week] = (diagByWeek[diag][week]||0) + 1;
  });

  var csv = 'Rx Vault Disease Trend Report\nClinic: ' + (clinic?.name||'') + '\nGenerated: ' + new Date().toLocaleString('en-IN') + '\n\n';
  csv += 'Diagnosis,' + weeks.join(',') + ',Total\n';
  Object.entries(diagCount).sort(function(a,b){return b[1]-a[1];}).forEach(function(d) {
    var row = d[0] + ',' + weeks.map(function(w){ return (diagByWeek[d[0]] && diagByWeek[d[0]][w]) || 0; }).join(',') + ',' + d[1];
    csv += row + '\n';
  });

  var blob = new Blob([csv], {type:'text/csv'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'rxvault_outbreak_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('📤 Outbreak data exported', 'success');
}