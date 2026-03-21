// ════════════════════════════════════════════════════════════
//  FEATURES.JS — High Priority Modules
//  1. Appointments / Queue Management
//  2. Billing & Invoices
//  3. Vital Signs Tracker
//  4. Patient Health Timeline
//  Load order: after script.js
// ════════════════════════════════════════════════════════════

// ─── Shared: hide all views helper ───────────────────────
function hideAllViews() {
  var ids = ['statsRow','controlsBar','prescriptionsList','aiSearchPanel',
             'doctorsView','patientsView','pharmacyView',
             'appointmentView','billingView','vitalsView'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function setNavActive(navId) {
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var nb = document.getElementById(navId);
  if (nb) nb.classList.add('active');
}

// ════════════════════════════════════════════════════════════
//  1. APPOINTMENTS / QUEUE MANAGEMENT
// ════════════════════════════════════════════════════════════
var appointments = [];

async function showAppointmentView() {
  currentView = 'appointments';
  hideAllViews();
  var av = document.getElementById('appointmentView');
  if (av) av.style.display = '';
  setNavActive('navAppointments');
  document.getElementById('pageTitle').textContent    = '📅 Appointments';
  document.getElementById('pageSubtitle').textContent = 'Today\'s queue and appointment management';
  var dateEl = document.getElementById('apptDateFilter');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();
  await loadAppointmentView();
}

async function loadAppointmentView() {
  var dateEl = document.getElementById('apptDateFilter');
  var date   = dateEl ? dateEl.value : todayISO();
  var list   = document.getElementById('apptList');
  var stats  = document.getElementById('apptStats');
  if (!list) return;

  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading…</div>';
  appointments = await dbGetAppointments(activeClinicId, date);

  // Stats
  var total    = appointments.length;
  var waiting  = appointments.filter(function(a){ return a.status === 'waiting'; }).length;
  var inRoom   = appointments.filter(function(a){ return a.status === 'in-room'; }).length;
  var done     = appointments.filter(function(a){ return a.status === 'done'; }).length;

  if (stats) {
    stats.innerHTML = [
      { label:'Total', val:total,   bg:'var(--surface2)',      clr:'var(--text-primary)' },
      { label:'Waiting', val:waiting, bg:'var(--allopathy-bg)', clr:'var(--allopathy)' },
      { label:'In Room', val:inRoom,  bg:'var(--teal-pale)',    clr:'var(--teal)' },
      { label:'Done',    val:done,    bg:'#e8f5e9',             clr:'var(--green)' },
    ].map(function(s) {
      return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius);'+
             'padding:10px 18px;display:flex;align-items:center;gap:10px">' +
             '<div style="font-size:22px;font-weight:700;color:'+s.clr+'">'+s.val+'</div>' +
             '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">'+s.label+'</div>' +
             '</div>';
    }).join('');
  }

  if (!appointments.length) {
    list.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📅</div>' +
        '<div class="empty-title">No appointments for this date</div>' +
        '<div class="empty-sub">Click "+ Book Appointment" to add one.</div>' +
      '</div>';
    return;
  }

  var statusConfig = {
    'waiting':  { label:'⏳ Waiting',  bg:'var(--allopathy-bg)', clr:'var(--allopathy)' },
    'in-room':  { label:'🔵 In Room',  bg:'var(--teal-pale)',    clr:'var(--teal)' },
    'done':     { label:'✅ Done',      bg:'#e8f5e9',             clr:'var(--green)' },
    'cancelled':{ label:'❌ Cancelled', bg:'var(--red-bg)',       clr:'var(--red)' },
  };

  list.innerHTML = appointments.map(function(a) {
    var sc = statusConfig[a.status] || statusConfig['waiting'];
    return (
      '<div class="rx-card" style="margin-bottom:10px;display:flex;align-items:center;gap:14px;padding:14px 18px">' +
        // Token
        '<div style="background:var(--teal);color:#fff;width:44px;height:44px;border-radius:50%;'+
          'display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">' +
          a.token_no +
        '</div>' +
        // Info
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:700;color:var(--text-primary)">' + escHtml(a.patient_name) + '</div>' +
          '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px;display:flex;flex-wrap:wrap;gap:10px">' +
            (a.doctor_name  ? '<span>🩺 Dr. '+escHtml(a.doctor_name)+'</span>' : '') +
            (a.phone        ? '<span>📱 '+escHtml(a.phone)+'</span>'           : '') +
            (a.appt_time    ? '<span>🕐 '+escHtml(a.appt_time)+'</span>'       : '') +
            (a.reason       ? '<span>📋 '+escHtml(a.reason)+'</span>'          : '') +
          '</div>' +
        '</div>' +
        // Status badge
        '<div style="background:'+sc.bg+';color:'+sc.clr+';padding:4px 12px;border-radius:20px;'+
          'font-size:11px;font-weight:700;flex-shrink:0">' + sc.label + '</div>' +
        // Actions
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          (a.status !== 'in-room'  && a.status !== 'done' ?
            '<button class="btn-sm btn-teal" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'in-room\')" style="font-size:11px">▶ Call</button>' : '') +
          (a.status === 'in-room' ?
            '<button class="btn-sm btn-teal" data-id="'+a.id+'" data-name="'+escAttr(a.patient_name)+'" onclick="apptOpenRx(this.dataset.id,this.dataset.name)" style="font-size:11px">📝 Prescribe</button>' : '') +
          (a.status !== 'done' && a.status !== 'cancelled' ?
            '<button class="btn-sm btn-outline-teal" data-id="'+a.id+'" onclick="updateApptStatus(this.dataset.id,\'done\')" style="font-size:11px">✅ Done</button>' : '') +
          '<button class="btn-sm btn-outline-red" data-id="'+a.id+'" onclick="deleteAppt(this.dataset.id)" style="font-size:11px">🗑️</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  // Update badge
  setEl('badgeAppointments', waiting);
}

async function updateApptStatus(id, status) {
  var appt = appointments.find(function(a){ return a.id === id; });
  if (!appt) return;
  appt.status = status;
  await dbUpsertAppointment(appt);
  await loadAppointmentView();
}

function apptOpenRx(apptId, patientName) {
  var patient = patientRegistry.find(function(p){
    return (p.name||'').trim().toLowerCase() === (patientName||'').trim().toLowerCase();
  });
  if (patient) {
    openPrescriptionForPatient(patient);
  } else {
    openAddModal();
    setTimeout(function(){ setVal('fPatientName', patientName); }, 100);
  }
}

async function deleteAppt(id) {
  if (!confirm('Delete this appointment?')) return;
  await dbDeleteAppointment(id);
  await loadAppointmentView();
}

function openBookAppointment() {
  var overlay = document.getElementById('bookApptOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bookApptOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  var dateEl = document.getElementById('apptDateFilter');
  var today  = dateEl ? dateEl.value : todayISO();
  var docOpts = doctorRegistry.map(function(d) {
    return '<option value="'+escAttr(d.name)+'"'+(d.unavailable?' disabled':'')+'>Dr. '+escHtml(d.name)+' — '+escHtml(d.specialization||d.type)+'</option>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:480px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📅 Book Appointment</div>' +
        '<div class="modal-subtitle">Add patient to queue</div></div>' +
        '<button class="modal-close" onclick="document.getElementById(\'bookApptOverlay\').classList.remove(\'open\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Patient Name *</label>' +
            '<input type="text" id="apptPatientName" placeholder="Full name" list="apptPatientList">' +
            '<datalist id="apptPatientList">' +
              patientRegistry.map(function(p){ return '<option value="'+escAttr(p.name)+'">'; }).join('') +
            '</datalist>' +
          '</div>' +
          '<div class="field"><label>Phone</label><input type="tel" id="apptPhone" placeholder="Mobile number"></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Date *</label><input type="date" id="apptDate" value="'+today+'"></div>' +
          '<div class="field"><label>Time</label><input type="time" id="apptTime"></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Doctor</label><select id="apptDoctor"><option value="">— Select Doctor —</option>'+docOpts+'</select></div>' +
          '<div class="field"><label>Reason / Chief Complaint</label><input type="text" id="apptReason" placeholder="e.g. Fever, Follow-up"></div>' +
        '</div>' +
        '<div id="apptBookError" style="color:var(--red);font-size:12.5px;min-height:18px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="document.getElementById(\'bookApptOverlay\').classList.remove(\'open\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveAppointment()">📅 Book Appointment</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ document.getElementById('apptPatientName')?.focus(); }, 100);
}

async function saveAppointment() {
  var name   = (document.getElementById('apptPatientName')?.value || '').trim();
  var date   = document.getElementById('apptDate')?.value || todayISO();
  var time   = document.getElementById('apptTime')?.value || '';
  var doctor = document.getElementById('apptDoctor')?.value || '';
  var phone  = document.getElementById('apptPhone')?.value || '';
  var reason = document.getElementById('apptReason')?.value || '';
  var errEl  = document.getElementById('apptBookError');

  if (!name) { if(errEl) errEl.textContent = 'Patient name is required.'; return; }
  if (errEl) errEl.textContent = '';

  var token = await dbGetNextToken(activeClinicId, date);
  var appt  = {
    id:           'appt_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    clinic_id:    activeClinicId,
    patient_name: name,
    phone:        phone,
    doctor_name:  doctor,
    appt_date:    date,
    appt_time:    time,
    reason:       reason,
    token_no:     token,
    status:       'waiting',
    created_at:   new Date().toISOString()
  };

  var ok = await dbUpsertAppointment(appt);
  if (!ok) { if(errEl) errEl.textContent = 'Failed to book. Try again.'; return; }

  document.getElementById('bookApptOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('apptDateFilter').value = date;
  showToast('✅ Token #' + token + ' booked for ' + name, 'success');
  await loadAppointmentView();
}

// ════════════════════════════════════════════════════════════
//  2. BILLING & INVOICES
// ════════════════════════════════════════════════════════════
var invoices = [];

async function showBillingView() {
  currentView = 'billing';
  hideAllViews();
  var bv = document.getElementById('billingView');
  if (bv) bv.style.display = '';
  setNavActive('navBilling');
  document.getElementById('pageTitle').textContent    = '💰 Billing & Invoices';
  document.getElementById('pageSubtitle').textContent = 'Patient invoices and payment records';
  await loadBillingView();
}

async function loadBillingView() {
  invoices = await dbGetInvoices(activeClinicId);
  renderBillingList(invoices);
  renderBillingStats(invoices);
}

function filterBilling() {
  var q      = (document.getElementById('billingSearch')?.value || '').toLowerCase().trim();
  var status = document.getElementById('billingStatusFilter')?.value || 'all';
  var list   = invoices.filter(function(inv) {
    if (status !== 'all' && inv.status !== status) return false;
    if (q) {
      var hay = [inv.patient_name, inv.invoice_no, inv.doctor_name].join(' ').toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
  renderBillingList(list);
}

function renderBillingStats(list) {
  var statsEl = document.getElementById('billingStats');
  if (!statsEl) return;
  var total   = list.reduce(function(s,i){ return s + (i.total_amount||0); }, 0);
  var paid    = list.filter(function(i){ return i.status==='paid'; }).reduce(function(s,i){ return s+(i.total_amount||0); }, 0);
  var unpaid  = list.filter(function(i){ return i.status!=='paid'; }).reduce(function(s,i){ return s+(i.total_amount||0); }, 0);
  var count   = list.length;
  statsEl.innerHTML = [
    { label:'Total Invoices', val:count,             bg:'var(--surface2)',      clr:'var(--text-primary)', prefix:'' },
    { label:'Total Revenue',  val:'₹'+total.toLocaleString('en-IN'), bg:'var(--teal-pale)',    clr:'var(--teal)',    prefix:'' },
    { label:'Collected',      val:'₹'+paid.toLocaleString('en-IN'),  bg:'#e8f5e9',             clr:'var(--green)',   prefix:'' },
    { label:'Pending',        val:'₹'+unpaid.toLocaleString('en-IN'),bg:'var(--red-bg)',       clr:'var(--red)',     prefix:'' },
  ].map(function(s) {
    return '<div style="background:'+s.bg+';border:1px solid var(--border);border-radius:var(--radius);'+
           'padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:140px">' +
           '<div style="font-size:18px;font-weight:700;color:'+s.clr+'">'+s.val+'</div>' +
           '<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">'+s.label+'</div>' +
           '</div>';
  }).join('');
}

function renderBillingList(list) {
  var container = document.getElementById('billingList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-icon">💰</div>' +
      '<div class="empty-title">No invoices yet</div>' +
      '<div class="empty-sub">Click "+ New Invoice" to create one.</div></div>';
    return;
  }
  container.innerHTML = list.map(function(inv) {
    var paid    = inv.status === 'paid';
    var items   = JSON.parse(inv.items_json || '[]');
    var itemsHtml = items.map(function(it) {
      return '<tr><td>'+escHtml(it.desc)+'</td><td style="text-align:right">₹'+Number(it.amount||0).toLocaleString('en-IN')+'</td></tr>';
    }).join('');
    return (
      '<div class="rx-card" style="margin-bottom:12px">' +
        '<div style="padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border-bottom:1px solid var(--border)">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              '<div style="font-size:15px;font-weight:700">'+escHtml(inv.patient_name)+'</div>' +
              '<div style="font-size:11px;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace">'+escHtml(inv.invoice_no)+'</div>' +
              '<div style="background:'+(paid?'#e8f5e9':'var(--allopathy-bg)')+';color:'+(paid?'var(--green)':'var(--allopathy)')+
                ';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+(paid?'✅ Paid':'⏳ Unpaid')+'</div>' +
            '</div>' +
            '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;display:flex;gap:14px;flex-wrap:wrap">' +
              (inv.doctor_name ? '<span>🩺 Dr. '+escHtml(inv.doctor_name)+'</span>' : '') +
              '<span>📅 '+formatDate(inv.invoice_date)+'</span>' +
              (inv.payment_method ? '<span>💳 '+escHtml(inv.payment_method)+'</span>' : '') +
            '</div>' +
          '</div>' +
          '<div style="font-size:20px;font-weight:700;color:var(--teal);flex-shrink:0">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</div>' +
        '</div>' +
        (itemsHtml ?
          '<div style="padding:10px 18px;border-bottom:1px solid var(--border)">' +
            '<table style="width:100%;font-size:12.5px;border-collapse:collapse"><tbody>'+itemsHtml+'</tbody>' +
            '<tfoot><tr><td style="font-weight:700;padding-top:6px;border-top:1px solid var(--border)">Total</td>' +
            '<td style="font-weight:700;text-align:right;padding-top:6px;border-top:1px solid var(--border)">₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</td></tr></tfoot></table>' +
          '</div>' : '') +
        '<div class="rx-footer-actions">' +
          '<button class="btn-sm btn-outline-teal" data-id="'+inv.id+'" onclick="printInvoice(this.dataset.id)">🖨️ Print</button>' +
          (!paid ? '<button class="btn-sm btn-teal" data-id="'+inv.id+'" onclick="markInvoicePaid(this.dataset.id)">✅ Mark Paid</button>' : '') +
          '<button class="btn-sm btn-outline-red" data-id="'+inv.id+'" onclick="deleteInvoice(this.dataset.id)">🗑️</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
  renderBillingStats(list);
}

function openNewInvoice() {
  var overlay = document.getElementById('newInvoiceOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'newInvoiceOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  var docOpts = doctorRegistry.map(function(d) {
    return '<option value="'+escAttr(d.name)+'">Dr. '+escHtml(d.name)+'</option>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:560px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">💰 New Invoice</div><div class="modal-subtitle">Create a patient invoice</div></div>' +
        '<button class="modal-close" onclick="document.getElementById(\'newInvoiceOverlay\').classList.remove(\'open\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Patient Name *</label>' +
            '<input type="text" id="invPatient" list="invPatientList" placeholder="Patient name">' +
            '<datalist id="invPatientList">'+patientRegistry.map(function(p){ return '<option value="'+escAttr(p.name)+'">'; }).join('')+'</datalist>' +
          '</div>' +
          '<div class="field"><label>Doctor</label><select id="invDoctor"><option value="">— Select —</option>'+docOpts+'</select></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Invoice Date *</label><input type="date" id="invDate" value="'+todayISO()+'"></div>' +
          '<div class="field"><label>Payment Method</label>' +
            '<select id="invPayMethod"><option>Cash</option><option>Card</option><option>UPI</option><option>Online</option><option>Insurance</option></select>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:10px">' +
          '<div class="form-section-title" style="margin-bottom:8px">📋 Invoice Items</div>' +
          '<div id="invItemsWrap"></div>' +
          '<button class="btn-sm btn-outline-teal" onclick="addInvoiceItem()" style="margin-top:6px;font-size:12px">＋ Add Item</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;padding-top:10px;border-top:1px solid var(--border)">' +
          '<span style="font-size:14px;color:var(--text-muted)">Total:</span>' +
          '<span id="invTotal" style="font-size:20px;font-weight:700;color:var(--teal)">₹0</span>' +
        '</div>' +
        '<div id="invError" style="color:var(--red);font-size:12.5px;min-height:18px;margin-top:6px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="document.getElementById(\'newInvoiceOverlay\').classList.remove(\'open\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveInvoice()">💾 Save Invoice</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  addInvoiceItem();
  // Auto-fill from last patient registration
  setTimeout(function(){ document.getElementById('invPatientName')?.focus(); }, 100);
}

function addInvoiceItem() {
  var wrap = document.getElementById('invItemsWrap') || document.getElementById('invoiceItems');
  if (!wrap) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML =
    '<input type="text" placeholder="Description (e.g. Consultation Fee)" style="flex:2;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif" class="inv-desc" oninput="updateInvTotal()">' +
    '<input type="number" placeholder="Amount ₹" min="0" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif" class="inv-amt" oninput="updateInvTotal()">' +
    '<button onclick="this.parentElement.remove();updateInvTotal()" style="background:var(--red-bg);color:var(--red);border:none;border-radius:var(--radius);padding:6px 10px;cursor:pointer;font-size:14px">✕</button>';
  wrap.appendChild(row);
}

function updateInvTotal() {
  var amts  = Array.from(document.querySelectorAll('.inv-amt')).map(function(el){ return parseFloat(el.value)||0; });
  var total = amts.reduce(function(s,a){ return s+a; }, 0);
  var el    = document.getElementById('invTotal');
  if (el) el.textContent = '₹' + total.toLocaleString('en-IN');
}

async function saveInvoice() {
  // Read from dynamic overlay (invPatient/invDoctor) or static modal (invPatientName/invDoctorName)
  var patient = (
    document.getElementById('invPatient')?.value ||
    document.getElementById('invPatientName')?.value || ''
  ).trim();
  var date    = document.getElementById('invDate')?.value || todayISO();
  var doctor  = (
    document.getElementById('invDoctor')?.value ||
    document.getElementById('invDoctorName')?.value || ''
  );
  var method  = document.getElementById('invPayMethod')?.value || 'Cash';
  var errEl   = document.getElementById('invError');
  if (!patient) { if(errEl) errEl.textContent='Patient name is required.'; return; }

  var items = [];
  document.querySelectorAll('#invItemsWrap > div, #invoiceItems > div').forEach(function(row) {
    var desc = row.querySelector('.inv-desc')?.value.trim() || '';
    var amt  = parseFloat(row.querySelector('.inv-amt')?.value || '0') || 0;
    if (desc || amt) items.push({ desc: desc, amount: amt });
  });
  if (!items.length) { if(errEl) errEl.textContent='Add at least one item.'; return; }

  var total     = items.reduce(function(s,i){ return s + (i.amount||0); }, 0);
  var invNo     = await dbGetNextInvoiceNo(activeClinicId);
  var inv = {
    id:             'inv_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    clinic_id:      activeClinicId,
    invoice_no:     invNo,
    patient_name:   patient,
    doctor_name:    doctor,
    invoice_date:   date,
    items_json:     JSON.stringify(items),
    total_amount:   total,
    payment_method: method,
    status:         'unpaid',
    created_at:     new Date().toISOString()
  };

  var ok = await dbUpsertInvoice(inv);
  if (!ok) { if(errEl) errEl.textContent='Failed to save. Try again.'; return; }

  document.getElementById('newInvoiceOverlay').classList.remove('open');
  document.body.style.overflow = '';
  showToast('✅ Invoice '+invNo+' created for '+patient, 'success');
  await loadBillingView();
}

async function markInvoicePaid(id) {
  var inv = invoices.find(function(i){ return i.id === id; });
  if (!inv) return;
  inv.status = 'paid';
  inv.paid_at = new Date().toISOString();
  await dbUpsertInvoice(inv);
  showToast('✅ Marked as paid', 'success');
  await loadBillingView();
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  var res = await db.from('invoices').delete().eq('id', id);
  if (res.error) { showToast('Failed to delete.', 'error'); return; }
  showToast('Invoice deleted.', 'info');
  await loadBillingView();
}

function printInvoice(id) {
  var inv = invoices.find(function(i){ return i.id === id; });
  if (!inv) return;
  var clinic  = getActiveClinic();
  var items   = JSON.parse(inv.items_json || '[]');
  var itemsHtml = items.map(function(it) {
    return '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">'+escHtml(it.desc)+'</td>' +
           '<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">₹'+Number(it.amount||0).toLocaleString('en-IN')+'</td></tr>';
  }).join('');
  var html =
    '<!DOCTYPE html><html><head><title>Invoice '+escHtml(inv.invoice_no)+'</title>' +
    '<style>body{font-family:DM Sans,sans-serif;padding:30px;color:#1a1a2e;font-size:13px}' +
    '.header{display:flex;justify-content:space-between;border-bottom:2px solid #0a7c6e;padding-bottom:16px;margin-bottom:20px}' +
    '.title{font-size:24px;font-weight:700;color:#0a7c6e}table{width:100%;border-collapse:collapse}' +
    '.total{font-size:18px;font-weight:700;color:#0a7c6e;text-align:right;margin-top:10px;padding-top:10px;border-top:2px solid #0a7c6e}' +
    '.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}' +
    '@media print{body{padding:20px}}</style></head>' +
    '<body onload="window.print()">' +
    '<div class="header"><div>' +
      '<div class="title">💊 Rx Vault</div>' +
      '<div style="font-size:12px;color:#666;margin-top:4px">'+(clinic?escHtml(clinic.name):'')+'</div>' +
    '</div><div style="text-align:right">' +
      '<div style="font-size:20px;font-weight:700">INVOICE</div>' +
      '<div style="font-family:monospace;font-size:14px;color:#0a7c6e">'+escHtml(inv.invoice_no)+'</div>' +
      '<div style="font-size:12px;color:#666;margin-top:4px">Date: '+formatDate(inv.invoice_date)+'</div>' +
      '<div class="badge" style="margin-top:6px;background:'+(inv.status==='paid'?'#e8f5e9':'#fff3e0')+';color:'+(inv.status==='paid'?'#2e7d32':'#e65100')+'">'+(inv.status==='paid'?'PAID':'UNPAID')+'</div>' +
    '</div></div>' +
    '<div style="margin-bottom:16px"><strong>Bill To:</strong> '+escHtml(inv.patient_name)+(inv.doctor_name?'<br><span style="color:#666;font-size:12px">Doctor: Dr. '+escHtml(inv.doctor_name)+'</span>':'')+'</div>' +
    '<table><thead><tr><th style="text-align:left;padding:8px 0;border-bottom:2px solid #eee">Description</th>' +
    '<th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee">Amount</th></tr></thead>' +
    '<tbody>'+itemsHtml+'</tbody></table>' +
    '<div class="total">Total: ₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+'</div>' +
    (inv.payment_method ? '<div style="font-size:12px;color:#666;margin-top:6px">Payment: '+escHtml(inv.payment_method)+'</div>' : '') +
    '<div style="margin-top:40px;font-size:11px;color:#999;text-align:center">Generated by Rx Vault · '+new Date().toLocaleDateString()+'</div>' +
    '</body></html>';
  var w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ════════════════════════════════════════════════════════════
//  3. VITAL SIGNS TRACKER
//  Accessed from patient card — "📊 Vitals" button
// ════════════════════════════════════════════════════════════
var vitalsData = [];
var vitalsPatientName = '';

async function openVitalsModal(patientName) {
  vitalsPatientName = patientName;
  var overlay = document.getElementById('vitalsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vitalsOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  vitalsData = await dbGetVitals(activeClinicId, patientName);

  var rows = vitalsData.slice(0, 10).map(function(v) {
    var bp  = v.bp_systolic  ? v.bp_systolic+'/'+v.bp_diastolic+' mmHg' : '—';
    var sug = v.blood_sugar  ? v.blood_sugar+' mg/dL' : '—';
    var wt  = v.weight       ? v.weight+' kg'         : '—';
    var sp  = v.spo2         ? v.spo2+'%'             : '—';
    var tmp = v.temperature  ? v.temperature+'°F'     : '—';
    var pr  = v.pulse        ? v.pulse+' bpm'         : '—';
    var flags = [];
    if (v.bp_systolic  > 140 || v.bp_diastolic > 90)  flags.push('<span style="color:var(--red);font-size:10px">⚠️ BP</span>');
    if (v.blood_sugar  > 200)                          flags.push('<span style="color:var(--red);font-size:10px">⚠️ Sugar</span>');
    if (v.spo2         < 95)                           flags.push('<span style="color:var(--red);font-size:10px">⚠️ SpO2</span>');
    if (v.temperature  > 100.4)                        flags.push('<span style="color:var(--red);font-size:10px">⚠️ Fever</span>');
    return '<tr>' +
      '<td style="padding:8px;font-size:12px">'+formatDate(v.recorded_at)+'</td>' +
      '<td style="padding:8px;font-size:12px">'+bp+'</td>' +
      '<td style="padding:8px;font-size:12px">'+sug+'</td>' +
      '<td style="padding:8px;font-size:12px">'+wt+'</td>' +
      '<td style="padding:8px;font-size:12px">'+tmp+'</td>' +
      '<td style="padding:8px;font-size:12px">'+pr+'</td>' +
      '<td style="padding:8px;font-size:12px">'+sp+'</td>' +
      '<td style="padding:8px;font-size:12px">'+flags.join(' ')+'</td>' +
    '</tr>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal" style="max-width:720px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📊 Vital Signs — '+escHtml(patientName)+'</div>' +
        '<div class="modal-subtitle">Record and track health vitals over time</div></div>' +
        '<button class="modal-close" onclick="document.getElementById(\'vitalsOverlay\').classList.remove(\'open\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        // Entry form
        '<div style="background:var(--surface2);border-radius:var(--radius);padding:16px;margin-bottom:18px">' +
          '<div class="form-section-title" style="margin-bottom:12px">➕ Record New Vitals</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
            vitalField('vBPSys',   'BP Systolic',  'number', '120', 'mmHg') +
            vitalField('vBPDia',   'BP Diastolic', 'number', '80',  'mmHg') +
            vitalField('vSugar',   'Blood Sugar',  'number', '100', 'mg/dL') +
            vitalField('vWeight',  'Weight',       'number', '70',  'kg') +
            vitalField('vTemp',    'Temperature',  'number', '98.6','°F') +
            vitalField('vPulse',   'Pulse',        'number', '72',  'bpm') +
            vitalField('vSpO2',    'SpO2',         'number', '98',  '%') +
            vitalField('vHeight',  'Height',       'number', '165', 'cm') +
          '</div>' +
          '<div style="margin-top:10px">' +
            '<button class="btn-sm btn-teal" onclick="saveVitals()" style="width:100%;justify-content:center;padding:9px">💾 Save Vitals</button>' +
          '</div>' +
        '</div>' +
        // History table
        '<div class="form-section-title" style="margin-bottom:8px">📈 History</div>' +
        (rows ?
          '<div style="overflow-x:auto"><table class="medicine-table"><thead><tr>' +
            '<th>Date</th><th>BP</th><th>Sugar</th><th>Weight</th><th>Temp</th><th>Pulse</th><th>SpO2</th><th>Alerts</th>' +
          '</tr></thead><tbody>'+rows+'</tbody></table></div>'
        : '<div style="color:var(--text-muted);font-size:13px;padding:12px 0">No vitals recorded yet.</div>') +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function vitalField(id, label, type, placeholder, unit) {
  return '<div><label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">'+label+' <span style="font-weight:400">('+unit+')</span></label>' +
    '<input type="'+type+'" id="'+id+'" placeholder="'+placeholder+'" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;box-sizing:border-box"></div>';
}

async function saveVitals() {
  var record = {
    id:           'vit_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
    clinic_id:    activeClinicId,
    patient_name: vitalsPatientName,
    bp_systolic:  parseFloat(document.getElementById('vBpSys')?.value)  || null,
    bp_diastolic: parseFloat(document.getElementById('vBpDia')?.value)  || null,
    sugar_fasting: parseFloat(document.getElementById('vSugarF')?.value)  || null,
    sugar_pp:     parseFloat(document.getElementById('vSugarPP')?.value) || null,
    sugar_random: parseFloat(document.getElementById('vSugarR')?.value)  || null,
    weight:       parseFloat(document.getElementById('vWeight')?.value) || null,
    temperature:  parseFloat(document.getElementById('vTemp')?.value)   || null,
    pulse:        parseFloat(document.getElementById('vPulse')?.value)  || null,
    spo2:         parseFloat(document.getElementById('vSpo2')?.value)   || null,
    height:       parseFloat(document.getElementById('vHeight')?.value) || null,
    recorded_at:  new Date().toISOString()
  };

  if (!Object.values(record).some(function(v,i){ return i > 3 && v !== null; })) {
    showToast('Enter at least one value.', 'error'); return;
  }

  var ok = await dbInsertVitals(record);
  if (!ok) { showToast('Failed to save vitals.', 'error'); return; }

  // Check for alerts
  var alerts = [];
  if (record.bp_systolic  > 140 || record.bp_diastolic > 90) alerts.push('High Blood Pressure');
  if (record.blood_sugar  > 200)                              alerts.push('High Blood Sugar');
  if (record.spo2         && record.spo2 < 95)               alerts.push('Low SpO2');
  if (record.temperature  > 100.4)                           alerts.push('Fever');

  if (alerts.length) {
    showToast('⚠️ Alerts: ' + alerts.join(', '), 'error');
  } else {
    showToast('✅ Vitals recorded for '+vitalsPatientName, 'success');
  }
  await openVitalsModal(vitalsPatientName);
}

// ════════════════════════════════════════════════════════════
//  4. PATIENT HEALTH TIMELINE
//  Accessed from patient card — "📋 Timeline" button
// ════════════════════════════════════════════════════════════
async function openPatientTimeline(patientName) {
  var overlay = document.getElementById('timelineOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'timelineOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML =
    '<div class="modal" style="max-width:680px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📋 Health Timeline — '+escHtml(patientName)+'</div>' +
        '<div class="modal-subtitle">Complete visit history, vitals and payments</div></div>' +
        '<button class="modal-close" onclick="document.getElementById(\'timelineOverlay\').classList.remove(\'open\')">✕</button>' +
      '</div>' +
      '<div class="modal-body" id="timelineBody">' +
        '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading timeline…</div>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Load data
  var rxList = prescriptions.filter(function(rx) {
    return (rx.patientName||'').trim().toLowerCase() === patientName.trim().toLowerCase();
  }).sort(function(a,b){ return new Date(b.date)-new Date(a.date); });

  var vitalsList = await dbGetVitals(activeClinicId, patientName);
  var invList    = invoices.filter(function(inv) {
    return (inv.patient_name||'').trim().toLowerCase() === patientName.trim().toLowerCase();
  });

  // Merge events
  var events = [];
  rxList.forEach(function(rx) {
    events.push({ date: rx.date, type: 'rx', data: rx });
  });
  vitalsList.forEach(function(v) {
    events.push({ date: v.recorded_at.split('T')[0], type: 'vitals', data: v });
  });
  invList.forEach(function(inv) {
    events.push({ date: inv.invoice_date, type: 'invoice', data: inv });
  });
  events.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });

  var body = document.getElementById('timelineBody');
  if (!body) return;

  if (!events.length) {
    body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No history found for this patient.</div>';
    return;
  }

  var html = '<div style="position:relative;padding-left:28px">';
  html += '<div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:var(--border)"></div>';

  events.forEach(function(ev) {
    var icon, bg, content;
    if (ev.type === 'rx') {
      var rx = ev.data;
      var typeIcon = {allopathy:'💉',homeopathy:'🌿',ayurveda:'🌱'}[rx.type]||'💊';
      icon = typeIcon; bg = 'var(--allopathy-bg)';
      content =
        '<div style="font-weight:700">'+typeIcon+' Prescription</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px">' +
          '🩺 Dr. '+escHtml(rx.doctorName||'—') +
          (rx.diagnosis ? ' · 🔬 '+escHtml(rx.diagnosis) : '') +
        '</div>' +
        (rx.medicines && rx.medicines.length ?
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">💊 '+
          rx.medicines.slice(0,3).map(function(m){ return escHtml(m.name); }).join(', ') +
          (rx.medicines.length>3 ? ' +more' : '') + '</div>' : '') +
        '<div style="margin-top:6px"><span style="background:'+(rx.status==='active'?'var(--green)':rx.status==='expired'?'var(--red)':'var(--text-muted)')+';color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+capitalize(rx.status||'')+'</span></div>';
    } else if (ev.type === 'vitals') {
      var v = ev.data;
      icon = '📊'; bg = 'var(--teal-pale)';
      var parts = [];
      if (v.bp_systolic)  parts.push('BP '+v.bp_systolic+'/'+v.bp_diastolic);
      if (v.blood_sugar)  parts.push('Sugar '+v.blood_sugar+'mg/dL');
      if (v.temperature)  parts.push('Temp '+v.temperature+'°F');
      if (v.pulse)        parts.push('Pulse '+v.pulse+'bpm');
      if (v.spo2)         parts.push('SpO2 '+v.spo2+'%');
      content =
        '<div style="font-weight:700">📊 Vitals Recorded</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px">'+parts.join(' · ')+'</div>';
    } else {
      var inv = ev.data;
      icon = '💰'; bg = '#e8f5e9';
      content =
        '<div style="font-weight:700">💰 Invoice '+escHtml(inv.invoice_no)+'</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:3px">' +
          '₹'+Number(inv.total_amount||0).toLocaleString('en-IN')+' · '+escHtml(inv.payment_method||'')+'</div>' +
        '<div style="margin-top:4px"><span style="background:'+(inv.status==='paid'?'var(--green)':'var(--allopathy)')+';color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+(inv.status==='paid'?'Paid':'Unpaid')+'</span></div>';
    }

    html +=
      '<div style="position:relative;margin-bottom:18px">' +
        '<div style="position:absolute;left:-22px;top:4px;width:12px;height:12px;border-radius:50%;background:'+bg+';border:2px solid var(--border)"></div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">'+formatDate(ev.date)+'</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;font-size:13px">' +
          content +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  body.innerHTML = html;
}

// ─── Wire vitals + timeline buttons into patient cards ─────
// Called from renderPatientsPage after building patient card body
function addPatientActionButtons(card, p) {
  var footer = card.querySelector('.rx-footer-actions');
  if (!footer) return;

  var vitalsBtn = document.createElement('button');
  vitalsBtn.className = 'btn-sm btn-outline-teal';
  vitalsBtn.textContent = '📊 Vitals';
  vitalsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    openVitalsModal(p.name);
  });

  var timelineBtn = document.createElement('button');
  timelineBtn.className = 'btn-sm btn-outline-teal';
  timelineBtn.textContent = '📋 Timeline';
  timelineBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    openPatientTimeline(p.name);
  });

  footer.insertBefore(vitalsBtn, footer.firstChild);
  footer.insertBefore(timelineBtn, footer.firstChild);
}

// ─── Update initAppForClinic to load invoices too ────────
var _origInitApp = typeof initAppForClinic === 'function' ? initAppForClinic : null;
async function initAppForClinic() {
  if (_origInitApp) await _origInitApp();
  // Load invoices for billing badge
  try {
    invoices = await dbGetInvoices(activeClinicId);
    var unpaidCount = invoices.filter(function(i){ return i.status !== 'paid'; }).length;
    setEl('badgeBilling', unpaidCount);
  } catch(e) {}
}

// ─── setView must also hide new views ─────────────────────
var _origSetView = typeof setView === 'function' ? setView : null;
// Patch hideAllViews into existing showDoctorView + showPatientsView
var _origShowDoctor   = typeof showDoctorView   === 'function' ? showDoctorView   : null;
var _origShowPatients = typeof showPatientsView  === 'function' ? showPatientsView  : null;
var _origShowPharmacy = typeof showPharmacyView  === 'function' ? showPharmacyView  : null;

function showDoctorView() {
  var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
  var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
  if (_origShowDoctor) _origShowDoctor();
}
function showPatientsView() {
  var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
  var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
  if (_origShowPatients) _origShowPatients();
}
function showPharmacyView() {
  var apv = document.getElementById('appointmentView'); if(apv) apv.style.display='none';
  var biv = document.getElementById('billingView');     if(biv) biv.style.display='none';
  if (_origShowPharmacy) _origShowPharmacy();
}
