/**
 * 📊 RxVault Plan Configuration
 * Defines resource limits and pricing for different clinic tiers.
 */
export const PLAN_LIMITS = {
    free: { 
        doctors: 1, 
        labTechs: 1, 
        totalStaff: 7, 
        price: 0,
        label: 'Free Plan'
    },
    silver: { 
        doctors: 7, 
        labTechs: 7, 
        totalStaff: 29, 
        price: 1729,
        label: 'Silver Plan'
    },
    gold: { 
        doctors: 100, 
        labTechs: 100, 
        totalStaff: Infinity, 
        price: 4479,
        label: 'Gold Plan'
    },
    platinum: { 
        doctors: Infinity, 
        labTechs: Infinity, 
        totalStaff: Infinity, 
        price: 8879,
        label: 'Platinum Plan'
    }
};

/**
 * 🛡️ Lab Technician Roles
 * Defines which roles count towards the "Lab Tech" limit.
 */
export const LAB_TECH_ROLES = ['lab_technician'];
