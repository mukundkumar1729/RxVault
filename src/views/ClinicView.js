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
    
    // Implement retry logic to handle async HTML injection from render-html.js
    let retryCount = 0;
    const maxRetries = 20;
    const attemptRender = () => {
        if (document.getElementById('clinicGateList') && document.getElementById('clinicGateForm')) {
            renderClinicSelectionGrid();
        } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(attemptRender, 100);
        } else {
            console.warn('[ClinicView] Clinic gate components failed to load in time.');
        }
    };
    attemptRender();
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
                el('span', { 
                    className: 'clinic-type-tag', 
                    style: { background: 'rgba(15,30,48,0.05)', color: 'var(--text-muted)', marginLeft: '4px', border: '1px solid var(--border)' }, 
                    textContent: (c.plan || 'free').charAt(0).toUpperCase() + (c.plan || 'free').slice(1)
                }),
                ...(c.staffRole ? [el('span', { className: 'clinic-type-tag', style: { background: 'rgba(10,124,110,0.15)', color: 'var(--teal)', marginLeft: '4px' }, textContent: window.formatRole ? window.formatRole(c.staffRole) : c.staffRole })] : [])
            ])
        ]),
        el('div', { className: 'clinic-card-actions' }, [
            ...((isSuperAdmin || c.staffRole === 'admin') && (c.plan === 'free' || c.plan === 'silver') ? [
                el('button', { 
                    className: 'clinic-edit-btn', 
                    style: { color: 'var(--teal)', borderColor: 'rgba(10,124,110,0.2)', marginRight: '6px' },
                    attributes: { title: 'Upgrade Plan' }, 
                    textContent: '💎', 
                    onClick: (e) => { e.stopPropagation(); if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal(c.id); } 
                })
            ] : []),
            ...(canCreate || c.staffRole === 'admin' ? [
                el('button', { className: 'clinic-edit-btn', attributes: { title: 'Edit' }, textContent: '✏️', onClick: (e) => { e.stopPropagation(); openEditClinicModal(c.id); } }),
                el('button', { className: 'clinic-del-btn', attributes: { title: 'Delete' }, textContent: '🗑️', onClick: (e) => { e.stopPropagation(); triggerDeleteClinicById(c.id); } })
            ] : [])
        ]),
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

/**
 * Prefills the Clinic Form with existing data or generic defaults
 */
export const prefillNewClinicForm = (clinic) => {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('cgName',    clinic ? clinic.name    : '');
    setVal('cgAddress', clinic ? clinic.address : '');
    setVal('cgPhone',   clinic ? clinic.phone   : '');
    setVal('cgEmail',   clinic ? clinic.email   : '');
    setVal('cgPin',     clinic ? clinic.pin     : '');
    setVal('cgLogo',    clinic ? clinic.logo    : '🏥');
    
    const typeEl = document.getElementById('cgType');
    if (typeEl) typeEl.value = clinic ? (clinic.type || 'multispecialty') : 'multispecialty';
    
    const titleEl = document.getElementById('clinicFormTitle');
    if (titleEl) titleEl.textContent = clinic ? 'Edit Clinic Details' : (store.clinics.length ? '＋ New Clinic' : '🏥 Create Your First Clinic');
    
    const saveBtn = document.getElementById('cgSaveBtn');
    if (saveBtn) saveBtn.dataset.editId = clinic ? clinic.id : '';
};

export const showNewClinicForm = () => {
    const list = document.getElementById('clinicGateList');
    const form = document.getElementById('clinicGateForm');
    if (list) list.style.display = 'none';
    if (form) form.style.display = '';
    
    const closeBtn = document.getElementById('clinicGateCloseBtn');
    if (closeBtn) closeBtn.style.display = (store.clinics || []).length ? '' : 'none';
    
    prefillNewClinicForm(null);
    setTimeout(() => { const i = document.getElementById('cgName'); if (i) i.focus(); }, 100);
};

export const cancelClinicForm = () => {
    if (!(store.clinics || []).length) {
        if (typeof window.showToast === 'function') window.showToast('Please create your first clinic to continue.', 'info');
        return;
    }
    renderClinicSelectionGrid();
};

export const openEditClinicModal = (id) => {
    const clinic = (store.clinics || []).find(c => c.id === id);
    if (!clinic) return;
    
    const list = document.getElementById('clinicGateList');
    const form = document.getElementById('clinicGateForm');
    if (list) list.style.display = 'none';
    if (form) form.style.display = '';
    
    prefillNewClinicForm(clinic);
};

import { saveClinicPayload, deleteClinicEntity } from '../services/clinicService.js';

export const saveClinicFormSecure = async () => {
    const nameEl = document.getElementById('cgName');
    const name = (nameEl?.value || '').trim();
    if (!name) { 
        if (typeof window.showToast === 'function') window.showToast('Clinic name is required.', 'error'); 
        nameEl?.focus(); 
        return; 
    }
    
    const btn = document.getElementById('cgSaveBtn');
    const editId = btn ? btn.dataset.editId : '';
    const oldText = btn ? btn.textContent : '';
    
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }
    
    const data = {
        name,
        address: document.getElementById('cgAddress')?.value || '',
        phone:   document.getElementById('cgPhone')?.value   || '',
        email:   document.getElementById('cgEmail')?.value   || '',
        type:    document.getElementById('cgType')?.value    || 'multispecialty',
        logo:    (document.getElementById('cgLogo')?.value || '').trim() || '🏥',
        pin:     (document.getElementById('cgPin')?.value  || '').trim() || 'admin1234'
    };
    
    try {
        const result = await saveClinicPayload(data, editId, store.currentUser);
        if (btn) { btn.disabled = false; btn.textContent = oldText; }
        
        if (result.success) {
            if (typeof window.showToast === 'function') window.showToast(editId ? 'Clinic updated!' : 'Clinic created!', 'success');
            // If it was a new clinic, saveClinicPayload already set it active and auto-routed.
            // If it was an edit, just go back to the list
            if (editId) renderClinicSelectionGrid();
            else {
                // Trigger global orchestrator
                if (typeof window.selectClinicFinalize === 'function') window.selectClinicFinalize(result.updated);
            }
        }
    } catch (err) {
        console.error('[ClinicView] Save error:', err);
        if (btn) { btn.disabled = false; btn.textContent = oldText; }
        if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
    }
};

export const triggerDeleteClinicById = async (id) => {
    if (!confirm('Delete this clinic and ALL its data?\nThis cannot be undone.')) return;
    
    if (typeof window.showLoading === 'function') window.showLoading('Deleting clinic…');
    try {
        await deleteClinicEntity(id, store.currentUser);
        if (typeof window.hideLoading === 'function') window.hideLoading();
        renderClinicSelectionGrid();
    } catch (err) {
        console.error('[ClinicView] Delete error:', err);
        if (typeof window.hideLoading === 'function') window.hideLoading();
        if (typeof window.showToast === 'function') window.showToast('Failed to delete clinic.', 'error');
    }
};
