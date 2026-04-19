// ════════════════════════════════════════════════════════════
//  DRUG INTERACTION CHECKER & CLINICAL DECISION SUPPORT
//  Checks for drug interactions, allergies, and clinical alerts
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

const DRUG_INTERACTIONS = [
    { drugs: ['warfarin', 'aspirin'], severity: 'high', effect: 'Increased bleeding risk' },
    { drugs: ['warfarin', 'ibuprofen'], severity: 'high', effect: 'Increased bleeding risk' },
    { drugs: ['warfarin', 'naproxen'], severity: 'high', effect: 'Increased bleeding risk' },
    { drugs: ['metformin', 'contrast dye'], severity: 'high', effect: 'Lactic acidosis risk' },
    { drugs: ['amlodipine', 'simvastatin'], severity: 'high', effect: 'Increased rhabdomyolysis risk - reduce simvastatin dose' },
    { drugs: ['lisinopril', 'potassium'], severity: 'moderate', effect: 'Hyperkalemia risk' },
    { drugs: ['losartan', 'potassium'], severity: 'moderate', effect: 'Hyperkalemia risk' },
    { drugs: ['digoxin', 'amiodarone'], severity: 'high', effect: 'Digoxin toxicity' },
    { drugs: ['sildenafil', 'nitroglycerin'], severity: 'high', effect: 'Severe hypotension' },
    { drugs: ['clarithromycin', 'simvastatin'], severity: 'high', effect: 'Increased myopathy risk' },
    { drugs: ['erythromycin', 'simvastatin'], severity: 'high', effect: 'Increased myopathy risk' },
    { drugs: ['fluoxetine', 'tramadol'], severity: 'moderate', effect: 'Serotonin syndrome risk' },
    { drugs: ['paroxetine', 'tramadol'], severity: 'moderate', effect: 'Serotonin syndrome risk' },
    { drugs: ['sertraline', 'tramadol'], severity: 'moderate', effect: 'Serotonin syndrome risk' },
    { drugs: ['ciprofloxacin', 'tizanidine'], severity: 'high', effect: 'Severe hypotension' },
    { drugs: ['ciprofloxacin', 'theophylline'], severity: 'moderate', effect: 'Theophylline toxicity' },
    { drugs: ['methotrexate', 'nsaids'], severity: 'high', effect: 'Methotrexate toxicity' },
    { drugs: ['lithium', 'ibuprofen'], severity: 'high', effect: 'Lithium toxicity' },
    { drugs: ['lithium', 'naproxen'], severity: 'high', effect: 'Lithium toxicity' },
    { drugs: [' ACE inhibitors', 'spironolactone'], severity: 'high', effect: 'Hyperkalemia risk' },
    { drugs: ['trimethoprim', 'sulfamethoxazole', 'potassium'], severity: 'moderate', effect: 'Hyperkalemia' },
    { drugs: ['clopidogrel', 'omeprazole'], severity: 'moderate', effect: 'Reduced antiplatelet effect' },
    { drugs: ['esomeprazole', 'clopidogrel'], severity: 'moderate', effect: 'Reduced antiplatelet effect' },
    { drugs: ['carbamazepine', 'warfarin'], severity: 'high', effect: 'Reduced anticoagulant effect' },
    { drugs: ['rifampin', 'warfarin'], severity: 'high', effect: 'Reduced anticoagulant effect' },
    { drugs: ['ketoconazole', 'statins'], severity: 'high', effect: 'Increased statin toxicity' },
    { drugs: ['diltiazem', 'simvastatin'], severity: 'high', effect: 'Increased myopathy risk' },
    { drugs: ['verapamil', 'simvastatin'], severity: 'high', effect: 'Increased myopathy risk' },
    { drugs: ['codeine', 'tramadol'], severity: 'high', effect: 'Respiratory depression risk' },
    { drugs: ['hydrocodone', 'tramadol'], severity: 'high', effect: 'Respiratory depression risk' },
    { drugs: ['morphine', 'tramadol'], severity: 'high', effect: 'Respiratory depression risk' },
];

const DRUG_CLASS_INTERACTIONS = [
    { from: ['NSAIDs', 'ibuprofen', 'naproxen', 'diclofenac', 'aspirin'], to: ['ACE inhibitors', 'lisinopril', 'enalapril', 'ramipril'], severity: 'moderate', effect: 'Reduced renal function, increased nephrotoxicity' },
    { from: ['NSAIDs'], to: ['Anticoagulants', 'warfarin', 'heparin', 'rivaroxaban'], severity: 'high', effect: 'Increased bleeding risk' },
    { from: ['Beta blockers'], to: ['Insulin', 'sulfonylureas'], severity: 'moderate', effect: 'Masked hypoglycemia symptoms' },
    { from: ['Corticosteroids'], to: ['NSAIDs'], severity: 'moderate', effect: 'Increased GI bleeding risk' },
    { from: ['ARBs', 'lisinopril', 'losartan'], to: ['NSAIDs'], severity: 'moderate', effect: 'Reduced renal function' },
    { from: ['Quinolones'], to: ['Theophylline'], severity: 'moderate', effect: 'Reduced theophylline clearance' },
    { from: ['Macrolides', 'clarithromycin', 'erythromycin'], to: ['Statins'], severity: 'high', effect: 'Increased myopathy risk' },
];

const KNOWN_ALLERGIES = {
    'penicillin': { alternatives: ['azithromycin', 'clindamycin', 'ceftriaxone'], reaction: 'anaphylaxis' },
    'sulfa': { alternatives: ['macrolides', 'fluoroquinolones'], reaction: 'rash, Stevens-Johnson' },
    'aspirin': { alternatives: ['acetaminophen', 'ibuprofen'], reaction: 'Reye syndrome, asthma' },
    'nsaids': { alternatives: ['acetaminophen', 'opioids'], reaction: 'GI bleeding, renal failure' },
    'codeine': { alternatives: ['hydromorphone', 'oxycodone'], reaction: 'respiratory depression' },
    'morphine': { alternatives: ['hydromorphone', 'fentanyl'], reaction: 'respiratory depression' },
    'local anesthetic': { alternatives: ['different class'], reaction: 'cardiac arrest' },
    'latex': { alternatives: ['synthetic gloves'], reaction: 'anaphylaxis' },
};

const CLINICAL_ALERTS = [
    { condition: 'bp_systolic', threshold: 180, severity: 'high', message: 'Hypertensive emergency - Immediate treatment required' },
    { condition: 'bp_systolic', threshold: 160, severity: 'moderate', message: 'Stage 2 hypertension - Start/titrate medication' },
    { condition: 'bp_diastolic', threshold: 120, severity: 'high', message: 'Hypertensive emergency - Immediate treatment required' },
    { condition: 'bp_diastolic', threshold: 100, severity: 'moderate', message: 'Stage 2 hypertension - Start/titrate medication' },
    { condition: 'heart_rate', threshold: 120, severity: 'moderate', message: 'Tachycardia - Evaluate causes' },
    { condition: 'heart_rate', threshold: 50, severity: 'moderate', message: 'Bradycardia - Consider medication review' },
    { condition: 'temperature', threshold: 39, severity: 'moderate', message: 'High fever - Consider infection workup' },
    { condition: 'temperature', threshold: 41, severity: 'high', message: 'Hyperthermia emergency' },
    { condition: 'spo2', threshold: 92, severity: 'high', message: ' respiratory failure - Supplemental O2 required' },
    { condition: 'glucose_fasting', threshold: 126, severity: 'moderate', message: 'Diabetes threshold - Confirm diagnosis' },
    { condition: 'glucose_random', threshold: 200, severity: 'moderate', message: 'Diabetes threshold - Confirm diagnosis' },
    { condition: 'hba1c', threshold: 6.5, severity: 'moderate', message: 'Diabetes diagnosis confirmed' },
    { condition: 'creatinine_male', threshold: 1.2, severity: 'moderate', message: 'Reduced renal function - Adjust drug doses' },
    { condition: 'creatinine_female', threshold: 1.1, severity: 'moderate', message: 'Reduced renal function - Adjust drug doses' },
    { condition: 'egfr', threshold: 60, severity: 'moderate', message: 'Moderate renal impairment - Dose adjustment needed' },
    { condition: 'egfr', threshold: 30, severity: 'high', message: 'Severe renal impairment - Avoid nephrotoxic drugs' },
    { condition: 'alt', threshold: 100, severity: 'moderate', message: 'Elevated liver enzymes - Review hepatotoxic meds' },
    { condition: 'ast', threshold: 100, severity: 'moderate', message: 'Elevated liver enzymes - Review hepatotoxic meds' },
    { condition: 'platelets', threshold: 100000, severity: 'moderate', message: 'Thrombocytopenia - Avoid anticoagulants' },
    { condition: 'wbc', threshold: 4000, severity: 'moderate', message: 'Leukopenia - Infection risk' },
];

function normalizeDrugName(name) {
    return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function findDrugInteractions(medications) {
    var interactions = [];
    var medNames = medications.map(function(m) {
        return normalizeDrugName(typeof m === 'string' ? m : (m.name || m.drug || m));
    });

    for (var i = 0; i < DRUG_INTERACTIONS.length; i++) {
        var interaction = DRUG_INTERACTIONS[i];
        var matches = 0;
        for (var j = 0; j < interaction.drugs.length; j++) {
            for (var k = 0; k < medNames.length; k++) {
                if (medNames[k].includes(interaction.drugs[j]) || interaction.drugs[j].includes(medNames[k])) {
                    matches++;
                    break;
                }
            }
        }
        if (matches >= interaction.drugs.length) {
            interactions.push({
                drugs: interaction.drugs,
                severity: interaction.severity,
                effect: interaction.effect,
                type: 'drug-drug'
            });
        }
    }

    return interactions;
}

function findClassInteractions(medications) {
    var interactions = [];
    var medNames = medications.map(function(m) {
        return normalizeDrugName(typeof m === 'string' ? m : (m.name || m.drug || m));
    });

    for (var i = 0; i < DRUG_CLASS_INTERACTIONS.length; i++) {
        var interaction = DRUG_CLASS_INTERACTIONS[i];
        var fromMatch = 0;
        var toMatch = 0;

        for (var j = 0; j < medNames.length; j++) {
            for (var k = 0; k < interaction.from.length; k++) {
                if (medNames[j].includes(interaction.from[k]) || interaction.from[k].includes(medNames[j])) {
                    fromMatch++;
                }
            }
            for (var k = 0; k < interaction.to.length; k++) {
                if (medNames[j].includes(interaction.to[k]) || interaction.to[k].includes(medNames[j])) {
                    toMatch++;
                }
            }
        }

        if (fromMatch > 0 && toMatch > 0) {
            interactions.push({
                drugs: [interaction.from[0] + ' + ' + interaction.to[0]],
                severity: interaction.severity,
                effect: interaction.effect,
                type: 'class'
            });
        }
    }

    return interactions;
}

function checkAllergies(medications, patientAllergies) {
    var alerts = [];
    if (!patientAllergies || !patientAllergies.length) return alerts;

    var allergyList = patientAllergies.map(function(a) {
        return normalizeDrugName(typeof a === 'string' ? a : (a.name || a.allergy || a));
    });

    for (var i = 0; i < medications.length; i++) {
        var medName = normalizeDrugName(typeof medications[i] === 'string' ? medications[i] : (medications[i].name || medications[i].drug || ''));

        for (var j = 0; j < allergyList.length; j++) {
            var allergy = allergyList[j];
            if (medName.includes(allergy) || allergy.includes(medName)) {
                var known = KNOWN_ALLERGIES[allergy];
                alerts.push({
                    drug: medications[i],
                    allergy: allergy,
                    severity: 'high',
                    reaction: known ? known.reaction : 'Unknown',
                    alternatives: known ? known.alternatives : [],
                    type: 'allergy'
                });
            }
        }
    }

    return alerts;
}

function checkClinicalAlerts(vitals, conditions) {
    var alerts = [];

    if (!vitals) return alerts;

    for (var i = 0; i < CLINICAL_ALERTS.length; i++) {
        var rule = CLINICAL_ALERTS[i];
        var value = null;

        switch (rule.condition) {
            case 'bp_systolic':
                value = vitals.bp_systolic || vitals.systolic || vitals.bp_sys;
                break;
            case 'bp_diastolic':
                value = vitals.bp_diastolic || vitals.diastolic || vitals.bp_dia;
                break;
            case 'heart_rate':
                value = vitals.heart_rate || vitals.pulse || vitals.hr;
                break;
            case 'temperature':
                value = vitals.temperature || vitals.temp || vitals.temp_f;
                break;
            case 'spo2':
                value = vitals.spo2 || vitals.oxygen || vitals.o2_sat;
                break;
            case 'glucose_fasting':
                value = vitals.glucose_fasting || vitals.fasting_sugar;
                break;
            case 'glucose_random':
                value = vitals.glucose_random || vitals.random_sugar || vitals.post_prandial;
                break;
            case 'hba1c':
                value = vitals.hba1c || vitals.hba1c_percent;
                break;
            case 'creatinine_male':
            case 'creatinine_female':
                value = vitals.creatinine;
                break;
            case 'egfr':
                value = vitals.egfr;
                break;
            case 'alt':
                value = vitals.alt || vitals.sgpt;
                break;
            case 'ast':
                value = vitals.ast || vitals.sgot;
                break;
            case 'platelets':
                value = vitals.platelets || vitals.thrombocytes;
                break;
            case 'wbc':
                value = vitals.wbc || vitals.leukocytes;
                break;
        }

        if (value != null) {
            var threshold = rule.threshold;
            var isHigh = rule.condition === 'spo2' ? value < threshold : value > threshold;

            if (isHigh) {
                alerts.push({
                    condition: rule.condition,
                    value: value,
                    threshold: threshold,
                    severity: rule.severity,
                    message: rule.message,
                    type: 'clinical'
                });
            }
        }
    }

    return alerts;
}

function fullInteractionCheck(medications, patientAllergies, vitals) {
    var results = {
        interactions: [],
        allergies: [],
        clinicalAlerts: [],
        hasHighSeverity: false,
        hasModerateSeverity: false
    };

    var drugInteractions = findDrugInteractions(medications);
    var classInteractions = findClassInteractions(medications);
    var allergyAlerts = checkAllergies(medications, patientAllergies);
    var clinical = checkClinicalAlerts(vitals);

    results.interactions = drugInteractions.concat(classInteractions);
    results.allergies = allergyAlerts;
    results.clinicalAlerts = clinical;

    var allAlerts = results.interactions.concat(results.allergies).concat(results.clinicalAlerts);
    for (var i = 0; i < allAlerts.length; i++) {
        if (allAlerts[i].severity === 'high') {
            results.hasHighSeverity = true;
        } else if (allAlerts[i].severity === 'moderate') {
            results.hasModerateSeverity = true;
        }
    }

    return results;
}

function formatInteractionAlert(checkResult) {
    if (!checkResult) return '';

    var html = '';
    var highAlerts = [];
    var modAlerts = [];

    var allAlerts = checkResult.interactions.concat(checkResult.allergies).concat(checkResult.clinicalAlerts);
    for (var i = 0; i < allAlerts.length; i++) {
        if (allAlerts[i].severity === 'high') {
            highAlerts.push(allAlerts[i]);
        } else {
            modAlerts.push(allAlerts[i]);
        }
    }

    if (highAlerts.length > 0) {
        html += '<div style="margin-bottom:12px">';
        for (var i = 0; i < highAlerts.length; i++) {
            var alert = highAlerts[i];
            var icon = alert.type === 'allergy' ? '🚫' : (alert.type === 'clinical' ? '⚠️' : '💊');
            var message = alert.effect || alert.message || alert.reaction;
            html += '<div style="background:var(--red-bg);border-left:3px solid var(--red);padding:10px 12px;border-radius:4px;margin-bottom:6px;font-size:13px">' +
                '<strong>' + icon + ' ' + alert.severity.toUpperCase() + ':</strong> ' + message + '</div>';
        }
        html += '</div>';
    }

    if (modAlerts.length > 0) {
        html += '<div style="margin-bottom:12px">';
        for (var i = 0; i < modAlerts.length; i++) {
            var alert = modAlerts[i];
            var icon = alert.type === 'allergy' ? '🚫' : (alert.type === 'clinical' ? '⚠️' : '💊');
            var message = alert.effect || alert.message || alert.reaction;
            html += '<div style="background:var(--yellow-bg);border-left:3px solid var(--orange);padding:10px 12px;border-radius:4px;margin-bottom:6px;font-size:13px">' +
                '<strong>' + icon + ' ' + alert.severity.toUpperCase() + ':</strong> ' + message + '</div>';
        }
        html += '</div>';
    }

    return html;
}

window.checkDrugInteractions = findDrugInteractions;
window.checkAllergies = checkAllergies;
window.checkClinicalAlerts = checkClinicalAlerts;
window.fullInteractionCheck = fullInteractionCheck;
window.formatInteractionAlert = formatInteractionAlert;
window.DRUG_INTERACTIONS = DRUG_INTERACTIONS;
window.CLINICAL_ALERTS = CLINICAL_ALERTS;

})();