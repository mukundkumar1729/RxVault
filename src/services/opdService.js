// ════════════════════════════════════════════════════════════
//  OPD, VACCINATION, AND FOLLOW-UP SERVICE
//  Stateless operational abstractions for front-desk workflows
// ════════════════════════════════════════════════════════════

import { db } from '../core/db.js';
import { store } from '../core/store.js';

// ─── Token Board Logic ──────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

export const fetchOpdBoardMetrics = () => {
    // Relying on global memory array injected by legacy bootstrap during transition.
    const appts = window.appointments || [];
    
    const todayAppts = appts.filter(a => a.appt_date === todayISO() || !a.appt_date);
    
    // Determine the patient currently actively being served
    const currentTokenObj = todayAppts
        .filter(a => a.status === 'in-room')
        .sort((a, b) => (a.token_no || 0) - (b.token_no || 0))[0];

    const waiting = todayAppts.filter(a => a.status === 'waiting').length;
    const done = todayAppts.filter(a => a.status === 'done').length;

    return {
        currentToken: currentTokenObj,
        countWaiting: waiting,
        countDone: done
    };
};

// ─── Vaccination Logic ──────────────────────────────────────────

export const VACCINE_SCHEDULE = [
    { name:'BCG',            age_days: 0,    type:'birth',     description:'Birth' },
    { name:'OPV-0',          age_days: 0,    type:'birth',     description:'Birth' },
    { name:'Hepatitis B-1',  age_days: 0,    type:'birth',     description:'Birth' },
    { name:'OPV-1 + IPV-1',  age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'DTwP/DTaP-1',    age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'Hib-1',          age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'Hepatitis B-2',  age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'Rotavirus-1',    age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'PCV-1',          age_days: 42,   type:'6w',        description:'6 weeks' },
    { name:'OPV-2 + IPV-2',  age_days: 70,   type:'10w',       description:'10 weeks' },
    { name:'DTwP/DTaP-2',    age_days: 70,   type:'10w',       description:'10 weeks' },
    { name:'Hib-2',          age_days: 70,   type:'10w',       description:'10 weeks' },
    { name:'Hepatitis B-3',  age_days: 70,   type:'10w',       description:'10 weeks' },
    { name:'Rotavirus-2',    age_days: 70,   type:'10w',       description:'10 weeks' },
    { name:'OPV-3',          age_days: 98,   type:'14w',       description:'14 weeks' },
    { name:'DTwP/DTaP-3',    age_days: 98,   type:'14w',       description:'14 weeks' },
    { name:'Hib-3',          age_days: 98,   type:'14w',       description:'14 weeks' },
    { name:'PCV-2',          age_days: 98,   type:'14w',       description:'14 weeks' },
    { name:'Rotavirus-3',    age_days: 98,   type:'14w',       description:'14 weeks' },
    { name:'MMR-1',          age_days: 274,  type:'9m',        description:'9 months' },
    { name:'Typhoid conj.',  age_days: 274,  type:'9m',        description:'9 months' },
    { name:'PCV booster',    age_days: 365,  type:'12m',       description:'12 months' },
    { name:'Hib booster',    age_days: 365,  type:'12m',       description:'12 months' },
    { name:'Hepatitis A-1',  age_days: 365,  type:'12m',       description:'12 months' },
    { name:'Varicella-1',    age_days: 365,  type:'12m',       description:'12 months' },
    { name:'MMR-2',          age_days: 548,  type:'15m',       description:'15 months' },
    { name:'DTwP/DTaP-B1',   age_days: 548,  type:'15m',       description:'15-18 months booster' },
    { name:'IPV booster',    age_days: 548,  type:'15m',       description:'15-18 months booster' },
    { name:'Hepatitis A-2',  age_days: 548,  type:'18m',       description:'18 months' },
    { name:'Varicella-2',    age_days: 548,  type:'18m',       description:'18 months' },
    { name:'DTwP/DTaP-B2',   age_days: 1825, type:'5y',        description:'5 years booster' },
    { name:'OPV booster',    age_days: 1825, type:'5y',        description:'5 years booster' },
    { name:'MMR-3',          age_days: 1825, type:'5y',        description:'5 years' },
    { name:'Tdap / Td',      age_days: 4015, type:'11y',       description:'10–12 years' },
    { name:'HPV-1',          age_days: 4015, type:'11y',       description:'11+ years (girls)' },
];

export const fetchPaediatricRegistry = () => {
    return (window.patientRegistry || []).filter(p => p.age && parseInt(p.age, 10) <= 14);
};

export const computePatientVaccineStatusState = (patient) => {
    let overdueCount = 0;
    let dueSoonCount = 0;
    
    if (!patient.dob) return { overdue: 0, dueSoon: 0, nextDue: null };
    
    const dob = new Date(patient.dob);
    if (isNaN(dob)) return { overdue: 0, dueSoon: 0, nextDue: null };
    
    const ageDays = Math.floor((Date.now() - dob.getTime()) / 86400000);
    const given = patient.vaccines_given || [];
    let nextDue = null;

    VACCINE_SCHEDULE.forEach(v => {
        if (given.includes(v.name)) return;
        
        const isGenderMismatch = v.name.includes('HPV') && (patient.gender || '').toLowerCase() !== 'female';
        if (isGenderMismatch) return;

        const dueIn = v.age_days - ageDays;
        
        if (dueIn < -14) overdueCount++;
        else if (dueIn >= -14 && dueIn <= 30) dueSoonCount++;

        if (dueIn >= -14 && dueIn <= 90) {
            if (!nextDue || v.age_days < nextDue.age_days) {
                const targetDate = new Date(dob.getTime() + v.age_days * 86400000);
                nextDue = { ...v, targetDate, daysLeft: dueIn };
            }
        }
    });

    return { overdue: overdueCount, dueSoon: dueSoonCount, nextDue };
};

// ─── Follow-Up Engine ──────────────────────────────────────────

export const computeGlobalFollowupReminders = (filterMode = 'all') => {
    let reminders = [];
    const now = new Date();
    
    (store.prescriptions || []).forEach(rx => {
        if (!rx.followupDate) return;
        
        const fDate = new Date(rx.followupDate);
        if (isNaN(fDate)) return;

        // Calculate offset (resetting times)
        const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate());
        const daysLeft = Math.round((d2 - d1) / 86400000);

        // Discard deeply fulfilled follow-ups
        if (daysLeft < -30) return;

        reminders.push({ rx, daysLeft, followupDate: fDate });
    });

    // Sub-segment filtering
    const sorted = reminders.sort((a,b) => a.daysLeft - b.daysLeft);
    
    if (filterMode === 'overdue') return sorted.filter(r => r.daysLeft < 0);
    if (filterMode === 'today') return sorted.filter(r => r.daysLeft === 0);
    if (filterMode === 'week') return sorted.filter(r => r.daysLeft > 0 && r.daysLeft <= 7);
    if (filterMode === 'upcoming') return sorted.filter(r => r.daysLeft > 7);
    
    return sorted; // all
};

export const persistPrescriptionFollowupOverride = async (rxId, newIsoDateStr) => {
    const rx = (store.prescriptions || []).find(r => r.id === rxId);
    if (!rx) return false;
    
    rx.followupDate = newIsoDateStr || null;
    
    // Attempt local legacy hook if available
    if (typeof window.dbUpsertPrescription === 'function') {
        const ok = await window.dbUpsertPrescription(rx);
        return ok;
    }
    
    // Fallback strictly native DB layer
    const { error } = await db.from('prescriptions').update({ followup_date: rx.followupDate }).eq('id', rx.id);
    return !error;
};
