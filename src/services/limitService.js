import { store } from '../core/store.js';
import { PLAN_LIMITS, LAB_TECH_ROLES } from '../core/planConfig.js';
import { getActiveClinic } from './clinicService.js';

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
    const plan = (clinic?.plan || 'free').toLowerCase();
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
        typeLabel: type === 'labTech' ? 'Lab Technician' : capitalize(type)
    };
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
