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

    // 1. Shift Legend
    const legendRow = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' } });
    Object.entries(SHIFTS).forEach(([key, s]) => {
        legendRow.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', background: s.bg, padding: '4px 12px', borderRadius: '20px' } }, [
            el('span', { style: { fontSize: '11px', fontWeight: '700', color: s.clr }, textContent: s.short }),
            el('span', { style: { fontSize: '11px', color: 'var(--text-muted)' }, textContent: `${s.label} · ${s.time}` })
        ]));
    });

    // 2. Week Navigation
    const navRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' } }, [
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '← Prev', onClick: () => { _rosterWeekOffset--; renderRosterGridSecure(container); } }),
        el('div', { style: { fontSize: '14px', fontWeight: '700', flex: '1', textAlign: 'center' }, textContent: weekLabel }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Next →', onClick: () => { _rosterWeekOffset++; renderRosterGridSecure(container); } }),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '📤 Export', onClick: renderPrintableRosterExport })
    ]);

    // 3. Grid Table
    const tableWrap = el('div', { style: { overflowX: 'auto' } });
    const table = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '700px' } });

    // Thead
    const thead = el('thead');
    const headerTr = el('tr', { style: { background: 'var(--surface2)' } });
    headerTr.appendChild(el('th', { style: { padding: '10px 14px', textAlign: 'left', fontWeight: '700', minWidth: '140px', borderBottom: '1px solid var(--border)' }, textContent: 'Staff' }));
    
    weekDates.forEach((d, i) => {
        const isToday = d.toDateString() === new Date().toDateString();
        const th = el('th', { style: { padding: '10px 8px', textAlign: 'center', fontWeight: '700', borderBottom: '1px solid var(--border)', background: isToday ? 'var(--teal-pale)' : '', color: isToday ? 'var(--teal)' : '' } }, [
            document.createTextNode(DAYS[i].substring(0, 3)),
            el('br'),
            el('span', { style: { fontSize: '10px', fontWeight: '400', color: 'var(--text-muted)' }, textContent: `${d.getDate()}/${d.getMonth()+1}` })
        ]);

        if (onCallToday[i] === 0) {
            th.appendChild(el('br'));
            th.appendChild(el('span', { style: { fontSize: '9px', color: 'var(--red)', fontWeight: '700' }, textContent: 'No on-call!' }));
        }
        headerTr.appendChild(th);
    });
    headerTr.appendChild(el('th', { style: { padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)', minWidth: '70px' }, textContent: 'Status' }));
    headerTr.appendChild(el('th', { style: { padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)' }, textContent: 'Total' }));
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Tbody
    const tbody = el('tbody');
    if (_staffList.length === 0) {
        tbody.appendChild(el('tr', {}, [el('td', { attributes: { colspan: '10' }, style: { padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }, textContent: 'No staff registered. Add staff via Administration → Staff Management.' })]));
    } else {
        _staffList.forEach(staff => {
            const shifts = _rosterDataCache[staff.id] || {};
            let nightCount = 0, onCallCount = 0, workDays = 0;
            
            const tr = el('tr', { 
                onmouseenter: function() { this.style.background = 'var(--surface2)'; },
                onmouseleave: function() { this.style.background = ''; }
            });

            const roleIcon = { doctor: '🩺', receptionist: '🧑‍💼', pharmacist: '💊', admin: '🔐', nurse: '💉', viewer: '👁️' }[staff.role] || '👤';
            
            // Staff Bio Cell
            const bioCell = el('td', { style: { padding: '10px 14px', borderBottom: '1px solid var(--border)' } }, [
                el('div', { style: { fontWeight: '600' }, textContent: `${roleIcon} ${staff.name || staff.email || 'Staff'}` }),
                el('div', { style: { fontSize: '10.5px', color: 'var(--text-muted)' }, textContent: (staff.role || '').charAt(0).toUpperCase() + (staff.role || '').slice(1) })
            ]);
            tr.appendChild(bioCell);

            // 7 Days Iteration Check
            const cellCollector = [];
            weekDates.forEach((d, di) => {
                const key = `${DAYS[di]}_${d.toISOString().split('T')[0]}`;
                const code = shifts[key] || 'OFF';
                const shift = SHIFTS[code] || SHIFTS.OFF;
                
                if (code === 'N') nightCount++;
                if (code === 'OC') onCallCount++;
                if (code !== 'OFF') workDays++;

                const selectNode = el('select', { 
                    style: { fontSize: '11px', padding: '4px 2px', border: '1px solid var(--border)', borderRadius: '6px', background: shift.bg, color: shift.clr, fontWeight: '700', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', width: '58px' },
                    onchange: async (e) => {
                        const newCode = e.target.value;
                        const newShiftObj = SHIFTS[newCode] || SHIFTS.OFF;
                        e.target.style.background = newShiftObj.bg;
                        e.target.style.color = newShiftObj.clr;
                        
                        _rosterDataCache[staff.id] = { ...(_rosterDataCache[staff.id] || {}), [key]: newCode };
                        await updateStaffShiftDatabase(staff.id, key, newCode);
                        
                        // We do not force total refresh to prevent heavy DOM thrashing, soft mutation mapped logic instead
                        openRosterViewSecure(); 
                    }
                }, Object.entries(SHIFTS).map(([k, meta]) => el('option', { value: k, textContent: meta.short, selected: code === k })));
                
                cellCollector.push(el('td', { style: { padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)' } }, [selectNode]));
            });

            // Append Badges conditionally into Bio
            const badgeWrap = el('div', { style: { fontSize: '10px', marginTop: '2px', display: 'flex', gap: '4px' } });
            if (nightCount > 1) badgeWrap.appendChild(el('span', { style: { background: 'var(--homeopathy-bg)', color: 'var(--homeopathy)', padding: '1px 5px', borderRadius: '6px' }, textContent: `🌙 ${nightCount}N` }));
            if (onCallCount > 0) badgeWrap.appendChild(el('span', { style: { background: 'var(--ayurveda-bg)', color: 'var(--ayurveda)', padding: '1px 5px', borderRadius: '6px' }, textContent: `📞 ${onCallCount}OC` }));
            if (badgeWrap.childNodes.length > 0) bioCell.appendChild(badgeWrap);
            
            // Apply iteration outputs
            cellCollector.forEach(c => tr.appendChild(c));

            // Status Badge
            const sts = staff.status || 'available';
            const cls = sts.includes('_') ? sts.split('_')[0] : 'custom';
            const fCls = sts.startsWith('on_') ? sts.split('_')[1] : cls;
            
            const formatStrLabel = (str) => (str || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            tr.appendChild(el('td', { style: { padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)' } }, [
                el('small', { className: `status-badge status-${fCls}`, style: { fontSize: '8.5px' }, textContent: formatStrLabel(sts) })
            ]));

            // Total Days
            tr.appendChild(el('td', { style: { padding: '6px 10px', textAlign: 'center', fontWeight: '700', borderBottom: '1px solid var(--border)', color: 'var(--teal)' }, textContent: `${workDays}/7` }));
            
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);

    // 4. Swap Box Area
    const swapHost = el('div', { id: 'swapRequests', style: { marginTop: '20px' } });

    container.append(legendRow, navRow, tableWrap, swapHost);
    
    // Mount Async Swap Render
    injectPendingSwapsDOM(swapHost);
};

// ─── Swaps Pipeline ──────────────────────────────────────────────

const injectPendingSwapsDOM = async (container) => {
    emptyNode(container);
    const data = await fetchPendingSwapRequests();
    if (!data.length) return;

    container.appendChild(el('div', { style: { fontSize: '13px', fontWeight: '700', marginBottom: '10px' }, textContent: `🔄 Pending Shift Swap Requests (${data.length})` }));

    data.forEach(req => {
        const requester = _staffList.find(s => s.id === req.requester_id);
        const target = _staffList.find(s => s.id === req.target_id);

        const card = el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } }, [
            el('div', { style: { flex: '1' } }, [
                el('div', { style: { fontSize: '13px', fontWeight: '600' }, textContent: `${requester?.name || req.requester_id} ↔ ${target?.name || req.target_id}` }),
                el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }, textContent: `${req.slot_key_a} ↔ ${req.slot_key_b}` }),
                ...(req.message ? [el('div', { style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }, textContent: `"${req.message}"` })] : [])
            ]),
            el('button', { className: 'btn-sm btn-teal', style: { fontSize: '12px' }, textContent: '✅ Approve', onClick: () => executeSwapActionSecure(req.id, true) }),
            el('button', { className: 'btn-sm btn-outline-red', style: { fontSize: '12px' }, textContent: '✕ Reject', onClick: () => executeSwapActionSecure(req.id, false) })
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
