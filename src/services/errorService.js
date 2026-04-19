// ════════════════════════════════════════════════════════════
//  ERROR HANDLING SERVICE
//  Provides user-friendly messages, retry actions, conflict handling
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

const ERROR_FRIENDLY_MAP = {
    'network': 'Unable to connect. Please check your internet connection.',
    'timeout': 'Request timed out. Please try again.',
    'fetch_failed': 'Failed to communicate with server. Please try again.',
    'invalid_json': 'Invalid data received from server. Please refresh and try again.',
    'unauthorized': 'Your session has expired. Please log in again.',
    'forbidden': 'You do not have permission to perform this action.',
    'not_found': 'The requested data was not found. It may have been deleted.',
    'conflict': 'This record was modified by another user. Please refresh and try again.',
    'validation': 'Please check your input and try again.',
    'quota_exceeded': 'Storage limit reached. Please upgrade your plan.',
    'rate_limited': 'Too many requests. Please wait a moment and try again.',
    'server_error': 'Server error. Please try again in a few minutes.',
    'database_error': 'Database error. Please try again.',
    'unknown': 'An unexpected error occurred. Please try again.'
};

const ERROR_RETRY_ACTIONS = new Map();

function getFriendlyErrorMessage(error) {
    if (!error) return ERROR_FRIENDLY_MAP.unknown;

    const errorStr = String(error.message || error).toLowerCase();

    for (const [key, message] of Object.entries(ERROR_FRIENDLY_MAP)) {
        if (errorStr.includes(key)) {
            return message;
        }
    }

    if (errorStr.includes('jwt') || errorStr.includes('token') || errorStr.includes('session')) {
        return ERROR_FRIENDLY_MAP.unauthorized;
    }
    if (errorStr.includes('403') || errorStr.includes('permission') || errorStr.includes('denied')) {
        return ERROR_FRIENDLY_MAP.forbidden;
    }
    if (errorStr.includes('404') || errorStr.includes('not found')) {
        return ERROR_FRIENDLY_MAP.not_found;
    }
    if (errorStr.includes('409') || errorStr.includes('conflict')) {
        return ERROR_FRIENDLY_MAP.conflict;
    }
    if (errorStr.includes('500') || errorStr.includes('server')) {
        return ERROR_FRIENDLY_MAP.server_error;
    }
    if (errorStr.includes('429') || errorStr.includes('rate limit')) {
        return ERROR_FRIENDLY_MAP.rate_limited;
    }

    if (error.message && error.message.length < 100) {
        return error.message;
    }

    return ERROR_FRIENDLY_MAP.unknown;
}

function isRetryableError(error) {
    if (!error) return false;
    const errorStr = String(error.message || error).toLowerCase();
    const retryable = ['network', 'timeout', 'fetch_failed', 'server_error', 'rate_limited', 'database_error'];
    return retryable.some(key => errorStr.includes(key));
}

function showErrorToast(error, retryAction = null, actionContext = null) {
    const message = getFriendlyErrorMessage(error);

    const container = document.getElementById('toastContainer');
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'toast-container';
        document.body.appendChild(newContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast error';

    let html = '<span class="toast-icon">❌</span> ' + message;

    if (retryAction && isRetryableError(error)) {
        const actionId = 'retry_' + Date.now();
        html += ' <button class="toast-retry-btn" id="' + actionId + '">Retry</button>';

        setTimeout(() => {
            const btn = document.getElementById(actionId);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    retryAction(actionContext);
                    toast.remove();
                });
            }
        }, 0);
    }

    toast.innerHTML = html;
    document.getElementById('toastContainer').appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 350);
    }, 5000);

    return toast;
}

async function withErrorHandling(promise, options = {}) {
    const {
        friendlyName = 'operation',
        retryAction = null,
        context = null,
        onSuccess = null,
        showToast = true
    } = options;

    try {
        const result = await promise;
        if (showToast && onSuccess) {
            onSuccess(result);
        }
        return { success: true, data: result };
    } catch (error) {
        console.error(`[ErrorService] ${friendlyName} failed:`, error);

        if (showToast) {
            showErrorToast(error, retryAction, context);
        }

        return { success: false, error };
    }
}

function registerRetryAction(operationKey, actionFn) {
    ERROR_RETRY_ACTIONS.set(operationKey, actionFn);
}

function getRetryAction(operationKey) {
    return ERROR_RETRY_ACTIONS.get(operationKey);
}

function clearRetryActions() {
    ERROR_RETRY_ACTIONS.clear();
}

let conflictResolveCallback = null;
let lastConflictData = null;

function showConflictDialog(data, options = {}) {
    const { onKeepMine, onUseTheirs, entityName = 'record' } = options;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'conflictModal';

    modal.innerHTML = `
        <div class="modal" style="max-width:420px">
            <div class="modal-header">
                <div>
                    <div class="modal-title">⚠️ Conflict Detected</div>
                    <div class="modal-subtitle">This ${entityName} was modified by another user</div>
                </div>
                <button class="modal-close" onclick="closeConflictDialog()">✕</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom:16px">
                    <div style="font-weight:500;margin-bottom:8px">Your version:</div>
                    <pre style="background:var(--bg);padding:12px;border-radius:6px;overflow:auto;font-size:12px;max-height:120px">${JSON.stringify(data.local, null, 2)}</pre>
                </div>
                <div>
                    <div style="font-weight:500;margin-bottom:8px">Server version:</div>
                    <pre style="background:var(--bg);padding:12px;border-radius:6px;overflow:auto;font-size:12px;max-height:120px">${JSON.stringify(data.server, null, 2)}</pre>
                </div>
            </div>
            <div class="modal-footer" style="gap:12px;display:flex;justify-content:flex-end">
                <button class="btn-sm btn-outline" onclick="closeConflictDialog(); ${onKeepMine ? 'onKeepMine()' : ''}">Keep Mine</button>
                <button class="btn-sm btn-teal" onclick="closeConflictDialog(); ${onUseTheirs ? 'onUseTheirs()' : ''}">Use Theirs</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    window.closeConflictDialog = () => {
        modal.remove();
        document.body.style.overflow = '';
    };

    return modal;
}

function handleConflictError(error, handler) {
    const errorStr = String(error.message || error).toLowerCase();
    if (errorStr.includes('409') || errorStr.includes('conflict') || errorStr.includes('precondition')) {
        const mockData = {
            local: handler.localData,
            server: handler.serverData || {}
        };
        showConflictDialog(mockData, {
            entityName: handler.entityName || 'record',
            onKeepMine: handler.forceSave,
            onUseTheirs: handler.useServer
        });
        return true;
    }
    return false;
}

function setupConflictHandler(resolveFn) {
    conflictResolveCallback = resolveFn;
}

function getLastConflictData() {
    return lastConflictData;
}

window.getFriendlyErrorMessage = getFriendlyErrorMessage;
window.isRetryableError = isRetryableError;
window.showErrorToast = showErrorToast;
window.withErrorHandling = withErrorHandling;
window.showConflictDialog = showConflictDialog;
window.handleConflictError = handleConflictError;

})();