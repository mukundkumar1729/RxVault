// ════════════════════════════════════════════════════════════
//  CLINIC VIEW CONTROLLER
//  Safely generates Multi-tenant Selectors and Topbar profiles
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';

/**
 * Initializes the layout and visibility of the Clinic Gate Modal.
 */
export const openClinicGate = () => {
    const gate = document.getElementById('clinicGate');
    if (gate) { 
        gate.classList.add('open'); 
        document.body.style.overflow = 'hidden'; 
    }
    renderClinicSelectionGrid();
};

export const closeClinicGate = () => {
    const gate = document.getElementById('clinicGate');
    if (gate) gate.classList.remove('open');
    document.body.style.overflow = '';
    
    // Fallback UI resync for topbar call bells
    if (typeof window.updateCallStaffBellVisibility === 'function') window.updateCallStaffBellVisibility();
};

/**
 * Core rendering node for building the Clinic list securely
 */
export const renderClinicSelectionGrid = () => {
    const listEl = document.getElementById('clinicGateList');
    const formEl = document.getElementById('clinicGateForm');
    const closeBtn = document.getElementById('clinicGateCloseBtn');
    
    if (!listEl || !formEl) return;

    const clinics = store.clinics || [];
    
    if (closeBtn) closeBtn.style.display = clinics.length ? '' : 'none';

    if (!clinics.length) {
        listEl.style.display = 'none';
        formEl.style.display = '';
        if (typeof window.prefillNewClinicForm === 'function') window.prefillNewClinicForm(null); // Optional fallback mapping
        return;
    }

    listEl.style.display = '';
    formEl.style.display = 'none';
    
    emptyNode(listEl);

    const typeIcon = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱', multispecialty: '🏥' };
    const typeName = { allopathy: 'Allopathy', homeopathy: 'Homeopathy', ayurveda: 'Ayurveda', multispecialty: 'Multispecialty' };
    
    const isSuperAdmin = typeof window.isSuperAdmin === 'function' ? window.isSuperAdmin() : false;
    const canCreate = isSuperAdmin || false;

    // Header Content
    const headerRow = el('div', { className: 'clinic-gate-list-header' }, [
        el('div', {}, [
            el('span', { textContent: 'Select a clinic to continue' }),
            ...(store.currentUser && store.currentUser.name ? [
                el('div', { style: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' } }, [
                    el('span', { textContent: 'Signed in as ' }),
                    el('strong', { textContent: store.currentUser.name }),
                    el('span', { textContent: ` · ${window.formatRole ? window.formatRole(store.currentUser.role) : store.currentUser.role}` })
                ])
            ] : [])
        ]),
        ...(canCreate ? [
            el('button', { className: 'clinic-new-btn', textContent: '＋ New Clinic', onClick: () => {
                document.getElementById('clinicGateList').style.display = 'none';
                document.getElementById('clinicGateForm').style.display = '';
                if(closeBtn) closeBtn.style.display = clinics.length ? '' : 'none';
                // Delay focus optionally
                setTimeout(() => { const i = document.getElementById('cgName'); if (i) i.focus(); }, 100);
            }})
        ] : [])
    ]);

    // Cards Setup
    const cardsGrid = el('div', { className: 'clinic-cards' });
    
    clinics.forEach(c => {
        const icon = typeIcon[c.type] || '🏥';
        const tname = typeName[c.type] || c.type;
        const isActive = c.id === store.activeClinicId;

        const card = el('div', { 
            className: `clinic-card ${isActive ? 'clinic-card-active' : ''}`,
            onClick: () => window.selectClinicFinalize(c.id) // Calls the orchestrator boot 
        }, [
            el('div', { className: 'clinic-card-icon', textContent: c.logo || icon }),
            el('div', { className: 'clinic-card-info' }, [
                el('div', { className: 'clinic-card-name' }, [
                    el('span', { textContent: c.name }),
                    ...(isActive ? [el('span', { style: { fontSize: '10px', color: 'var(--teal)' }, textContent: ' ✓ Active' })] : [])
                ]),
                el('div', { className: 'clinic-card-meta' }, [
                    el('span', { className: 'clinic-type-tag', textContent: `${icon} ${tname}` }),
                    ...(c.staffRole ? [el('span', { className: 'clinic-type-tag', style: { background: 'rgba(10,124,110,0.15)', color: 'var(--teal)', marginLeft: '4px' }, textContent: window.formatRole ? window.formatRole(c.staffRole) : c.staffRole })] : [])
                ])
            ]),
            ...(canCreate ? [
                el('div', { className: 'clinic-card-actions' }, [
                    el('button', { className: 'clinic-edit-btn', attributes: { title: 'Edit' }, textContent: '✏️', onClick: (e) => { e.stopPropagation(); window.openEditClinicModal(c.id); } }),
                    el('button', { className: 'clinic-del-btn', attributes: { title: 'Delete' }, textContent: '🗑️', onClick: (e) => { e.stopPropagation(); window.triggerDeleteClinicById(c.id); } })
                ])
            ] : []),
            el('div', { className: 'clinic-card-arrow', textContent: '→' })
        ]);
        
        cardsGrid.appendChild(card);
    });

    const footerRow = el('div', { style: { padding: '12px 0 4px', textAlign: 'right' } }, [
        el('button', { className: 'btn-sm btn-outline-red', style: { fontSize: '12px' }, textContent: '🚪 Sign Out', onClick: () => typeof window.authLogout === 'function' ? window.authLogout() : location.reload() })
    ]);

    listEl.appendChild(headerRow);
    listEl.appendChild(cardsGrid);
    listEl.appendChild(footerRow);
};
