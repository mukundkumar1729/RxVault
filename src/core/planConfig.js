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
        label: 'Free Plan',
        features: [
            '👨‍⚕️ Up to 1 Doctor',
            '🧪 Up to 1 Lab Tech',
            '👥 Up to 7 Staff'
        ]
    },
    silver: { 
        doctors: 7, 
        labTechs: 7, 
        totalStaff: 29, 
        price: 1729,
        label: 'Silver Plan',
        features: [
            '👨‍⚕️ Up to 7 Doctors',
            '🧪 Up to 7 Lab Techs',
            '👥 Up to 29 Total Staff',
            '✅ Priority Support'
        ]
    },
    gold: { 
        doctors: 100, 
        labTechs: 100, 
        totalStaff: Infinity, 
        price: 5729,
        label: 'Gold Plan',
        features: [
            '👨‍⚕️ Up to 100 Doctors',
            '🧪 Up to 100 Lab Techs',
            '👥 Unlimited Staff',
            '✅ AI Medical Insights'
        ]
    },
    platinum: { 
        doctors: Infinity, 
        labTechs: Infinity, 
        totalStaff: Infinity, 
        price: 9729,
        label: 'Platinum Plan',
        features: [
            '👨‍⚕️ Unlimited Doctors',
            '🧪 Unlimited Lab Techs',
            '👥 Unlimited Staff',
            '✅ Enterprise AI Suite'
        ]
    }
};

/**
 * 🛡️ Lab Technician Roles
 * Defines which roles count towards the "Lab Tech" limit.
 */
export const LAB_TECH_ROLES = ['lab_technician'];
