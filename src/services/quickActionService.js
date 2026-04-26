// ════════════════════════════════════════════════════════════
//  QUICK ACTION FLOATING BUTTON
//  One-tap access to common actions
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

function initQuickActionButton() {
    var existing = document.getElementById('quickActionFloatBtn');
    if (existing) return;

    var btn = document.createElement('div');
    btn.id = 'quickActionFloatBtn';
    btn.innerHTML = 
        '<button id="fabMainBtn" onclick="toggleQuickActions()" style="width:56px;height:56px;border-radius:28px;background:var(--teal);border:none;box-shadow:0 4px 16px rgba(10,124,110,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform 0.2s">➕</button>' +
        '<div id="fabMenu" style="position:absolute;bottom:70px;right:0;display:none;flex-direction:column;gap:8px;align-items:flex-end">' +
            '<button onclick="openRegisterModal();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">👤 New Patient</button>' +
            '<button onclick="window.openBookAppointment ? window.openBookAppointment() : openBookAppointment();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">📅 Book Appt</button>' +
            '<button onclick="openAddModal();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">💊 New Rx</button>' +
            '<button onclick="openPatientSelfSchedule();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">🖥️ Patient Portal</button>' +
            '<button onclick="toggleActivityFeed();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">📋 Activity Feed</button>' +
            '<button onclick="toggleChatModal();toggleQuickActions();" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:24px;cursor:pointer;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px">💬 Internal Chat</button>' +
        '</div>';
    btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9997';

    document.body.appendChild(btn);

    document.addEventListener('click', function(e) {
        var menu = document.getElementById('fabMenu');
        var btn = document.getElementById('fabMainBtn');
        if (menu && menu.style.display === 'flex' && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
}

function toggleQuickActions() {
    var menu = document.getElementById('fabMenu');
    var btn = document.getElementById('fabMainBtn');
    if (!menu || !btn) return;

    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'flex';
        btn.style.transform = 'rotate(45deg)';
    } else {
        menu.style.display = 'none';
        btn.style.transform = 'rotate(0deg)';
    }
}

function toggleActivityFeed() {
    var existing = document.getElementById('activityFeedModal');
    if (existing) { existing.remove(); return; }

    var modal = document.createElement('div');
    modal.id = 'activityFeedModal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    modal.innerHTML = '<div class="modal" style="max-width:480px;max-height:80vh;display:flex;flex-direction:column">' +
        '<div class="modal-header">' +
            '<div><div class="modal-title">📋 Recent Activity</div><div class="modal-subtitle">Live feed of clinic actions</div></div>' +
            '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="activityFeedContent" style="overflow-y:auto;flex:1"></div>' +
    '</div>';

    document.body.appendChild(modal);

    if (typeof window.renderActivityFeed === 'function') {
        window.renderActivityFeed('activityFeedContent');
    }
}

window.initQuickActionButton = initQuickActionButton;
window.toggleQuickActions = toggleQuickActions;
window.toggleActivityFeed = toggleActivityFeed;

})();