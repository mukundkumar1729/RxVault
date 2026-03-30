// ════════════════════════════════════════════════════════════
//  PRESCRIPTION SERVICE
//  Handles logic for OPD Prescriptions, saving, revisions
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { dbUpsertPrescription, dbDeletePrescription } from '../core/db.js';

export const savePrescriptionRecord = async (rxData, isEdit = false) => {
    if (!store.activeClinicId) throw new Error("No active clinic available for prescriptions.");

    let rx = { ...rxData };
    rx.updatedAt = new Date().toISOString();
    
    const registry = store.prescriptions || [];

    if (isEdit) {
        const idx = registry.findIndex(p => p.id === rx.id);
        if (idx > -1) {
            const old = registry[idx];
            const snap = { ...old };
            delete snap.revisions;
            
            rx.revisions = [...(old.revisions || []), { ...snap, _savedAt: old.updatedAt || old.createdAt || old.date }];
            rx.createdAt = old.createdAt || new Date().toISOString();
            registry[idx] = rx;
        } else {
            throw new Error("Prescription not found for editing.");
        }
    } else {
        rx.id = rx.id || `rx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        rx.createdAt = new Date().toISOString();
        if(!rx.clinicId) rx.clinicId = store.activeClinicId;
        registry.unshift(rx);
    }

    const success = await dbUpsertPrescription(rx);
    if (!success) throw new Error("Database failed to process prescription sync.");

    // Broadcast reactivity
    store.prescriptions = [...registry];
    return rx;
};

export const deletePrescriptionRecord = async (rxId) => {
    const success = await dbDeletePrescription(rxId);
    if (success) {
        const registry = store.prescriptions || [];
        store.prescriptions = registry.filter(p => p.id !== rxId);
        return true;
    }
    return false;
};

export const restoreRevision = async (rxId, revIdx) => {
    const registry = store.prescriptions || [];
    const pIdx = registry.findIndex(x => x.id === rxId);
    if (pIdx === -1) throw new Error('Prescription not found');

    const p = registry[pIdx];
    const revToRestore = (p.revisions || [])[revIdx];
    if (!revToRestore) throw new Error('Revision index invalid');

    const snap = { ...p };
    delete snap.revisions;

    const newRevisions = [...(p.revisions || [])];
    newRevisions.splice(revIdx, 1);
    newRevisions.push({ ...snap, _savedAt: p.updatedAt || p.createdAt || p.date });

    const restoredP = {
        ...revToRestore,
        id: rxId, // Maintain original ID
        revisions: newRevisions,
        updatedAt: new Date().toISOString()
    };

    registry[pIdx] = restoredP;
    
    const ok = await dbUpsertPrescription(restoredP);
    if (!ok) throw new Error('Failed to save restored version to DB');

    store.prescriptions = [...registry];
    return restoredP;
};
