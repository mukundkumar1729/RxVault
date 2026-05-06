// ════════════════════════════════════════════════════════════
//  HRMS SERVICE
//  Leave Management, Salary/Payroll, Separation, Settlement, Appraisal
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

const DEFAULT_LEAVE_BALANCE = {
    casual: 12,
    sick: 10,
    paid: 15,
    maternity: 90,
    paternity: 15
};

const DEFAULT_SALARY_STRUCTURE = {
    basic_percent: 50,
    hra_percent: 20,
    conveyance_percent: 10,
    special_percent: 20,
    pf_percent: 12,
    tax_percent: 10
};

function getDB() {
    return typeof window.db !== 'undefined' ? window.db : null;
}

function showToast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════
//  LEAVE MANAGEMENT
// ════════════════════════════════════════════════════════════

async function getLeaveBalance(clinicId, staffUserId, year) {
    var db = getDB();
    if (!db) return DEFAULT_LEAVE_BALANCE;

    var currentYear = year || new Date().getFullYear();

    var { data, error } = await db.from('leave_balances')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .eq('year', currentYear)
        .maybeSingle();

    if (error || !data) {
        return { ...DEFAULT_LEAVE_BALANCE, year: currentYear };
    }

    return data;
}

async function getLeaveHistory(clinicId, staffUserId, limit) {
    var db = getDB();
    if (!db) return [];

    var query = db.from('staff_leaves')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .order('created_at', { ascending: false });

    if (limit) query = query.limit(limit);

    var { data, error } = await query;
    if (error) { console.error('[HRMS] getLeaveHistory:', error); return []; }
    return data || [];
}

async function getPendingLeaves(clinicId) {
    var db = getDB();
    if (!db) return [];

    var { data, error } = await db.from('staff_leaves')
        .select('*, staff:user_id(name, email)')
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) { console.error('[HRMS] getPendingLeaves:', error); return []; }
    return data || [];
}

async function applyLeave(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var startDate = new Date(data.start_date);
    var endDate = new Date(data.end_date);
    var totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    var leave = {
        clinic_id: data.clinic_id,
        staff_user_id: data.staff_user_id,
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        total_days: totalDays,
        reason: data.reason || '',
        status: 'pending',
        created_at: new Date().toISOString()
    };

    var { error } = await db.from('staff_leaves').insert(leave);
    if (error) { console.error('[HRMS] applyLeave:', error); return { success: false, error: error.message }; }

    if (typeof window.addActivityLog === 'function') {
        window.addActivityLog('applied', 'leave', data.staff_user_id, data.leave_type + ' leave');
    }

    return { success: true };
}

async function approveLeave(leaveId, approverId) {
    var db = getDB();
    if (!db) return false;

    var { error } = await db.from('staff_leaves')
        .update({ status: 'approved', approved_by: approverId, approved_at: new Date().toISOString() })
        .eq('id', leaveId);

    if (error) { console.error('[HRMS] approveLeave:', error); return false; }

    showToast('Leave approved', 'success');
    return true;
}

async function rejectLeave(leaveId, reason) {
    var db = getDB();
    if (!db) return false;

    var { error } = await db.from('staff_leaves')
        .update({ status: 'rejected', approved_by: null, approved_at: new Date().toISOString(), reason: reason || 'Rejected' })
        .eq('id', leaveId);

    if (error) { console.error('[HRMS] rejectLeave:', error); return false; }

    showToast('Leave rejected', 'info');
    return true;
}

// ════════════════════════════════════════════════════════════
//  SALARY / PAYROLL
// ════════════════════════════════════════════════════════════

async function getSalaryComponents(clinicId) {
    var db = getDB();
    if (!db) return DEFAULT_SALARY_STRUCTURE;

    var { data, error } = await db.from('salary_components')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_default', true)
        .maybeSingle();

    if (error || !data) return DEFAULT_SALARY_STRUCTURE;
    return data;
}

async function getSalaryHistory(clinicId, staffUserId) {
    var db = getDB();
    if (!db) return [];

    var { data, error } = await db.from('staff_salaries')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

    if (error) { console.error('[HRMS] getSalaryHistory:', error); return []; }
    return data || [];
}

async function getPayslip(clinicId, staffUserId, month, year) {
    var db = getDB();
    if (!db) return null;

    var { data, error } = await db.from('staff_salaries')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

    if (error) { console.error('[HRMS] getPayslip:', error); return null; }
    return data;
}

async function processMonthlySalary(clinicId, month, year, processedBy) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var staff = await dbGetClinicStaff(clinicId);
    if (!staff || staff.length === 0) return { success: false, error: 'No staff found' };

    var components = await getSalaryComponents(clinicId);
    var processed = 0;

    for (var i = 0; i < staff.length; i++) {
        var s = staff[i];
        var basic = s.basic_salary || 20000;
        var hra = basic * (components.hra_percent / 100);
        var conveyance = basic * (components.conveyance_percent / 100);
        var special = basic * (components.special_percent / 100);
        var gross = basic + hra + conveyance + special;
        var pf = basic * (components.pf_percent / 100);
        var tax = gross * (components.tax_percent / 100);
        var totalDeductions = pf + tax;
        var net = gross - totalDeductions;

        var existing = await getPayslip(clinicId, s.user_id, month, year);
        if (existing) continue;

        var salary = {
            clinic_id: clinicId,
            staff_user_id: s.user_id,
            month: month,
            year: parseInt(year),
            basic_salary: basic,
            hra: hra,
            conveyance: conveyance,
            special_allowance: special,
            pf_deduction: pf,
            tax_deduction: tax,
            other_deductions: 0,
            gross_salary: gross,
            net_salary: net,
            status: 'draft',
            processed_by: processedBy,
            processed_at: new Date().toISOString()
        };

        await db.from('staff_salaries').insert(salary);
        processed++;
    }

    showToast('Salary processed for ' + processed + ' staff', 'success');
    return { success: true, processed: processed };
}

async function publishSalary(salaryId) {
    var db = getDB();
    if (!db) return false;

    var { error } = await db.from('staff_salaries')
        .update({ status: 'published' })
        .eq('id', salaryId);

    if (error) { console.error('[HRMS] publishSalary:', error); return false; }

    showToast('Salary published', 'success');
    return true;
}

// ════════════════════════════════════════════════════════════
//  SEPARATION
// ════════════════════════════════════════════════════════════

async function getSeparationInfo(clinicId, staffUserId) {
    var db = getDB();
    if (!db) return null;

    var { data, error } = await db.from('staff_separations')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) { console.error('[HRMS] getSeparationInfo:', error); return null; }
    return data;
}

async function getAllSeparations(clinicId) {
    var db = getDB();
    if (!db) return [];

    var { data, error } = await db.from('staff_separations')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

    if (error) { console.error('[HRMS] getAllSeparations:', error); return []; }
    return data || [];
}

async function initiateSeparation(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var noticeDays = data.notice_period_days || 30;
    var noticeStart = new Date(data.notice_start_date);
    var lastWorking = new Date(noticeStart);
    lastWorking.setDate(lastWorking.getDate() + noticeDays);

    var separation = {
        clinic_id: data.clinic_id,
        staff_user_id: data.staff_user_id,
        type: data.type,
        notice_period_days: noticeDays,
        notice_start_date: data.notice_start_date,
        last_working_date: lastWorking.toISOString().split('T')[0],
        reason: data.reason || '',
        status: 'pending',
        created_by: data.created_by,
        created_at: new Date().toISOString()
    };

    var { error } = await db.from('staff_separations').insert(separation);
    if (error) { console.error('[HRMS] initiateSeparation:', error); return { success: false, error: error.message }; }

    if (typeof window.addActivityLog === 'function') {
        window.addActivityLog('initiated', 'separation', data.staff_user_id, data.type);
    }

    showToast('Separation initiated', 'success');
    return { success: true };
}

async function updateSeparationStatus(separationId, status, notes) {
    var db = getDB();
    if (!db) return false;

    var update = { status: status, updated_at: new Date().toISOString() };
    if (notes) update.exit_interview_notes = notes;

    var { error } = await db.from('staff_separations')
        .update(update)
        .eq('id', separationId);

    if (error) { console.error('[HRMS] updateSeparationStatus:', error); return false; }

    showToast('Separation status updated', 'success');
    return true;
}

// ════════════════════════════════════════════════════════════
//  FULL & FINAL SETTLEMENT
// ════════════════════════════════════════════════════════════

async function getSettlementInfo(clinicId, staffUserId) {
    var db = getDB();
    if (!db) return null;

    var { data, error } = await db.from('staff_settlements')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) { console.error('[HRMS] getSettlementInfo:', error); return null; }
    return data;
}

async function calculateSettlement(clinicId, staffUserId, separationId) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var balance = await getLeaveBalance(clinicId, staffUserId);
    var leaveEncashment = (balance.casual + balance.sick) * 500;

    var salary = await getPayslip(clinicId, staffUserId, new Date().getMonth() + 1, new Date().getFullYear());
    var dailySalary = salary ? salary.net_salary / 30 : 500;

    var lastSalary = await db.from('staff_salaries')
        .select('net_salary')
        .eq('clinic_id', clinicId)
        .eq('staff_user_id', staffUserId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

    var finalSalaryDays = 15;
    var finalSalary = dailySalary * finalSalaryDays;

    var totalSettlement = leaveEncashment + finalSalary;

    return {
        leave_encashment: leaveEncashment,
        final_salary_days: finalSalaryDays,
        final_salary: finalSalary,
        total_settlement: totalSettlement,
        other_deductions: 0,
        outstanding_loans: 0
    };
}

async function processSettlement(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var settlement = {
        clinic_id: data.clinic_id,
        staff_user_id: data.staff_user_id,
        separation_id: data.separation_id,
        final_salary_days: data.final_salary_days,
        unused_leaves_encashment: data.unused_leaves_encashment,
        outstanding_loans: data.outstanding_loans || 0,
        other_deductions: data.other_deductions || 0,
        total_settlement_amount: data.total_settlement_amount,
        settlement_date: data.settlement_date,
        payment_mode: data.payment_mode || 'bank_transfer',
        status: 'pending',
        experience_letter: false,
        relieving_letter: false,
        created_by: data.created_by,
        created_at: new Date().toISOString()
    };

    var { error } = await db.from('staff_settlements').insert(settlement);
    if (error) { console.error('[HRMS] processSettlement:', error); return { success: false, error: error.message }; }

    showToast('Settlement processed', 'success');
    return { success: true };
}

async function generateExperienceLetter(staffUserId, clinicId) {
    var staff = await dbGetStaffMember(clinicId, staffUserId);
    if (!staff) return { success: false, error: 'Staff not found' };

    var name = staff.name || 'Employee';
    var role = staff.role || 'Staff Member';
    var joinDate = staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'N/A';
    var exitDate = new Date().toLocaleDateString();

    var letter = 'EXPERIENCE LETTER\n\n' +
        'Date: ' + exitDate + '\n\n' +
        'To,\n' + name + '\n\n' +
        'Dear ' + name + ',\n\n' +
        'This is to certify that you have worked as ' + role + ' at our organization from ' + joinDate + ' to ' + exitDate + '.\n\n' +
        'During your tenure, you have shown good performance and professional conduct.\n\n' +
        'We wish you all the best for your future endeavors.\n\n' +
        'For ' + (window.store && window.store.activeClinic ? window.store.activeClinic.name : 'Clinic');

    return { success: true, letter: letter };
}

// ════════════════════════════════════════════════════════════
//  PERFORMANCE APPRAISAL
// ════════════════════════════════════════════════════════════

async function getAppraisalCycles(clinicId) {
    var db = getDB();
    if (!db) return [];

    var { data, error } = await db.from('appraisal_cycles')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('start_date', { ascending: false });

    if (error) { console.error('[HRMS] getAppraisalCycles:', error); return []; }
    return data || [];
}

async function createAppraisalCycle(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var cycle = {
        clinic_id: data.clinic_id,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'draft',
        created_at: new Date().toISOString()
    };

    var { error } = await db.from('appraisal_cycles').insert(cycle);
    if (error) { console.error('[HRMS] createAppraisalCycle:', error); return { success: false, error: error.message }; }

    return { success: true };
}

async function submitSelfAppraisal(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var appraisal = {
        cycle_id: data.cycle_id,
        staff_user_id: data.staff_user_id,
        self_rating: data.self_rating,
        self_comment: data.self_comment || '',
        status: 'self_submitted',
        submitted_at: new Date().toISOString()
    };

    var { error } = await db.from('appraisals').insert(appraisal);
    if (error) { console.error('[HRMS] submitSelfAppraisal:', error); return { success: false, error: error.message }; }

    showToast('Self appraisal submitted', 'success');
    return { success: true };
}

async function submitManagerReview(data) {
    var db = getDB();
    if (!db) return { success: false, error: 'Database not available' };

    var { error } = await db.from('appraisals')
        .update({
            reviewer_user_id: data.reviewer_user_id,
            manager_rating: data.manager_rating,
            manager_comment: data.manager_comment || '',
            overall_rating: ((data.self_rating || 0) + (data.manager_rating || 0)) / 2,
            status: 'completed',
            reviewed_at: new Date().toISOString()
        })
        .eq('cycle_id', data.cycle_id)
        .eq('staff_user_id', data.staff_user_id);

    if (error) { console.error('[HRMS] submitManagerReview:', error); return { success: false, error: error.message }; }

    showToast('Manager review submitted', 'success');
    return { success: true };
}

async function getAppraisalHistory(clinicId, staffUserId) {
    var db = getDB();
    if (!db) return [];

    var { data, error } = await db.from('appraisals')
        .select('*, cycle:cycle_id(name, start_date, end_date)')
        .eq('staff_user_id', staffUserId)
        .order('submitted_at', { ascending: false });

    if (error) { console.error('[HRMS] getAppraisalHistory:', error); return []; }
    return data || [];
}

async function getPendingAppraisals(clinicId, reviewerId) {
    var db = getDB();
    if (!db) return [];

    var cycles = await getAppraisalCycles(clinicId);
    var activeCycle = cycles.find(function(c) { return c.status === 'active'; });
    if (!activeCycle) return [];

    var staff = await dbGetClinicStaff(clinicId);
    var pending = [];

    for (var i = 0; i < staff.length; i++) {
        var s = staff[i];
        if (s.user_id === reviewerId) continue;

        var existing = await db.from('appraisals')
            .select('*')
            .eq('cycle_id', activeCycle.id)
            .eq('staff_user_id', s.user_id)
            .maybeSingle();

        if (!existing || existing.status === 'self_submitted') {
            pending.push({ staff: s, appraisal: existing });
        }
    }

    return pending;
}

// ════════════════════════════════════════════════════════════
//  GLOBAL EXPORTS
// ════════════════════════════════════════════════════════════

window.hrmsLeave = {
    getBalance: getLeaveBalance,
    getHistory: getLeaveHistory,
    getPending: getPendingLeaves,
    apply: applyLeave,
    approve: approveLeave,
    reject: rejectLeave
};

window.hrmsSalary = {
    getComponents: getSalaryComponents,
    getHistory: getSalaryHistory,
    getPayslip: getPayslip,
    process: processMonthlySalary,
    publish: publishSalary
};

window.hrmsSeparation = {
    getInfo: getSeparationInfo,
    getAll: getAllSeparations,
    initiate: initiateSeparation,
    updateStatus: updateSeparationStatus
};

window.hrmsSettlement = {
    getInfo: getSettlementInfo,
    calculate: calculateSettlement,
    process: processSettlement,
    generateExperienceLetter: generateExperienceLetter
};

window.hrmsAppraisal = {
    getCycles: getAppraisalCycles,
    createCycle: createAppraisalCycle,
    submitSelf: submitSelfAppraisal,
    submitReview: submitManagerReview,
    getHistory: getAppraisalHistory,
    getPending: getPendingAppraisals
};

})();