// ════════════════════════════════════════════════════════════
//  PRESCRIPTION VIEW CONTROLLER
//  Handles secure, non-innerHTML rendering of the Rx Cards
// ════════════════════════════════════════════════════════════

import { store, subscribe } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';

export const initPrescriptionView = () => {
    subscribe('prescriptions', (rxList) => {
        // Redraw lists when reactive store pushes updates
        if (store.currentView === 'all' || store.currentView === 'patients') {
            window.render(); // Hooks into legacy global `render()` until fully integrated
        }
    });
};

const TYPE_LABEL = { allopathy: '💉 Allopathy', homeopathy: '🌿 Homeopathy', ayurveda: '🌱 Ayurveda' };
const STATUS_COLORS = { active: 'var(--green)', completed: 'var(--text-muted)', expired: 'var(--red)' };
const STATUS_ICONS = { active: '🟢', completed: '✅', expired: '🔴' };

/**
 * High-performance, highly secure generator for building Rx Card DOM trees natively without string interpolations.
 */
export const buildPrescriptionCard = (p, searchQuery = '', allTerms = []) => {
    
    // Fallback highlight function injecting spans natively (ignoring complex Regex for safety/stability here, or returning raw)
    const hlRaw = (str) => str || '—'; 

    const card = el('div', { className: 'rx-card', id: `card_${p.id}` });

    // HEADER - Collapsible Top Row
    const header = el('div', { className: 'rx-card-header', onClick: () => card.classList.toggle('expanded') }, [
        el('span', { className: `rx-type-badge badge-${p.type || 'allopathy'}`, textContent: TYPE_LABEL[p.type] || p.type }),
        
        el('div', { className: 'rx-main' }, [
            el('div', { className: 'rx-patient', textContent: hlRaw(p.patientName) }),
            el('div', { className: 'rx-meta' }, [
                el('span', { className: 'rx-meta-item', textContent: `🩺 ${hlRaw(p.doctorName)}` }),
                ...(p.diagnosis ? [el('span', { className: 'rx-meta-item', textContent: `🔬 ${hlRaw(p.diagnosis)}` })] : []),
                ...(p.hospital ? [el('span', { className: 'rx-meta-item', textContent: `🏥 ${hlRaw(p.hospital)}` })] : []),
                el('span', { className: 'rx-meta-item', style: { color: STATUS_COLORS[p.status] || 'var(--text-muted)' }, textContent: `${STATUS_ICONS[p.status] || ''} ${(p.status || 'unknown').toUpperCase()}` })
            ])
        ]),

        el('div', { className: 'rx-date-badge', textContent: formatDate(p.date) }),

        // Head Actions (Mini-Icons)
        el('div', { className: 'rx-actions', onClick: (e) => e.stopPropagation() }, [
            el('button', { className: 'icon-btn', attributes: { title: 'Record Vitals' }, style: { position: 'relative' }, onClick: () => window.openServicesPanel(p.id) }, [
                el('span', { textContent: '🩺' }),
                el('span', { id: `svc_badge_${p.id}`, style: { display: 'none', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', background: 'var(--teal)', color: '#fff', borderRadius: '50%', fontSize: '10px', fontWeight: '700', marginLeft: '4px', flexShrink: '0' }, textContent: '0' })
            ]),
            el('button', { className: 'icon-btn print', attributes: { title: 'Print' }, textContent: '🖨️', onClick: () => window.printPrescription(p.id) }),
            el('button', { className: 'icon-btn print', attributes: { title: 'Order Lab' }, textContent: '🔬', onClick: (e) => { e.stopPropagation(); window.openNewLabOrderSecure(p.patientName); } }),
            el('button', { className: 'icon-btn print', attributes: { title: 'QR Code' }, textContent: '📱', onClick: () => injectPrescriptionQRSecure(p.id) }),
            el('button', { className: 'icon-btn edit', attributes: { title: 'Edit' }, textContent: '✏️', onClick: () => window.openEditModal(p.id) }),
            ...(p.status === 'expired' ? [el('button', { className: 'icon-btn', attributes: { title: 'Renew' }, style: { color: 'var(--teal)' }, textContent: '🔄', onClick: () => window.renewPrescription(p.id) })] : []),
            el('button', { className: 'icon-btn delete', attributes: { title: 'Delete' }, textContent: '🗑️', onClick: () => window.confirmDelete(p.id) })
        ]),

        el('span', { className: 'chevron-icon', textContent: '▼' })
    ]);

    card.appendChild(header);

    // BODY - Expanding Detail Container
    const body = el('div', { className: 'rx-card-body', id: `body_${p.id}` });
    
    // Patient Detail Grid
    const detailsGrid = el('div', { className: 'rx-details-grid' });
    [
        { label: 'Patient Age & Gender', val: `${p.age ? p.age + ' yrs' : '—'} ${p.gender ? '· ' + p.gender : ''}` },
        { label: 'Blood Group', val: p.bloodGroup || '—' },
        { label: 'Contact', val: p.phone || '—', mono: true },
        { label: 'Specialization', val: p.specialization || '—' },
        { label: 'Hospital / Clinic', val: p.hospital || '—' },
        { label: 'Valid Until', val: p.validUntil ? formatDate(p.validUntil) : '—' }
    ].forEach(d => {
        detailsGrid.appendChild(el('div', { className: 'detail-group' }, [
            el('div', { className: 'detail-label', textContent: d.label }),
            el('div', { className: `detail-value ${d.mono ? 'mono' : ''}`, textContent: d.val })
        ]));
    });
    body.appendChild(detailsGrid);

    // Medicines Table
    const medsBlock = el('div', { className: 'rx-medicines' }, [
        el('div', { className: 'medicines-title', textContent: `💊 Medicines (${p.medicines ? p.medicines.length : 0})` })
    ]);
    
    if (p.medicines && p.medicines.length) {
        const table = el('table', { className: 'medicine-table' });
        const theadTr = el('tr');
        ['Medicine', 'Dosage', 'Frequency', 'Duration', 'Route'].forEach(h => theadTr.appendChild(el('th', { textContent: h })));
        table.appendChild(el('thead', {}, [theadTr]));

        const tbody = el('tbody');
        p.medicines.forEach(m => {
            const tr = el('tr');
            const tdName = el('td');
            tdName.appendChild(el('strong', { textContent: m.name || '—' }));
            tr.appendChild(tdName);
            tr.appendChild(el('td', { textContent: m.dosage || '—' }));
            tr.appendChild(el('td', { textContent: m.frequency || '—' }));
            tr.appendChild(el('td', { textContent: m.duration || '—' }));
            tr.appendChild(el('td', { textContent: m.route || '—' }));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        medsBlock.appendChild(table);
    } else {
        medsBlock.appendChild(el('div', { style: { color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }, textContent: 'No medicines recorded.' }));
    }
    body.appendChild(medsBlock);

    // Diagnostics Table
    if (p.diagnostics && p.diagnostics.length) {
        const diagBlock = el('div', { className: 'rx-diagnostics' }, [
            el('div', { className: 'medicines-title', textContent: `🔬 Diagnosis & Tests (${p.diagnostics.length})` })
        ]);

        const dtable = el('table', { className: 'medicine-table' });
        const dtheadTr = el('tr');
        ['Test / Investigation', 'Observation / Notes'].forEach(h => dtheadTr.appendChild(el('th', { textContent: h })));
        dtable.appendChild(el('thead', {}, [dtheadTr]));

        const dtbody = el('tbody');
        p.diagnostics.forEach(d => {
            const tr = el('tr');
            const tdTest = el('td'); tdTest.appendChild(el('strong', { textContent: d.test }));
            tr.appendChild(tdTest);
            tr.appendChild(el('td', { textContent: d.notes || '—' }));
            dtbody.appendChild(tr);
        });
        dtable.appendChild(dtbody);
        diagBlock.appendChild(dtable);
        body.appendChild(diagBlock);
    }

    // Notes
    if (p.notes) {
        body.appendChild(el('div', { className: 'rx-notes' }, [
            el('div', { className: 'rx-notes-label', textContent: '📝 Clinical Notes' }),
            el('div', { className: 'rx-notes-text', textContent: p.notes }) // Not interpolating as HTML, safely stored as textContent
        ]));
    }

    // Interactive Footer
    const footer = el('div', { className: 'rx-footer-actions' }, [
        el('button', {
            className: 'btn-sm',
            style: { border: '1.5px solid var(--teal)', color: 'var(--teal)', background: 'transparent', borderRadius: '7px', padding: '7px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans,sans-serif', transition: 'all 0.15s' },
            textContent: '🩺 Services & Vitals',
            onMouseEnter: function() { this.style.background = 'var(--teal-pale)'; },
            onMouseLeave: function() { this.style.background = 'transparent'; },
            onClick: () => window.openServicesPanel(p.id)
        }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '🔬 Lab', onClick: () => window.openNewLabOrderSecure(p.patientName) }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '📱 QR', onClick: () => injectPrescriptionQRSecure(p.id) }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '🖨️ Print', onClick: () => window.printPrescription(p.id) }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '✏️ Edit', onClick: () => window.openEditModal(p.id) }),
        ...(p.email ? [el('button', {
            className: 'btn-sm',
            style: { border: '1px solid var(--teal)', color: 'var(--teal)', background: 'transparent', borderRadius: '7px', padding: '7px 14px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans,sans-serif' },
            attributes: { title: 'Send expiry notification' },
            textContent: '📧 Notify',
            onClick: () => window.notifyPatientForRx(p.id)
        })] : []),
        ...(p.status === 'expired' ? [el('button', { className: 'btn-sm btn-teal', textContent: '🔄 Renew Rx', onClick: () => window.renewPrescription(p.id) })] : []),
        el('button', { className: 'btn-sm btn-outline-red', textContent: '🗑️ Delete', onClick: () => window.confirmDelete(p.id) })
    ]);

    body.appendChild(footer);
    card.appendChild(body);

    return card;
};

// ─── QR Code Engineering Subsystem ───────────────────────────────────

const injectPrescriptionQRSecure = (rxId) => {
    const rx = (store.prescriptions || []).find(r => r.id === rxId);
    if (!rx) return;

    let overlay = document.getElementById('qrOverlay');
    if (!overlay) { 
        overlay = el('div', { id: 'qrOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const qrData = JSON.stringify({
        id: rx.id,
        patient: rx.patientName,
        doctor: rx.doctorName,
        date: rx.date,
        valid: rx.validUntil,
        diag: rx.diagnosis,
        min: (rx.medicines || []).map(m => m.name)
    });

    const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(qrData)}&choe=UTF-8`;

    const downloadAction = () => {
        const img = document.querySelector('#qrOverlay img');
        if (!img) return;
        const a = document.createElement('a');
        a.href = img.src;
        a.download = `rx_qr_${(rx.patientName || 'patient').replace(/\\s+/g, '_')}_${rx.date}.png`;
        a.click();
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '420px', textAlign: 'center' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '📱 Prescription QR Code' }),
                el('div', { className: 'modal-subtitle', textContent: `${rx.patientName} · ${formatDate(rx.date)}` })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('qrOverlay') })
        ]),
        el('div', { className: 'modal-body', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' } }, [
            el('div', { style: { background: '#fff', padding: '16px', borderRadius: '12px', border: '2px solid var(--border)', display: 'inline-block' } }, [
                el('img', { 
                    attributes: { src: qrUrl, width: '240', height: '240', alt: 'QR Code' }, 
                    style: { display: 'block' },
                    onerror: function() { this.parentElement.innerHTML = '<div style="width:240px;height:240px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;text-align:center">QR unavailable offline</div>'; }
                })
            ]),
            el('div', { style: { background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', width: '100%', textAlign: 'left', fontSize: '13px' } }, [
                el('div', { style: { fontWeight: '700', marginBottom: '8px', fontSize: '14px' }, textContent: `📋 ${rx.patientName}` }),
                el('div', { style: { color: 'var(--text-secondary)', lineHeight: '1.8' } }, [
                    el('div', { textContent: `🩺 Dr. ${rx.doctorName || '—'}` }),
                    el('div', { textContent: `🔬 ${rx.diagnosis || '—'}` }),
                    el('div', { textContent: `📅 Valid: ${formatDate(rx.validUntil || rx.date)}` }),
                    el('div', { textContent: `💊 ${(rx.medicines||[]).slice(0,3).map(m=>m.name).join(', ')}${rx.medicines&&rx.medicines.length>3?' +more':''}` })
                ])
            ]),
            el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }, textContent: 'Scan to verify prescription metadata.\\nGenerated by RxVault Framework.' })
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: '⬇️ Download', onClick: downloadAction }),
            el('button', { className: 'btn-sm btn-teal', textContent: '🖨️ Print', onClick: () => window.printQR(rxId) })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};
