// ════════════════════════════════════════════════════════════
//  REAL-TIME NOTIFICATION SERVICE
//  Push notifications, activity feed, real-time updates
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

var _notifications = [];
var _activityLog = [];
var _notificationPollingInterval = null;
var _lastUpdateTime = Date.now();

const NOTIFICATION_TYPES = {
    appointment: { icon: '📅', color: 'var(--teal)', label: 'Appointment' },
    prescription: { icon: '💊', color: 'var(--allopathy)', label: 'Prescription' },
    lab_result: { icon: '🔬', color: 'var(--homeopathy)', label: 'Lab Results' },
    message: { icon: '💬', color: 'var(--blue)', label: 'Message' },
    call: { icon: '🔔', color: 'var(--red)', label: 'Call' },
    stock_alert: { icon: '📦', color: 'var(--orange)', label: 'Stock Alert' },
    refund: { icon: '💰', color: 'var(--green)', label: 'Payment' },
    system: { icon: '⚙️', color: 'var(--gray)', label: 'System' }
};

function initRealTimeNotifications() {
    loadStoredNotifications();
    startPolling();
    renderNotificationBell();
}

function loadStoredNotifications() {
    try {
        var stored = localStorage.getItem('rx_notifications');
        if (stored) {
            _notifications = JSON.parse(stored);
        }
        var activity = localStorage.getItem('rx_activity_log');
        if (activity) {
            _activityLog = JSON.parse(activity);
        }
    } catch(e) {}
}

function saveNotifications() {
    try {
        localStorage.setItem('rx_notifications', JSON.stringify(_notifications.slice(0, 100)));
        localStorage.setItem('rx_activity_log', JSON.stringify(_activityLog.slice(0, 200)));
    } catch(e) {}
}

function startPolling() {
    if (_notificationPollingInterval) return;
    _notificationPollingInterval = setInterval(checkNewItems, 30000);
    checkNewItems();
}

function stopPolling() {
    if (_notificationPollingInterval) {
        clearInterval(_notificationPollingInterval);
        _notificationPollingInterval = null;
    }
}

function checkNewItems() {
    if (typeof window.dbGetActiveCalls === 'function' && window.store && window.store.activeClinicId) {
        window.dbGetActiveCalls(window.store.activeClinicId).then(function(calls) {
            if (calls && calls.length > 0) {
                for (var i = 0; i < calls.length; i++) {
                    var call = calls[i];
                    if (call.created_at > _lastUpdateTime) {
                        addNotification({
                            type: 'call',
                            title: 'Patient Call',
                            message: call.patient_name + ' is calling',
                            data: call,
                            urgent: true
                        });
                    }
                }
            }
        });
    }
    _lastUpdateTime = Date.now();
}

function addNotification(options) {
    var notification = {
        id: 'notif_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        type: options.type || 'system',
        title: options.title || 'Notification',
        message: options.message || '',
        data: options.data || null,
        urgent: options.urgent || false,
        read: false,
        createdAt: new Date().toISOString()
    };

    _notifications.unshift(notification);
    _notifications = _notifications.slice(0, 100);
    saveNotifications();
    renderNotificationBell();
    showToast(notification.message || notification.title, notification.urgent ? 'error' : 'info');

    return notification;
}

function addActivityLog(action, entity, entityId, details) {
    var entry = {
        id: 'act_' + Date.now().toString(36),
        action: action,
        entity: entity,
        entityId: entityId,
        details: details || '',
        user: typeof currentUser !== 'undefined' ? currentUser.name : 'System',
        timestamp: new Date().toISOString()
    };

    _activityLog.unshift(entry);
    _activityLog = _activityLog.slice(0, 200);
    saveNotifications();
    renderActivityFeed();

    return entry;
}

function getUnreadCount() {
    return _notifications.filter(function(n) { return !n.read; }).length;
}

function markAsRead(id) {
    for (var i = 0; i < _notifications.length; i++) {
        if (_notifications[i].id === id) {
            _notifications[i].read = true;
        }
    }
    saveNotifications();
    renderNotificationBell();
}

function markAllAsRead() {
    for (var i = 0; i < _notifications.length; i++) {
        _notifications[i].read = true;
    }
    saveNotifications();
    renderNotificationBell();
}

function clearNotifications() {
    _notifications = [];
    saveNotifications();
    renderNotificationBell();
}

function renderNotificationBell() {
    var bell = document.getElementById('notificationBell');
    if (!bell) return;

    var unread = getUnreadCount();
    var countEl = bell.querySelector('.bell-count');
    if (countEl) {
        countEl.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
        countEl.style.display = unread > 0 ? 'flex' : 'none';
    }
}

function renderNotificationsPanel() {
    var panel = document.getElementById('notificationPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        panel.style.cssText = 'position:fixed;top:60px;right:80px;width:340px;max-height:450px;background:var(--surface);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9998;overflow:hidden;display:none';
        document.body.appendChild(panel);
    }

    var unread = getUnreadCount();
    var html = '<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
        '<div style="font-weight:600;font-size:14px">Notifications <span style="color:var(--text-muted)">(' + unread + ' unread)</span></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button onclick="markAllRead()" style="font-size:12px;color:var(--teal);background:none;border:none;cursor:pointer">Mark all read</button>' +
        '<button onclick="toggleNotificationPanel()" style="font-size:14px;background:none;border:none;cursor:pointer">✕</button>' +
        '</div>' +
        '</div>' +
        '<div style="max-height:380px;overflow-y:auto">';

    var items = _notifications.slice(0, 20);
    if (items.length === 0) {
        html += '<div style="padding:30px;text-align:center;color:var(--text-muted)">No notifications</div>';
    } else {
        for (var i = 0; i < items.length; i++) {
            var n = items[i];
            var typeInfo = NOTIFICATION_TYPES[n.type] || NOTIFICATION_TYPES.system;
            html += '<div style="padding:12px 16px;border-bottom:1px solid var(--border);background:' + (n.read ? 'transparent' : 'var(--teal-pale)') + ';cursor:pointer" onclick="markAsRead(\'' + n.id + '\')">' +
                '<div style="display:flex;gap:10px;align-items:flex-start">' +
                '<div style="font-size:18px">' + typeInfo.icon + '</div>' +
                '<div style="flex:1">' +
                '<div style="font-weight:600;font-size:13px">' + n.title + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted)">' + n.message + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">' + formatTimeAgo(n.createdAt) + '</div>' +
                '</div>' +
                (n.urgent ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--red)"></div>' : '') +
                '</div>' +
                '</div>';
        }
    }

    html += '</div>';
    panel.innerHTML = html;
}

function toggleNotificationPanel() {
    var panel = document.getElementById('notificationPanel');
    if (!panel) {
        renderNotificationsPanel();
        panel = document.getElementById('notificationPanel');
    }
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        renderNotificationsPanel();
    } else {
        panel.style.display = 'none';
    }
}

function renderActivityFeed(containerId) {
    var container = containerId ? document.getElementById(containerId) : document.getElementById('activityFeed');
    if (!container) return;

    var html = '';
    var items = _activityLog.slice(0, 15);

    if (items.length === 0) {
        html = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No recent activity</div>';
    } else {
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var icon = getActivityIcon(item.action);
            html += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:12px">' +
                '<div style="font-size:14px">' + icon + '</div>' +
                '<div style="flex:1">' +
                '<div><strong>' + item.user + '</strong> ' + item.action + ' ' + item.entity + '</div>' +
                '<div style="color:var(--text-muted);margin-top:2px">' + formatTimeAgo(item.timestamp) + '</div>' +
                '</div>' +
                '</div>';
        }
    }

    container.innerHTML = html;
}

function getActivityIcon(action) {
    var icons = {
        'created': '✅',
        'updated': '✏️',
        'deleted': '🗑️',
        'booked': '📅',
        'completed': '✅',
        'cancelled': '❌',
        'added': '➕',
        'logged in': '🔑',
        'paid': '💰'
    };
    return icons[action.toLowerCase()] || '📌';
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    var seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    return new Date(timestamp).toLocaleDateString();
}

window.initRealTimeNotifications = initRealTimeNotifications;
window.addNotification = addNotification;
window.addActivityLog = addActivityLog;
window.toggleNotificationPanel = toggleNotificationPanel;
window.markAsRead = markAsRead;
window.markAllRead = markAllAsRead;
window.getUnreadCount = getUnreadCount;
window.renderActivityFeed = renderActivityFeed;

})();