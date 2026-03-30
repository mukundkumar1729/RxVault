import { store } from '../core/store.js';
import { el, emptyNode } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchVitalsForPatient } from '../services/vitalsService.js';

/**
 * Main entry point for Health Timeline
 */
export const openPatientTimelineSecure = async (patientName) => {
    let overlay = document.getElementById('timelineOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'timelineOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const modal = el('div', { className: 'modal', style: { maxWidth: '700px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '📋 Health Timeline' }),
                el('div', { className: 'modal-subtitle', textContent: `${patientName} — complete medical history` })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onclick: () => overlay.classList.remove('open') })
        ]),
        el('div', { id: 'timelineBody', style: { padding: '20px', minHeight: '200px' } }, [
            el('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' } }, [
                el('div', { style: { fontSize: '32px', marginBottom: '8px' }, textContent: '⏳' }),
                el('div', { textContent: 'Building timeline...' })
            ])
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    await renderTimelineContent(patientName);
};

const renderTimelineContent = async (patientName) => {
    const body = document.getElementById('timelineBody');
    if (!body) return;

    // Gather data
    const rxList = (store.prescriptions || []).filter(rx => (rx.patientName || '').trim().toLowerCase() === patientName.trim().toLowerCase());
    const vitsList = await fetchVitalsForPatient(store.activeClinicId, patientName);
    const invList = (store.invoices || []).filter(i => (i.patient_name || '').trim().toLowerCase() === patientName.trim().toLowerCase());
    const apptList = (store.appointments || []).filter(a => (a.patient_name || '').trim().toLowerCase() === patientName.trim().toLowerCase());

    const events = [];
    rxList.forEach(rx => events.push({ date: rx.date, type: 'rx', data: rx }));
    vitsList.forEach(v => events.push({ date: (v.recorded_at || '').split('T')[0], type: 'vitals', data: v }));
    invList.forEach(i => events.push({ date: i.invoice_date, type: 'invoice', data: i }));
    apptList.forEach(a => events.push({ date: a.appt_date, type: 'appt', data: a }));
    
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!events.length) {
        emptyNode(body);
        body.appendChild(el('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '48px', marginBottom: '12px' }, textContent: '🗒️' }),
            el('div', { textContent: 'No history found for this patient.' })
        ]));
        return;
    }

    const typeConfig = {
        rx: { icon: '💊', color: 'var(--teal)', bg: 'var(--teal-pale)' },
        vitals: { icon: '📊', color: 'var(--allopathy)', bg: 'var(--allopathy-bg)' },
        invoice: { icon: '💰', color: 'var(--green)', bg: '#e8f5e9' },
        appt: { icon: '📅', color: 'var(--ayurveda)', bg: 'var(--ayurveda-bg)' },
    };

    const container = el('div', { style: { position: 'relative', paddingLeft: '36px' } }, [
        el('div', { style: { position: 'absolute', left: '16px', top: '0', bottom: '0', width: '2px', background: 'linear-gradient(to bottom, var(--teal), var(--border))' } })
    ]);

    events.forEach(ev => {
        const tc = typeConfig[ev.type] || typeConfig.rx;
        let cardContent = null;

        if (ev.type === 'rx') {
            const rx = ev.data;
            cardContent = [
                el('div', { style: { fontWeight: '700', fontSize: '14px' }, textContent: `💊 Prescription (${rx.type || 'allopathy'})` }),
                el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }, textContent: `🩺 Dr. ${rx.doctorName || '—'} · ${rx.diagnosis || ''}` }),
                rx.medicines?.length ? el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }, textContent: '💊 ' + rx.medicines.slice(0, 3).map(m => m.name).join(', ') }) : null,
                el('div', { style: { marginTop: '6px' } }, [
                    el('span', { style: { background: rx.status === 'active' ? 'var(--green)' : 'var(--text-muted)', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }, textContent: rx.status.toUpperCase() })
                ])
            ];
        } else if (ev.type === 'vitals') {
            const v = ev.data;
            cardContent = [
                el('div', { style: { fontWeight: '700', fontSize: '14px' }, textContent: '📊 Vitals Recorded' }),
                el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }, textContent: `BP: ${v.bp_systolic || '—'}/${v.bp_diastolic || '—'} · Pulse: ${v.pulse || '—'} · Temp: ${v.temperature || '—'}°F` }),
                (v.bp_systolic > 140 || v.temperature > 100.4) ? el('div', { style: { marginTop: '4px' }, textContent: '⚠️ Abnormal Values detected' }) : null
            ];
        } else if (ev.type === 'invoice') {
            const inv = ev.data;
            cardContent = [
                el('div', { style: { fontWeight: '700', fontSize: '14px' }, textContent: `💰 Invoice ${inv.invoice_no}` }),
                el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }, textContent: `₹${inv.total_amount.toLocaleString('en-IN')} via ${inv.payment_method}` }),
                el('div', { style: { marginTop: '6px' } }, [
                   el('span', { style: { background: inv.status === 'paid' ? '#e8f5e9' : 'var(--ayurveda-bg)', color: inv.status === 'paid' ? 'var(--green)' : 'var(--ayurveda)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }, textContent: inv.status.toUpperCase() })
                ])
            ];
        } else if (ev.type === 'appt') {
            const a = ev.data;
            cardContent = [
                el('div', { style: { fontWeight: '700', fontSize: '14px' }, textContent: `📅 Appt — Token #${a.token_no}` }),
                el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }, textContent: `Dr. ${a.doctor_name || '—'} · ${a.visit_type}` })
            ];
        }

        container.appendChild(el('div', { style: { position: 'relative', marginBottom: '20px' } }, [
            el('div', { style: { position: 'absolute', left: '-28px', top: '6px', width: '14px', height: '14px', borderRadius: '50%', background: tc.bg, border: `2px solid ${tc.color}`, boxShadow: '0 0 0 3px white' } }),
            el('div', { style: { fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px' }, textContent: formatDate(ev.date) }),
            el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' } }, cardContent)
        ]));
    });

    emptyNode(body);
    body.appendChild(container);
};

// Global Bridge
window.openPatientTimeline = openPatientTimelineSecure;
window.addPatientActionButtonsTimeline = (card, p) => {
    const footer = card.querySelector('.rx-footer-actions');
    if (!footer) return;
    const btn = el('button', { className: 'btn-sm btn-outline-teal', textContent: '📋 Timeline', onclick: (e) => { e.stopPropagation(); openPatientTimelineSecure(p.name); } });
    footer.insertBefore(btn, footer.firstChild);
};
