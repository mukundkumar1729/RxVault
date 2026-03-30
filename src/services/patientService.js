// ════════════════════════════════════════════════════════════
//  PATIENT SERVICE
//  Handles logic for patient registration and fee validity
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { dbInsertPatient, dbUpsertPrescription } from '../core/db.js';

const FEE_VALIDITY_DAYS = 7;

/**
 * Calculates the most recent payment date across registrations and prescriptions.
 * @param {Object} patient 
 * @returns {Date|null}
 */
export const getLastPaymentDate = (patient) => {
    const dates = [];
    if (patient.registeredAt) dates.push(new Date(patient.registeredAt));
    if (patient.lastFeeDate)  dates.push(new Date(patient.lastFeeDate));
    
    // Check global prescription store safely
    const rxs = store.prescriptions || [];
    rxs.forEach(rx => {
        if ((rx.patientName||'').trim().toLowerCase() === (patient.name||'').trim().toLowerCase() && rx.feePaidDate) {
            dates.push(new Date(rx.feePaidDate));
        }
    });
    
    if (!dates.length) return null;
    return dates.reduce((a, b) => a > b ? a : b);
};

/**
 * Returns the exact expiration date of the consultation fee.
 */
export const getFeeExpiryDate = (patient) => {
    const last = getLastPaymentDate(patient);
    if (!last) return null;
    return new Date(last.getTime() + FEE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
};

/**
 * Returns number of days remaining on consultation.
 */
export const getDaysRemaining = (patient) => {
    const exp = getFeeExpiryDate(patient);
    if (!exp) return 0;
    return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
};

/**
 * Returns the status of the patient's fee.
 * @returns {'valid' | 'expired' | 'never'}
 */
export const getPatientFeeStatus = (patient) => {
    if (!patient) return 'never';
    const lastPayment = getLastPaymentDate(patient);
    if (!lastPayment) return 'never';
    
    const diffDays = (Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= FEE_VALIDITY_DAYS ? 'valid' : 'expired';
};

/**
 * Registers a new patient to the active clinic and updates the global store.
 */
export const registerNewPatient = async (patientData) => {
    if (!store.activeClinicId) throw new Error('No active clinic to register patient into.');
    
    const patientRecord = {
        ...patientData,
        clinicId: store.activeClinicId,
        registeredAt: new Date().toISOString()
    };
    
    const success = await dbInsertPatient(patientRecord);
    if (!success) return false;
    
    // Update proxy store reactively
    const updatedRegistry = [patientRecord, ...(store.patientRegistry || [])];
    store.patientRegistry = updatedRegistry;
    
    return patientRecord;
};

/**
 * Processes a consultation fee collection for an existing patient.
 */
export const collectFee = async (patientId, amount, paymentMethod, doctorName) => {
    const registry = store.patientRegistry || [];
    const idx = registry.findIndex(p => p.id === patientId);
    
    if (idx === -1) throw new Error('Patient not found');
    
    const patient = registry[idx];
    patient.lastFeeDate = new Date().toISOString();
    patient.consultantFee = amount;
    patient.paymentMethod = paymentMethod;
    if (doctorName) patient.consultantDoctor = doctorName;
    
    const success = await dbInsertPatient(patient);
    if (!success) return false;
    
    // Trigger reactivity
    store.patientRegistry = [...registry];
    return patient;
};
