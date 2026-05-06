// ════════════════════════════════════════════════════════════
//  HRMS UI HANDLERS
//  Tab switching and modal handlers for HRMS features
// ════════════════════════════════════════════════════════════

function formatLeaveDate(start, end) {
    if (!start || !end) return '-';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var startDate = new Date(start);
    var endDate = new Date(end);
    var startDay = startDate.getDate();
    var endDay = endDate.getDate();
    var startMonth = months[startDate.getMonth()];
    var endMonth = months[endDate.getMonth()];
    var startYear = startDate.getFullYear();
    var endYear = endDate.getFullYear();
    if (start === end) {
        return startDay + 'th ' + startMonth + ' ' + startYear;
    }
    if (startYear === endYear && startMonth === endMonth) {
        return startDay + ' - ' + endDay + 'th ' + startMonth + ' ' + startYear;
    }
    return startDay + 'th ' + startMonth + ' ' + startYear + ' - ' + endDay + 'th ' + endMonth + ' ' + endYear;
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showStaffTab(tabName) {
    var tabs = ['list', 'add', 'leave', 'salary', 'separation', 'settlement', 'appraisal', 'audit'];
    for (var i = 0; i < tabs.length; i++) {
        var el = document.getElementById('staffTab' + capitalize(tabs[i]));
        if (el) el.style.display = (tabs[i] === tabName) ? '' : 'none';

        var btn = document.getElementById('tabStaff' + capitalize(tabs[i]));
        if (btn) btn.classList.toggle('active', tabs[i] === tabName);
    }

    if (tabName === 'leave') loadLeaveTab();
    if (tabName === 'salary') loadSalaryTab();
    if (tabName === 'separation') loadSeparationTab();
    if (tabName === 'settlement') loadSettlementTab();
    if (tabName === 'appraisal') loadAppraisalTab();
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function getCurrentUserId() {
    return typeof currentUser !== 'undefined' ? currentUser.id : null;
}

function getCurrentClinicId() {
    return typeof activeClinicId !== 'undefined' ? activeClinicId : null;
}

// ════════════════════════════════════════════════════════════
//  LEAVE TAB
// ════════════════════════════════════════════════════════════

async function loadLeaveTab() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var balanceEl = document.getElementById('leaveBalanceDisplay');
    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.getBalance) {
        var balance = await window.hrmsLeave.getBalance(clinicId, userId, new Date().getFullYear());
        if (balanceEl) {
            balanceEl.innerHTML =
                '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
                '<div style="font-size:20px;font-weight:700;color:var(--teal)">' + (balance.casual || 12) + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted)">Casual</div></div>' +
                '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
                '<div style="font-size:20px;font-weight:700;color:var(--allopathy)">' + (balance.sick || 10) + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted)">Sick</div></div>' +
                '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
                '<div style="font-size:20px;font-weight:700;color:var(--homeopathy)">' + (balance.paid || 15) + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted)">Paid Leave</div></div>';
        }
    }

    var historyEl = document.getElementById('leaveHistoryList');
    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.getHistory) {
        var history = await window.hrmsLeave.getHistory(clinicId, userId, 10);
        if (historyEl) {
            if (history.length === 0) {
                historyEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No leave history</div>';
            } else {
                var html = '';
                for (var i = 0; i < history.length; i++) {
                    var l = history[i];
                    var statusColor = l.status === 'approved' ? 'var(--green)' : (l.status === 'rejected' ? 'var(--red)' : 'var(--orange)');
                    var formattedDate = formatLeaveDate(l.start_date, l.end_date);
                    html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:12px">' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
                        '<div><strong>' + capitalize(l.leave_type) + '</strong></div>' +
                        '<div style="text-align:right"><span style="color:' + statusColor + ';font-weight:600">' + capitalize(l.status) + '</span></div></div>' +
                        '<div style="color:var(--text-muted);font-size:11px;margin-bottom:4px">' + formattedDate + ' (' + l.total_days + ' days)</div>' +
                        (l.reason ? '<div style="font-size:11px;color:var(--text-secondary);font-style:italic">"' + escHtml(l.reason) + '"</div>' : '') +
                        '</div>';
                }
                historyEl.innerHTML = html;
            }
        }
    }

    var pendingEl = document.getElementById('pendingLeavesList');
    var canApprove = canApproveLeaves();

    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.getPending) {
        var pending = await window.hrmsLeave.getPending(clinicId);
        if (pendingEl) {
            if (pending.length === 0) {
                pendingEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">No pending approvals</div>';
            } else {
                var html = '';
                for (var i = 0; i < pending.length; i++) {
                    var p = pending[i];
                    var formattedDate = formatLeaveDate(p.start_date, p.end_date);
                    html += '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:8px">' +
                        '<div style="font-weight:600;font-size:13px">' + (p.staff ? p.staff.name : 'Staff') + '</div>' +
                        '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + capitalize(p.leave_type + ' Leave') + ' - ' + p.total_days + ' days<br>' + formattedDate + '</div>' +
                        (p.reason ? '<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-bottom:8px">"' + escHtml(p.reason) + '"</div>' : '');
                    if (canApprove) {
                        html += '<div style="display:flex;gap:8px">' +
                            '<button onclick="window.hrmsLeave.approve(' + p.id + ',\'' + getCurrentUserId() + '\');loadLeaveTab();" class="btn-sm btn-teal" style="padding:6px 12px;font-size:11px">✅ Approve</button>' +
                            '<button onclick="window.hrmsLeave.reject(' + p.id + ',\'Rejected\');loadLeaveTab();" class="btn-sm btn-outline" style="padding:6px 12px;font-size:11px">❌ Reject</button>' +
                            '</div>';
                    }
                    html += '</div>';
                }
                pendingEl.innerHTML = html;
            }
        }
    }
}

function canApproveLeaves() {
    var role = typeof currentUser !== 'undefined' ? currentUser.role : null;
    var staffRole = typeof currentUser !== 'undefined' ? currentUser.staffRole : null;
    return role === 'superadmin' || role === 'admin' || staffRole === 'admin' || staffRole === 'clinic_supervisor' || staffRole === 'department_head';
}

function openApplyLeaveModal() {
    var clinicId = getCurrentClinicId();
    var userId = getCurrentUserId();
    if (!clinicId || !userId) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML =
        '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><div><div class="modal-title">🏖️ Apply Leave</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Leave Type</label><select id="leaveType" class="premium-input"><option value="casual">Casual Leave</option><option value="sick">Sick Leave</option><option value="paid">Paid Leave</option><option value="unpaid">Unpaid Leave</option></select></div>' +
        '<div class="form-row" style="margin-bottom:12px"><div class="field"><label>From Date</label><input type="date" id="leaveStart"></div><div class="field"><label>To Date</label><input type="date" id="leaveEnd"></div></div>' +
        '<div class="field"><label>Reason</label><textarea id="leaveReason" class="premium-input" rows="3" placeholder="Reason for leave..."></textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="submitLeaveApplication()">Submit Request</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
}

async function submitLeaveApplication() {
    var clinicId = getCurrentClinicId();
    var userId = getCurrentUserId();
    var startDate = document.getElementById('leaveStart').value;
    var endDate = document.getElementById('leaveEnd').value;
    var leaveType = document.getElementById('leaveType').value;
    var reason = document.getElementById('leaveReason').value;

    if (!startDate || !endDate) { showToast('Please select dates', 'error'); return; }

    var data = { clinic_id: clinicId, staff_user_id: userId, start_date: startDate, end_date: endDate, leave_type: leaveType, reason: reason };

    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.apply) {
        var result = await window.hrmsLeave.apply(data);
        if (result.success) {
            showToast('Leave application submitted', 'success');
            document.querySelector('.modal-overlay.open')?.remove();
            loadLeaveTab();
        } else {
            showToast(result.error || 'Failed to submit', 'error');
        }
    }
}

// ════════════════════════════════════════════════════════════
//  SALARY TAB
// ════════════════════════════════════════════════════════════

async function loadSalaryTab() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var listEl = document.getElementById('salaryHistoryList');
    if (typeof window.hrmsSalary !== 'undefined' && window.hrmsSalary.getHistory) {
        var history = await window.hrmsSalary.getHistory(clinicId, userId);
        if (listEl) {
            if (history.length === 0) {
                listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No salary records yet</div>';
            } else {
                var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left">Month</th><th style="padding:8px;text-align:right">Gross</th><th style="padding:8px;text-align:right">Deductions</th><th style="padding:8px;text-align:right">Net</th><th style="padding:8px;text-align:center">Status</th></tr></thead><tbody>';
                for (var i = 0; i < history.length; i++) {
                    var s = history[i];
                    var monthName = new Date(s.year, s.month - 1).toLocaleString('default', { month: 'short' });
                    var statusColor = s.status === 'published' ? 'var(--green)' : (s.status === 'paid' ? 'var(--teal)' : 'var(--orange)');
                    html += '<tr style="border-bottom:1px solid var(--border)">' +
                        '<td style="padding:8px">' + monthName + ' ' + s.year + '</td>' +
                        '<td style="padding:8px;text-align:right">₹' + Math.round(s.gross_salary).toLocaleString() + '</td>' +
                        '<td style="padding:8px;text-align:right">₹' + Math.round(s.pf_deduction + s.tax_deduction).toLocaleString() + '</td>' +
                        '<td style="padding:8px;text-align:right;font-weight:600">₹' + Math.round(s.net_salary).toLocaleString() + '</td>' +
                        '<td style="padding:8px;text-align:center"><span style="color:' + statusColor + ';font-size:11px">' + capitalize(s.status) + '</span></td></tr>';
                }
                html += '</tbody></table>';
                listEl.innerHTML = html;
            }
        }
    }
}

function openProcessSalaryModal() {
    var clinicId = getCurrentClinicId();
    if (!clinicId) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    var now = new Date();
    overlay.innerHTML =
        '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><div><div class="modal-title">⚙️ Process Monthly Salary</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">This will generate salary records for all active staff for the selected month.</p>' +
        '<div class="form-row" style="margin-bottom:12px"><div class="field"><label>Month</label><select id="salaryMonth"><option value="1">January</option><option value="2">February</option><option value="3">March</option><option value="4">April</option><option value="5">May</option><option value="6">June</option><option value="7">July</option><option value="8">August</option><option value="9">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select></div>' +
        '<div class="field"><label>Year</label><input type="number" id="salaryYear" value="' + now.getFullYear() + '" class="premium-input"></div></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="processSalary()">Process Salary</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
    document.getElementById('salaryMonth').value = now.getMonth() + 1;
}

async function processSalary() {
    var clinicId = getCurrentClinicId();
    var userId = getCurrentUserId();
    var month = parseInt(document.getElementById('salaryMonth').value);
    var year = parseInt(document.getElementById('salaryYear').value);

    if (typeof window.hrmsSalary !== 'undefined' && window.hrmsSalary.process) {
        var result = await window.hrmsSalary.process(clinicId, month, year, userId);
        if (result.success) {
            showToast('Salary processed for ' + result.processed + ' staff', 'success');
            document.querySelector('.modal-overlay.open')?.remove();
            loadSalaryTab();
        } else {
            showToast(result.error || 'Failed to process', 'error');
        }
    }
}

function loadSalaryHistory() {
    loadSalaryTab();
}

// ════════════════════════════════════════════════════════════
//  SEPARATION TAB
// ════════════════════════════════════════════════════════════

async function loadSeparationTab() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var listEl = document.getElementById('separationHistoryList');
    if (typeof window.hrmsSeparation !== 'undefined' && window.hrmsSeparation.getInfo) {
        var info = await window.hrmsSeparation.getInfo(clinicId, userId);
        if (listEl) {
            if (!info) {
                listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No separation history</div>';
            } else {
                var statusColor = info.status === 'completed' ? 'var(--green)' : (info.status === 'cancelled' ? 'var(--red)' : 'var(--orange)');
                listEl.innerHTML = '<div style="background:var(--surface);padding:16px;border-radius:8px">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-weight:600">Type:</span><span>' + capitalize(info.type) + '</span></div>' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-weight:600">Notice Start:</span><span>' + info.notice_start_date + '</span></div>' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-weight:600">Last Working:</span><span>' + info.last_working_date + '</span></div>' +
                    '<div style="display:flex;justify-content:space-between"><span style="font-weight:600">Status:</span><span style="color:' + statusColor + '">' + capitalize(info.status) + '</span></div>' +
                    '</div>';
            }
        }
    }
}

function openSeparationModal() {
    var clinicId = getCurrentClinicId();
    var userId = getCurrentUserId();
    if (!clinicId) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML =
        '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><div><div class="modal-title">🚪 Initiate Separation</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Type</label><select id="sepType" class="premium-input"><option value="resignation">Resignation</option><option value="termination">Termination</option><option value="retirement">Retirement</option></select></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Notice Start Date</label><input type="date" id="sepStartDate"></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Notice Period (days)</label><input type="number" id="sepDays" value="30" class="premium-input"></div>' +
        '<div class="field"><label>Reason</label><textarea id="sepReason" class="premium-input" rows="3" placeholder="Reason for separation..."></textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-red" onclick="submitSeparation()">Submit</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
}

async function submitSeparation() {
    var clinicId = getCurrentClinicId();
    var userId = getCurrentUserId();
    var data = {
        clinic_id: clinicId,
        staff_user_id: userId,
        type: document.getElementById('sepType').value,
        notice_start_date: document.getElementById('sepStartDate').value,
        notice_period_days: parseInt(document.getElementById('sepDays').value),
        reason: document.getElementById('sepReason').value,
        created_by: userId
    };

    if (!data.notice_start_date) { showToast('Please select start date', 'error'); return; }

    if (typeof window.hrmsSeparation !== 'undefined' && window.hrmsSeparation.initiate) {
        var result = await window.hrmsSeparation.initiate(data);
        if (result.success) {
            showToast('Separation initiated', 'success');
            document.querySelector('.modal-overlay.open')?.remove();
            loadSeparationTab();
        } else {
            showToast(result.error || 'Failed', 'error');
        }
    }
}

// ════════════════════════════════════════════════════════════
//  SETTLEMENT TAB
// ════════════════════════════════════════════════════════════

async function loadSettlementTab() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var infoEl = document.getElementById('settlementInfo');
    var listEl = document.getElementById('settlementHistoryList');

    if (typeof window.hrmsSettlement !== 'undefined' && window.hrmsSettlement.getInfo) {
        var info = await window.hrmsSettlement.getInfo(clinicId, userId);
        if (infoEl) {
            if (!info) {
                infoEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center">No settlement pending</div>';
            } else {
                var statusColor = info.status === 'paid' ? 'var(--green)' : (info.status === 'processed' ? 'var(--teal)' : 'var(--orange)');
                infoEl.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Settlement Details</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">' +
                    '<div>Leave Encashment:</div><div>₹' + Math.round(info.unused_leaves_encashment || 0).toLocaleString() + '</div>' +
                    '<div>Final Salary:</div><div>₹' + Math.round(info.final_salary || 0).toLocaleString() + '</div>' +
                    '<div>Total Amount:</div><div style="font-weight:700;color:var(--teal)">₹' + Math.round(info.total_settlement_amount || 0).toLocaleString() + '</div>' +
                    '<div>Status:</div><div style="color:' + statusColor + '">' + capitalize(info.status) + '</div></div>';
            }
        }
    }

    if (listEl) {
        listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Settlement history will appear here</div>';
    }
}

function openSettlementModal() {
    var clinicId = getCurrentClinicId();
    if (!clinicId) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML =
        '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><div><div class="modal-title">📝 Process Settlement</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<p style="font-size:13px;color:var(--text-muted)">This will calculate and process the full and final settlement.</p>' +
        '<div class="field" style="margin-top:16px"><label>Select Staff</label><select id="settleStaff" class="premium-input"><option value="">Select...</option></select></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="calculateSettlement()">Calculate</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
}

async function calculateSettlement() {
    showToast('Settlement calculation initiated', 'info');
}

// ════════════════════════════════════════════════════════════
//  APPRAISAL TAB
// ════════════════════════════════════════════════════════════

async function loadAppraisalTab() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var cycleEl = document.getElementById('activeCycleInfo');
    var historyEl = document.getElementById('appraisalHistoryList');

    if (typeof window.hrmsAppraisal !== 'undefined' && window.hrmsAppraisal.getCycles) {
        var cycles = await window.hrmsAppraisal.getCycles(clinicId);
        var active = cycles.find(function(c) { return c.status === 'active'; });

        if (cycleEl) {
            if (active) {
                cycleEl.innerHTML = '<div style="font-weight:600">' + active.name + '</div><div style="font-size:12px;color:var(--text-muted)">' + active.start_date + ' to ' + active.end_date + '</div>';
            } else {
                cycleEl.innerHTML = '<div style="font-size:13px">No active cycle</div>';
            }
        }
    }

    if (typeof window.hrmsAppraisal !== 'undefined' && window.hrmsAppraisal.getHistory) {
        var history = await window.hrmsAppraisal.getHistory(clinicId, userId);
        if (historyEl) {
            if (history.length === 0) {
                historyEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No appraisal records</div>';
            } else {
                var html = '';
                for (var i = 0; i < history.length; i++) {
                    var a = history[i];
                    var rating = a.overall_rating || a.self_rating || 0;
                    var stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
                    html += '<div style="background:var(--surface);padding:12px;border-radius:8px;margin-bottom:8px">' +
                        '<div style="font-weight:600;font-size:13px">' + (a.cycle ? a.cycle.name : 'Appraisal') + '</div>' +
                        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Rating: <span style="color:var(--teal)">' + stars + '</span> (' + rating + '/5)</div>' +
                        '</div>';
                }
                historyEl.innerHTML = html;
            }
        }
    }

    var pendingEl = document.getElementById('pendingAppraisalsList');
    if (typeof window.hrmsAppraisal !== 'undefined' && window.hrmsAppraisal.getPending) {
        var pending = await window.hrmsAppraisal.getPending(clinicId, userId);
        if (pendingEl) {
            if (pending.length === 0) {
                pendingEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">No pending reviews</div>';
            } else {
                pendingEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Found ' + pending.length + ' pending appraisals</div>';
            }
        }
    }
}

function openAppraisalCycleModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    var now = new Date();
    var nextYear = now.getFullYear() + 1;
    overlay.innerHTML =
        '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><div><div class="modal-title">➕ New Appraisal Cycle</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Cycle Name</label><input type="text" id="cycleName" class="premium-input" placeholder="e.g. Annual 2026"></div>' +
        '<div class="form-row" style="margin-bottom:12px"><div class="field"><label>Start Date</label><input type="date" id="cycleStart"></div><div class="field"><label>End Date</label><input type="date" id="cycleEnd"></div></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="createAppraisalCycle()">Create</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
    document.getElementById('cycleStart').value = now.toISOString().split('T')[0];
    document.getElementById('cycleEnd').value = nextYear + '-01-31';
}

async function createAppraisalCycle() {
    var clinicId = getCurrentClinicId();
    var data = {
        clinic_id: clinicId,
        name: document.getElementById('cycleName').value,
        start_date: document.getElementById('cycleStart').value,
        end_date: document.getElementById('cycleEnd').value
    };

    if (!data.name || !data.start_date || !data.end_date) { showToast('Please fill all fields', 'error'); return; }

    if (typeof window.hrmsAppraisal !== 'undefined' && window.hrmsAppraisal.createCycle) {
        var result = await window.hrmsAppraisal.createCycle(data);
        if (result.success) {
            showToast('Appraisal cycle created', 'success');
            document.querySelector('.modal-overlay.open')?.remove();
            loadAppraisalTab();
        } else {
            showToast(result.error || 'Failed', 'error');
        }
    }
}

window.showStaffTab = showStaffTab;
window.openApplyLeaveModal = openApplyLeaveModal;
window.submitLeaveApplication = submitLeaveApplication;
window.openProcessSalaryModal = openProcessSalaryModal;
window.processSalary = processSalary;
window.loadSalaryHistory = loadSalaryHistory;
window.openSeparationModal = openSeparationModal;
window.submitSeparation = submitSeparation;
window.openSettlementModal = openSettlementModal;
window.calculateSettlement = calculateSettlement;
window.openAppraisalCycleModal = openAppraisalCycleModal;
window.createAppraisalCycle = createAppraisalCycle;
window.getCurrentUserId = getCurrentUserId;
window.getCurrentClinicId = getCurrentClinicId;

// ════════════════════════════════════════════════════════════
//  MY LEAVE MODAL (Accessible to all staff)
// ════════════════════════════════════════════════════════════

function openMyLeaveModal() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) { showToast('Please log in to access leave', 'error'); return; }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = 
        '<div class="modal" style="max-width:480px;max-height:80vh;display:flex;flex-direction:column">' +
        '<div class="modal-header">' +
        '<div><div class="modal-title">🏖️ My Leave</div><div class="modal-subtitle">View balance and apply for leave</div></div>' +
        '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="myLeaveContent" style="overflow-y:auto;flex:1"></div>' +
        '<div class="modal-footer" style="justify-content:space-between;display:flex">' +
        '<button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Close</button>' +
        '<button class="btn-sm btn-teal" onclick="openApplyLeaveModal()">➕ Apply Leave</button>' +
        '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    loadMyLeaveContent();
}

async function loadMyLeaveContent() {
    var userId = getCurrentUserId();
    var clinicId = getCurrentClinicId();
    if (!userId || !clinicId) return;

    var container = document.getElementById('myLeaveContent');
    if (!container) return;

    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading...</div>';

    var html = '';

    // Leave Balance
    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.getBalance) {
        var balance = await window.hrmsLeave.getBalance(clinicId, userId, new Date().getFullYear());
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
            '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
            '<div style="font-size:24px;font-weight:700;color:var(--teal)">' + (balance.casual || 12) + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted)">Casual</div></div>' +
            '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
            '<div style="font-size:24px;font-weight:700;color:var(--allopathy)">' + (balance.sick || 10) + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted)">Sick</div></div>' +
            '<div style="background:var(--surface2);padding:12px;border-radius:8px;text-align:center">' +
            '<div style="font-size:24px;font-weight:700;color:var(--homeopathy)">' + (balance.paid || 15) + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted)">Paid Leave</div></div>' +
            '</div>';
    }

    // Leave History
    html += '<div style="font-weight:600;font-size:13px;margin-bottom:8px">Leave History</div>';

    if (typeof window.hrmsLeave !== 'undefined' && window.hrmsLeave.getHistory) {
        var history = await window.hrmsLeave.getHistory(clinicId, userId, 20);
        if (history && history.length > 0) {
            for (var i = 0; i < history.length; i++) {
                var l = history[i];
                var statusColor = l.status === 'approved' ? 'var(--green)' : (l.status === 'rejected' ? 'var(--red)' : 'var(--orange)');
                var formattedDate = formatLeaveDate(l.start_date, l.end_date);
                html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:12px">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
                    '<div><strong>' + capitalize(l.leave_type) + '</strong></div>' +
                    '<div style="text-align:right"><span style="color:' + statusColor + ';font-weight:600">' + capitalize(l.status) + '</span></div></div>' +
                    '<div style="color:var(--text-muted);font-size:11px">' + formattedDate + ' (' + l.total_days + ' days)</div>' +
                    (l.reason ? '<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-top:4px">"' + escHtml(l.reason) + '"</div>' : '') +
                    '</div>';
            }
        } else {
            html += '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No leave history</div>';
        }
    }

    container.innerHTML = html;
}

window.openMyLeaveModal = openMyLeaveModal;
window.loadMyLeaveContent = loadMyLeaveContent;