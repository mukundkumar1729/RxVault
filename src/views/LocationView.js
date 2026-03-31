// ════════════════════════════════════════════════════════════
//  LOCATION DIRECTORY VIEW CONTROLLER
//  Safely builds geographic map grids for clinical departments
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { loadActiveLocations, executeLocationSearch } from '../services/locationService.js';

export const openLocationDirectory = async () => {
    store.currentView = 'locationDirectory';
    hideAllViews();

    let v = document.getElementById('locationDirView');
    if (!v) {
        v = el('div', { id: 'locationDirView' });
        document.querySelector('.main').appendChild(v);
    }
    
    // Display Title Headers
    const pgTitle = document.getElementById('pageTitle');
    const pgSub = document.getElementById('pageSubtitle');
    if (pgTitle) pgTitle.textContent = '🗺️ Location Directory';
    if (pgSub) pgSub.textContent = 'Find where doctors, labs and facilities are located';
    
    // Fallbacks
    if (typeof window.setNavActive === 'function') window.setNavActive('navLocationDir');
    
    emptyNode(v);
    
    // UI Layout Frame
    const topBar = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' } }, [
        el('div', { style: { position: 'relative', flex: 1, minWidth: '200px' } }, [
            el('span', { style: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', pointerEvents: 'none' }, textContent: '🔍' }),
            el('input', { id: 'locDirSearch', attributes: { placeholder: 'Search by name, floor, block, cabin…' }, style: { width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', boxSizing: 'border-box' } }, [], { oninput: () => updateLocationGrid() })
        ]),
        el('select', { id: 'locDirTypeFilter', style: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)' } }, [
            el('option', { value: '', textContent: 'All Types' }),
            el('option', { value: 'doctor', textContent: '🩺 Doctor' }),
            el('option', { value: 'lab', textContent: '🧪 Lab/Diagnostic' }),
            el('option', { value: 'pharmacy', textContent: '💊 Pharmacy' }),
            el('option', { value: 'ward', textContent: '🛏️ Ward' }),
            el('option', { value: 'ot', textContent: '⚕️ OT/Procedure Room' }),
            el('option', { value: 'admin', textContent: '🔐 Admin/Office' }),
            el('option', { value: 'other', textContent: '📍 Other' })
        ], { onchange: () => updateLocationGrid() }),
        ...(window.can && window.can.accessAdminPanel && window.can.accessAdminPanel() ? [
            el('button', { className: 'btn-add', style: { padding: '9px 16px', fontSize: '13px', whiteSpace: 'nowrap' }, textContent: '＋ Add Location', onClick: () => typeof window.openAddLocationEntry === 'function' ? window.openAddLocationEntry() : null })
        ] : [])
    ]);

    v.appendChild(topBar);
    v.appendChild(el('div', { id: 'locDirGrid' }));

    // Async data
    await loadActiveLocations();
    updateLocationGrid();
};

const updateLocationGrid = () => {
    const q = document.getElementById('locDirSearch')?.value || '';
    const type = document.getElementById('locDirTypeFilter')?.value || '';
    
    const grid = document.getElementById('locDirGrid');
    if (!grid) return;

    emptyNode(grid);

    const matches = executeLocationSearch(q, type);

    if (!matches.length) {
        grid.appendChild(el('div', { style: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-lg)' } }, [
            el('div', { style: { fontSize: '36px', marginBottom: '10px' }, textContent: '🗺️' }),
            el('div', { style: { fontWeight: '600' }, textContent: 'No locations found' }),
            el('div', { style: { fontSize: '13px', marginTop: '6px' }, textContent: 'Add location entries to help staff and patients navigate.' })
        ]));
        return;
    }

    const typeConfig = {
        doctor:   { icon: '🩺', bg: 'var(--allopathy-bg)', clr: 'var(--allopathy)' },
        lab:      { icon: '🧪', bg: 'var(--homeopathy-bg)', clr: 'var(--homeopathy)' },
        pharmacy: { icon: '💊', bg: 'var(--teal-pale)', clr: 'var(--teal)' },
        ward:     { icon: '🛏️', bg: 'var(--surface2)', clr: 'var(--text-primary)' },
        ot:       { icon: '⚕️', bg: 'var(--red-bg)', clr: 'var(--red)' },
        admin:    { icon: '🔐', bg: 'var(--ayurveda-bg)', clr: 'var(--ayurveda)' },
        other:    { icon: '📍', bg: 'var(--bg)', clr: 'var(--text-muted)' }
    };

    const container = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' } });

    // Ensure mapping handles manual legacy assignments correctly
    matches.forEach(e => {
        const tc = typeConfig[e.entity_type] || typeConfig.other;
        
        let actions = [];
        if (!e._auto && window.can && window.can.accessAdminPanel && window.can.accessAdminPanel()) {
            actions = [
                el('button', { className: 'btn-sm', style: { padding: '4px 8px', fontSize: '11px', background: 'transparent', border: '1px solid var(--border)' }, textContent: 'Edit', onClick: () => typeof window.openEditLocationEntry === 'function' ? window.openEditLocationEntry(e.id) : null }),
                el('button', { className: 'btn-sm btn-outline-red', style: { padding: '4px 8px', fontSize: '11px' }, textContent: 'Delete', onClick: () => typeof window.confirmDeleteLocation === 'function' ? window.confirmDeleteLocation(e.id) : null })
            ];
        }

        const card = el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } }, [
            el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
                el('div', { style: { width: '40px', height: '40px', borderRadius: '10px', background: tc.bg, color: tc.clr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: '0' }, textContent: tc.icon }),
                el('div', { style: { flex: 1, minWidth: 0 } }, [
                    el('div', { style: { fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, textContent: e.name || 'Unnamed' }),
                    el('div', { style: { fontSize: '11.5px', color: 'var(--text-secondary)' }, textContent: e.specialization || (e.entity_type ? e.entity_type.toUpperCase() : '') })
                ])
            ]),
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '12px' } }, [
                el('div', {}, [
                    el('div', { style: { color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '2px' }, textContent: 'Floor' }),
                    el('div', { style: { fontWeight: '600' }, textContent: e.floor || '—' })
                ]),
                el('div', {}, [
                    el('div', { style: { color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '2px' }, textContent: 'Block/Wing' }),
                    el('div', { style: { fontWeight: '600' }, textContent: e.block || '—' })
                ]),
                el('div', { style: { gridColumn: 'span 2' } }, [
                    el('div', { style: { color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '2px' }, textContent: 'Cabin/Room' }),
                    el('div', { style: { fontWeight: '600' }, textContent: e.cabin || '—' })
                ])
            ]),
            ...(e.notes || e.phone ? [
                el('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' } }, [
                    ...(e.phone ? [el('div', {}, [el('strong', { textContent: '📞 ' }), el('span', { textContent: e.phone })])] : []),
                    ...(e.notes ? [el('div', {}, [el('strong', { textContent: '📝 ' }), el('span', { textContent: e.notes })])] : [])
                ])
            ] : []),
            ...(actions.length ? [
                el('div', { style: { display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '10px' } }, actions)
            ] : [])
        ]);

        container.appendChild(card);
    });

    grid.appendChild(container);

    // Initial load listener bindings
    document.getElementById('locDirSearch')?.addEventListener('input', updateLocationGrid);
    document.getElementById('locDirTypeFilter')?.addEventListener('change', updateLocationGrid);
};
