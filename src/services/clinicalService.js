// ════════════════════════════════════════════════════════════
//  CLINICAL SERVICE
//  Allergy Datasets & Intelligent Drug Interaction Engine
// ════════════════════════════════════════════════════════════

import { db } from '../core/db.js';
import { store } from '../core/store.js';

/**
 * High-risk Interaction Registry
 * Format: [drugA_fragment, drugB_fragment, severity, clinical_rationale]
 * Matches via substring inference to ensure broader fault-tolerance.
 */
export const DRUG_INTERACTIONS = [
    ['warfarin',   'aspirin',       'high',   'Major bleeding risk — combined anticoagulant + antiplatelet effect'],
    ['warfarin',   'ibuprofen',     'high',   'Ibuprofen increases warfarin effect → bleeding risk'],
    ['warfarin',   'paracetamol',   'med',    'High-dose paracetamol may enhance warfarin anticoagulation'],
    ['metformin',  'alcohol',       'med',    'Risk of lactic acidosis with heavy alcohol use'],
    ['metformin',  'contrast',      'high',   'Hold metformin 48h before/after iodine contrast studies'],
    ['metformin',  'ibuprofen',     'med',    'NSAIDs may impair renal function and increase metformin levels'],
    ['amlodipine', 'simvastatin',   'high',   'Amlodipine increases simvastatin levels → myopathy risk'],
    ['amlodipine', 'clarithromycin','high',   'CYP3A4 inhibition raises amlodipine → severe hypotension'],
    ['atenolol',   'verapamil',     'high',   'Additive AV block risk — both slow heart rate'],
    ['atenolol',   'diltiazem',     'high',   'Combined bradycardia and heart block risk'],
    ['lisinopril', 'spironolactone','high',   'Dangerous hyperkalaemia — both raise potassium'],
    ['lisinopril', 'ibuprofen',     'med',    'NSAIDs blunt ACE inhibitor effect and stress kidneys'],
    ['ciprofloxacin','antacid',     'med',    'Antacids reduce ciprofloxacin absorption — space 2h apart'],
    ['ciprofloxacin','warfarin',    'high',   'Ciprofloxacin markedly increases warfarin effect'],
    ['clarithromycin','simvastatin','high',   'Severe rhabdomyolysis risk — CYP3A4 inhibition'],
    ['fluconazole', 'warfarin',     'high',   'Fluconazole strongly increases warfarin — serious bleeding risk'],
    ['fluconazole', 'metformin',    'low',    'Mild increase in metformin levels — monitor glucose'],
    ['digoxin',    'amiodarone',    'high',   'Amiodarone nearly doubles digoxin levels → toxicity'],
    ['digoxin',    'clarithromycin','high',   'Clarithromycin raises digoxin to toxic levels'],
    ['ssri',       'tramadol',      'high',   'Serotonin syndrome risk — potentially life-threatening'],
    ['sertraline', 'tramadol',      'high',   'Serotonin syndrome risk'],
    ['fluoxetine', 'tramadol',      'high',   'Serotonin syndrome risk'],
    ['aspirin',    'ibuprofen',     'med',    'Ibuprofen blocks aspirin\'s cardioprotective effect'],
    ['methotrexate','ibuprofen',    'high',   'NSAIDs reduce methotrexate clearance → toxicity'],
    ['phenytoin',  'warfarin',      'high',   'Unpredictable interaction — both levels affected'],
    ['carbamazepine','warfarin',    'high',   'Carbamazepine accelerates warfarin metabolism'],
    ['sildenafil', 'nitrate',       'high',   'Severe hypotension — absolute contraindication'],
    ['sildenafil', 'isosorbide',    'high',   'Severe hypotension — absolute contraindication'],
];

/**
 * Searches the core global namespace registry to locate a matched patient object.
 * Used as a fallback during the hybrid legacy transition period where patient strings
 * map actively over their GUIDs inside prescription flows.
 */
const locatePatientInSystem = (patientName) => {
    const registry = window.patientRegistry || [];
    return registry.find(p => (p.name || '').trim().toLowerCase() === (patientName || '').trim().toLowerCase());
};

export const updatePatientAllergyDatabase = async (patientPayload) => {
    const { error } = await db.from('patients').upsert(patientPayload, { onConflict: 'id' });
    if (error) { 
        console.error('[Clinical Service] Patient sync failed', error); 
        return false; 
    }
    return true;
};

/**
 * Determines if a new medicine fragment structurally matches any pre-existing
 * known allergies registered within the patient's biological profile.
 */
export const assessPatientAllergyCollision = (patientName, medicineName) => {
    const patient = locatePatientInSystem(patientName);
    if (!patient || !patient.allergies || !patient.allergies.length) return null;
    
    const token = (medicineName || '').toLowerCase();
    
    return patient.allergies.find(a => {
        const alg = a.drug.toLowerCase();
        return token.includes(alg.split(' ')[0]) || alg.includes(token.split(' ')[0]);
    }) || null;
};

/**
 * Determines theoretical Drug interactions traversing previously administered 
 * active scripts for the patient + the unsubmitted form context array.
 */
export const assessDrugInteractions = (patientName, proposedMedicineName, inMemoryFormMeds = []) => {
    if (!patientName || !proposedMedicineName) return [];
    
    // Aggregate Active
    const baseMedsLine = [];
    (store.prescriptions || []).forEach(rx => {
        if ((rx.patientName || '').trim().toLowerCase() !== patientName.trim().toLowerCase()) return;
        if (rx.status !== 'active') return;
        (rx.medicines || []).forEach(m => { 
            if (m.name) baseMedsLine.push(m.name.toLowerCase()); 
        });
    });

    // Fold the active UI context
    inMemoryFormMeds.forEach(m => {
        const val = m.toLowerCase().trim();
        if (val && val !== proposedMedicineName.toLowerCase()) baseMedsLine.push(val);
    });

    const activeMeds = [...new Set(baseMedsLine)];
    const proposed = proposedMedicineName.toLowerCase();
    const hits = [];

    DRUG_INTERACTIONS.forEach(([drugA, drugB, sev, desc]) => {
        const matA = proposed.includes(drugA);
        const matB = proposed.includes(drugB);
        if (!matA && !matB) return;
        
        const counterTarget = matA ? drugB : drugA;
        const existsInVector = activeMeds.find(m => m.includes(counterTarget));
        
        if (existsInVector) {
            hits.push({
                drug1: proposedMedicineName,
                drug2: existsInVector,
                severity: sev,
                description: desc
            });
        }
    });

    return hits;
};
