import { store } from '../core/store.js';

/**
 * Fetches vitals for a specific patient
 */
export const fetchVitalsForPatient = async (clinicId, patientName) => {
    return await window.dbGetVitals(clinicId, patientName);
};

/**
 * Persists a new vitals record
 */
export const saveVitalsRecord = async (record) => {
    return await window.dbInsertVitals(record);
};

/**
 * Calculates BMI and category
 */
export const calculateBMI = (weight, height) => {
    if (!weight || !height || height <= 0) return null;
    const bmi = weight / Math.pow(height / 100, 2);
    let category = 'Normal';
    let color = 'var(--green)';
    
    if (bmi < 18.5) { category = 'Underweight'; color = 'var(--allopathy)'; }
    else if (bmi >= 25 && bmi < 30) { category = 'Overweight'; color = 'var(--ayurveda)'; }
    else if (bmi >= 30) { category = 'Obese'; color = 'var(--red)'; }
    
    return { val: bmi.toFixed(1), category, color };
};

/**
 * Analyzes vitals for abnormal thresholds
 */
export const getVitalsAlerts = (v) => {
    const alerts = [];
    if (v.bp_systolic > 140 || v.bp_diastolic > 90) alerts.push({ type: 'warning', text: `High BP (${v.bp_systolic}/${v.bp_diastolic} mmHg)` });
    if (v.bp_systolic < 90) alerts.push({ type: 'warning', text: 'Low Blood Pressure' });
    if (v.sugar_fasting > 126) alerts.push({ type: 'warning', text: 'High Fasting Blood Sugar' });
    if (v.sugar_fasting < 70 || v.sugar_pp < 70) alerts.push({ type: 'error', text: 'Low Blood Sugar (Hypoglycemia risk)' });
    if (v.spo2 && v.spo2 < 95) alerts.push({ type: 'error', text: '🚨 Low SpO2' });
    if (v.temperature > 103) alerts.push({ type: 'error', text: '🚨 High Fever (>103°F)' });
    else if (v.temperature > 100.4) alerts.push({ type: 'warning', text: `Fever (${v.temperature}°F)` });
    if (v.pulse > 100) alerts.push({ type: 'warning', text: 'Elevated Pulse' });
    if (v.pulse < 60) alerts.push({ type: 'warning', text: 'Low Pulse (Bradycardia)' });
    return alerts;
};
