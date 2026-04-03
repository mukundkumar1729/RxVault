// ════════════════════════════════════════════════════════════
//  ROSTER / STAFF SCHEDULING SERVICE
//  Handles database access, grid processing, and swap negotiations
// ════════════════════════════════════════════════════════════

import { db } from '../core/db.js';
import { store } from '../core/store.js';

export const SHIFTS = {
    M:   { label: 'Morning',   time: '7am–2pm',  bg: 'hsl(150, 80%, 96%)',  clr: 'hsl(150, 80%, 25%)',  short: 'MOR' },
    A:   { label: 'Afternoon', time: '2pm–9pm',  bg: 'hsl(210, 80%, 96%)',  clr: 'hsl(210, 80%, 30%)',  short: 'AFT' },
    N:   { label: 'Night',     time: '9pm–7am',  bg: 'hsl(270, 70%, 96%)',  clr: 'hsl(270, 70%, 35%)',  short: 'NGT' },
    OC:  { label: 'On-Call',   time: 'standby',  bg: 'hsl(30, 90%, 95%)',   clr: 'hsl(30, 90%, 30%)',   short: 'ONC' },
    OFF: { label: 'Off',       time: 'rest day', bg: 'hsl(210, 10%, 94%)',  clr: 'hsl(210, 10%, 45%)',  short: 'OFF' },
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Returns an array of 7 Date objects for the week containing today + offset weeks.
 */
export const getWeekDates = (offset = 0) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today.getTime() + (mondayDiff + offset * 7) * 86400000);
    
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
};

/**
 * Fetches the active clinic members assigned to the roster (excluding superadmins).
 */
export const fetchRosterStaffMembers = async () => {
    if (!store.activeClinicId) return [];
    const { data, error } = await db.from('clinic_members').select('*').eq('clinic_id', store.activeClinicId);
    if (error) {
        console.error('[Roster Service] Members fetch failed', error);
        return [];
    }
    return (data || []).filter(m => m.role !== 'superadmin');
};

/**
 * Fetches the raw weekly shift data for the clinic and remaps it hierarchically.
 * Resolves to { [staff_id]: { [slot_key]: "M|A|N|OC|OFF" } }
 */
export const fetchShiftRosterMap = async () => {
    if (!store.activeClinicId) return {};
    const { data, error } = await db.from('shift_roster').select('*').eq('clinic_id', store.activeClinicId);
    if (error) {
        console.error('[Roster Service] Shifts fetch failed', error);
        return {};
    }
    
    const rosterData = {};
    (data || []).forEach(row => {
        if (!rosterData[row.staff_id]) rosterData[row.staff_id] = {};
        rosterData[row.staff_id][row.slot_key] = row.shift_code;
    });
    return rosterData;
};

/**
 * Persists an exact staff shift change slot.
 */
export const updateStaffShiftDatabase = async (staffId, slotKey, shiftCode) => {
    const { error } = await db.from('shift_roster').upsert({
        clinic_id: store.activeClinicId,
        staff_id: staffId,
        slot_key: slotKey,
        shift_code: shiftCode,
        updated_at: new Date().toISOString()
    }, { onConflict: 'clinic_id,staff_id,slot_key' });
    
    if (error) console.error('[Roster Service] Shift upsert failed', error);
    return !error;
};

/**
 * Polls for pending staff swap negotiations.
 */
export const fetchPendingSwapRequests = async () => {
    if (!store.activeClinicId) return [];
    const { data, error } = await db.from('shift_swaps')
        .select('*')
        .eq('clinic_id', store.activeClinicId)
        .eq('status', 'pending')
        .order('requested_on', { ascending: false });
        
    if (error) console.error('[Roster Service] Swap fetch failed', error);
    return data || [];
};

/**
 * Approves a queued shift swap, injecting the new target shifts securely.
 * @returns {boolean} true if successful
 */
export const approveShiftSwap = async (swapId, rosterDataCache) => {
    const { data, error } = await db.from('shift_swaps').select('*').eq('id', swapId).single();
    if (error || !data) return false;
    
    const codeA = (rosterDataCache[data.requester_id] || {})[data.slot_key_a] || 'OFF';
    const codeB = (rosterDataCache[data.target_id] || {})[data.slot_key_b] || 'OFF';
    
    // Perform relational vector swap natively
    const okA = await updateStaffShiftDatabase(data.requester_id, data.slot_key_b, codeA);
    const okB = await updateStaffShiftDatabase(data.target_id, data.slot_key_a, codeB);
    
    if (okA && okB) {
        await db.from('shift_swaps').update({ status: 'approved', resolved_on: new Date().toISOString() }).eq('id', swapId);
        return true;
    }
    return false;
};

/**
 * Explicitly terminates a swap request without applying shift vectors.
 */
export const rejectShiftSwap = async (swapId) => {
    const { error } = await db.from('shift_swaps').update({ status: 'rejected', resolved_on: new Date().toISOString() }).eq('id', swapId);
    return !error;
};
