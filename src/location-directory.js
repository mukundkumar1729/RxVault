function showLocationDirectoryView() {
  currentView = 'locationDirectory';
  if (typeof hideAllViews === 'function') hideAllViews();

  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var navBtn = document.getElementById('navLocationDir'); if (navBtn) navBtn.classList.add('active');

  document.getElementById('pageTitle').textContent    = '🗺️ Location Directory';
  document.getElementById('pageSubtitle').textContent = 'Find where doctors, labs and facilities are located';

  var v = document.getElementById('locationDirView');
  if (!v) { v = document.createElement('div'); v.id='locationDirView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';
  renderLocationDirectory(v);
}

var _locationEntries = [];

async function renderLocationDirectory(container) {
  // Load saved entries from DB (using stock_items pattern with a category marker)
  try {
    var { data } = await db.from('location_directory').select('*').eq('clinic_id', activeClinicId).order('entity_type').order('name');
    _locationEntries = data || [];
  } catch(e) {
    // Table may not exist yet — use localStorage fallback
    try { _locationEntries = JSON.parse(localStorage.getItem('loc_dir_' + activeClinicId) || '[]'); } catch(e2) { _locationEntries = []; }
  }

  container.innerHTML =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">' +
      '<div style="position:relative;flex:1;min-width:200px">' +
        '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">🔍</span>' +
        '<input type="text" id="locDirSearch" placeholder="Search by name, floor, block, cabin…" oninput="filterLocationDir()" ' +
          'style="width:100%;padding:9px 12px 9px 34px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;box-sizing:border-box">' +
      '</div>' +
      '<select id="locDirTypeFilter" onchange="filterLocationDir()" ' +
        'style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="">All Types</option>' +
        '<option value="doctor">🩺 Doctor</option>' +
        '<option value="lab">🧪 Lab/Diagnostic</option>' +
        '<option value="pharmacy">💊 Pharmacy</option>' +
        '<option value="ward">🛏️ Ward</option>' +
        '<option value="ot">⚕️ OT/Procedure Room</option>' +
        '<option value="admin">🔐 Admin/Office</option>' +
        '<option value="other">📍 Other</option>' +
      '</select>' +
      (typeof can !== 'undefined' && can.accessAdminPanel && can.accessAdminPanel()
        ? '<button class="btn-add" onclick="openAddLocationEntry()" style="padding:9px 16px;font-size:13px;white-space:nowrap">＋ Add Location</button>' : '') +
    '</div>' +
    '<div id="locDirGrid"></div>';

  filterLocationDir();
}

function filterLocationDir() {
  var q    = (document.getElementById('locDirSearch')?.value    || '').toLowerCase().trim();
  var type = document.getElementById('locDirTypeFilter')?.value || '';
  var grid = document.getElementById('locDirGrid'); if (!grid) return;

  var filtered = _locationEntries.filter(function(e) {
    if (type && e.entity_type !== type) return false;
    if (q) {
      var hay = [(e.name||''), (e.floor||''), (e.block||''), (e.cabin||''), (e.notes||''), (e.entity_type||'')].join(' ').toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  // Merge with doctorRegistry for doctors not manually added
  if (!type || type === 'doctor') {
    (doctorRegistry||[]).forEach(function(d) {
      var exists = filtered.find(function(e){ return e.entity_type === 'doctor' && (e.name||'').toLowerCase() === ('Dr. '+d.name).toLowerCase(); });
      if (!exists && (!q || d.name.toLowerCase().includes(q))) {
        filtered.push({ id:'dr_'+d.id, entity_type:'doctor', name:'Dr. '+d.name, specialization:d.specialization||'', floor:'—', block:'—', cabin:'—', notes:'', phone:d.phone||'', _auto:true });
      }
    });
  }

  if (!filtered.length) {
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--surface);border:1px dashed var(--border2);border-radius:var(--radius-lg)"><div style="font-size:36px;margin-bottom:10px">🗺️</div><div style="font-weight:600">No locations found</div><div style="font-size:13px;margin-top:6px">Add location entries to help staff and patients navigate.</div></div>';
    return;
  }

  var typeConfig = {
    doctor:   { icon:'🩺', bg:'var(--allopathy-bg)', clr:'var(--allopathy)' },
    lab:      { icon:'🧪', bg:'var(--homeopathy-bg)', clr:'var(--homeopathy)' },
    pharmacy: { icon:'💊', bg:'var(--teal-pale)', clr:'var(--teal)' },
    ward:     { icon:'🛏️', bg:'var(--surface2)', clr:'var(--text-primary)' },
    ot:       { icon:'⚕️', bg:'var(--red-bg)', clr:'var(--red)' },
    admin:    { icon:'🔐', bg:'var(--ayurveda-bg)', clr:'var(--ayurveda)' },
    other:    { icon:'📍', bg:'var(--bg)', clr:'var(--text-muted)' }
  };

  grid.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">' +
    filtered.map(function(e) {
      var tc = typeConfig[e.entity_type] || typeConfig.other;
      var canEdit = !e._auto && typeof can !== 'undefined' && can.accessAdminPanel && can.accessAdminPanel();
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-sm);transition:box-shadow 0.2s" onmouseenter="this.style.boxShadow=\'var(--shadow)\'" onmouseleave="this.style.boxShadow=\'var(--shadow-sm)\'">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:42px;height:42px;border-radius:10px;background:'+tc.bg+';color:'+tc.clr+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+tc.icon+'</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(e.name)+'</div>' +
            (e.specialization ? '<div style="font-size:12px;color:var(--text-muted)">'+escHtml(e.specialization)+'</div>' : '') +
          '</div>' +
          (canEdit ? '<button onclick="openEditLocationEntry(\''+e.id+'\')" style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer;color:var(--text-muted)">✏️</button>' : '') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">' +
          '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">Floor</div><div style="font-weight:600;color:var(--text-primary)">'+(e.floor||'—')+'</div></div>' +
          '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">Block / Wing</div><div style="font-weight:600;color:var(--text-primary)">'+(e.block||'—')+'</div></div>' +
          '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">Cabin / Room</div><div style="font-weight:600;color:var(--teal)">'+(e.cabin||'—')+'</div></div>' +
          (e.phone ? '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">Contact</div><div style="font-weight:600">'+escHtml(e.phone)+'</div></div>' : '') +
        '</div>' +
        (e.notes ? '<div style="margin-top:10px;font-size:12px;color:var(--text-secondary);background:var(--surface2);padding:8px 10px;border-radius:8px;border-left:3px solid var(--teal)">'+escHtml(e.notes)+'</div>' : '') +
        (e._auto ? '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);font-style:italic">Auto-populated from doctor registry — add a manual entry to set location details.</div>' : '') +
      '</div>';
    }).join('') + '</div>';
}

async function openAddLocationEntry(existing) {
  var overlay = document.getElementById('locDirEntryOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='locDirEntryOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  var e = existing || {};

  var staffList = [];
  try { staffList = (await dbGetClinicStaff(activeClinicId)) || []; } catch(ex) { staffList = []; }
  window._locDirStaffMap = {};
  staffList.forEach(function(s) { window._locDirStaffMap[s.user_id] = s; });

  var staffOpts = '<option value="">— Select Staff Member —</option>' +
    staffList.map(function(s) {
      var sel = (e.staff_user_id === s.user_id) ? ' selected' : '';
      return '<option value="'+escAttr(s.user_id)+'"'+sel+'>'+escHtml(s.name)+' ('+escHtml((s.user_id||'').slice(-6))+')</option>';
    }).join('');

  var isDoctorType = (!e.entity_type || e.entity_type === 'doctor');

  overlay.innerHTML =
    '<div class="modal" style="max-width:480px">' +
      '<div class="modal-header"><div>' +
        '<div class="modal-title">'+(existing?'✏️ Edit':'➕ Add')+' Location Entry</div>' +
        '<div class="modal-subtitle">Add facility, doctor room or lab location</div>' +
      '</div><button class="modal-close" onclick="closeOverlay(\'locDirEntryOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Name <span style="color:var(--red)">*</span></label><input type="text" id="loc_name" value="'+escAttr(e.name||'')+'" placeholder="e.g. Dr. Priya Mehta / MRI Lab"></div>' +
          '<div class="field"><label>Type</label><select id="loc_type" onchange="onLocTypeChange()">' +
            ['doctor','lab','pharmacy','ward','ot','admin','other'].map(function(t){ return '<option value="'+t+'"'+(t===(e.entity_type||'doctor')?' selected':'')+'>'+({'doctor':'🩺 Doctor','lab':'🧪 Lab/Diagnostic','pharmacy':'💊 Pharmacy','ward':'🛏️ Ward','ot':'⚕️ OT/Procedure','admin':'🔐 Admin','other':'📍 Other'}[t])+'</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<div id="loc_staff_field" class="field" style="margin-bottom:12px;'+(isDoctorType?'':'display:none')+'">' +
          '<label>Staff Member <span style="font-size:11px;color:var(--text-muted);font-weight:400">(Registered only)</span></label>' +
          '<select id="loc_staff_id" onchange="onLocStaffSelect()" style="width:100%">'+staffOpts+'</select>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Select a registered staff member — name &amp; specialization will be auto-filled.</div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:12px"><label>Specialization / Description</label><input type="text" id="loc_spec" value="'+escAttr(e.specialization||'')+'" placeholder="e.g. Cardiologist, Blood Tests, MRI, CT Scan"></div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Floor No.</label><input type="text" id="loc_floor" value="'+escAttr(e.floor||'')+'" placeholder="e.g. Ground, 1st, 2nd"></div>' +
          '<div class="field"><label>Block / Wing</label><input type="text" id="loc_block" value="'+escAttr(e.block||'')+'" placeholder="e.g. Block A, East Wing"></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Cabin / Room No.</label><input type="text" id="loc_cabin" value="'+escAttr(e.cabin||'')+'" placeholder="e.g. Room 101, Cabin 5"></div>' +
          '<div class="field"><label>Contact / Extension</label><input type="tel" id="loc_phone" value="'+escAttr(e.phone||'')+'" placeholder="e.g. +91 98765 43210"></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0"><label>Notes / Timings</label><textarea id="loc_notes" rows="2" style="resize:vertical" placeholder="e.g. Mon-Fri 9am-5pm, Sat 9am-1pm">'+escHtml(e.notes||'')+'</textarea></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'locDirEntryOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveLocationEntry(\''+escAttr(e.id||'')+'\')">💾 Save</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

function onLocTypeChange() {
  var type = document.getElementById('loc_type')?.value || 'other';
  var staffField = document.getElementById('loc_staff_field');
  if (staffField) staffField.style.display = (type === 'doctor') ? '' : 'none';
  if (type !== 'doctor') {
    var staffSel = document.getElementById('loc_staff_id');
    if (staffSel) staffSel.value = '';
  }
}

function onLocStaffSelect() {
  var uid = document.getElementById('loc_staff_id')?.value || '';
  if (!uid || !window._locDirStaffMap) return;
  var staff = window._locDirStaffMap[uid];
  if (!staff) return;
  var nameEl = document.getElementById('loc_name');
  var specEl = document.getElementById('loc_spec');
  if (nameEl) nameEl.value = 'Dr. ' + staff.name;
  if (specEl) specEl.value = staff.specialization || staff.role || '';
}

function openEditLocationEntry(id) {
  var entry = _locationEntries.find(function(e){ return e.id === id; });
  if (entry) openAddLocationEntry(entry);
}

async function saveLocationEntry(existingId) {
  var name   = (document.getElementById('loc_name')?.value || '').trim();
  var type   = document.getElementById('loc_type')?.value || 'other';
  var errEl  = document.getElementById('loc_error');
  if (errEl) errEl.textContent = '';

  if (!name) { if(errEl) errEl.textContent='Name is required.'; showToast('Name is required.', 'error'); return; }

  // Doctor entries must be linked to a registered staff member
  if (type === 'doctor') {
    var staffId = document.getElementById('loc_staff_id')?.value || '';
    if (!staffId) {
      if(errEl) errEl.textContent='Please select a registered staff member for a Doctor location entry.';
      showToast('Select a registered staff member.', 'error');
      return;
    }
  }
  var entry = {
    id:          existingId || ('loc_'+Date.now()+'_'+Math.random().toString(36).slice(2,5)),
    clinic_id:   activeClinicId,
    staff_user_id: document.getElementById('loc_staff_id')?.value || null,
    entity_type: type,
    name,
    specialization: document.getElementById('loc_spec')?.value  || '',
    floor:       document.getElementById('loc_floor')?.value    || '',
    block:       document.getElementById('loc_block')?.value    || '',
    cabin:       document.getElementById('loc_cabin')?.value    || '',
    phone:       document.getElementById('loc_phone')?.value    || '',
    notes:       document.getElementById('loc_notes')?.value    || '',
    updated_at:  new Date().toISOString()
  };
  // Try saving to DB; fallback to localStorage
  try {
    await db.from('location_directory').upsert(entry, { onConflict: 'id' });
  } catch(e) {
    var entries = JSON.parse(localStorage.getItem('loc_dir_'+activeClinicId)||'[]');
    var idx = entries.findIndex(function(x){ return x.id === entry.id; });
    if (idx > -1) entries[idx] = entry; else entries.push(entry);
    localStorage.setItem('loc_dir_'+activeClinicId, JSON.stringify(entries));
  }
  if (existingId) {
    var idx2 = _locationEntries.findIndex(function(x){ return x.id === existingId; });
    if (idx2 > -1) _locationEntries[idx2] = entry; else _locationEntries.push(entry);
  } else {
    _locationEntries.push(entry);
  }
  closeOverlay('locDirEntryOverlay');
  showToast('📍 Location saved: ' + name, 'success');
  var v = document.getElementById('locationDirView');
  if (v) filterLocationDir();
}

// Inject Location Directory nav button
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var adminNav = document.querySelector('#sidebarAdmin .sidebar-nav-items') ||
                  document.querySelector('#sidebarLabClinical .sidebar-nav-items');
    if (adminNav && !document.getElementById('navLocationDir')) {
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.id = 'navLocationDir';
      btn.innerHTML = '<span class="nav-icon">🗺️</span> Location Directory';
      btn.onclick = showLocationDirectoryView;
      adminNav.insertBefore(btn, adminNav.firstChild);
    }
  }, 1600);
});

// Expose global refresh function for external hooks (e.g. from script-doctors.js)
window.refreshLocationDirectory = function() {
  var v = document.getElementById('locationDirView');
  if (v) renderLocationDirectory(v);
  else if (typeof filterLocationDir === 'function') filterLocationDir();
};
