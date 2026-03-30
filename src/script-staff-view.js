function showStaffListView() {
  currentView = 'staffList';
  if (typeof hideAllViews === 'function') hideAllViews();

  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel',
   'doctorsView','patientsView','pharmacyView','appointmentView','billingView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });

  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';

  var v = document.getElementById('staffListView');
  if (!v) { v = document.createElement('div'); v.id = 'staffListView'; document.querySelector('.main').appendChild(v); }
  v.style.display = '';

  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var navBtn = document.getElementById('navStaffList'); if (navBtn) navBtn.classList.add('active');

  document.getElementById('pageTitle').textContent    = '👥 Staff Directory';
  document.getElementById('pageSubtitle').textContent = 'All registered staff members and their roles';

  renderStaffListView(v);
}

async function renderStaffListView(container) {
  container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">⏳ Loading staff...</div>';

  var staffData = [];
  try {
    staffData = await dbGetClinicStaff(activeClinicId) || [];
  } catch(e) { console.error('[StaffList]', e); }

  var roleIcon = {
    admin:'🔐', doctor:'🩺', receptionist:'🧑‍💼', pharmacist:'💊', viewer:'👁️',
    medical_assistant:'🏥', lab_technician:'🧪', billing_manager:'💰',
    inventory_manager:'📦', clinic_supervisor:'⭐', medical_support_aide:'🛏️'
  };
  var roleBg = {
    admin:'var(--red-bg)', doctor:'var(--allopathy-bg)', receptionist:'var(--teal-pale)',
    pharmacist:'var(--homeopathy-bg)', viewer:'var(--bg)',
    medical_assistant:'var(--teal-pale)', lab_technician:'var(--bg)',
    billing_manager:'var(--bg)', inventory_manager:'var(--bg)',
    clinic_supervisor:'var(--teal-pale)', medical_support_aide:'var(--bg)'
  };
  var roleClr = {
    admin:'var(--red)', doctor:'var(--allopathy)', receptionist:'var(--teal)',
    pharmacist:'var(--homeopathy)', viewer:'var(--text-muted)',
    medical_assistant:'var(--teal)', lab_technician:'var(--text-primary)',
    billing_manager:'var(--text-primary)', inventory_manager:'var(--text-primary)',
    clinic_supervisor:'var(--teal)', medical_support_aide:'var(--text-primary)'
  };

  container.innerHTML =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">' +
      '<div style="position:relative;flex:1;min-width:200px">' +
        '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">🔍</span>' +
        '<input type="text" id="staffListSearch" placeholder="Search by name, email, role…" oninput="filterStaffListView()" ' +
          'style="width:100%;padding:9px 12px 9px 34px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;box-sizing:border-box">' +
      '</div>' +
      '<select id="staffListRoleFilter" onchange="filterStaffListView()" ' +
        'style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="">All Roles</option>' +
        ['admin','doctor','receptionist','pharmacist','medical_assistant','lab_technician','billing_manager','inventory_manager','clinic_supervisor','medical_support_aide','viewer']
          .map(function(r){ return '<option value="'+r+'">'+(roleIcon[r]||'👤')+' '+capitalize(r.replace(/_/g,' '))+'</option>'; }).join('') +
      '</select>' +
      '<select id="staffListStatusFilter" onchange="filterStaffListView()" ' +
        'style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="">All Status</option>' +
        '<option value="active">✅ Active</option>' +
        '<option value="inactive">🔴 Inactive</option>' +
      '</select>' +
    '</div>' +
    '<div id="staffListGrid"></div>';

  window._staffListData = staffData;
  filterStaffListView();
}

function filterStaffListView() {
  var staffData = window._staffListData || [];
  var q      = (document.getElementById('staffListSearch')?.value || '').toLowerCase().trim();
  var role   = document.getElementById('staffListRoleFilter')?.value || '';
  var status = document.getElementById('staffListStatusFilter')?.value || '';

  var filtered = staffData.filter(function(s) {
    if (role   && s.role !== role) return false;
    if (status === 'active'   && !s.is_active) return false;
    if (status === 'inactive' &&  s.is_active) return false;
    if (q) {
      var hay = [(s.name||''), (s.email||''), (s.role||'')].join(' ').toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  var grid = document.getElementById('staffListGrid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);background:var(--surface);border:1px dashed var(--border2);border-radius:var(--radius-lg)"><div style="font-size:36px;margin-bottom:10px">👥</div><div style="font-weight:600">No staff members found</div></div>';
    return;
  }

  var roleIcon = { admin:'🔐', doctor:'🩺', receptionist:'🧑‍💼', pharmacist:'💊', viewer:'👁️', medical_assistant:'🏥', lab_technician:'🧪', billing_manager:'💰', inventory_manager:'📦', clinic_supervisor:'⭐', medical_support_aide:'🛏️' };
  var roleBg   = { admin:'var(--red-bg)', doctor:'var(--allopathy-bg)', receptionist:'var(--teal-pale)', pharmacist:'var(--homeopathy-bg)', viewer:'var(--bg)', medical_assistant:'var(--teal-pale)', lab_technician:'var(--bg)', billing_manager:'var(--bg)', inventory_manager:'var(--bg)', clinic_supervisor:'var(--teal-pale)', medical_support_aide:'var(--bg)' };
  var roleClr  = { admin:'var(--red)', doctor:'var(--allopathy)', receptionist:'var(--teal)', pharmacist:'var(--homeopathy)', viewer:'var(--text-muted)', medical_assistant:'var(--teal)', lab_technician:'var(--text-primary)', billing_manager:'var(--text-primary)', inventory_manager:'var(--text-primary)', clinic_supervisor:'var(--teal)', medical_support_aide:'var(--text-primary)' };

  grid.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">' +
    filtered.map(function(s) {
      var initials = (s.name||'?').split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
      var lastLogin = s.last_login ? new Date(s.last_login).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'Never';
      var isMe = typeof currentUser !== 'undefined' && currentUser && s.user_id === currentUser.id;
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-sm);transition:box-shadow 0.2s;position:relative" onmouseenter="this.style.boxShadow=\'var(--shadow)\'" onmouseleave="this.style.boxShadow=\'var(--shadow-sm)\'">' +
        (isMe ? '<div style="position:absolute;top:12px;right:12px;background:var(--teal-pale);color:var(--teal);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">YOU</div>' : '') +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--teal-light),var(--teal));color:#fff;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(10,124,110,0.3)">' + initials + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(s.name||'—') + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(s.email||'—') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          '<span style="background:'+(roleBg[s.role]||'var(--bg)')+';color:'+(roleClr[s.role]||'var(--text-muted)')+';font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px">'+(roleIcon[s.role]||'👤')+' '+capitalize((s.role||'').replace(/_/g,' '))+'</span>' +
          (s.staff_type === 'adhoc' ? '<span style="background:var(--bg);color:var(--text-muted);border:1px solid var(--border);font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px">Ad-hoc</span>' : '') +
          (s.is_active ? '' : '<span style="background:var(--red-bg);color:var(--red);font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px">Inactive</span>') +
        '</div>' +
        '<div style="font-size:11.5px;color:var(--text-muted)">Last login: ' + lastLogin + '</div>' +
        (s.status && s.status !== 'available' ? '<div style="margin-top:6px;font-size:11px;color:var(--ayurveda);background:var(--ayurveda-bg);padding:3px 8px;border-radius:6px;display:inline-block">📍 ' + formatStatusLabel(s.status) + '</div>' : '') +
      '</div>';
    }).join('') +
    '</div>';
}

// Inject Staff List nav item into Records sidebar section
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var recordsNav = document.querySelector('#sidebarRecords .sidebar-nav-items');
    if (recordsNav && !document.getElementById('navStaffList')) {
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.id = 'navStaffList';
      btn.innerHTML = '<span class="nav-icon">👥</span> Staff Directory <span class="nav-badge" id="badgeStaffList">0</span>';
      btn.onclick = showStaffListView;
      recordsNav.appendChild(btn);
      // Update count
      if (typeof dbGetClinicStaff === 'function') {
        dbGetClinicStaff(activeClinicId).then(function(d){ setEl('badgeStaffList', (d||[]).length); }).catch(function(){});
      }
    }
  }, 1500);
});

