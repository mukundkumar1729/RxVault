// ════════════════════════════════════════════════════════════
//  CLINICAL VIEW CONTROLLER
//  Alert Banners, Form Hooks, Allergy Modals, and Memory Leaks
// ════════════════════════════════════════════════════════════

import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { updatePatientAllergyDatabase, assessPatientAllergyCollision, assessDrugInteractions } from '../services/clinicalService.js';

let _activePatientName = null;

export const openAllergyManagerSecure = (patientName) => {
    _activePatientName = patientName;
    const patientList = window.patientRegistry || [];
    const patient = patientList.find(p => (p.name || '').trim().toLowerCase() === (patientName || '').trim().toLowerCase());
    
    if (!patient) {
        window.showToast('Patient allergies not found in registry. Ensure patient is registered.', 'error');
        return;
    }

    let overlay = document.getElementById('allergyOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'allergyOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const allergies = patient.allergies || [];

    const saveAction = async () => {
        const drug = document.getElementById('allergyDrugInp')?.value?.trim();
        const severity = document.getElementById('allergySeverityInp')?.value || 'severe';
        const reaction = document.getElementById('allergyReactionInp')?.value?.trim();
        
        if (!drug) { window.showToast('Enter a drug name.', 'error'); return; }

        if (!patient.allergies) patient.allergies = [];
        patient.allergies.push({ drug, severity, reaction, addedOn: new Date().toISOString() });
        
        const ok = await updatePatientAllergyDatabase(patient);
        if (ok) {
            window.showToast(`⚠️ Allergy recorded for ${patient.name}`, 'success');
            openAllergyManagerSecure(patient.name); // Re-render local state
        }
    };

    const removeAction = async (idx) => {
        const drug = patient.allergies[idx]?.drug;
        if (!confirm(`Remove allergy for ${drug}?`)) return;
        
        patient.allergies.splice(idx, 1);
        const ok = await updatePatientAllergyDatabase(patient);
        if (ok) {
            window.showToast('Allergy removed.', 'info');
            openAllergyManagerSecure(patient.name); // Re-render
        }
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '520px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '⚠️ Drug Allergy Registry' }),
                el('div', { className: 'modal-subtitle', textContent: `${patient.name} — known drug allergies & reactions` })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('allergyOverlay') })
        ]),
        el('div', { className: 'modal-body' })
    ]);

    const mBody = modal.querySelector('.modal-body');

    // 1. Alert Banner Segment
    if (allergies.length > 0) {
        mBody.appendChild(el('div', { style: { background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px' } }, [
            el('span', { style: { fontSize: '20px' }, textContent: '🚨' }),
            el('div', {}, [
                el('div', { style: { fontWeight: '700', fontSize: '13px', color: 'var(--red)' }, textContent: `Documented Allergies (${allergies.length})` }),
                el('div', { style: { fontSize: '12.5px', color: 'var(--red)', marginTop: '2px' }, textContent: allergies.map(a => a.drug).join(', ') })
            ])
        ]));
    } else {
        mBody.appendChild(el('div', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }, textContent: 'No known drug allergies on record.' }));
    }

    // 2. Add Allergy Form
    mBody.appendChild(el('div', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', marginBottom: '14px' } }, [
        el('div', { style: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '10px' }, textContent: 'Add New Allergy' }),
        el('div', { className: 'form-row', style: { marginBottom: '10px' } }, [
            el('div', { className: 'field' }, [
                el('label', {}, [document.createTextNode('Drug / Medicine Name '), el('span', { textContent: '*' })]),
                el('input', { id: 'allergyDrugInp', type: 'text', attributes: { placeholder: 'e.g. Penicillin, Aspirin, Sulfa drugs' } })
            ]),
            el('div', { className: 'field' }, [
                el('label', { textContent: 'Reaction Severity' }),
                el('select', { id: 'allergySeverityInp' }, [
                    el('option', { value: 'mild', textContent: 'Mild (rash, itching)' }),
                    el('option', { value: 'moderate', textContent: 'Moderate (hives, swelling)' }),
                    el('option', { value: 'severe', textContent: 'Severe (anaphylaxis, shock)', selected: true })
                ])
            ])
        ]),
        el('div', { className: 'field', style: { marginBottom: '10px' } }, [
            el('label', { textContent: 'Reaction Description' }),
            el('input', { id: 'allergyReactionInp', type: 'text', attributes: { placeholder: 'e.g. Developed anaphylactic shock, required emergency treatment' } })
        ]),
        el('button', { className: 'btn-sm btn-teal', textContent: '➕ Add Allergy', onClick: saveAction })
    ]));

    // 3. List Vector
    if (allergies.length > 0) {
        const listWrap = el('div', { id: 'allergyList' });
        const mapColor = { mild: ['var(--ayurveda-bg)', 'var(--ayurveda)'], moderate: ['var(--allopathy-bg)', 'var(--allopathy)'], severe: ['var(--red-bg)', 'var(--red)'] };
        
        allergies.forEach((a, idx) => {
            const mc = mapColor[a.severity] || mapColor.moderate;
            listWrap.appendChild(el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } }, [
                el('div', { style: { flex: '1' } }, [
                    el('div', { style: { fontWeight: '700', fontSize: '13.5px' }, textContent: a.drug }),
                    ...(a.reaction ? [el('div', { style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }, textContent: a.reaction })] : []),
                    el('div', { style: { marginTop: '4px' } }, [
                        el('span', { style: { background: mc[0], color: mc[1], fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }, textContent: (a.severity || 'moderate').toUpperCase() })
                    ])
                ]),
                el('button', { style: { fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, textContent: '🗑️', onClick: () => removeAction(idx) })
            ]));
        });
        mBody.appendChild(listWrap);
    }

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

// ─── Prescription Form Alert Engine ────────────────────────────────────

const injectAllergyAlertNode = (allergyObj, medicineName) => {
    const existing = document.getElementById('allergyAlertBanner');
    if (existing) existing.remove();

    const banner = el('div', { id: 'allergyAlertBanner', style: { background: 'var(--red-bg)', border: '2px solid var(--red)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', margin: '10px 0', display: 'flex', alignItems: 'center', gap: '12px', animation: 'slideIn 0.2s ease' } }, [
        el('span', { style: { fontSize: '24px' }, textContent: '🚨' }),
        el('div', { style: { flex: '1' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '14px', color: 'var(--red)' }, textContent: `ALLERGY ALERT — ${medicineName}` }),
            el('div', { style: { fontSize: '12.5px', color: 'var(--red)', marginTop: '3px' } }, [
                document.createTextNode('Patient has a documented '),
                el('strong', { textContent: (allergyObj.severity || '').toUpperCase() }),
                document.createTextNode(` allergy to ${allergyObj.drug}. ${allergyObj.reaction ? 'Reaction: ' + allergyObj.reaction : ''}`)
            ])
        ]),
        el('button', { style: { fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }, textContent: '✕', onClick: function() { this.parentElement.remove(); } })
    ]);

    const medEditor = document.getElementById('medicinesEditor');
    if (medEditor && medEditor.parentElement) {
        medEditor.parentElement.insertBefore(banner, medEditor);
    }
};

const injectInteractionAlertNodes = (alertsVector, medicineName) => {
    document.querySelectorAll('.interaction-alert-banner').forEach(el => el.remove());
    if (!alertsVector || !alertsVector.length) return;

    const medEditor = document.getElementById('medicinesEditor');
    if (!medEditor || !medEditor.parentElement) return;

    alertsVector.forEach(alert => {
        const bg = alert.severity === 'high' ? 'var(--red-bg)' : alert.severity === 'med' ? 'var(--ayurveda-bg)' : 'var(--surface2)';
        const clr = alert.severity === 'high' ? 'var(--red)' : alert.severity === 'med' ? 'var(--ayurveda)' : 'var(--text-muted)';
        const lbl = alert.severity === 'high' ? '🚨 MAJOR interaction' : alert.severity === 'med' ? '⚠️ Moderate interaction' : 'ℹ️ Minor interaction';

        const banner = el('div', { className: 'interaction-alert-banner', style: { background: bg, border: `1px solid ${clr}`, borderRadius: 'var(--radius)', padding: '10px 14px', margin: '6px 0', fontSize: '12.5px', display: 'flex', alignItems: 'flex-start', gap: '8px' } }, [
            el('div', { style: { flex: '1' } }, [
                el('span', { style: { fontWeight: '700', color: clr }, textContent: `${lbl}: ` }),
                el('strong', { textContent: medicineName }),
                document.createTextNode(' + '),
                el('strong', { textContent: alert.drug2 }),
                el('br'),
                el('span', { style: { color: 'var(--text-secondary)' }, textContent: alert.description })
            ]),
            el('button', { style: { fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }, textContent: '✕', onClick: function() { this.parentElement.remove(); } })
        ]);

        medEditor.parentElement.insertBefore(banner, medEditor);
    });
};

// ─── Form Input Hooks ────────────────────────────────────────────────

export const attachClinicalHooks = () => {
    // 1. Hook into Add Medicine row append sequence via prototype/DOM mapping
    if (typeof window.addMedicineRow === 'function') {
        const legacyBaseAddRow = window.addMedicineRow;
        window.addMedicineRow = function() {
            legacyBaseAddRow();
            
            // Map event explicitly on the tail-end newly spawned node
            const inputs = document.querySelectorAll('#medicinesEditor .med-name');
            const targetNode = inputs[inputs.length - 1];
            
            if (targetNode) {
                targetNode.addEventListener('blur', function() {
                    const medName = this.value.trim();
                    if (!medName) return;
                    
                    const pField = document.getElementById('fPatientName');
                    const patientName = pField ? pField.value.trim() : '';
                    if (!patientName) return;
                    
                    // Allergy Collision Engine
                    const collision = assessPatientAllergyCollision(patientName, medName);
                    if (collision) injectAllergyAlertNode(collision, medName);
                    
                    // Drug Matrix Resolver — scrape UI elements parallel to proxy state
                    const curUiMeds = [];
                    document.querySelectorAll('#medicinesEditor .med-name').forEach(el => {
                        const v = el.value.trim();
                        if (v) curUiMeds.push(v);
                    });
                    
                    const crossFire = assessDrugInteractions(patientName, medName, curUiMeds);
                    if (crossFire.length) injectInteractionAlertNodes(crossFire, medName);
                });
            }
        };
    }
    
    // 2. Hook Patient Identity Field on Form Selection
    const patientField = document.getElementById('fPatientName');
    if (patientField) {
        patientField.addEventListener('change', function() {
            const name = this.value.trim();
            if (!name) return;
            
            const list = window.patientRegistry || [];
            const patientObj = list.find(p => (p.name || '').trim().toLowerCase() === name.toLowerCase());
            
            if (patientObj && patientObj.allergies && patientObj.allergies.length > 0) {
                const mapStr = patientObj.allergies.map(a => a.drug).join(', ');
                const labelAllergies = patientObj.allergies.length > 1 ? 'ies' : 'y';
                window.showToast(`⚠️ ${patientObj.name} has ${patientObj.allergies.length} documented drug allerg${labelAllergies}: ${mapStr}`, 'error');
            }
        });
    }
    
    // 3. Mount "Allergies" logic directly into the globally scoped render hooks for Patient Dashboards
    if (typeof window.renderPatientsPage === 'function') {
        const legacyRenderPat = window.renderPatientsPage;
        window.renderPatientsPage = function(list) {
            legacyRenderPat(list);
            
            // Async inject the Allergy Warning Action natively via DOM tree mapping
            setTimeout(() => {
                document.querySelectorAll('#patientsGrid .rx-card').forEach(card => {
                    if (card.querySelector('.allergy-btn')) return; // Dedupe
                    
                    const footer = card.querySelector('.rx-footer-actions');
                    if (!footer) return;
                    
                    const rawNameNode = card.querySelector('[style*="font-weight:700"]') || card.querySelector('.patient-name');
                    const cName = rawNameNode ? rawNameNode.textContent.trim() : '';
                    if (!cName) return;
                    
                    const btn = el('button', { 
                        className: 'btn-sm allergy-btn', 
                        style: { border: '1px solid var(--red)', color: 'var(--red)', background: 'transparent', borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontFamily: 'DM Sans,sans-serif', cursor: 'pointer' },
                        textContent: '⚠️ Allergies',
                        onClick: (e) => { e.stopPropagation(); openAllergyManagerSecure(cName); }
                    });
                    
                    footer.insertBefore(btn, footer.firstChild);
                });
            }, 50); // Frame buffer trailing legacy render loop
        };
    }
};

window.openAllergyManager = openAllergyManagerSecure;
