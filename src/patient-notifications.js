// ════════════════════════════════════════════════════════════
//  PATIENT-NOTIFICATIONS.JS
//  Prescription expiry notification system for Rx Vault
//
//  Features:
//  1. In-app notification bell (shown when staff is logged in)
//  2. Email notification via Supabase Edge Function
//  3. Auto-check on app load + every 30 minutes
//  4. Patient-facing notification when patient email is on record
//  5. Manual "Notify Patient" button on each Rx card
// ════════════════════════════════════════════════════════════

var NOTIF_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
var NOTIF_WARN_DAYS         = 3;               // warn when ≤ 3 days left
var _notifTimer             = null;
var _notifList              = [];              // in-memory notification cache

// ════════════════════════════════════════════════════════════
//  1. EXPIRY CHECKING
// ════════════════════════════════════════════════════════════

/**
 * Returns all active prescriptions expiring within NOTIF_WARN_DAYS days
 * or already expired today.
 */
function getExpiringPrescriptions() {
  var today    = new Date(); today.setHours(0,0,0,0);
  var warnDate = new Date(today.getTime() + NOTIF_WARN_DAYS * 24 * 60 * 60 * 1000);

  return prescriptions.filter(function(rx) {
    if (!rx.validUntil || rx.status !== 'active') return false;
    var expiry = new Date(rx.validUntil + 'T00:00:00');
    return expiry <= warnDate; // expires within warn window or already past
  }).map(function(rx) {
    var expiry   = new Date(rx.validUntil + 'T00:00:00');
    var diffMs   = expiry.getTime() - today.getTime();
    var daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      rx:       rx,
      daysLeft: daysLeft,
      expired:  daysLeft < 0,
      expiring: daysLeft >= 0 && daysLeft <= NOTIF_WARN_DAYS
    };
  });
}

/**
 * Run the expiry check, update the notification bell, and
 * auto-send emails for patients whose email is on file and
 * haven't been notified in the last 24h.
 */
async function runNotificationCheck() {
  var items = getExpiringPrescriptions();
  _notifList = items;
  renderNotificationBell(items);

  // Auto-send emails for items not yet notified today
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.rx.email && shouldSendEmail(item.rx)) {
      await sendExpiryEmail(item.rx, item.daysLeft);
    }
  }
}

/**
 * Returns true if we haven't already sent a notification email
 * for this Rx in the last 24 hours (stored in localStorage).
 */
function shouldSendEmail(rx) {
  var key       = 'rxnotif_' + rx.id;
  var lastSent  = localStorage.getItem(key);
  if (!lastSent) return true;
  var hoursSince = (Date.now() - parseInt(lastSent, 10)) / 3600000;
  return hoursSince >= 24;
}

function markEmailSent(rxId) {
  localStorage.setItem('rxnotif_' + rxId, Date.now().toString());
}

// ════════════════════════════════════════════════════════════
//  2. IN-APP NOTIFICATION BELL
// ════════════════════════════════════════════════════════════

function renderNotificationBell(items) {
  // Create bell if it doesn't exist
  var existing = document.getElementById('notifBellWrap');
  if (!existing) {
    var topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    var wrap  = document.createElement('div');
    wrap.id   = 'notifBellWrap';
    wrap.style.cssText = 'position:relative;display:flex;align-items:center';
    wrap.innerHTML =
      '<button id="notifBellBtn" onclick="toggleNotifPanel()" ' +
        'style="position:relative;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);' +
        'border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;' +
        'justify-content:center;font-size:16px;transition:background 0.15s;color:#fff" ' +
        'title="Prescription Notifications">' +
        '🔔' +
        '<span id="notifBadge" style="display:none;position:absolute;top:-4px;right:-4px;' +
          'background:var(--red);color:#fff;border-radius:50%;width:18px;height:18px;' +
          'font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;' +
          'border:2px solid var(--indian-red)">0</span>' +
      '</button>' +
      '<div id="notifPanel" style="display:none;position:absolute;top:calc(100% + 10px);right:0;' +
        'background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);' +
        'box-shadow:var(--shadow-lg);min-width:340px;max-width:400px;z-index:500;overflow:hidden;' +
        'animation:slideIn 0.15s ease">' +
      '</div>';
    // Insert before user menu
    var userDiv = topbarRight.querySelector('[style*="position:relative"]');
    topbarRight.insertBefore(wrap, userDiv || topbarRight.firstChild);
  }

  var badge = document.getElementById('notifBadge');
  var panel = document.getElementById('notifPanel');
  if (!badge || !panel) return;

  if (!items.length) {
    badge.style.display = 'none';
    panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">✅ No expiring prescriptions</div>';
    return;
  }

  var urgentCount = items.filter(function(i){ return i.daysLeft <= 1; }).length;
  badge.style.display = 'flex';
  badge.textContent   = items.length > 9 ? '9+' : items.length;
  badge.style.background = urgentCount > 0 ? 'var(--red)' : 'var(--ayurveda)';

  panel.innerHTML =
    '<div style="padding:14px 16px 10px;border-bottom:1px solid var(--border);background:var(--surface2);' +
      'display:flex;align-items:center;justify-content:space-between">' +
      '<div style="font-weight:700;font-size:14px;color:var(--text-primary)">🔔 Prescription Alerts</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">' + items.length + ' expiring soon</div>' +
    '</div>' +
    '<div style="max-height:380px;overflow-y:auto">' +
      items.map(function(item) {
        var rx       = item.rx;
        var urgency  = item.expired ? 'red' : item.daysLeft <= 1 ? 'red' : item.daysLeft <= 2 ? 'ayurveda' : 'teal';
        var urgencyClr = { red:'var(--red)', ayurveda:'var(--ayurveda)', teal:'var(--teal)' }[urgency];
        var urgencyBg  = { red:'var(--red-bg)', ayurveda:'var(--ayurveda-bg)', teal:'var(--teal-pale)' }[urgency];
        var label = item.expired
          ? '🔴 Expired ' + Math.abs(item.daysLeft) + ' day' + (Math.abs(item.daysLeft) !== 1 ? 's' : '') + ' ago'
          : item.daysLeft === 0
            ? '🟠 Expires today'
            : item.daysLeft === 1
              ? '🟠 Expires tomorrow'
              : '🟡 Expires in ' + item.daysLeft + ' days';
        return '<div style="padding:12px 16px;border-bottom:1px solid var(--border);transition:background 0.12s" ' +
          'onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-weight:600;font-size:13.5px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(rx.patientName) + '</div>' +
              '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + escHtml(rx.diagnosis||'—') + '</div>' +
              '<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">🩺 Dr. ' + escHtml(rx.doctorName||'—') + ' · ' + formatDate(rx.validUntil) + '</div>' +
            '</div>' +
            '<span style="background:' + urgencyBg + ';color:' + urgencyClr + ';font-size:10px;font-weight:700;' +
              'padding:3px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0">' + label + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-top:8px">' +
            '<button onclick="notifViewRx(\'' + rx.id + '\')" ' +
              'style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer;color:var(--text-secondary)">👁 View Rx</button>' +
            (rx.email
              ? '<button onclick="notifSendEmail(\'' + rx.id + '\')" data-rxid="' + rx.id + '" ' +
                  'style="font-size:11px;padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:transparent;cursor:pointer;color:var(--teal)">📧 Notify Patient</button>'
              : '<span style="font-size:11px;color:var(--text-muted);padding:4px 0">⚠️ No email on file</span>') +
            '<button onclick="notifRenewRx(\'' + rx.id + '\')" ' +
              'style="font-size:11px;padding:4px 10px;border:1px solid var(--green);border-radius:6px;background:transparent;cursor:pointer;color:var(--green)">🔄 Renew</button>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<div style="padding:10px 16px;border-top:1px solid var(--border);background:var(--surface2);display:flex;justify-content:space-between;align-items:center">' +
      '<button onclick="notifSendAllEmails()" style="font-size:12px;padding:5px 12px;border:1px solid var(--teal);border-radius:6px;background:transparent;cursor:pointer;color:var(--teal)">📧 Email All Patients</button>' +
      '<button onclick="closeNotifPanel()" style="font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer;color:var(--text-muted)">✕ Close</button>' +
    '</div>';
}

function toggleNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) {
    setTimeout(function() {
      document.addEventListener('click', closeNotifOnOutside, { once: true });
    }, 10);
  }
}
function closeNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if (panel) panel.style.display = 'none';
}
function closeNotifOnOutside(e) {
  var wrap = document.getElementById('notifBellWrap');
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
}

function notifViewRx(rxId) {
  closeNotifPanel();
  viewPatientRx(rxId);
}
function notifRenewRx(rxId) {
  closeNotifPanel();
  renewPrescription(rxId);
}
async function notifSendEmail(rxId) {
  var item = _notifList.find(function(i){ return i.rx.id === rxId; });
  if (!item) return;
  var btn = document.querySelector('[data-rxid="' + rxId + '"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }
  var ok = await sendExpiryEmail(item.rx, item.daysLeft);
  if (btn) { btn.disabled = false; btn.textContent = ok ? '✅ Sent' : '❌ Failed'; }
  setTimeout(function(){ if (btn) btn.textContent = '📧 Notify Patient'; }, 3000);
}
async function notifSendAllEmails() {
  var withEmail = _notifList.filter(function(i){ return !!i.rx.email; });
  if (!withEmail.length) { showToast('No patients with email addresses found.', 'info'); return; }
  showToast('Sending ' + withEmail.length + ' notification(s)…', 'info');
  var sent = 0;
  for (var i = 0; i < withEmail.length; i++) {
    var item = withEmail[i];
    var ok = await sendExpiryEmail(item.rx, item.daysLeft);
    if (ok) sent++;
  }
  showToast('✅ Sent ' + sent + ' of ' + withEmail.length + ' email(s)', sent === withEmail.length ? 'success' : 'info');
}

// ════════════════════════════════════════════════════════════
//  3. EMAIL SENDING (via Supabase Edge Function)
// ════════════════════════════════════════════════════════════

/**
 * Sends an expiry notification email to the patient.
 * Uses a Supabase Edge Function at /functions/v1/send-rx-notification
 * Falls back to a mailto: link if the function isn't deployed.
 */
async function sendExpiryEmail(rx, daysLeft) {
  if (!rx.email) return false;

  var clinic   = getActiveClinic();
  var subject  = daysLeft < 0
    ? 'Your prescription from ' + (clinic?.name || 'Rx Vault') + ' has expired'
    : daysLeft === 0
      ? 'Your prescription expires today — ' + (clinic?.name || 'Rx Vault')
      : 'Your prescription expires in ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' — ' + (clinic?.name || 'Rx Vault');

  var meds = (rx.medicines || []).map(function(m){
    return '• ' + m.name + (m.dosage ? ' ' + m.dosage : '') + (m.frequency ? ' — ' + m.frequency : '');
  }).join('\n');

  var body = buildEmailBody(rx, daysLeft, clinic);

  // Try Supabase Edge Function first
  try {
    var SUPABASE_URL = typeof db !== 'undefined' && db.supabaseUrl ? db.supabaseUrl : null;
    if (!SUPABASE_URL) {
      // Extract from the supabase client
      SUPABASE_URL = 'https://wavakcolrtrwmjcjkdfc.supabase.co';
    }
    var resp = await fetch(SUPABASE_URL + '/functions/v1/send-rx-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getSupabaseAnonKey() },
      body: JSON.stringify({
        to:         rx.email,
        patientName: rx.patientName,
        subject,
        html:       body.html,
        text:       body.text,
        rxId:       rx.id,
        clinicName: clinic?.name || 'Rx Vault',
        daysLeft,
        validUntil: rx.validUntil,
        diagnosis:  rx.diagnosis || '',
        medicines:  rx.medicines || [],
        doctorName: rx.doctorName || ''
      })
    });
    if (resp.ok) {
      markEmailSent(rx.id);
      showToast('📧 Email sent to ' + rx.patientName, 'success');
      return true;
    }
  } catch(e) {
    console.warn('[Notif] Edge function not available, falling back to mailto:', e.message);
  }

  // Fallback: open mailto link (works without backend)
  openMailtoFallback(rx.email, subject, body.text);
  markEmailSent(rx.id);
  return true;
}

function openMailtoFallback(email, subject, bodyText) {
  var mailto = 'mailto:' + encodeURIComponent(email) +
    '?subject=' + encodeURIComponent(subject) +
    '&body='    + encodeURIComponent(bodyText);
  window.open(mailto, '_blank');
  showToast('📧 Email client opened for ' + email, 'info');
}

function getSupabaseAnonKey() {
  // Reuse the key from supabase.js
  return typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '';
}

function buildEmailBody(rx, daysLeft, clinic) {
  var clinicName = clinic?.name || 'Rx Vault';
  var clinicPhone= clinic?.phone || '';
  var clinicAddr = clinic?.address || '';
  var expiryLabel = daysLeft < 0
    ? 'expired ' + Math.abs(daysLeft) + ' day' + (Math.abs(daysLeft) !== 1 ? 's' : '') + ' ago'
    : daysLeft === 0 ? 'expires TODAY'
    : 'expires in <strong>' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + '</strong>';

  var medsListHtml = (rx.medicines || []).map(function(m){
    return '<li><strong>' + escHtml(m.name) + '</strong>' + (m.dosage ? ' — ' + escHtml(m.dosage) : '') + (m.frequency ? ', ' + escHtml(m.frequency) : '') + '</li>';
  }).join('');

  var medsListText = (rx.medicines || []).map(function(m){
    return '• ' + m.name + (m.dosage ? ' ' + m.dosage : '') + (m.frequency ? ' — ' + m.frequency : '');
  }).join('\n');

  var urgencyColor = daysLeft < 0 ? '#dc2626' : daysLeft <= 1 ? '#d97706' : '#0a7c6e';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<style>body{font-family:DM Sans,Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}' +
    '.wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}' +
    '.header{background:' + urgencyColor + ';padding:28px 32px;color:#fff}' +
    '.header h1{margin:0;font-size:22px;font-weight:700}' +
    '.header p{margin:6px 0 0;opacity:0.85;font-size:14px}' +
    '.body{padding:28px 32px}' +
    '.alert-box{background:' + (daysLeft < 0 ? '#fef2f2' : daysLeft <= 1 ? '#fffbeb' : '#e6f5f3') + ';' +
      'border-left:4px solid ' + urgencyColor + ';padding:14px 18px;border-radius:8px;margin-bottom:20px;font-size:14px}' +
    '.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8fa0b3;margin-bottom:8px}' +
    '.meds-list{background:#f7fafc;border-radius:8px;padding:14px 18px;margin-bottom:20px}' +
    '.meds-list ul{margin:0;padding-left:18px}' +
    '.meds-list li{font-size:13.5px;margin-bottom:4px;color:#1a1a2e}' +
    '.cta{background:' + urgencyColor + ';color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin:8px 0}' +
    '.footer{background:#f7fafc;padding:18px 32px;font-size:12px;color:#8fa0b3;border-top:1px solid #e5e9ef}' +
    '</style></head><body>' +
    '<div class="wrap">' +
      '<div class="header">' +
        '<h1>💊 Prescription Notification</h1>' +
        '<p>' + escHtml(clinicName) + '</p>' +
      '</div>' +
      '<div class="body">' +
        '<p style="font-size:16px;margin-top:0">Dear <strong>' + escHtml(rx.patientName) + '</strong>,</p>' +
        '<div class="alert-box">' +
          '⚠️ Your prescription for <strong>' + escHtml(rx.diagnosis || 'your condition') + '</strong> ' + expiryLabel + '.' +
        '</div>' +
        '<div class="section-title">Prescription Details</div>' +
        '<table style="width:100%;font-size:13.5px;border-collapse:collapse;margin-bottom:20px">' +
          '<tr><td style="padding:5px 0;color:#8fa0b3;width:40%">Doctor</td><td>Dr. ' + escHtml(rx.doctorName||'—') + '</td></tr>' +
          '<tr><td style="padding:5px 0;color:#8fa0b3">Valid Until</td><td>' + formatDate(rx.validUntil) + '</td></tr>' +
          '<tr><td style="padding:5px 0;color:#8fa0b3">Diagnosis</td><td>' + escHtml(rx.diagnosis||'—') + '</td></tr>' +
        '</table>' +
        (medsListHtml ? '<div class="section-title">Prescribed Medicines</div><div class="meds-list"><ul>' + medsListHtml + '</ul></div>' : '') +
        '<p style="font-size:13.5px;color:#4a6076;line-height:1.6">Please contact your clinic or visit your doctor to renew your prescription and continue your treatment without interruption.</p>' +
        (clinicPhone ? '<p style="font-size:13.5px"><strong>📞 Clinic Contact:</strong> ' + escHtml(clinicPhone) + '</p>' : '') +
      '</div>' +
      '<div class="footer">' +
        escHtml(clinicName) + (clinicAddr ? ' · ' + escHtml(clinicAddr) : '') +
        '<br>This is an automated notification from Rx Vault Medical Record Manager.' +
      '</div>' +
    '</div></body></html>';

  var text =
    'Dear ' + rx.patientName + ',\n\n' +
    'This is a reminder from ' + clinicName + '.\n\n' +
    'Your prescription for "' + (rx.diagnosis||'your condition') + '" ' +
    (daysLeft < 0 ? 'EXPIRED ' + Math.abs(daysLeft) + ' days ago.' : daysLeft === 0 ? 'EXPIRES TODAY.' : 'expires in ' + daysLeft + ' day(s) on ' + rx.validUntil + '.') + '\n\n' +
    'Doctor: Dr. ' + (rx.doctorName||'—') + '\n' +
    'Valid Until: ' + rx.validUntil + '\n\n' +
    (medsListText ? 'Prescribed Medicines:\n' + medsListText + '\n\n' : '') +
    'Please contact your clinic to renew your prescription.\n' +
    (clinicPhone ? 'Clinic Phone: ' + clinicPhone + '\n' : '') +
    '\nRx Vault Medical Record Manager';

  return { html, text };
}

// ════════════════════════════════════════════════════════════
//  4. MANUAL NOTIFY BUTTON on Rx card
// ════════════════════════════════════════════════════════════

/**
 * Call this from the Rx card to send a one-off notification.
 * Button should be added in script-render.js renderCard footer actions.
 */
async function notifyPatientForRx(rxId) {
  var rx = prescriptions.find(function(x){ return x.id === rxId; });
  if (!rx) return;

  if (!rx.email) {
    showToast('No email address on file for ' + rx.patientName + '. Edit the Rx to add one.', 'error');
    return;
  }
  if (!rx.validUntil) {
    showToast('No expiry date set on this prescription.', 'error');
    return;
  }

  var expiry   = new Date(rx.validUntil + 'T00:00:00');
  var today    = new Date(); today.setHours(0,0,0,0);
  var daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  var ok = await sendExpiryEmail(rx, daysLeft);
  if (ok) showToast('✅ Notification sent to ' + rx.patientName, 'success');
  else    showToast('Failed to send notification.', 'error');
}

// ════════════════════════════════════════════════════════════
//  5. AUTO-START on app init
// ════════════════════════════════════════════════════════════

function startNotificationService() {
  // Initial check after data loads
  setTimeout(runNotificationCheck, 2000);

  // Periodic re-check
  if (_notifTimer) clearInterval(_notifTimer);
  _notifTimer = setInterval(runNotificationCheck, NOTIF_CHECK_INTERVAL_MS);
}

function stopNotificationService() {
  if (_notifTimer) { clearInterval(_notifTimer); _notifTimer = null; }
}

// Hook into initAppForClinic via DOMContentLoaded patch
document.addEventListener('DOMContentLoaded', function() {
  var _prevInit = typeof initAppForClinic === 'function' ? initAppForClinic : null;
  if (_prevInit) {
    initAppForClinic = async function() {
      await _prevInit();
      startNotificationService();
    };
  }
});
