import { store } from '../core/store.js';
import { el, emptyNode } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchVitalsForPatient, saveVitalsRecord, calculateBMI, getVitalsAlerts } from '../services/vitalsService.js';

let currentPatient = '';

/**
 * Main entry point for Vitals Modal
 */
export const openVitalsModalSecure = async (patientName) => {
    currentPatient = patientName;
    let overlay = document.getElementById('vitalsModalOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'vitalsModalOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const vitals = await fetchVitalsForPatient(store.activeClinicId, patientName);
    renderModal(overlay, vitals);
    
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

const renderModal = (container, history) => {
    emptyNode(container);

    const modal = el('div', { className: 'modal', style: { maxWidth: '820px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: `📊 Vitals — ${currentPatient}` }),
                el('div', { className: 'modal-subtitle', textContent: 'Record and track health vitals · 🔴=Abnormal high 🔵=Abnormal low' })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onclick: () => container.classList.remove('open') })
        ]),
        el('div', { className: 'modal-body' }, [
            // Entry Form
            el('div', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px', marginBottom: '20px' } }, [
                el('div', { className: 'form-section-title', style: { marginBottom: '14px' }, textContent: '➕ Record New Vitals' }),
                
                el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' } }, [
                    inputField('vBpSys', 'BP Systolic', 'number', '120', 'mmHg'),
                    inputField('vBpDia', 'BP Diastolic', 'number', '80', 'mmHg'),
                    inputField('vPulse', 'Pulse Rate', 'number', '72', 'bpm'),
                    inputField('vTemp', 'Temperature', 'number', '98.6', '°F'),
                ]),
                el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' } }, [
                    inputField('vSugarF', 'Sugar — Fasting', 'number', '90', 'mg/dL'),
                    inputField('vSugarPP', 'Sugar — Post-Meal', 'number', '130', 'mg/dL'),
                    inputField('vSugarR', 'Sugar — Random', 'number', '110', 'mg/dL'),
                    inputField('vSpo2', 'SpO2', 'number', '98', '%'),
                ]),
                el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' } }, [
                    inputField('vWeight', 'Weight', 'number', '70', 'kg', (e) => updateBmi(e.target.value, document.getElementById('vHeight')?.value)),
                    inputField('vHeight', 'Height', 'number', '165', 'cm', (e) => updateBmi(document.getElementById('vWeight')?.value, e.target.value)),
                    el('div', { id: 'vBmiCalc', style: { gridColumn: 'span 2', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                        el('span', { textContent: '📐 BMI will calculate automatically' })
                    ])
                ]),
                
                el('div', { id: 'vitalsAlertBox', style: { marginBottom: '10px' } }),
                el('button', { className: 'btn-sm btn-teal', style: { width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }, textContent: '💾 Save Vital Signs', onclick: () => saveVitals(container) })
            ]),

            // History Table
            el('div', { className: 'form-section-title', style: { marginBottom: '10px' }, textContent: '📈 Vitals History' }),
            renderHistoryTable(history)
        ])
    ]);

    container.appendChild(modal);
};

const inputField = (id, label, type, placeholder, unit, oninput) => el('div', {}, [
    el('label', { style: { fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: '4px' } }, [
        document.createTextNode(label + ' '),
        el('span', { style: { fontWeight: '400', color: 'var(--text-muted)', textTransform: 'none' }, textContent: `(${unit})` })
    ]),
    el('input', { id, type, placeholder, attributes: { step: 'any' }, oninput, style: { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', background: 'var(--surface)' } })
]);

const updateBmi = (w, h) => {
    const res = calculateBMI(parseFloat(w), parseFloat(h));
    const elBmi = document.getElementById('vBmiCalc');
    if (!elBmi) return;
    
    if (res) {
        emptyNode(elBmi);
        elBmi.append(
            el('span', { style: { fontSize: '15px' }, textContent: '📐' }),
            el('span', {}, [
                document.createTextNode('BMI: '),
                el('strong', { style: { color: res.color, fontSize: '16px' }, textContent: res.val }),
                document.createTextNode(' '),
                el('span', { style: { color: res.color, fontSize: '12px', fontWeight: '600' }, textContent: res.category })
            ])
        );
    } else {
        elBmi.textContent = '📐 BMI will calculate automatically';
    }
};

const renderHistoryTable = (history) => {
    if (!history || !history.length) {
        return el('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }, textContent: 'No vitals recorded yet for this patient.' });
    }

    const rows = history.slice(0, 15).map(v => {
        const bp = v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—';
        const bpFlag = (v.bp_systolic > 140 || v.bp_diastolic > 90) ? '🔴' : (v.bp_systolic < 90 ? '🔵' : '');
        const bmiRes = calculateBMI(v.weight, v.height);
        const sugar = v.sugar_fasting || v.sugar_random || '—';
        
        return el('tr', { style: { borderBottom: '1px solid var(--border)' } }, [
            el('td', { style: { padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)' }, textContent: formatDate(v.recorded_at) }),
            el('td', { style: { padding: '8px 10px', fontWeight: '600' }, textContent: `${bpFlag} ${bp}` }),
            el('td', { style: { padding: '8px 10px' }, textContent: v.pulse ? `${v.pulse} bpm` : '—' }),
            el('td', { style: { padding: '8px 10px' }, textContent: v.temperature ? `${v.temperature}°F` : '—' }),
            el('td', { style: { padding: '8px 10px' }, textContent: sugar !== '—' ? `${sugar} mg/dL` : '—' }),
            el('td', { style: { padding: '8px 10px' }, textContent: v.spo2 ? `${v.spo2}%` : '—' }),
            el('td', { style: { padding: '8px 10px' }, textContent: v.weight ? `${v.weight} kg` : '—' }),
            el('td', { style: { padding: '8px 10px' }, textContent: bmiRes ? `${bmiRes.val} ${bmiRes.category === 'Normal' ? '' : (bmiRes.category === 'Underweight' ? '🔵' : '🔴')}` : '—' })
        ]);
    });

    return el('div', { style: { overflowX: 'auto' } }, [
        el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } }, [
            el('thead', {}, [
                el('tr', { style: { background: 'var(--surface2)' } }, [
                    'Date', 'BP', 'Pulse', 'Temp', 'Sugar', 'SpO2', 'Weight', 'BMI'
                ].map(h => el('th', { style: { padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }, textContent: h })))
            ]),
            el('tbody', {}, rows)
        ])
    ]);
};

const saveVitals = async (overlay) => {
    const record = {
        id: 'vit_' + Date.now(),
        clinic_id: store.activeClinicId,
        patient_name: currentPatient,
        bp_systolic: parseFloat(document.getElementById('vBpSys')?.value) || null,
        bp_diastolic: parseFloat(document.getElementById('vBpDia')?.value) || null,
        pulse: parseFloat(document.getElementById('vPulse')?.value) || null,
        temperature: parseFloat(document.getElementById('vTemp')?.value) || null,
        sugar_fasting: parseFloat(document.getElementById('vSugarF')?.value) || null,
        sugar_pp: parseFloat(document.getElementById('vSugarPP')?.value) || null,
        sugar_random: parseFloat(document.getElementById('vSugarR')?.value) || null,
        spo2: parseFloat(document.getElementById('vSpo2')?.value) || null,
        weight: parseFloat(document.getElementById('vWeight')?.value) || null,
        height: parseFloat(document.getElementById('vHeight')?.value) || null,
        recorded_at: new Date().toISOString()
    };

    const hasValue = Object.keys(record).some(k => !['id', 'clinic_id', 'patient_name', 'recorded_at'].includes(k) && record[k] !== null);
    if (!hasValue) return window.showToast('Enter at least one value', 'error');

    const alerts = getVitalsAlerts(record);
    const alertBox = document.getElementById('vitalsAlertBox');
    if (alerts.length) {
        emptyNode(alertBox);
        alertBox.appendChild(el('div', { style: { background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px' } }, 
            alerts.map(a => el('div', { style: { fontSize: '12.5px', color: 'var(--red)', fontWeight: '600', padding: '2px 0' }, textContent: a.text }))
        ));
    }

    const ok = await saveVitalsRecord(record);
    if (ok) {
        window.showToast(`✅ Vitals recorded for ${currentPatient}`, alerts.length ? 'error' : 'success');
        const history = await fetchVitalsForPatient(store.activeClinicId, currentPatient);
        renderModal(overlay, history);
    }
};

// Global Bridge
window.openVitalsModal = openVitalsModalSecure;
window.addPatientActionButtonsVitals = (card, p) => {
    const footer = card.querySelector('.rx-footer-actions');
    if (!footer) return;
    const btn = el('button', { className: 'btn-sm btn-outline-teal', textContent: '📊 Vitals', onclick: (e) => { e.stopPropagation(); openVitalsModalSecure(p.name); } });
    footer.insertBefore(btn, footer.firstChild);
};
