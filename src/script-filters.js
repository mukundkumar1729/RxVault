// ════════════════════════════════════════════════════════════
//  SCRIPT-FILTERS.JS — Search, filter, sort, view switching
//  Depends on: script-utils.js, script-core.js, script-render.js
// ════════════════════════════════════════════════════════════

function getSearchVals() {
  return {
    patient:   (document.getElementById('srchPatient')?.value   || '').toLowerCase().trim(),
    doctor:    (document.getElementById('srchDoctor')?.value    || '').toLowerCase().trim(),
    diagnosis: (document.getElementById('srchDiagnosis')?.value || '').toLowerCase().trim(),
    phone:     (document.getElementById('srchPhone')?.value     || '').toLowerCase().trim(),
    email:     (document.getElementById('srchEmail')?.value     || '').toLowerCase().trim(),
    id:        (document.getElementById('srchId')?.value        || '').toLowerCase().trim(),
    dateFrom:  (document.getElementById('srchDateFrom')?.value  || ''),
    dateTo:    (document.getElementById('srchDateTo')?.value    || ''),
    status:    (document.getElementById('statusFilter')?.value  || 'all'),
    sort:      (document.getElementById('sortSelect')?.value    || 'newest'),
  };
}

function applyFilters() {
  var filtered = [...prescriptions];
  var s   = getSearchVals();
  var now = new Date();
  var thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  if (currentView === 'recent') filtered = filtered.filter(function(p){ return new Date(p.date) >= thirtyDaysAgo; });
  if (currentView === 'active') filtered = filtered.filter(function(p){ return p.status === 'active'; });
  if (currentTypeFilter !== 'all') filtered = filtered.filter(function(p){ return p.type === currentTypeFilter; });

  if (s.patient)   filtered = filtered.filter(function(p){ return (p.patientName||'').toLowerCase().includes(s.patient); });
  if (s.doctor)    filtered = filtered.filter(function(p){ return (p.doctorName||'').toLowerCase().includes(s.doctor); });
  if (s.diagnosis) filtered = filtered.filter(function(p){ return (p.diagnosis||'').toLowerCase().includes(s.diagnosis) || (p.hospital||'').toLowerCase().includes(s.diagnosis); });
  if (s.phone)     filtered = filtered.filter(function(p){ return (p.phone||'').replace(/\s/g,'').includes(s.phone.replace(/\s/g,'')) || (p.doctorPhone||'').replace(/\s/g,'').includes(s.phone.replace(/\s/g,'')); });
  if (s.email)     filtered = filtered.filter(function(p){ return (p.email||'').toLowerCase().includes(s.email); });
  if (s.id)        filtered = filtered.filter(function(p){ return (p.id||'').toLowerCase().includes(s.id) || (p.patientId||'').toLowerCase().includes(s.id); });
  if (s.dateFrom)  filtered = filtered.filter(function(p){ return p.date && p.date >= s.dateFrom; });
  if (s.dateTo)    filtered = filtered.filter(function(p){ return p.date && p.date <= s.dateTo; });
  if (s.status !== 'all') filtered = filtered.filter(function(p){ return p.status === s.status; });

  if (s.sort === 'newest')  filtered.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  if (s.sort === 'oldest')  filtered.sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
  if (s.sort === 'patient') filtered.sort(function(a,b){ return (a.patientName||'').localeCompare(b.patientName||''); });
  if (s.sort === 'doctor')  filtered.sort(function(a,b){ return (a.doctorName||'').localeCompare(b.doctorName||''); });

  setEl('resultsShowing', filtered.length); setEl('resultsShowing2', filtered.length);
  setEl('resultsTotal', prescriptions.length);
  updateActiveFilterTags(s);

  var allTerms = [s.patient, s.doctor, s.diagnosis, s.phone, s.email, s.id].filter(Boolean);
  renderList(filtered, allTerms.join(' '), allTerms);
}

function updateActiveFilterTags(s) {
  var tags = [];
  if (s.patient)   tags.push({label:'Patient: "' + s.patient + '"',    clear:function(){ document.getElementById('srchPatient').value='';   applyFilters(); }});
  if (s.doctor)    tags.push({label:'Doctor: "' + s.doctor + '"',       clear:function(){ document.getElementById('srchDoctor').value='';    applyFilters(); }});
  if (s.diagnosis) tags.push({label:'Diagnosis: "' + s.diagnosis + '"', clear:function(){ document.getElementById('srchDiagnosis').value=''; applyFilters(); }});
  if (s.phone)     tags.push({label:'Phone: "' + s.phone + '"',         clear:function(){ document.getElementById('srchPhone').value='';     applyFilters(); }});
  if (s.email)     tags.push({label:'Email: "' + s.email + '"',         clear:function(){ document.getElementById('srchEmail').value='';     applyFilters(); }});
  if (s.id)        tags.push({label:'ID: "' + s.id + '"',               clear:function(){ document.getElementById('srchId').value='';        applyFilters(); }});
  if (s.dateFrom)  tags.push({label:'From: ' + formatDate(s.dateFrom),  clear:function(){ document.getElementById('srchDateFrom').value='';  applyFilters(); }});
  if (s.dateTo)    tags.push({label:'To: '   + formatDate(s.dateTo),    clear:function(){ document.getElementById('srchDateTo').value='';    applyFilters(); }});
  if (s.status !== 'all') tags.push({label:'Status: ' + capitalize(s.status), clear:function(){ document.getElementById('statusFilter').value='all'; applyFilters(); }});
  if (currentTypeFilter !== 'all') tags.push({label:'Type: ' + capitalize(currentTypeFilter), clear:function(){
    currentTypeFilter = 'all';
    document.querySelectorAll('.type-filter-btn').forEach(function(b){ b.classList.remove('active-filter'); });
    document.querySelector('.type-filter-btn').classList.add('active-filter');
    applyFilters();
  }});

  var badge = document.getElementById('searchActiveBadge');
  if (badge) badge.classList.toggle('show', tags.length > 0);
  var container = document.getElementById('activeFilterTags');
  if (!container) return;
  if (!tags.length) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:11px;font-style:italic">No filters active</span>';
    return;
  }
  container.innerHTML = '';
  tags.forEach(function(t) {
    var el = document.createElement('span'); el.className = 'active-filter-tag';
    el.innerHTML = escHtml(t.label) + ' <span style="font-size:12px">×</span>';
    el.addEventListener('click', t.clear);
    container.appendChild(el);
  });
}

function clearFilters() {
  ['srchPatient','srchDoctor','srchDiagnosis','srchPhone','srchEmail','srchId','srchDateFrom','srchDateTo']
    .forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sortSelect').value   = 'newest';
  document.getElementById('statusFilter').value = 'all';
  currentTypeFilter = 'all';
  document.querySelectorAll('.type-filter-btn').forEach(function(b){ b.classList.remove('active-filter'); });
  var first = document.querySelector('.type-filter-btn'); if (first) first.classList.add('active-filter');
  applyFilters();
}

// ─── View switching ───────────────────────────────────────
function setView(view) {
  // Hide doctor/patient/feature views if switching away
  if (currentView === 'doctors') {
    document.getElementById('doctorsView').style.display = 'none';
    ['statsRow','controlsBar','prescriptionsList'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display=''; });
    var ai = document.getElementById('aiSearchPanel'); if (ai) ai.style.display = '';
  }
  if (currentView === 'patients') {
    var pv = document.getElementById('patientsView'); if (pv) pv.style.display = 'none';
    ['statsRow','controlsBar','prescriptionsList'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display=''; });
    var ai2 = document.getElementById('aiSearchPanel'); if (ai2) ai2.style.display = '';
  }

  currentView = view;
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  var titles = {all:'All Rx', recent:'Recent Rx (Last 30 Days)', active:'Active Rx'};
  var subs   = {all:'Manage all your medical records', recent:'Rx issued in the last 30 days', active:'Currently active treatment records'};
  document.getElementById('pageTitle').textContent    = titles[view] || 'Rx';
  document.getElementById('pageSubtitle').textContent = subs[view]   || '';

  // Show main Rx controls
  ['statsRow','controlsBar','prescriptionsList'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display=''; });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = '';

  applyFilters();
  if (typeof refreshSidebarDots === 'function') setTimeout(refreshSidebarDots, 20);
}

function filterByType(type) {
  currentTypeFilter = type;
  document.querySelectorAll('.type-filter-btn').forEach(function(b){ b.classList.remove('active-filter'); });
  if (event && event.currentTarget) event.currentTarget.classList.add('active-filter');
  applyFilters();
}
