// ════════════════════════════════════════════════════════════
//  PATIENTS VIEW CONTROLLER
//  Handles secure rendering of patient cards using dom.js
// ════════════════════════════════════════════════════════════

import { store, subscribe } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { formatDate, capitalize } from '../utils/formatters.js';
import { getPatientFeeStatus, getDaysRemaining } from '../services/patientService.js';

/**
 * Initializes the view listeners to auto-render based on store changes
 */
export const initPatientsView = () => {
    // When the patient registry updates, re-render the active view automatically
    subscribe('patients', (newList) => {
        if (store.currentView === 'patients') {
            renderPatientsGrid(newList);
        }
    });
};

/**
 * Secures standard HTML `.innerHTML` building with safe `el()` creation
 */
export const renderPatientsGrid = (list = store.patientRegistry) => {
    const grid = document.getElementById('patientsGrid');
    if (!grid) return;
    
    emptyNode(grid);

    if (!list || !list.length) {
        grid.appendChild(
            el('div', { className: 'empty-state' }, [
                el('div', { className: 'empty-icon', textContent: '👥' }),
                el('div', { className: 'empty-title', textContent: 'No Patients Registered' }),
                el('div', { className: 'empty-sub', textContent: 'Use "Register Patient" to add your first patient.' }),
                el('button', { className: 'btn-add', textContent: '👤 Register Patient', onClick: () => window.openRegisterModal() })
            ])
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach(p => {
        const rxs = (store.prescriptions || []).filter(rx => (rx.patientName||'').trim().toLowerCase() === (p.name||'').trim().toLowerCase());
        
        // Construct the Card securely avoiding raw innerHTML
        const card = el('div', { className: 'rx-card' });
        
        // Card Header Assembly
        const header = el('div', { className: 'rx-card-header', style: { cursor: 'pointer' } }, [
            el('div', { className: 'rx-type-badge', style: { background: '#e8f0fe', color: '#1a6fdb' }, textContent: '👤 Patient' }),
            el('div', { className: 'rx-main' }, [
                el('div', { className: 'rx-patient', textContent: p.name }),
                el('div', { className: 'rx-meta' }, buildMetaTags(p, rxs.length))
            ]),
            el('div', { className: 'rx-date-badge', textContent: formatDate(p.registrationDate) }),
            el('div', { className: 'rx-actions' }, [
                el('button', { className: 'btn-sm btn-outline-teal', textContent: '📝 New Rx', onClick: (e) => { e.stopPropagation(); window.openPrescriptionForPatient(p); } })
            ]),
            el('span', { className: 'chevron-icon', textContent: '▼' })
        ]);

        header.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                card.classList.toggle('expanded');
                if (card.classList.contains('expanded') && window.renderVitalsChart) {
                    setTimeout(() => window.renderVitalsChart(p.id, `chart_${p.id}`), 100);
                }
            }
        });

        card.appendChild(header);

        // Security-First Body Construction
        const body = el('div', { className: 'rx-card-body' }, [
            el('div', { className: 'rx-details-grid', style: { paddingTop: '16px' } }, [
                createDetailGroup('Age & Gender', `${p.age || '—'} ${p.gender ? ' · ' + p.gender : ''}`),
                createDetailGroup('Blood Group', p.bloodGroup || '—'),
                createDetailGroup('Phone', p.phone || '—'),
                createDetailGroup('Email', p.email || '—')
            ])
        ]);

        card.appendChild(body);
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
};

// ─── Helpers ─────────────────────────────────────────

const createDetailGroup = (label, val) => {
    return el('div', { className: 'detail-group' }, [
        el('div', { className: 'detail-label', textContent: label }),
        el('div', { className: 'detail-value', textContent: val })
    ]);
};

const buildMetaTags = (p, rxCount) => {
    const tags = [];
    if (p.age) tags.push(el('span', { className: 'rx-meta-item', textContent: `🎂 ${p.age} yrs` }));
    if (p.phone) tags.push(el('span', { className: 'rx-meta-item', textContent: `📱 ${p.phone}` }));
    
    tags.push(el('span', { className: 'rx-meta-item', style: { color: 'var(--green)' }, textContent: `💰 ₹${p.consultantFee||0} via ${p.paymentMethod||'Cash'}` }));

    if (rxCount > 0) {
        const badge = el('span', { className: 'rx-meta-item' });
        badge.innerHTML = `<span class="nav-badge" style="background:var(--teal);color:#fff">${rxCount} Rx</span>`; // Controlled, internal integer interpolation is safe
        tags.push(badge);
    }

    // Fee Status Badge via Service
    const feeStatus = getPatientFeeStatus(p);
    let feeSpan;
    if (feeStatus === 'valid') {
        const d = getDaysRemaining(p);
        feeSpan = el('span', { className: 'nav-badge', style: { background:'var(--green)', color:'#fff' }, textContent: `✅ ${d}d left` });
    } else if (feeStatus === 'expired') {
        feeSpan = el('span', { className: 'nav-badge', style: { background:'var(--red-bg)', color:'var(--red)' }, textContent: `⚠️ Fee expired` });
    } else {
        feeSpan = el('span', { className: 'nav-badge', style: { background:'var(--bg)', color:'var(--text-muted)', border:'1px solid var(--border)' }, textContent: `💳 Fee pending` });
    }
    
    tags.push(el('span', { className: 'rx-meta-item' }, [feeSpan]));
    
    return tags;
};
