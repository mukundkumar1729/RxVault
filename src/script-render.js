// ════════════════════════════════════════════════════════════
//  SCRIPT-RENDER.JS — Prescription list & card rendering
//  Depends on: script-utils.js, script-core.js
// ════════════════════════════════════════════════════════════

function renderList(items, searchQuery, allTerms) {
  searchQuery = searchQuery || '';
  allTerms    = allTerms    || [];
  var container = document.getElementById('prescriptionsList');
  if (!container) return; // Guard against null container
  if (!items.length) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📭</div>' +
        '<div class="empty-title">No prescriptions found</div>' +
        '<div class="empty-sub">' + (searchQuery ? 'No records match your search criteria.' : 'Start by adding your first prescription.') + '</div>' +
        (!searchQuery ? '<button class="btn-add" onclick="openAddModal()">＋ Add First Prescription</button>' : '') +
      '</div>';
    return;
  }
  container.innerHTML = items.map(function(p){ return renderCard(p, searchQuery, allTerms); }).join('');
}

function renderCard(p, q, allTerms) {
  q        = q        || '';
  allTerms = allTerms || [];

  var hl = function(str) {
    if (!str) return escHtml(str || '—');
    var result = escHtml(str);
    var terms  = allTerms.length ? allTerms : (q ? [q] : []);
    terms.forEach(function(term) {
      if (!term) return;
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
      result = result.replace(re, '<mark class="highlight">$1</mark>');
    });
    return result;
  };

  var typeLabel    = {allopathy:'💉 Allopathy', homeopathy:'🌿 Homeopathy', ayurveda:'🌱 Ayurveda'};
  var statusColors = {active:'var(--green)', completed:'var(--text-muted)', expired:'var(--red)'};
  var statusIcons  = {active:'🟢', completed:'✅', expired:'🔴'};

  // Medicines table
  var medsTable = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No medicines recorded.</div>';
  if (p.medicines && p.medicines.length) {
    medsTable = '<table class="medicine-table"><thead><tr>' +
      '<th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th>' +
      '</tr></thead><tbody>' +
      p.medicines.map(function(m) {
        return '<tr><td><strong>' + escHtml(m.name||'—') + '</strong></td>' +
          '<td>' + escHtml(m.dosage||'—') + '</td>' +
          '<td>' + escHtml(m.frequency||'—') + '</td>' +
          '<td>' + escHtml(m.duration||'—') + '</td>' +
          '<td>' + escHtml(m.route||'—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  // Diagnostics
  var diagSection = '';
  if (p.diagnostics && p.diagnostics.length) {
    diagSection = '<div class="rx-diagnostics">' +
      '<div class="medicines-title">🔬 Diagnosis &amp; Tests (' + p.diagnostics.length + ')</div>' +
      '<table class="medicine-table"><thead><tr><th>Test / Investigation</th><th>Observation / Notes</th></tr></thead><tbody>' +
      p.diagnostics.map(function(d) {
        return '<tr><td><strong>' + escHtml(d.test) + '</strong></td><td>' + escHtml(d.notes||'—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Notes
  var notesSection = p.notes
    ? '<div class="rx-notes"><div class="rx-notes-label">📝 Clinical Notes</div>' +
      '<div class="rx-notes-text">' + escHtml(p.notes) + '</div></div>' : '';

  // History & revisions
  var cnt    = prescriptions.filter(function(x){ return x.patientName === p.patientName && x.id !== p.id; }).length;
  var revCnt = (p.revisions || []).length;
  var historySection = '';
  if (cnt > 0) {
    historySection +=
      '<button class="history-toggle-btn" data-patient="' + escHtml(p.patientName) +
      '" data-id="' + p.id + '" onclick="togglePatientHistory(this)">' +
        '📋 Patient History <span class="hist-count">' + cnt + ' visit' + (cnt > 1 ? 's' : '') + '</span> ' +
        '<span class="hist-chevron">▼</span>' +
      '</button>' +
      '<div id="hist_' + p.id + '" class="hist-content" style="display:none"></div>';
  }
  if (revCnt > 0) {
    historySection +=
      '<button class="history-toggle-btn rev-btn" data-id="' + p.id + '" onclick="toggleRevisionHistory(this)">' +
        '📜 ' + revCnt + ' Revision' + (revCnt > 1 ? 's' : '') +
        ' <span class="hist-chevron">▼</span>' +
      '</button>' +
      '<div id="rev_' + p.id + '" class="hist-content" style="display:none"></div>';
  }

  var statusColor = statusColors[p.status] || 'var(--text-muted)';
  var statusIcon  = statusIcons[p.status]  || '';

  // ── Services / Vitals badge (count shown after load) ──
  var servicesBadge =
    '<span id="svc_badge_' + p.id + '" style="' +
      'display:none;align-items:center;justify-content:center;' +
      'width:18px;height:18px;' +
      'background:var(--teal);color:#fff;' +
      'border-radius:50%;font-size:10px;font-weight:700;' +
      'margin-left:4px;flex-shrink:0;' +
    '">0</span>';

  return (
    '<div class="rx-card" id="card_' + p.id + '">' +
      '<div class="rx-card-header" onclick="toggleCard(\'' + p.id + '\')">' +
        '<span class="rx-type-badge badge-' + p.type + '">' + (typeLabel[p.type] || p.type) + '</span>' +
        '<div class="rx-main">' +
          '<div class="rx-patient">' + hl(p.patientName) + '</div>' +
          '<div class="rx-meta">' +
            '<span class="rx-meta-item">🩺 ' + hl(p.doctorName) +
            (function(){
              if (typeof window === 'undefined' || !window.staffStatusMap) return '';
              var ss = window.staffStatusMap && window.staffStatusMap[p.doctorName];
              if (ss && ss.status && ss.status !== 'available') {
                var cls = ss.status.includes('_') ? ss.status.split('_')[0] : 'custom';
                if (ss.status.startsWith('on_')) cls = ss.status.split('_')[1];
                return ' <small class="status-badge status-' + cls + '" style="font-size:8.5px;padding:1px 5px">' + formatStatusLabel(ss.status) + '</small>';
              }
              return '';
            })() + '</span>' +
            (p.diagnosis ? '<span class="rx-meta-item">🔬 ' + hl(p.diagnosis) + '</span>' : '') +
            (p.hospital  ? '<span class="rx-meta-item">🏥 ' + hl(p.hospital)  + '</span>' : '') +
            '<span class="rx-meta-item" style="color:' + statusColor + '">' + statusIcon + ' ' + capitalize(p.status || 'unknown') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="rx-date-badge">' + formatDate(p.date) + '</div>' +
        '<div class="rx-actions" onclick="event.stopPropagation()">' +
          // ── Services button in header actions (quick access) ──
          '<button class="icon-btn" title="Record Vitals / Services" ' +
            'onclick="openServicesPanel(\'' + p.id + '\')" ' +
            'style="position:relative">' +
            '🩺' + servicesBadge +
          '</button>' +
          '<button class="icon-btn print" title="Print"  onclick="printPrescription(\'' + p.id + '\')">🖨️</button>' +
          '<button class="icon-btn edit"  title="Edit"   onclick="openEditModal(\''    + p.id + '\')">✏️</button>' +
          (p.status === 'expired' ? '<button class="icon-btn" title="Renew" onclick="renewPrescription(\'' + p.id + '\')" style="color:var(--teal)">🔄</button>' : '') +
          '<button class="icon-btn delete" title="Delete" onclick="confirmDelete(\''   + p.id + '\')">🗑️</button>' +
        '</div>' +
        '<span class="chevron-icon">▼</span>' +
      '</div>' +
      '<div class="rx-card-body" id="body_' + p.id + '">' +
        '<div class="rx-details-grid">' +
          '<div class="detail-group"><div class="detail-label">Patient Age &amp; Gender</div><div class="detail-value">' + (p.age ? p.age + ' yrs' : '—') + (p.gender ? ' · ' + p.gender : '') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Blood Group</div><div class="detail-value">' + (p.bloodGroup || '—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Contact</div><div class="detail-value mono">' + (p.phone || '—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Specialization</div><div class="detail-value">' + (p.specialization || '—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Hospital / Clinic</div><div class="detail-value">' + (p.hospital || '—') + '</div></div>' +
          '<div class="detail-group"><div class="detail-label">Valid Until</div><div class="detail-value">' + (p.validUntil ? formatDate(p.validUntil) : '—') + '</div></div>' +
        '</div>' +
        '<div class="rx-medicines"><div class="medicines-title">💊 Medicines (' + (p.medicines ? p.medicines.length : 0) + ')</div>' + medsTable + '</div>' +
        diagSection + notesSection +
        (historySection ? '<div class="rx-patient-history">' + historySection + '</div>' : '') +

        // ── SERVICES / VITALS INLINE SECTION ──
        '<div class="rx-vitals-inline" id="vitals_inline_' + p.id + '">' +
          _renderVitalsInlineSummary(p) +
        '</div>' +

        '<div class="rx-footer-actions">' +
          // ── Services button — prominent in footer ──
          '<button class="btn-sm" ' +
            'onclick="openServicesPanel(\'' + p.id + '\')" ' +
            'style="border:1.5px solid var(--teal);color:var(--teal);background:transparent;' +
              'border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;' +
              'display:flex;align-items:center;gap:6px;font-family:DM Sans,sans-serif;' +
              'transition:all 0.15s" ' +
            'onmouseenter="this.style.background=\'var(--teal-pale)\'" ' +
            'onmouseleave="this.style.background=\'transparent\'">' +
            '🩺 Services &amp; Vitals' +
          '</button>' +
          '<button class="btn-sm btn-outline-teal" onclick="printPrescription(\'' + p.id + '\')">🖨️ Print</button>' +
          '<button class="btn-sm btn-outline-teal" onclick="openEditModal(\''    + p.id + '\')">✏️ Edit</button>' +
          (p.email
            ? '<button class="btn-sm" onclick="notifyPatientForRx(\'' + p.id + '\')" title="Send expiry notification" style="border:1px solid var(--teal);color:var(--teal);background:transparent;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:DM Sans,sans-serif">📧 Notify</button>'
            : '') +
          (p.status === 'expired' && (typeof can !== 'undefined' && can.addPrescription())
            ? '<button class="btn-sm btn-teal" onclick="renewPrescription(\'' + p.id + '\')">🔄 Renew Rx</button>' : '') +
          '<button class="btn-sm btn-outline-red" onclick="confirmDelete(\'' + p.id + '\')">🗑️ Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ── Renders a compact "vitals recorded" strip inside the card body ──
// This is a placeholder until async data loads — JS patches it after badge load
function _renderVitalsInlineSummary(p) {
  // Will be replaced by loadAllRxVitalsBadges() after data fetch
  return '';
}

function toggleCard(id) { document.getElementById('card_' + id).classList.toggle('expanded'); }

// ─── Patient history ──────────────────────────────────────
function togglePatientHistory(btn) {
  var patientName = btn.dataset.patient, cardId = btn.dataset.id;
  var el = document.getElementById('hist_' + cardId); if (!el) return;
  var chevron = btn.querySelector('.hist-chevron');
  if (el.dataset.loaded === '1') {
    var open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (chevron) chevron.textContent = open ? '▼' : '▲';
    return;
  }
  el.dataset.loaded = '1';
  var history = prescriptions.filter(function(p){ return p.patientName === patientName && p.id !== cardId; })
    .sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  if (!history.length) { el.innerHTML = '<div class="hist-empty">No previous visits found.</div>'; }
  else {
    var statusClr = {active:'var(--green)', completed:'var(--text-muted)', expired:'var(--red)'};
    el.innerHTML = history.map(function(p) {
      return '<div class="hist-row">' +
        '<div class="hist-date">' + formatDate(p.date) + '</div>' +
        '<div class="hist-info">' +
          '<span class="hist-diag">' + escHtml(p.diagnosis || 'No diagnosis recorded') + '</span>' +
          (p.doctorName ? '<span class="hist-dr">🩺 ' + escHtml(p.doctorName) + '</span>' : '') +
          '<span class="hist-status" style="color:' + (statusClr[p.status] || 'var(--text-muted)') + '">' + capitalize(p.status || '') + '</span>' +
        '</div>' +
        (p.medicines && p.medicines.length
          ? '<div class="hist-meds">💊 ' + p.medicines.slice(0,3).map(function(m){ return escHtml(m.name); }).join(', ') + (p.medicines.length > 3 ? ' +' + (p.medicines.length-3) + ' more' : '') + '</div>'
          : '') +
      '</div>';
    }).join('');
  }
  el.style.display = ''; if (chevron) chevron.textContent = '▲';
}

// ─── Revision history ─────────────────────────────────────
function toggleRevisionHistory(btn) {
  var cardId = btn.dataset.id;
  var el = document.getElementById('rev_' + cardId); if (!el) return;
  var chevron = btn.querySelector('.hist-chevron');
  if (el.dataset.loaded === '1') {
    var open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (chevron) chevron.textContent = open ? '▼' : '▲';
    return;
  }
  el.dataset.loaded = '1';
  var p = prescriptions.find(function(x){ return x.id === cardId; });
  var revisions = (p?.revisions || []).slice().reverse();
  if (!revisions.length) { el.innerHTML = '<div class="hist-empty">No previous revisions.</div>'; el.style.display = ''; return; }
  var typeLabel = {allopathy:'💉 Allopathy', homeopathy:'🌿 Homeopathy', ayurveda:'🌱 Ayurveda'};
  el.innerHTML = revisions.map(function(rv, i) {
    var savedLabel = rv._savedAt
      ? 'Saved ' + new Date(rv._savedAt).toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'})
      : 'Version ' + (revisions.length - i);
    var medsSummary = (rv.medicines || []).slice(0,3).map(function(m){ return escHtml(m.name); }).join(', ') +
      (rv.medicines && rv.medicines.length > 3 ? ' +' + (rv.medicines.length - 3) + ' more' : '');
    return '<div class="rev-row">' +
      '<div class="rev-header">' +
        '<span class="rev-version">v' + (revisions.length - i) + '</span>' +
        '<span class="rev-date">' + savedLabel + '</span>' +
        '<span class="rev-type">' + (typeLabel[rv.type] || rv.type) + '</span>' +
        '<button class="rev-restore-btn" onclick="restoreRevision(\'' + cardId + '\',' + (revisions.length-1-i) + ')">↩ Restore</button>' +
      '</div>' +
      '<div class="rev-body">' +
        (rv.diagnosis ? '<div class="rev-field"><span class="rev-label">Diagnosis:</span> ' + escHtml(rv.diagnosis) + '</div>' : '') +
        (rv.status    ? '<div class="rev-field"><span class="rev-label">Status:</span> ' + capitalize(rv.status) + '</div>' : '') +
        (medsSummary  ? '<div class="rev-field"><span class="rev-label">Medicines:</span> 💊 ' + medsSummary + '</div>' : '') +
        (rv.notes     ? '<div class="rev-field"><span class="rev-label">Notes:</span> ' + escHtml(rv.notes.substring(0,120)) + (rv.notes.length > 120 ? '…' : '') + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
  el.style.display = ''; if (chevron) chevron.textContent = '▲';
}

function restoreRevision(cardId, revIdx) {
  if (!confirm('Restore this revision? The current prescription will become a new revision.')) return;
  var pIdx = prescriptions.findIndex(function(x){ return x.id === cardId; }); if (pIdx === -1) return;
  var p = prescriptions[pIdx];
  var revToRestore = (p.revisions || [])[revIdx]; if (!revToRestore) return;
  var snap = {...p}; delete snap.revisions;
  var newRevisions = [...(p.revisions || [])]; newRevisions.splice(revIdx, 1);
  newRevisions.push({...snap, _savedAt: p.updatedAt || p.createdAt || p.date});
  prescriptions[pIdx] = {...revToRestore, id: cardId, revisions: newRevisions, updatedAt: new Date().toISOString()};
  render();
  showToast('Revision restored successfully', 'success');
}

// ─── View a specific Rx from patient history ──────────────
function viewPatientRx(rxId) {
  setView_noNav('all');
  setTimeout(function() {
    var card = document.getElementById('card_' + rxId);
    if (card) { card.classList.add('expanded'); card.scrollIntoView({behavior:'smooth', block:'center'}); }
  }, 150);
}
function setView_noNav(view) {
  if (currentView === 'patients') {
    var pv = document.getElementById('patientsView'); if (pv) pv.style.display = 'none';
    var ai = document.getElementById('aiSearchPanel'); if (ai) ai.style.display = '';
    ['statsRow','controlsBar','prescriptionsList'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.style.display = '';
    });
  }
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('pageTitle').textContent    = 'All Rx';
  document.getElementById('pageSubtitle').textContent = 'Manage all your medical records';
  applyFilters();
}
