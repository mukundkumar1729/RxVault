import { store } from '../core/store.js';

/**
 * Fetches appointments for a clinic/date and updates the store
 */
export const fetchAppointments = async (clinicId, date = '') => {
    // Note: dbGetAppointments is global from supabase.js for now
    const data = await window.dbGetAppointments(clinicId, date);
    store.appointments = data || [];
    return store.appointments;
};

/**
 * Persists a new or updated appointment
 */
export const saveAppointment = async (appt) => {
    const ok = await window.dbUpsertAppointment(appt);
    if (ok) {
        // Optimistic update or refresh
        const idx = (store.appointments || []).findIndex(a => a.id === appt.id);
        if (idx !== -1) {
            store.appointments[idx] = appt;
        } else {
            store.appointments = [appt, ...(store.appointments || [])];
        }
    }
    return ok;
};

/**
 * Updates only the status of an appointment
 */
export const updateAppointmentStatus = async (id, status) => {
    const appt = (store.appointments || []).find(a => a.id === id);
    if (!appt) return false;
    
    const updated = { ...appt, status };
    const ok = await window.dbUpsertAppointment(updated);
    if (ok) {
        appt.status = status; // Direct mutation of reactive store object
    }
    return ok;
};

/**
 * Toggles arrival status
 */
export const toggleAppointmentArrival = async (id) => {
    const appt = (store.appointments || []).find(a => a.id === id);
    if (!appt) return false;
    
    const updated = { ...appt, arrived: !appt.arrived };
    const ok = await window.dbUpsertAppointment(updated);
    if (ok) {
        appt.arrived = !appt.arrived;
    }
    return ok;
};

/**
 * Deletes an appointment
 */
export const deleteAppointment = async (id) => {
    const ok = await window.dbDeleteAppointment(id);
    if (ok) {
        store.appointments = (store.appointments || []).filter(a => a.id !== id);
    }
    return ok;
};

/**
 * Gets next token number for a specific date
 */
export const getNextToken = async (clinicId, date) => {
    return await window.dbGetNextToken(clinicId, date);
};

/**
 * Computes queue statistics from current store
 */
export const computeQueueStats = (dateFilter = '') => {
    const list = store.appointments || [];
    const today = new Date().toISOString().split('T')[0];
    
    // If no filter, we usually show today's stats on dashboards
    const target = dateFilter ? list : list.filter(a => (a.appt_date || '').slice(0, 10) === today);
    
    return {
        total: target.length,
        waiting: target.filter(a => a.status === 'waiting' && a.arrived).length,
        notArrived: target.filter(a => !a.arrived).length,
        inRoom: target.filter(a => a.status === 'in-room').length,
        done: target.filter(a => a.status === 'done').length,
        arrived: target.filter(a => !!a.arrived).length
    };
};
