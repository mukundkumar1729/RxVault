// ════════════════════════════════════════════════════════════
//  SCRIPT-UTILS.JS — Shared utility functions
//  Load order: FIRST among script-*.js files
// ════════════════════════════════════════════════════════════

// ─── HTML escaping ────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── Date helpers ─────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  try {
    var ds = String(d).length > 10 ? d : d + 'T00:00:00';
    return new Date(ds).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
  } catch(e) { return d; }
}
function addDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Toast notifications ──────────────────────────────────
function showToast(msg, type) {
  type = type || 'info';
  var icons = { success:'✅', error:'❌', info:'ℹ️' };
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type]||'ℹ️') + '</span> ' + msg;
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('toast-fade');
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 350);
  }, 3200);
}

// ─── Modal helpers ────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
}
function openOverlay(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeOverlay(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ─── Form helpers ─────────────────────────────────────────
function getVal(id) { return (document.getElementById(id)?.value || '').trim(); }
function setVal(id, val) { var el = document.getElementById(id); if (el && val != null) el.value = val; }
function focusEl(id) { document.getElementById(id)?.focus(); }
function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

// ─── Collapsible section helpers ─────────────────────────
function toggleSection(sectionId) {
  var s = document.getElementById(sectionId);
  if (s) s.classList.toggle('collapsed');
}
function expandSection(sectionId) {
  var el = document.getElementById(sectionId);
  if (el) el.classList.remove('collapsed');
}

// ─── Notes helpers ────────────────────────────────────────
function appendNote(text) {
  var ta = document.getElementById('fNotes'); if (!ta) return;
  var sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  ta.value += sep + text;
  updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
}
function insertNoteText(text) {
  var ta = document.getElementById('fNotes'); if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
}
function clearNotes() {
  var ta = document.getElementById('fNotes');
  if (ta && ta.value && confirm('Clear all clinical notes?')) {
    ta.value = ''; updateNotesCounter(ta); ta.style.height = '';
  }
}
function applyNoteTemplate(key) {
  if (!key) return;
  var FALLBACK = {
    fever:'• Drink plenty of warm fluids and rest.\n• Take paracetamol if temperature exceeds 100°F.',
    arthritis:'• Rest the affected joint. Avoid heavy lifting.',
    diabetes:'• Test blood sugar levels before meals and at bedtime.',
    hypertension:'• Check blood pressure daily and record readings.',
    ayurveda:'• Take medicine on an empty stomach with warm water.',
    homeopathy:'• Avoid coffee, mint during treatment.',
    postop:'• Keep wound clean and dry.',
    pediatric:'• Maintain hydration.',
    respiratory:'• Use inhaler as prescribed.',
    gastro:'• Eat small, frequent meals.'
  };
  var text = '';
  if (NOTE_TEMPLATES_DATA) { var t = NOTE_TEMPLATES_DATA.find(function(t){ return t.key === key; }); if (t) text = t.text; }
  if (!text) text = FALLBACK[key] || '';
  if (!text) return;
  var ta = document.getElementById('fNotes'); if (!ta) return;
  if (ta.value && !confirm('This will replace the current notes. Continue?')) {
    document.getElementById('noteTemplate').value = ''; return;
  }
  ta.value = text; updateNotesCounter(ta); autoResizeTextarea(ta); ta.focus();
  document.getElementById('noteTemplate').value = '';
}
function updateNotesCounter(ta) {
  var el = document.getElementById('notesCounter'); if (!el) return;
  var text = ta.value.trim(); var words = text ? text.split(/\s+/).length : 0; var chars = ta.value.length;
  el.textContent = words + ' word' + (words !== 1 ? 's' : '') + ' · ' + chars + ' char' + (chars !== 1 ? 's' : '');
  el.classList.toggle('notes-counter-warn', chars > 800);
}
function autoResizeTextarea(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 320) + 'px';
}
function toggleNoteCategory(btn) {
  var cat = btn.getAttribute('data-cat');
  if (activeNoteCategories.has(cat)) { activeNoteCategories.delete(cat); btn.classList.remove('active'); }
  else { activeNoteCategories.add(cat); btn.classList.add('active'); }
  updateNoteCategoryDisplay();
}
function updateNoteCategoryDisplay() {
  var el = document.getElementById('notesCategoryDisplay'); if (!el) return;
  if (!activeNoteCategories.size) { el.innerHTML = ''; return; }
  var labels = {dietary:'🥗 Dietary', lifestyle:'🏃 Lifestyle', warning:'⚠️ Warning', followup:'📅 Follow-up', medication:'💊 Medication', rest:'😴 Rest'};
  el.innerHTML = [...activeNoteCategories].map(function(c){ return '<span class="notes-cat-badge cat-'+c+'">' + (labels[c]||c) + '</span>'; }).join('');
}

// ─── Diagnosis helpers ────────────────────────────────────
function appendDiag(text) {
  var ta = document.getElementById('fDiagnosis'); if (!ta) return;
  var sep = ta.value && !ta.value.endsWith('\n') ? ', ' : '';
  ta.value += sep + text; updateDiagCounter(ta); autoDiagResize(ta); ta.focus();
  ta.selectionStart = ta.selectionEnd = ta.value.length;
}
function insertDiagText(text) {
  var ta = document.getElementById('fDiagnosis'); if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  updateDiagCounter(ta); autoDiagResize(ta); ta.focus();
}
function clearDiag() {
  var ta = document.getElementById('fDiagnosis'); if (!ta || !ta.value) return;
  ta.value = ''; updateDiagCounter(ta); ta.style.height = ''; ta.focus();
}
function updateDiagCounter(ta) {
  var el = document.getElementById('diagCounter'); if (!el) return;
  var text = ta.value.trim(); var words = text ? text.split(/\s+/).length : 0;
  el.textContent = words + ' word' + (words !== 1 ? 's' : '');
  el.classList.toggle('diag-warn', words > 80);
}
function autoDiagResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
}

// ─── Quick chips ──────────────────────────────────────────
var QUICK_CHIPS_FALLBACK = [
  {icon:'💧', label:'Warm fluids',       text:'Drink plenty of warm fluids.'},
  {icon:'🛏️', label:'Bed rest',          text:'Take complete bed rest for 2–3 days.'},
  {icon:'🧊', label:'Avoid cold',        text:'Avoid cold water and chilled foods.'},
  {icon:'🍽️', label:'After meals',       text:'Take medicines after meals.'},
  {icon:'🥄', label:'Before meals',      text:'Take medicines before meals.'},
  {icon:'🚭', label:'No alcohol/smoking',text:'Avoid alcohol and smoking.'},
  {icon:'📅', label:'F/U 7 days',        text:'Follow-up after 7 days.'},
  {icon:'📅', label:'F/U 1 month',       text:'Follow-up after 1 month.'},
  {icon:'🚨', label:'Return if worse',   text:'Return immediately if symptoms worsen.'},
  {icon:'🏋️', label:'Avoid exertion',    text:'Avoid strenuous physical activity.'},
  {icon:'🧂', label:'Low-salt diet',     text:'Maintain a low-salt diet.'},
  {icon:'🍬', label:'Low-sugar diet',    text:'Maintain a low-sugar diet.'},
  {icon:'😴', label:'Sleep 7-8h',        text:'Get adequate sleep (7–8 hours per night).'},
  {icon:'🩹', label:'Keep clean/dry',    text:'Keep wound/area clean and dry.'},
  {icon:'💊', label:'Take with water',   text:'Take medicine with a full glass of water.'},
  {icon:'☀️', label:'Morning dose',      text:'Take morning dose before 8 AM.'},
  {icon:'🌙', label:'Bedtime dose',      text:'Take dose at bedtime.'},
  {icon:'❄️', label:'Keep refrigerated', text:'Store medicine in refrigerator.'},
];
function renderQuickChips(filter) {
  filter = filter || '';
  var scroll = document.getElementById('quickChipsScroll'); if (!scroll) return;
  var chips = QUICK_CHIPS_DATA || QUICK_CHIPS_FALLBACK;
  var q = filter.toLowerCase().trim();
  var filtered = q ? chips.filter(function(c){ return c.label.toLowerCase().includes(q) || c.text.toLowerCase().includes(q); }) : chips;
  if (!filtered.length) { scroll.innerHTML = '<span style="color:var(--text-muted);font-size:12px;padding:5px 0">No chips match</span>'; return; }
  scroll.innerHTML = filtered.map(function(c) {
    return '<button type="button" class="quick-chip" data-text="' + escHtml(c.text) + '" onclick="appendNote(this.dataset.text)">' + c.icon + ' ' + c.label + '</button>';
  }).join('');
}

// ─── Doctor availability panel ────────────────────────────
function renderDoctorAvailPanel(d) {
  var panel = document.getElementById('doctorAvailPanel');
  var slotsEl = document.getElementById('availInlineSlots');
  var nameEl = document.getElementById('availInlineDoctorName');
  if (!panel) return;
  if (nameEl) nameEl.textContent = 'Dr. ' + d.name;
  var slotsHtml = '';
  if (d.unavailable) {
    slotsHtml = '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:12px;font-weight:600">🔴 Dr. ' + escHtml(d.name) + ' is currently marked as unavailable.</div>';
  } else if (!d.availability || !d.availability.length) {
    slotsHtml = '<span style="color:var(--text-muted);font-size:12px">No availability listed.</span>';
  } else {
    var TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    slotsHtml = d.availability.map(function(s) {
      return '<div class="avail-slot' + (s.day === TODAY_NAME ? ' avail-slot-today' : '') + '">' +
        '<span class="avail-day">' + s.day + (s.day === TODAY_NAME ? ' ✓' : '') + '</span>' +
        '<span class="avail-time">' + escHtml(s.time) + '</span></div>';
    }).join('');
  }
  if (slotsEl) slotsEl.innerHTML = slotsHtml;
  panel.classList.remove('hidden');
}
function clearDoctorAvailPanel() {
  var panel = document.getElementById('doctorAvailPanel');
  if (panel) panel.classList.add('hidden');
}

// ─── Sidebar toggle ───────────────────────────────────────
function toggleSidebar() {
  var shell = document.querySelector('.app-shell');
  if (!shell) return;
  
  if (window.innerWidth <= 900) {
    document.body.classList.toggle('sidebar-mobile-open');
  } else {
    var isCollapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem('rx_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }
}

// ─── Keyboard shortcuts ───────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeModal('rxFormModal'); closeModal('confirmModal'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openAddModal(); }
});

// ─── Close modals on overlay click ───────────────────────
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this.id);
    });
  });
});
