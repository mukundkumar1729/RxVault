// ════════════════════════════════════════════════════════════
//  CLINIC SERVICE
//  Handles clinic lifecycle, session persistence, and tenant resolution
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { dbGetUserClinics, dbGetClinics, dbUpdateClinic, dbInsertClinic, dbDeleteClinic, dbAssignStaff, dbAudit } from '../core/db.js';

const ACTIVE_CLINIC_KEY = 'pv_active_clinic';

/**
 * Validates and caches the active clinic choice
 */
export const setActiveClinic = (id) => {
    store.activeClinicId = id;
    if (id) {
        localStorage.setItem(ACTIVE_CLINIC_KEY, id);
    } else {
        localStorage.removeItem(ACTIVE_CLINIC_KEY);
    }

    const match = (store.clinics || []).find(c => c.id === id);
    if (match && typeof window.updateClinicRole === 'function') {
        window.updateClinicRole(match.staffRole || 'viewer'); // Fallback to global dispatch until top-level integration closes
    }
};

/**
 * Returns the hydrated clinic object currently in context
 */
export const getActiveClinic = () => {
    return (store.clinics || []).find(c => c.id === store.activeClinicId) || null;
};

/**
 * Automatically loads authorized clinics based on User Role (Admin vs Standard)
 */
export const loadAuthorizedClinics = async (user) => {
    let loadedClinics = [];
    
    // Auth-aware fetching
    if (user && user.id) {
        const userClinics = await dbGetUserClinics(user.id);
        loadedClinics = (userClinics || []).map(c => ({
            id: c.clinic_id,
            name: c.clinic_name,
            logo: c.clinic_logo || '🏥',
            type: c.clinic_type || 'multispecialty',
            staffRole: c.staff_role,
            pin: c.clinic_pin
        }));

        // SuperAdmin fallback mapping
        if (!loadedClinics.length && typeof window.isSuperAdmin === 'function' && window.isSuperAdmin()) {
            const allClinics = await dbGetClinics();
            loadedClinics = allClinics.map(c => ({ ...c, staffRole: 'superadmin' }));
        }
    } else {
        // Unauthenticated fetching path
        loadedClinics = await dbGetClinics();
    }

    store.clinics = loadedClinics;
    return loadedClinics;
};

/**
 * Determines whether to show the gating UI or auto-forward into a single valid clinic session
 */
export const resolveInitialClinicRoute = (loadedClinics) => {
    if (!loadedClinics.length) return 'EMPTY';

    const saved = localStorage.getItem(ACTIVE_CLINIC_KEY);
    if (saved && loadedClinics.find(c => c.id === saved)) {
        setActiveClinic(saved);
        return 'READY';
    }

    if (loadedClinics.length === 1) {
        setActiveClinic(loadedClinics[0].id);
        return 'READY';
    }

    return 'MULTIPICK';
};

/**
 * Persist a newly generated or modified clinic payload securely
 */
export const saveClinicPayload = async (data, editId = null, user = null) => {
    if (editId) {
        const ok = await dbUpdateClinic(editId, data);
        if (!ok) throw new Error('Failed to update clinic.');
        
        let registry = [...store.clinics];
        const idx = registry.findIndex(c => c.id === editId);
        if (idx > -1) registry[idx] = { ...registry[idx], ...data };
        store.clinics = registry;
        
        return { success: true, updated: editId };
    } else {
        const newId = `clinic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
        const newClinic = { id: newId, ...data };
        
        const saved = await dbInsertClinic(newClinic);
        if (!saved) throw new Error('Failed to create clinic.');
        
        if (user && user.id) {
            await dbAssignStaff(saved.id, user.id, 'admin', user.id);
        }
        
        if (typeof dbAudit === 'function') dbAudit('create', 'clinics', saved.id, null, data);
        
        store.clinics = [...store.clinics, saved];
        setActiveClinic(saved.id);
        return { success: true, updated: saved.id };
    }
};

/**
 * Terminate a clinic tenant entirely
 */
export const deleteClinicEntity = async (id, user) => {
    await dbDeleteClinic(id);
    await loadAuthorizedClinics(user);
    if (store.activeClinicId === id) setActiveClinic(null);
    return true;
};
