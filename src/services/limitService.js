import { store } from '../core/store.js';
import { PLAN_LIMITS, LAB_TECH_ROLES } from '../core/planConfig.js';
import { getActiveClinic } from './clinicService.js';
import { db } from '../core/db.js';

/**
 * 🛡️ RXVAULT LIMIT SERVICE
 * Validates resource limits based on clinic plan
 */

/**
 * Checks if a resource can be added to the active clinic.
 * @param {string} type - 'doctor' | 'labTech' | 'staff'
 * @returns {Object} { canAdd: boolean, limit: number, current: number, planLabel: string }
 */
export const checkPlanLimit = (type) => {
    const clinic = getActiveClinic();
    const statusInfo = getPlanStatus(clinic);
    
    // If fully EXPIRED, enforce Free limits regardless of the current plan ID
    const plan = (statusInfo.status === 'EXPIRED') ? 'free' : (clinic?.plan || 'free').toLowerCase();
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    
    let current = 0;
    let limit = Infinity;

    switch (type) {
        case 'doctor':
            current = (store.doctors || []).length;
            limit = limits.doctors;
            break;
        case 'labTech':
            current = (store.staff || []).filter(s => LAB_TECH_ROLES.includes(s.role)).length;
            limit = limits.labTechs;
            break;
        case 'staff':
            current = (store.staff || []).length;
            limit = limits.totalStaff;
            break;
    }

    return {
        canAdd: current < limit,
        limit,
        current,
        planLabel: limits.label,
        typeLabel: type === 'labTech' ? 'Lab Technician' : capitalize(type),
        isExpired: statusInfo.status === 'EXPIRED',
        isGrace: statusInfo.status === 'GRACE'
    };
};

/**
 * 📅 Determine current plan status based on expiry date
 */
export const getPlanStatus = (clinic) => {
    if (!clinic || !clinic.planExpiresAt || clinic.plan === 'free') return { status: 'VALID' };
    
    const now = new Date();
    const expiry = new Date(clinic.planExpiresAt);
    const graceEnd = new Date(expiry.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    if (now <= expiry) return { status: 'VALID', expiry };
    if (now <= graceEnd) return { status: 'GRACE', expiry, graceEnd };
    return { status: 'EXPIRED', expiry, graceEnd };
};

/**
 * 🧹 AUTO-ENFORCEMENT: Deactivates or Reactivates staff based on plan status
 */
export const autoEnforceClinicLimits = async (clinicId) => {
    if (!clinicId) return;
    console.log('[LimitService] Enforcing limits for clinic:', clinicId);
    
    // 1. Get latest clinic data
    const clinics = await db.from('clinics').select('*').eq('id', clinicId);
    if (!clinics.data || !clinics.data[0]) return;
    const clinic = clinics.data[0];
    const statusInfo = getPlanStatus({ 
        plan: clinic.plan, 
        planExpiresAt: clinic.plan_expires_at 
    });

    console.log('[LimitService] Current status:', statusInfo.status);

    // 2. Fetch all staff & doctors
    const { data: doctors } = await db.from('doctors').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: true });
    const { data: staff } = await db.from('clinic_staff').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: true });

    const activePlan = statusInfo.status === 'EXPIRED' ? 'free' : (clinic.plan || 'free').toLowerCase();
    const limits = PLAN_LIMITS[activePlan] || PLAN_LIMITS.free;

    // 3. Enforce Doctors
    const activeDocs = (doctors || []).filter(d => !d.unavailable);
    if (activeDocs.length > limits.doctors) {
        const surplus = activeDocs.slice(limits.doctors);
        for (const doc of surplus) {
            await db.from('doctors').update({ unavailable: true }).eq('id', doc.id);
        }
    } else if (statusInfo.status !== 'EXPIRED') {
        const inactiveDocs = (doctors || []).filter(d => d.unavailable);
        const slotsAvailable = limits.doctors - activeDocs.length;
        if (slotsAvailable > 0) {
            const toReact = inactiveDocs.slice(0, slotsAvailable);
            for (const doc of toReact) {
                await db.from('doctors').update({ unavailable: false }).eq('id', doc.id);
            }
        }
    }

    // 4. Enforce Lab Techs
    const activeLabTechs = (staff || []).filter(s => s.is_active && LAB_TECH_ROLES.includes(s.role));
    if (activeLabTechs.length > limits.labTechs) {
        const surplus = activeLabTechs.slice(limits.labTechs);
        for (const s of surplus) {
            await db.from('clinic_staff').update({ is_active: false }).eq('id', s.id);
        }
    } else if (statusInfo.status !== 'EXPIRED') {
        const inactiveLabTechs = (staff || []).filter(s => !s.is_active && LAB_TECH_ROLES.includes(s.role));
        const slotsAvailable = limits.labTechs - activeLabTechs.length;
        if (slotsAvailable > 0) {
            const toReact = inactiveLabTechs.slice(0, slotsAvailable);
            for (const s of toReact) {
                await db.from('clinic_staff').update({ is_active: true }).eq('id', s.id);
            }
        }
    }

    // 5. Enforce Total Staff
    const activeStaff = (staff || []).filter(s => s.is_active);
    if (activeStaff.length > limits.totalStaff) {
        const surplus = activeStaff.slice(limits.totalStaff);
        for (const s of surplus) {
            await db.from('clinic_staff').update({ is_active: false }).eq('id', s.id);
        }
    } else if (statusInfo.status !== 'EXPIRED') {
        const inactiveStaff = (staff || []).filter(s => !s.is_active);
        const slotsAvailable = limits.totalStaff - activeStaff.length;
        if (slotsAvailable > 0) {
            const toReact = inactiveStaff.slice(0, slotsAvailable);
            for (const s of toReact) {
                await db.from('clinic_staff').update({ is_active: true }).eq('id', s.id);
            }
        }
    }
    
    console.log('[LimitService] Enforcement complete.');
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * 🔍 Helper for UI feedback
 */
export const getLimitFeedback = (type) => {
    const check = checkPlanLimit(type);
    if (!check) return null;
    if (check.canAdd) return null;
    
    return {
        title: `${check.typeLabel} Limit Reached`,
        message: `Your ${check.planLabel} allows up to ${check.limit} ${check.typeLabel}s.`,
        upgradeMsg: `Upgrade to a higher plan to add more.`,
        footer: `Upgrade Now`,
        icon: '⚠️'
    };
};
