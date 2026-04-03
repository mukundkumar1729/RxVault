// ════════════════════════════════════════════════════════════
//  ROSTER VIEW CONTROLLER
//  Safely injects Shift Scheduling Grids and pending swaps
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { 
    SHIFTS, DAYS, getWeekDates, fetchRosterStaffMembers, fetchShiftRosterMap, 
    updateStaffShiftDatabase, fetchPendingSwapRequests, approveShiftSwap, rejectShiftSwap 
} from '../services/rosterService.js';

let _rosterWeekOffset = 0;
let _staffList = [];
let _rosterDataCache = {};

export const openRosterViewSecure = async () => {
    if (typeof window.setView === 'function') window.setView('roster');
    store.currentView = 'roster';

    let rv = document.getElementById('rosterView');
    if (!rv) { 
        rv = el('div', { id: 'rosterView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(rv);
    }
    rv.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navRoster');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '🗓️ Shift & Duty Roster';
    if (sub) sub.textContent = 'Weekly schedule, on-call assignments and shift management for nursing staff';
    if (addBtn) addBtn.style.display = 'none';

    await loadAndRenderRosterGrid(rv);
};

const loadAndRenderRosterGrid = async (container) => {
    // 1. Fetch Parallel Data
    _staffList = await fetchRosterStaffMembers();
    _rosterDataCache = await fetchShiftRosterMap();

    // 2. Generate Grid
    renderRosterGridSecure(container);
};

const getInitials = (name) => {
    return (name || 'S').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const getRoleColor = (role) => {
    const map = { doctor: '#0ea5e9', nurse: '#10b981', pharmacist: '#8b5cf6', receptionist: '#f59e0b', admin: '#ef4444' };
    return map[role] || '#64748b';
};

const renderRosterGridSecure = (container) => {
    emptyNode(container);

    const weekDates = getWeekDates(_rosterWeekOffset);
    const weekLabel = `${weekDates[0].toLocaleDateString('en-IN', { day:'2-digit', month:'short' })} – ${weekDates[6].toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`;

    const onCallToday = {};
    weekDates.forEach((d, di) => {
        const key = `${DAYS[di]}_${d.toISOString().split('T')[0]}`;
        const count = _staffList.filter(s => (_rosterDataCache[s.id] || {})[key] === 'OC').length;
        onCallToday[di] = count;
    });

    // 1. Sleek Toolbar
    const toolbar = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: 'var(--surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' } }, [
        el('div', { style: { display: 'flex', gap: '8px' } }, [
            el('button', { className: 'btn-sm btn-outline-teal', style: { padding: '6px 12px', borderRadius: '8px' }, textContent: '←', title: 'Previous Week', onClick: () => { _rosterWeekOffset--; renderRosterGridSecure(container); } }),
            el('button', { className: 'btn-sm btn-outline-teal', style: { padding: '6px 12px', borderRadius: '8px' }, textContent: 'Today', onClick: () => { _rosterWeekOffset = 0; renderRosterGridSecure(container); } }),
            el('button', { className: 'btn-sm btn-outline-teal', style: { padding: '6px 12px', borderRadius: '8px' }, textContent: '→', title: 'Next Week', onClick: () => { _rosterWeekOffset++; renderRosterGridSecure(container); } }),
        ]),
        el('div', { style: { fontSize: '15px', fontWeight: '700', color: 'var(--color-secondary)' }, textContent: weekLabel }),
        el('div', { style: { display: 'flex', gap: '8px' } }, [
            el('button', { className: 'btn-sm btn-outline-teal', style: { padding: '6px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }, onClick: renderPrintableRosterExport }, [
                el('span', { textContent: '📤' }), el('span', { textContent: 'Export PDF' })
            ])
        ])
    ]);

    // 2. Legend Row (Subtle)
    const legendRow = el('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', padding: '0 4px' } });
    Object.entries(SHIFTS).forEach(([key, s]) => {
        legendRow.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
            el('div', { style: { width: '10px', height: '10px', borderRadius: '3px', background: s.bg, border: `1.5px solid ${s.clr}` } }),
            el('span', { style: { fontSize: '11px', fontWeight: '600', color: 'var(--text-main)' }, textContent: s.label }),
            el('span', { style: { fontSize: '10px', color: 'var(--text-muted)' }, textContent: s.time })
        ]));
    });

    // 3. Main Grid Table
    const tableWrap = el('div', { style: { background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' } });
    const table = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '800px' } });

    // Thead
    const thead = el('thead', { style: { background: 'var(--bg)', borderBottom: '2px solid var(--border)' } });
    const headerTr = el('tr');
    headerTr.appendChild(el('th', { style: { padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }, textContent: 'Staff Member' }));
    
    weekDates.forEach((d, i) => {
        const isToday = d.toDateString() === new Date().toDateString();
        const th = el('th', { style: { padding: '12px 8px', textAlign: 'center', fontWeight: '700', minWidth: '80px', background: isToday ? 'rgba(10, 124, 110, 0.05)' : '', position: 'relative' } }, [
            el('div', { style: { fontSize: '11px', color: isToday ? 'var(--color-primary)' : 'var(--text-muted)', textTransform: 'uppercase' }, textContent: DAYS[i].substring(0, 3) }),
            el('div', { style: { fontSize: '14px', marginTop: '2px', color: isToday ? 'var(--color-primary)' : 'var(--text-main)' }, textContent: d.getDate() }),
            (onCallToday[i] === 0 ? el('div', { style: { position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }, title: 'No on-call staff assigned!' }) : null)
        ]);
        headerTr.appendChild(th);
    });
    headerTr.appendChild(el('th', { style: { padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }, textContent: 'Status' }));
    headerTr.appendChild(el('th', { style: { padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }, textContent: 'Weekly' }));
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Tbody
    const tbody = el('tbody');
    if (_staffList.length === 0) {
        tbody.appendChild(el('tr', {}, [el('td', { attributes: { colspan: '10' }, style: { padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }, textContent: 'No staff members found.' })]));
    } else {
        _staffList.forEach(staff => {
            const shifts = _rosterDataCache[staff.id] || {};
            let nightCount = 0, onCallCount = 0, workDays = 0;
            
            const tr = el('tr', { 
                style: { transition: 'background 0.2s ease', borderBottom: '1px solid var(--border)' },
                onmouseenter: function() { this.style.background = 'rgba(10, 124, 110, 0.02)'; },
                onmouseleave: function() { this.style.background = ''; }
            });

            // Staff Profile Cell
            const initials = getInitials(staff.name || staff.email);
            const roleColor = getRoleColor(staff.role);
            
            const bioCell = el('td', { style: { padding: '12px 16px' } }, [
                el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                    el('div', { style: { width: '32px', height: '32px', borderRadius: '10px', background: `${roleColor}20`, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' }, textContent: initials }),
                    el('div', {}, [
                        el('div', { style: { fontWeight: '600', color: 'var(--text-main)', fontSize: '13px' }, textContent: staff.name || staff.email || 'Staff' }),
                        el('div', { style: { fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'capitalize' }, textContent: staff.role || 'Staff' })
                    ])
                ])
            ]);
            tr.appendChild(bioCell);

            // Shift Cells
            weekDates.forEach((d, di) => {
                const key = `${DAYS[di]}_${d.toISOString().split('T')[0]}`;
                const code = shifts[key] || 'OFF';
                const shift = SHIFTS[code] || SHIFTS.OFF;
                const isToday = d.toDateString() === new Date().toDateString();

                if (code === 'N') nightCount++;
                if (code === 'OC') onCallCount++;
                if (code !== 'OFF') workDays++;

                const select = el('select', { 
                    style: { appearance: 'none', border: 'none', borderRadius: '8px', background: shift.bg, color: shift.clr, padding: '6px 8px', fontSize: '11px', fontWeight: '800', width: '56px', textAlign: 'center', cursor: 'pointer', outline: 'none' },
                    onchange: async (e) => {
                        const val = e.target.value;
                        const sObj = SHIFTS[val] || SHIFTS.OFF;
                        e.target.style.background = sObj.bg;
                        e.target.style.color = sObj.clr;
                        _rosterDataCache[staff.id] = { ...(_rosterDataCache[staff.id] || {}), [key]: val };
                        await updateStaffShiftDatabase(staff.id, key, val);
                        setTimeout(() => renderRosterGridSecure(container), 200); // Soft refresh for totals
                    }
                }, Object.entries(SHIFTS).map(([k, meta]) => el('option', { value: k, textContent: meta.short, selected: code === k })));
                
                tr.appendChild(el('td', { style: { padding: '8px 4px', textAlign: 'center', background: isToday ? 'rgba(10, 124, 110, 0.02)' : '' } }, [select]));
            });

            // Status Badge
            const sts = staff.status || 'available';
            const fCls = sts.includes('_') ? sts.split('_')[1] : (sts === 'on_duty' ? 'success' : 'muted');
            
            tr.appendChild(el('td', { style: { padding: '8px 4px', textAlign: 'center' } }, [
                el('span', { className: `status-badge status-${fCls}`, style: { fontSize: '9px', padding: '2px 8px' }, textContent: sts.replace(/_/g, ' ') })
            ]));

            // Weekly Total
            tr.appendChild(el('td', { style: { padding: '8px 12px', textAlign: 'center' } }, [
                el('div', { style: { fontWeight: '700', color: workDays >= 5 ? 'var(--color-primary)' : 'var(--text-muted)' }, textContent: `${workDays}/7` })
            ]));
            
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);

    // 4. Pending Swaps Section
    const swapHost = el('div', { id: 'swapRequests', style: { marginTop: '24px' } });

    container.append(toolbar, legendRow, tableWrap, swapHost);
    injectPendingSwapsDOM(swapHost);
};

// ─── Swaps Pipeline ──────────────────────────────────────────────

const injectPendingSwapsDOM = async (container) => {
    emptyNode(container);
    const data = await fetchPendingSwapRequests();
    if (!data.length) return;

    container.appendChild(el('div', { style: { fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '8px' } }, [
        el('span', { textContent: '🔄' }),
        el('span', { textContent: `Pending Shift Swap Requests (${data.length})` })
    ]));

    data.forEach(req => {
        const requester = _staffList.find(s => s.id === req.requester_id);
        const target = _staffList.find(s => s.id === req.target_id);

        const card = el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' } }, [
            el('div', { style: { flex: '1' } }, [
                el('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }, textContent: `${requester?.name || 'Staff'} ↔ ${target?.name || 'Staff'}` }),
                el('div', { style: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' } }, [
                    el('span', { style: { background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }, textContent: req.slot_key_a.replace(/_/g, ' ') }),
                    el('span', { textContent: '⇄' }),
                    el('span', { style: { background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }, textContent: req.slot_key_b.replace(/_/g, ' ') })
                ]),
                ...(req.message ? [el('div', { style: { fontSize: '12px', color: 'var(--color-primary)', marginTop: '6px', fontStyle: 'italic' }, textContent: `"${req.message}"` })] : [])
            ]),
            el('div', { style: { display: 'flex', gap: '8px' } }, [
                el('button', { className: 'btn-sm btn-teal', style: { borderRadius: '8px' }, textContent: 'Approve', onClick: () => executeSwapActionSecure(req.id, true) }),
                el('button', { className: 'btn-sm btn-outline-red', style: { borderRadius: '8px' }, textContent: 'Reject', onClick: () => executeSwapActionSecure(req.id, false) })
            ])
        ]);
        container.appendChild(card);
    });
};

const executeSwapActionSecure = async (swapId, isApprove) => {
    if (isApprove) {
        const ok = await approveShiftSwap(swapId, _rosterDataCache);
        if (ok) {
            window.showToast('✅ Shift swap approved and applied', 'success');
            openRosterViewSecure();
        } else {
            window.showToast('Failed to approve swap.', 'error');
        }
    } else {
        const ok = await rejectShiftSwap(swapId);
        if (ok) {
            window.showToast('Swap request rejected.', 'info');
            const swapHost = document.getElementById('swapRequests');
            if (swapHost) injectPendingSwapsDOM(swapHost);
        }
    }
};

// ─── Extracted HTML Grid Printer ──────────────────────────────────

const renderPrintableRosterExport = () => {
    const weekDates = getWeekDates(_rosterWeekOffset);
    const weekLabel = `${weekDates[0].toLocaleDateString('en-IN', { day:'2-digit', month:'short' })} – ${weekDates[6].toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`;
    const clinic = typeof window.getActiveClinic === 'function' ? window.getActiveClinic() : null;

    const rows = _staffList.map(staff => {
        const shifts = _rosterDataCache[staff.id] || {};
        const datesMap = weekDates.map((d, di) => {
            const code = shifts[`${DAYS[di]}_${d.toISOString().split('T')[0]}`] || 'OFF';
            const shift = SHIFTS[code] || SHIFTS.OFF;
            return `<td style="padding:8px;text-align:center;border:1px solid #ddd;background:${shift.bg};color:${shift.clr};font-weight:700">${shift.short}</td>`;
        }).join('');
        return `<tr><td style="padding:8px 12px;font-weight:600;border:1px solid #ddd">${staff.name||staff.email||'Staff'}<br><small style="color:#888">${staff.role||''}</small></td>${datesMap}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Roster ${weekLabel}</title>
<style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}table{width:100%;border-collapse:collapse}th{background:#f0f4f8;padding:8px;border:1px solid #ddd;text-align:center}@media print{body{padding:0}}</style></head>
<body onload="window.print()">
<h2 style="color:#0f2240">🗓️ Weekly Duty Roster</h2>
<p>${clinic?.name||'Rx Vault'} · ${weekLabel}</p>
<table><thead><tr><th>Staff</th>${DAYS.map((d,i)=> `<th>${d.substring(0,3)} ${weekDates[i].getDate()}</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:20px;font-size:11px;color:#888">MOR=Morning(7am–2pm) | AFT=Afternoon(2pm–9pm) | NGT=Night(9pm–7am) | ONC=On-Call | OFF=Rest day</p>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
};

window.showRosterView = openRosterViewSecure;
