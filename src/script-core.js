//  SCRIPT-CORE.JS — State, data loading, app init & boot
//  Depends on: script-utils.js, supabase.js, auth.js, clinic.js
// ════════════════════════════════════════════════════════════

// ─── Global state ─────────────────────────────────────────
var prescriptions      = [];
var editingId          = null;
var activeNoteCategories = new Set();
var currentView        = 'all';
var currentTypeFilter  = 'all';
var deleteTargetId     = null;
var doctorRegistry     = [];
var isAdminUnlocked    = false;
var editingDoctorIdx   = null;
var patientRegistry    = [];
var appointmentRegistry = [];
var billingRegistry    = [];

var TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

// ─── Quick chips & note templates data ───────────────────
var QUICK_CHIPS_DATA    = null;
var NOTE_TEMPLATES_DATA = null;

async function loadQuickChips() {
  try { QUICK_CHIPS_DATA = await fetch('data/quick-chips.json').then(function(r){ return r.json(); }); }
  catch(e) { QUICK_CHIPS_DATA = null; }
}
async function loadNoteTemplates() {
  try {
    NOTE_TEMPLATES_DATA = await fetch('data/note-templates.json').then(function(r){ return r.json(); });
    var sel = document.getElementById('noteTemplate');
    if (sel && NOTE_TEMPLATES_DATA) {
      sel.innerHTML = '<option value="">— Choose a template —</option>' +
        NOTE_TEMPLATES_DATA.map(function(t){ return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('');
    }
  } catch(e) { NOTE_TEMPLATES_DATA = null; }
}

// ─── Admin PIN ────────────────────────────────────────────
window.getAdminPin = function() { 
    const clinic = typeof window.getActiveClinic === 'function' ? window.getActiveClinic() : null;
    return clinic?.pin || 'admin1234'; 
};

// ─── Data loaders ─────────────────────────────────────────
async function loadData() {
  await Promise.all([
    dbGetPrescriptions(activeClinicId).then(function(d){ prescriptions = d; }),
    loadStaffData()
  ]);
}
async function loadStaffData() {
  if (typeof dbGetClinicStaff !== 'function') return;
  var staff = await dbGetClinicStaff(activeClinicId);
  window.staffStatusMap = {};
  if (staff) {
    staff.forEach(function(s) {
      if (s.status && s.status !== 'available') {
        window.staffStatusMap[s.name] = { status: s.status, until: s.status_until };
      }
    });
  }
}

async function loadPatientRegistry() {
  patientRegistry = await dbGetPatients(activeClinicId);
}

async function loadDoctorRegistry() {
  doctorRegistry = await dbGetDoctors(activeClinicId);
}

async function loadAppointmentRegistry() {
  if (typeof dbGetAppointments !== 'function') return;
  appointmentRegistry = await dbGetAppointments(activeClinicId);
}

async function loadBillingRegistry() {
  if (typeof dbGetInvoices !== 'function') return;
  billingRegistry = await dbGetInvoices(activeClinicId);
}

function genId() { return 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function genPatientId() { return 'PID-' + Date.now().toString(36).toUpperCase(); }

// ─── Main init — called after clinic is selected ─────────
async function initAppForClinic() {
  isAdminUnlocked = false;
  
  if (typeof window.showLoading === 'function') window.showLoading('Loading clinic data…');
  renderTopbarClinic();

  // Restore current user's status for this clinic
  if (typeof currentUser !== 'undefined' && currentUser) {
    var member = await dbGetStaffMember(activeClinicId, currentUser.id);
    if (member) {
      currentUser.status = member.status;
      currentUser.status_until = member.status_until;
      if (typeof updateStatusUI === 'function') updateStatusUI();
    }
  }

  await Promise.all([
    loadData(),
    loadPatientRegistry(),
    loadDoctorRegistry(),
    loadQuickChips(),
    loadNoteTemplates(),
    (async () => { if (typeof loadAppointmentRegistry === 'function') await loadAppointmentRegistry(); })(),
    (async () => { if (typeof loadBillingRegistry === 'function') await loadBillingRegistry(); })()
  ]);

  if (typeof window.hideLoading === 'function') window.hideLoading();
  
  render();
  updateStats();
  if (currentView === 'doctors')  renderAdminDoctorList();
  if (currentView === 'patients') renderPatientsPage(patientRegistry);
  if (typeof applyPermissionGuards === 'function') applyPermissionGuards();
  if (typeof initAiSearchPanel    === 'function') initAiSearchPanel();
}

// ─── Stats ────────────────────────────────────────────────
function updateStats() {
  var total  = prescriptions.length;
  var allo   = prescriptions.filter(function(p){ return p.type === 'allopathy'; }).length;
  var homo   = prescriptions.filter(function(p){ return p.type === 'homeopathy'; }).length;
  var ayur   = prescriptions.filter(function(p){ return p.type === 'ayurveda'; }).length;
  var now    = new Date();
  var thirty = new Date(now - 30 * 24 * 60 * 60 * 1000);
  var recent = prescriptions.filter(function(p){ return new Date(p.date) >= thirty; }).length;
  var active = prescriptions.filter(function(p){ return p.status === 'active'; }).length;

  var setEl = function(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };

  ['statTotal','statsTotal','statTotalMobile'].forEach(function(id){ setEl(id, total); });
  ['statAllo','statsAllo'].forEach(function(id){ setEl(id, allo); });
  ['statHomo','statsHomo'].forEach(function(id){ setEl(id, homo); });
  ['statAyur','statsAyur'].forEach(function(id){ setEl(id, ayur); });

  setEl('badgeAll', total);
  setEl('badgeRecent', recent);
  setEl('badgeActive', active);
  setEl('badgeDoctors', doctorRegistry.length);
  setEl('badgePatients', patientRegistry.length);
  
  // Appointments — Default badge shows today's "pending" queue or total for today
  if (typeof appointmentRegistry !== 'undefined') {
    var today = new Date().toISOString().split('T')[0];
    var todayAppts = appointmentRegistry.filter(function(a) { return (a.appt_date || '').slice(0, 10) === today; });
    var pending = todayAppts.filter(function(a) { return a.status === 'waiting' || a.status === 'in-room'; }).length;
    setEl('badgeAppointments', pending || todayAppts.length);
  }

  // Pharmacy
  var pendingRx = prescriptions.filter(function(p){ return !p.dispenseDate; }).length;
  setEl('badgePharmacy', pendingRx);

  // Billing
  if (typeof billingRegistry !== 'undefined') {
    setEl('badgeBilling', billingRegistry.length);
  }

  // Lab Orders
  var labOrders = prescriptions.reduce(function(acc, p){ return acc + (p.diagnostics ? p.diagnostics.length : 0); }, 0);
  setEl('badgeLabOrders', labOrders);

  setEl('badgeFollowup', 0);
  setEl('badgeVaccination', 0);
}
window.updateStats = updateStats;

// ─── Render entry point ───────────────────────────────────
function render() { updateStats(); if (typeof applyFilters === 'function') applyFilters(); applyPermissionUI(); }

// ─── Permission UI ────────────────────────────────────────
function applyPermissionUI() {
  if (typeof can === 'undefined') return;
  document.querySelectorAll('[data-perm]').forEach(function(el) {
    var perm    = el.dataset.perm;
    var allowed = (can[perm] && typeof can[perm] === 'function') ? can[perm]() : true;
    el.style.display = allowed ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="openAddModal"]').forEach(function(btn){
    btn.style.display = can.addPrescription() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="openRegisterModal"]').forEach(function(btn){
    btn.style.display = can.registerPatient() ? '' : 'none';
  });
  document.querySelectorAll('[onclick*="exportAll"]').forEach(function(btn){
    btn.style.display = can.exportData() ? '' : 'none';
  });
}


// ─── Clinic Calls (Digital Bell) ──────────────────────────
var lastActiveCallIds = new Set();
async function ringBell() {
  if (!activeClinicId || !currentUser) return;
  var msg = 'Staff requested at OPD / Consultation Room';
  var ok = await dbRingBell(activeClinicId, currentUser.name, msg);
  if (ok) {
    if (typeof showToast === 'function') showToast('🔔 Bell rung! Staff notified.', 'success');
    checkClinicCalls();
  }
}

async function checkClinicCalls() {
  if (!activeClinicId) return;
  var calls = await dbGetActiveCalls(activeClinicId);
  renderClinicCalls(calls);
}

function renderClinicCalls(calls) {
  var container = document.getElementById('clinicCallNotifications');
  if (!container) return;

  var currentIds = new Set(calls.map(function(c){ return c.id; }));
  var newCalls = calls.filter(function(c){ return !lastActiveCallIds.has(c.id); });
  
  if (newCalls.length > 0) {
    playBellSound();
  }
  lastActiveCallIds = currentIds;

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  container.innerHTML = calls.map(function(c) {
    return '<div class="call-notif" style="pointer-events:all; background:var(--surface); border:2px solid var(--teal); border-radius:var(--radius); padding:12px 16px; box-shadow:var(--shadow-lg); animation:slideIn 0.3s ease; display:flex; flex-direction:column; gap:4px; min-width:240px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; gap:12px">' +
        '<div style="font-weight:700; color:var(--teal); font-size:13px;">🔔 CALL FROM ' + escHtml(c.caller_name).toUpperCase() + '</div>' +
        '<button onclick="clearClinicCall(\'' + c.id + '\')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; padding:4px;">✕</button>' +
      '</div>' +
      '<div style="font-size:12.5px; color:var(--text-primary); font-weight:500;">' + escHtml(c.message) + '</div>' +
      '<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">' + new Date(c.created_at).toLocaleTimeString() + '</div>' +
    '</div>';
  }).join('');
}

async function clearClinicCall(id) {
  await dbClearCall(id);
  checkClinicCalls();
}

function playBellSound() {
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch(e) {}
}

setInterval(function() {
  if (typeof activeClinicId !== 'undefined' && activeClinicId) checkClinicCalls();
}, 10000);
document.addEventListener('DOMContentLoaded', function() {
  loadTheme();
  setTimeout(function() {
    if (typeof activeClinicId !== 'undefined' && activeClinicId) checkClinicCalls();
  }, 2000);
});

// ─── Stats Dropdown ───────────────────────────────────────
function toggleStatsDropdown(e) {
  if (e) e.stopPropagation();
  var dd = document.getElementById('statsDropdown');
  if (!dd) return;
  var isOpen = dd.classList.toggle('open');
  if (isOpen) {
    // Close on next outside click
    setTimeout(function() {
      document.addEventListener('click', function closeStats(ev) {
        var trigger = document.querySelector('.topbar-stats-trigger');
        if (trigger && trigger.contains(ev.target)) return;
        if (dd && dd.contains(ev.target)) return;
        dd.classList.remove('open');
        document.removeEventListener('click', closeStats);
      });
    }, 0);
  }
}

// ─── Theme System ─────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('rxvault_theme', theme);
  // Mark active button
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    var isMatch = btn.getAttribute('onclick').includes("'" + theme + "'");
    btn.style.borderColor = isMatch ? 'var(--teal)' : 'var(--border)';
    btn.style.boxShadow = isMatch ? '0 0 0 2px rgba(10,124,110,0.2)' : 'none';
  });
}

function loadTheme() {
  var saved = localStorage.getItem('rxvault_theme') || 'light';
  setTheme(saved);
}


// ─── Upgrade Plan Checkout Logic ──────────────────────────
let selectedUpgradePlanId = null;

async function calculateBreakdownLocally(planId, promoCode = '') {
    const { PLAN_LIMITS } = await import('./core/planConfig.js');
    const limits = PLAN_LIMITS[planId] || { price: 0 };
    const basePrice = limits.price;
    
    const UPGRADE_TAX_RATES = { CGST: 0.09, SGST: 0.09 };
    
    // Flexible Promo Codes Definition
    const UPGRADE_PROMO_CODES = { 
        'WELCOME10': 0.10, 
        'SAVE10': 0.10, 
        'SAVE25': 0.25,
        'SAVE60': 0.60,  
        'RX2026': 500, 
        'FREEBI': 1.0 
    };

    let discount = 0;
    const code = (promoCode || '').toUpperCase().trim();
    if (code && UPGRADE_PROMO_CODES[code]) {
        const val = UPGRADE_PROMO_CODES[code];
        discount = val <= 1 ? basePrice * val : val;
    }
    const taxable = Math.max(0, basePrice - discount);
    const tax1 = taxable * UPGRADE_TAX_RATES.CGST;
    const tax2 = taxable * UPGRADE_TAX_RATES.SGST;
    return {
        basePrice,
        discountAmount: discount,
        tax1: { name: 'CGST (9%)', amount: Math.round(tax1 * 100) / 100 },
        tax2: { name: 'SGST (9%)', amount: Math.round(tax2 * 100) / 100 },
        total: Math.round((taxable + tax1 + tax2) * 100) / 100
    };
}

window.showPlanSelection = function() {
  document.getElementById('planSelectionView').style.display = 'block';
  document.getElementById('checkoutBreakdownView').style.display = 'none';
}

window.showPlanBreakdown = async function(planId) {
  selectedUpgradePlanId = planId;
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
  document.getElementById('summaryPlanName').innerText = planName + ' Plan';
  
  // Transition UI
  document.getElementById('planSelectionView').style.display = 'none';
  document.getElementById('checkoutBreakdownView').style.display = 'block';
  
  // Fetch initial breakdown (no promo)
  await window.updateBreakdownUI();
}

window.applyPromoCode = async function() {
  const code = document.getElementById('promoCodeInput').value.trim();
  if (!code) return;
  await window.updateBreakdownUI(code);
}

window.updateBreakdownUI = async function(promoCode = null) {
  try {
    if (typeof window.showLoading === 'function') window.showLoading('Calculating breakdown…');
    
    // 1. Calculate locally first (ensures immediate UI update and works without Edge Function update)
    const breakdown = await calculateBreakdownLocally(selectedUpgradePlanId, promoCode);
    console.log('[Upgrade] Calculated local breakdown:', breakdown);

    // 2. Fallback to server if needed (optional, keeping it for parity)
    /*
    try {
        const { getOrderBreakdown } = await import('./services/razorpayService.js');
        const serverBreakdown = await getOrderBreakdown(selectedUpgradePlanId, promoCode, 'india');
        if (serverBreakdown) breakdown = serverBreakdown;
    } catch (e) { console.warn('[Upgrade] Server breakdown failed, using local.'); }
    */

    // 3. Update UI
    console.log('[Upgrade] Updating UI with breakdown:', breakdown);
    const basePrice = breakdown.basePrice || 0;
    document.getElementById('bdBasePrice').innerText = '₹' + basePrice.toLocaleString();
    
    if (breakdown.tax1) {
      document.getElementById('bdTax1Name').innerText = breakdown.tax1.name || 'Tax 1';
      document.getElementById('bdTax1Value').innerText = '₹' + (breakdown.tax1.amount || 0).toLocaleString();
    }
    if (breakdown.tax2) {
      document.getElementById('bdTax2Name').innerText = breakdown.tax2.name || 'Tax 2';
      document.getElementById('bdTax2Value').innerText = '₹' + (breakdown.tax2.amount || 0).toLocaleString();
    }
    
    document.getElementById('bdTotalAmount').innerText = '₹' + (breakdown.total || 0).toLocaleString();

    const discountRow = document.getElementById('bdDiscountRow');
    if (breakdown.discountAmount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('bdDiscountValue').innerText = '-₹' + breakdown.discountAmount.toLocaleString();
    } else {
      discountRow.style.display = 'none';
    }

    // Handle zero-amount checkout
    const payBtn = document.getElementById('btnFinalPay');
    if (payBtn) {
      if (breakdown.total <= 0) {
        payBtn.innerText = '✨ Activate Plan for Free';
        payBtn.style.background = 'var(--teal)';
      } else {
        payBtn.innerText = 'Secure Checkout with Razorpay';
        payBtn.style.background = '';
      }
    }

    if (typeof window.hideLoading === 'function') window.hideLoading();
  } catch (e) {
    if (typeof window.hideLoading === 'function') window.hideLoading();
    if (typeof window.showToast === 'function') window.showToast(e.message, 'error');
  }
}

window.proceedToPayment = async function() {
  const promoCode = (document.getElementById('promoCodeInput')?.value || '').trim();
  const clinicId = window.currentUpgradeClinicId || activeClinicId || localStorage.getItem('last_clinic_id'); 
  const user = JSON.parse(localStorage.getItem('rxvault_user_profile') || '{}');
  const country = 'india'; 

  // 1. Get current breakdown to check amount
  // We use local calculation for quick check, or service for server-side
  const breakdown = await calculateBreakdownLocally(selectedUpgradePlanId, promoCode);
  
  // 2. If 0 (e.g. 100% discount or Free plan), bypass Razorpay and activate directly
  if (breakdown && breakdown.total <= 0) {
    try {
      if (typeof window.showLoading === 'function') window.showLoading('Activating your plan…');
      
      const clinic = getActiveClinic();
      if (!clinic) throw new Error('No active clinic found.');

      // Calculate Expiry Date
      // Renewal (same plan): CurrentExpiry + 1yr
      // Upgrade (new plan): Today + 1yr
      let newExpiryDate = new Date();
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);

      if (clinic.plan === selectedUpgradePlanId && clinic.planExpiresAt) {
          const currentExpiry = new Date(clinic.planExpiresAt);
          // If already expired, start from today, else extend from current expiry
          const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
          newExpiryDate = new Date(baseDate.getTime());
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
      }

      const updateData = { 
        plan: selectedUpgradePlanId,
        plan_expires_at: newExpiryDate.toISOString()
      };

      const { db } = await import('./core/db.js');
      const { error } = await db.from('clinics').update(updateData).eq('id', clinicId);
      
      if (error) throw error;

      // Enforce limits immediately (reactivates staff)
      const { autoEnforceClinicLimits } = await import('./services/limitService.js');
      await autoEnforceClinicLimits(clinicId);

      if (typeof window.hideLoading === 'function') window.hideLoading();
      if (typeof window.showToast === 'function') window.showToast('✨ Plan Activated Successfully!', 'success');
      
      // Refresh UI
      if (typeof window.initClinicGate === 'function') window.initClinicGate();
      setTimeout(() => location.reload(), 1500);
      return;
    } catch (err) {
      if (typeof window.hideLoading === 'function') window.hideLoading();
      if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
      return;
    }
  }

  // 3. Verify Price with Server before opening Razorpay
  const { startUpgradeFlow, getOrderBreakdown } = await import('./services/razorpayService.js');
  
  try {
    if (typeof window.showLoading === 'function') window.showLoading('Verifying price with server...');
    
    const serverBreakdown = await getOrderBreakdown(selectedUpgradePlanId, promoCode, country);
    const localTotal = breakdown.total;
    const serverTotal = serverBreakdown.total;

    console.log('[PriceVerify]', { local: localTotal, server: serverTotal, serverBreakdown });

    // Allow 0.05 difference for rounding, but block major discrepancies (like missing discounts)
    if (Math.abs(localTotal - serverTotal) > 0.05) {
      if (typeof window.hideLoading === 'function') window.hideLoading();
      
      const errorMsg = `Price Mismatch!\nLocal: ₹${localTotal.toFixed(2)}\nServer: ₹${serverTotal.toFixed(2)}\n\nThis usually means the promo code was not recognized by the server. Please try again or use a different code.`;
      alert(errorMsg);
      return;
    }

    // 4. Normal Razorpay Flow
    await startUpgradeFlow(clinicId, selectedUpgradePlanId, user, promoCode, country);
  } catch (err) {
    if (typeof window.hideLoading === 'function') window.hideLoading();
    console.error('[VerifyError]', err);
    if (typeof window.showToast === 'function') window.showToast('Verification failed: ' + err.message, 'error');
  }
}

// ─── Phase 5 Modular Transition ──────────────────────────────
// Redundant legacy boot() removed in favor of ES6 main.js
// ════════════════════════════════════════════════════════════