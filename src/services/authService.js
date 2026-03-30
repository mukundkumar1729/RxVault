// ════════════════════════════════════════════════════════════
//  AUTHENTICATION SERVICE
//  Handles core session state, permissions, and database login logic
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { dbLogin } from '../core/db.js';

const AUTH_SESSION_KEY = 'rxvault_session';

/**
 * Validates and restores session from local storage.
 * @returns {boolean} true if session successfully loaded
 */
export const loadSession = () => {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) return false;
        
        const s = JSON.parse(raw);
        const ageHrs = (Date.now() - new Date(s.savedAt).getTime()) / 3600000;
        
        if (ageHrs > 12) {
            clearSession();
            return false;
        }

        // Hydrate the proxy store
        store.currentUser = s.user;
        store.currentRole = s.clinicRole || null;
        
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Saves authenticated user data directly into the Proxy store and local storage.
 */
export const saveSession = (user, clinicRole) => {
    store.currentUser = user;
    store.currentRole = clinicRole || null;
    
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        user,
        clinicRole,
        savedAt: new Date().toISOString()
    }));
};

/**
 * Destroys session locally and from the application state store.
 */
export const clearSession = () => {
    store.currentUser = null;
    store.currentRole = null;
    store.activeClinicId = null;
    
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('pv_active_clinic');
};

/**
 * Ensures proxy store hydrates accurately representing valid Auth tokens
 */
export const syncCurrentUserStatus = async () => {
    const isLoaded = loadSession();
    if (!isLoaded) return null;
    return store.currentUser;
};

/**
 * Modifies the user's active clinic role context.
 */
export const updateClinicRole = (role) => {
    store.currentRole = role || null;
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
            const s = JSON.parse(raw);
            s.clinicRole = role;
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(s));
        }
    } catch (e) {
        console.warn('Failed to update clinic role storage:', e);
    }
};

/**
 * Authenticates user credentials via Supabase layer.
 */
export const authLogin = async (email, password) => {
    const result = await dbLogin(email, password);
    if (!result) return { success: false, error: 'Invalid email or password.' };
    if (!result.is_active) return { success: false, error: 'Account is inactive. Contact admin.' };
    
    saveSession(result, result.role === 'superadmin' ? 'superadmin' : null);
    
    return { success: true, user: result };
};

export const authLogout = async () => {
    clearSession();
    window.location.reload();
};

// ─── Permission Guards ────────────────────────────────────

export const isLoggedIn = () => store.currentUser !== null;
export const isSuperAdmin = () => store.currentUser?.role === 'superadmin';

export const getEffectiveRole = () => {
    if (!store.currentUser) return null;
    if (store.currentUser.role === 'superadmin') return 'superadmin';
    return store.currentRole || 'viewer';
};

export const hasRole = (roles) => {
    const role = getEffectiveRole();
    return role && roles.includes(role);
};

export const can = {
    createClinic:       () => hasRole(['superadmin']),
    deleteClinic:       () => hasRole(['superadmin']),
    manageStaff:        () => hasRole(['superadmin','admin']),
    manageDoctors:      () => hasRole(['superadmin','admin']),
    addPrescription:    () => hasRole(['superadmin','admin','doctor']),
    editPrescription:   () => hasRole(['superadmin','admin','doctor']),
    deletePrescription: () => hasRole(['superadmin','admin']),
    registerPatient:    () => hasRole(['superadmin','admin','doctor','receptionist']),
    viewPrescriptions:  () => hasRole(['superadmin','admin','doctor','receptionist','pharmacist','viewer']),
    viewPharmacy:       () => hasRole(['superadmin','admin','doctor','pharmacist']),
    viewPatients:       () => hasRole(['superadmin','admin','doctor','receptionist','pharmacist','viewer']),
    exportData:         () => hasRole(['superadmin','admin']),
    viewAuditLog:       () => hasRole(['superadmin','admin']),
    accessAdminPanel:   () => hasRole(['superadmin','admin']),
};
