// ════════════════════════════════════════════════════════════
//  PATIENT FEEDBACK / SURVEY SERVICE
//  Collect patient satisfaction after visits
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

var _pendingFeedbackQueue = [];

const DEFAULT_QUESTIONS = [
    { id: 'overall', type: 'rating', question: 'How was your overall experience?', min: 1, max: 5, icons: ['😞', '😐', '🙂', '😊', '🤩'] },
    { id: 'wait_time', type: 'rating', question: 'How was the waiting time?', min: 1, max: 5, icons: ['😞', '😐', '🙂', '😊', '🤩'] },
    { id: 'staff_behavior', type: 'rating', question: 'How was the staff behavior?', min: 1, max: 5, icons: ['😞', '😐', '🙂', '😊', '🤩'] },
    { id: 'cleanliness', type: 'rating', question: 'How was the clinic cleanliness?', min: 1, max: 5, icons: ['😞', '😐', '🙂', '😊', '🤩'] },
    { id: 'recommend', type: 'yesno', question: 'Would you recommend us to others?', yesLabel: 'Yes', noLabel: 'No' },
    { id: 'comments', type: 'text', question: 'Any suggestions for improvement?', placeholder: 'Your feedback (optional)...' }
];

function openFeedbackModal(appointmentId, patientName) {
    var existing = document.getElementById('feedbackModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'feedbackModal';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    overlay.innerHTML = renderFeedbackForm(appointmentId, patientName);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.onclick = function(e) {
        if (e.target === overlay) closeFeedbackModal();
    };
}

function renderFeedbackForm(apptId, patientName) {
    var html = '<div class="modal" style="max-width:420px;background:var(--surface);border-radius:16px;padding:24px;text-align:center;animation:slideIn 0.2s ease">' +
        '<div style="font-size:40px;margin-bottom:12px">💬</div>' +
        '<div style="font-size:20px;font-weight:600;margin-bottom:4px">Patient Feedback</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Your feedback helps us serve you better</div>';

    for (var i = 0; i < DEFAULT_QUESTIONS.length; i++) {
        var q = DEFAULT_QUESTIONS[i];
        html += '<div style="text-align:left;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px">' +
            '<div style="font-weight:600;font-size:13px;margin-bottom:8px">' + q.question + '</div>';

        if (q.type === 'rating') {
            html += '<div style="display:flex;justify-content:space-between;gap:4px">';
            for (var r = q.min; r <= q.max; r++) {
                html += '<button class="fb-star" data-qid="' + q.id + '" data-value="' + r + '" onclick="setFeedbackRating(this,\'' + q.id + '\',' + r + ')" style="font-size:24px;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s">' + (q.icons ? q.icons[r-1] : r) + '</button>';
            }
            html += '</div>';
        } else if (q.type === 'yesno') {
            html += '<div style="display:flex;gap:12px;margin-top:8px">' +
                '<button onclick="setFeedbackYesNo(\'' + q.id + '\',true)" style="flex:1;padding:10px;border:1px solid var(--teal);border-radius:8px;background:transparent;color:var(--teal);cursor:pointer;font-weight:500">✅ ' + q.yesLabel + '</button>' +
                '<button onclick="setFeedbackYesNo(\'' + q.id + '\',false)" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer;font-weight:500">❌ ' + q.noLabel + '</button>' +
                '</div>';
        } else if (q.type === 'text') {
            html += '<textarea id="fb_' + q.id + '" placeholder="' + q.placeholder + '" style="width:100%;min-height:80px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-primary);font-size:13px;resize:none;margin-top:8px"></textarea>';
        }

        html += '</div>';
    }

    html += '<button onclick="submitFeedback(\'' + apptId + '\')" class="btn-sm btn-teal" style="width:100%;padding:12px;font-size:14px;margin-top:8px">✅ Submit Feedback</button>' +
        '</div>';

    return html;
}

function setFeedbackRating(btn, questionId, value) {
    var parent = btn.parentElement;
    var buttons = parent.querySelectorAll('.fb-star');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].style.opacity = '0.4';
    }
    for (var i = 0; i < value; i++) {
        buttons[i].style.opacity = '1';
    }

    if (!window._feedbackAnswers) window._feedbackAnswers = {};
    window._feedbackAnswers[questionId] = value;
}

function setFeedbackYesNo(questionId, value) {
    if (!window._feedbackAnswers) window._feedbackAnswers = {};
    window._feedbackAnswers[questionId] = value;
}

async function submitFeedback(appointmentId) {
    var answers = window._feedbackAnswers || {};
    var comments = document.getElementById('fb_comments')?.value || '';

    var feedback = {
        id: 'fb_' + Date.now().toString(36),
        clinic_id: window.store?.activeClinicId || activeClinicId,
        appointment_id: appointmentId,
        overall_rating: answers.overall || null,
        wait_time_rating: answers.wait_time || null,
        staff_rating: answers.staff_behavior || null,
        cleanliness_rating: answers.cleanliness || null,
        recommend: answers.recommend !== undefined ? answers.recommend : null,
        comments: comments,
        created_at: new Date().toISOString()
    };

    try {
        if (typeof window.db === 'object' && window.db.from) {
            await window.db.from('patient_feedback').insert(feedback);
        }
        showToast('Thank you for your feedback! 🙏', 'success');
        closeFeedbackModal();
    } catch(e) {
        showToast('Could not submit. Please try again.', 'error');
    }
}

function closeFeedbackModal() {
    var overlay = document.getElementById('feedbackModal');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
    window._feedbackAnswers = {};
}

function queueFeedbackForLater(appointmentId, patientName) {
    _pendingFeedbackQueue.push({ id: appointmentId, name: patientName, queuedAt: Date.now() });
}

function triggerFeedbackRequestAfterVisit(appointmentId, patientName) {
    var delay = 3000;
    setTimeout(function() {
        openFeedbackModal(appointmentId, patientName);
    }, delay);
}

window.openFeedbackModal = openFeedbackModal;
window.queueFeedbackForLater = queueFeedbackForLater;
window.triggerFeedbackRequestAfterVisit = triggerFeedbackRequestAfterVisit;
window.setFeedbackRating = setFeedbackRating;
window.setFeedbackYesNo = setFeedbackYesNo;
window.submitFeedback = submitFeedback;
window.closeFeedbackModal = closeFeedbackModal;

})();