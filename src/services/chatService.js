// ════════════════════════════════════════════════════════════
//  INTERNAL CHAT SERVICE
//  Staff-to-staff messaging within the clinic
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

var _conversations = {};
var _currentChat = null;
var _chatPollingInterval = null;

function initChatService() {
    loadChatHistory();
    startPolling();
}

function loadChatHistory() {
    try {
        var stored = localStorage.getItem('rx_chat_history');
        if (stored) {
            _conversations = JSON.parse(stored);
        }
    } catch(e) {}
}

function saveChatHistory() {
    try {
        localStorage.setItem('rx_chat_history', JSON.stringify(_conversations));
    } catch(e) {}
}

function startPolling() {
    if (_chatPollingInterval) return;
    _chatPollingInterval = setInterval(checkNewMessages, 15000);
    checkNewMessages();
}

function stopPolling() {
    if (_chatPollingInterval) {
        clearInterval(_chatPollingInterval);
        _chatPollingInterval = null;
    }
}

function checkNewMessages() {
    // Future: integrate with Supabase real-time
    updateChatBadge();
}

function getUnreadCount() {
    var count = 0;
    for (var userId in _conversations) {
        var msgs = _conversations[userId] || [];
        for (var i = 0; i < msgs.length; i++) {
            if (!msgs[i].read && msgs[i].sender !== getCurrentUserId()) {
                count++;
            }
        }
    }
    return count;
}

function getCurrentUserId() {
    return typeof currentUser !== 'undefined' ? currentUser.id : 'unknown';
}

function updateChatBadge() {
    var badge = document.getElementById('chatBadge');
    if (!badge) return;
    var count = getUnreadCount();
    badge.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function openChatModal() {
    var existing = document.getElementById('chatModal');
    if (existing) { existing.remove(); }

    var modal = document.createElement('div');
    modal.id = 'chatModal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    modal.innerHTML = renderChatInterface();
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.onclick = function(e) {
        if (e.target === modal) closeChatModal();
    };

    renderConversationList();
}

function closeChatModal() {
    var modal = document.getElementById('chatModal');
    if (modal) { modal.remove(); }
    document.body.style.overflow = '';
    _currentChat = null;
}

function renderChatInterface() {
    return '<div class="modal" style="max-width:700px;height:520px;display:flex;flex-direction:row;overflow:hidden;padding:0">' +
        '<div style="width:220px;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--bg)">' +
            '<div style="padding:16px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px">💬 Messages</div>' +
            '<div id="chatConversationList" style="flex:1;overflow-y:auto"></div>' +
        '</div>' +
        '<div id="chatMainArea" style="flex:1;display:flex;flex-direction:column;background:var(--surface)">' +
            '<div id="chatEmptyState" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Select a conversation to start chatting</div>' +
            '<div id="chatContent" style="display:none;flex-direction:column;height:100%">' +
                '<div id="chatHeader" style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:600;display:flex;align-items:center;gap:10px"></div>' +
                '<div id="chatMessages" style="flex:1;overflow-y:auto;padding:12px"></div>' +
                '<div id="chatInputArea" style="padding:12px;border-top:1px solid var(--border);display:flex;gap:8px">' +
                    '<input type="text" id="chatMessageInput" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:20px;background:var(--bg);font-size:13px" onkeypress="if(event.key===\'Enter\')sendChatMessage()">' +
                    '<button onclick="sendChatMessage()" style="padding:10px 16px;background:var(--teal);color:#fff;border:none;border-radius:20px;cursor:pointer;font-size:14px">➤</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

async function renderConversationList() {
    var container = document.getElementById('chatConversationList');
    if (!container) return;

    var staffMembers = [];
    if (typeof window.store !== 'undefined' && window.store.staff) {
        staffMembers = window.store.staff.filter(function(s) {
            return s.user_id !== getCurrentUserId();
        });
    }

    var html = '<div style="padding:10px;border-bottom:1px solid var(--border)">' +
        '<button onclick="openNewChatModal()" style="width:100%;padding:10px;background:var(--teal);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500">➕ New Conversation</button>' +
        '</div>';

    var hasConversations = false;
    for (var userId in _conversations) {
        if (_conversations[userId] && _conversations[userId].length > 0) {
            hasConversations = true;
            var lastMsg = _conversations[userId][_conversations[userId].length - 1];
            var name = lastMsg.senderName || userId;
            var unread = _conversations[userId].filter(function(m) { return !m.read && m.sender !== getCurrentUserId(); }).length;

            html += '<div onclick="openChatWith(\'' + userId + '\')" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:center;background:' + (unread > 0 ? 'var(--teal-pale)' : 'transparent') + '">' +
                '<div style="width:36px;height:36px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600">' + name.charAt(0).toUpperCase() + '</div>' +
                '<div style="flex:1;overflow:hidden">' +
                '<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (lastMsg.text || '').substring(0, 25) + '</div>' +
                '</div>' +
                (unread > 0 ? '<div style="background:var(--teal);color:#fff;font-size:10px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px">' + unread + '</div>' : '') +
                '</div>';
        }
    }

    if (!hasConversations) {
        html += '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">No conversations yet</div>';
    }

    container.innerHTML = html;
}

function openChatWith(userId) {
    _currentChat = userId;

    var msgs = _conversations[userId] || [];
    var name = userId;
    if (typeof window.store !== 'undefined' && window.store.staff) {
        var staff = window.store.staff.find(function(s) { return s.user_id === userId; });
        if (staff) name = staff.name || staff.email;
    }

    document.getElementById('chatEmptyState').style.display = 'none';
    document.getElementById('chatContent').style.display = 'flex';
    document.getElementById('chatHeader').innerHTML = '<div style="width:32px;height:32px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">' + name.charAt(0).toUpperCase() + '</div><div>' + name + '</div>';

    renderMessages(userId);

    for (var i = 0; i < msgs.length; i++) {
        if (msgs[i].sender !== getCurrentUserId()) {
            msgs[i].read = true;
        }
    }
    saveChatHistory();
    updateChatBadge();
    renderConversationList();

    var msgContainer = document.getElementById('chatMessages');
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function renderMessages(userId) {
    var container = document.getElementById('chatMessages');
    var msgs = _conversations[userId] || [];

    if (msgs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;font-size:13px">No messages yet. Start the conversation!</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        var isMe = msg.sender === getCurrentUserId();
        var time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        html += '<div style="display:flex;justify-content:' + (isMe ? 'flex-end' : 'flex-start') + ';margin-bottom:10px">' +
            '<div style="max-width:70%;padding:10px 14px;border-radius:16px;background:' + (isMe ? 'var(--teal)' : 'var(--bg)') + ';color:' + (isMe ? '#fff' : 'var(--text-primary)') + ';font-size:13px;line-height:1.4">' +
            '<div>' + msg.text + '</div>' +
            '<div style="font-size:10px;opacity:0.7;margin-top:4px;text-align:' + (isMe ? 'right' : 'left') + '">' + time + '</div>' +
            '</div>' +
            '</div>';
    }

    container.innerHTML = html;
}

function sendChatMessage() {
    var input = document.getElementById('chatMessageInput');
    var text = input.value.trim();
    if (!text || !_currentChat) return;

    var myId = getCurrentUserId();
    var myName = typeof currentUser !== 'undefined' ? currentUser.name : 'Me';

    var msg = {
        id: 'msg_' + Date.now(),
        sender: myId,
        senderName: myName,
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    };

    if (!_conversations[_currentChat]) {
        _conversations[_currentChat] = [];
    }
    _conversations[_currentChat].push(msg);

    saveChatHistory();
    input.value = '';
    renderMessages(_currentChat);
    renderConversationList();

    var msgContainer = document.getElementById('chatMessages');
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function openNewChatModal() {
    var staff = [];
    if (typeof window.store !== 'undefined' && window.store.staff) {
        staff = window.store.staff.filter(function(s) {
            return s.user_id !== getCurrentUserId();
        });
    }

    if (staff.length === 0) {
        showToast('No staff members available to chat', 'info');
        return;
    }

    var html = '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header">' +
            '<div><div class="modal-title">➕ New Conversation</div><div class="modal-subtitle">Select a staff member</div></div>' +
            '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button>' +
        '</div>' +
        '<div class="modal-body" style="max-height:300px;overflow-y:auto">';

    for (var i = 0; i < staff.length; i++) {
        var s = staff[i];
        html += '<div onclick="startChatWithUser(\'' + s.user_id + '\')" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:12px;align-items:center">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600">' + (s.name || s.email).charAt(0).toUpperCase() + '</div>' +
            '<div><div style="font-weight:600;font-size:13px">' + (s.name || s.email) + '</div><div style="font-size:11px;color:var(--text-muted)">' + (s.role || 'Staff') + '</div></div>' +
            '</div>';
    }

    html += '</div></div>';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

function startChatWithUser(userId) {
    var overlay = document.querySelector('.modal-overlay:last-child');
    if (overlay) overlay.remove();
    openChatWith(userId);
}

function toggleChatModal() {
    var existing = document.getElementById('chatModal');
    if (existing) {
        closeChatModal();
    } else {
        openChatModal();
    }
}

window.initChatService = initChatService;
window.openChatModal = openChatModal;
window.closeChatModal = closeChatModal;
window.toggleChatModal = toggleChatModal;
window.openChatWith = openChatWith;
window.sendChatMessage = sendChatMessage;
window.openNewChatModal = openNewChatModal;
window.startChatWithUser = startChatWithUser;
window.getUnreadCount = getUnreadCount;

})();