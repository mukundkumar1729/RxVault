// ════════════════════════════════════════════════════════════
//  OPD VIEW CONTROLLER
//  Safely injects Reception Live-Boards and Vaccination / Follow-up Grids
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchOpdBoardMetrics, computePatientVaccineStatusState, VACCINE_SCHEDULE, fetchPaediatricRegistry, computeGlobalFollowupReminders, persistPrescriptionFollowupOverride } from '../services/opdService.js';

// ─── Token Display Board ───

export const openOpdBoardViewSecure = () => {
    store.currentView = 'opdBoard';
    hideAllViews();

    let v = document.getElementById('opdBoardView');
    if (!v) { 
        v = el('div', { id: 'opdBoardView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(v);
    }
    v.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navOpdBoard');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '📺 OPD Token Display Board';
    if (sub) sub.textContent = 'Real-time waiting-room display — open in a separate browser tab for the TV screen';
    if (addBtn) addBtn.style.display = 'none';

    renderOpdBoardContainerSecure(v);
};

const renderOpdBoardContainerSecure = (container) => {
    emptyNode(container);

    const metrics = fetchOpdBoardMetrics();
    const boardUrl = `${window.location.origin}${window.location.pathname}?opdboard=${store.activeClinicId}`;

    const tvBanner = el('div', { style: { background: 'linear-gradient(135deg,#0f2240 0%,#1a3a60 100%)', borderRadius: 'var(--radius-lg)', padding: '32px', marginBottom: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden' } }, [
        el('div', { style: { fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }, textContent: 'Now Serving' }),
        el('div', { id: 'opdBoardTokenDisplay', style: { fontFamily: '"DM Serif Display",serif', fontSize: '88px', fontWeight: '700', color: '#fff', lineHeight: '1' }, textContent: metrics.currentToken ? metrics.currentToken.token_no : '—' })
    ]);

    if (metrics.currentToken) {
        tvBanner.appendChild(el('div', { style: { fontSize: '18px', color: 'rgba(255,255,255,0.8)', marginTop: '8px' }, textContent: `${metrics.currentToken.patient_name}${metrics.currentToken.doctor_name ? ` · Dr. ${metrics.currentToken.doctor_name}` : ''}` }));
    } else {
        tvBanner.appendChild(el('div', { style: { fontSize: '16px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }, textContent: 'No patient currently in room' }));
    }

    tvBanner.appendChild(el('div', { style: { display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '24px' } }, [
        el('div', { style: { textAlign: 'center' } }, [
            el('div', { style: { fontSize: '28px', fontWeight: '700', color: '#fff' }, textContent: metrics.countWaiting }),
            el('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: 'Waiting' })
        ]),
        el('div', { style: { textAlign: 'center' } }, [
            el('div', { style: { fontSize: '28px', fontWeight: '700', color: '#4ade80' }, textContent: metrics.countDone }),
            el('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: 'Done today' })
        ])
    ]));

    const shareBox = el('div', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '16px' } }, [
        el('div', { style: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: '8px' }, textContent: '📺 Display Board URL — open on the waiting room TV' }),
        el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
            el('code', { style: { flex: '1', background: 'var(--bg)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: '12.5px', border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }, textContent: boardUrl }),
            el('button', { className: 'btn-sm btn-teal', textContent: '📋 Copy', onClick: () => { navigator.clipboard.writeText(boardUrl).then(() => { window.showToast('URL copied!', 'success'); }); } })
        ])
    ]);

    container.append(tvBanner, shareBox);
};

// ─── Vaccination Tracker ───

export const openVaccinationViewSecure = () => {
    store.currentView = 'vaccination';
    hideAllViews();

    let v = document.getElementById('vaccinationView');
    if (!v) { 
        v = el('div', { id: 'vaccinationView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(v);
    }
    v.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navVaccination');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '💉 Vaccination Tracker';
    if (sub) sub.textContent = 'Immunisation schedules, due dates and overdue alerts for paediatric patients';
    if (addBtn) addBtn.style.display = 'none';

    renderVaccinationGridSecure(v);
};

const renderVaccinationGridSecure = (container) => {
    emptyNode(container);

    const list = fetchPaediatricRegistry();
    let rOverdue = 0, rDueSoon = 0;
    
    // Compute stats map
    const mapped = list.map(p => {
        const meta = computePatientVaccineStatusState(p);
        if (meta.overdue > 0) rOverdue++;
        else if (meta.dueSoon > 0) rDueSoon++;
        return { patient: p, meta };
    });

    const statCard = (icon, val, lbl, bg, textClr) => el('div', { style: { background: bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '110px' } }, [
        el('div', { style: { fontSize: '22px' }, textContent: icon }),
        el('div', {}, [
            el('div', { style: { fontSize: '22px', fontWeight: '700', color: textClr, fontFamily: '"DM Serif Display",serif' }, textContent: val }),
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: lbl })
        ])
    ]);

    const statsRow = el('div', { style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } }, [
        statCard('👶', list.length, 'Paediatric Patients', 'var(--surface2)', 'var(--text-primary)'),
        statCard('📅', rDueSoon, 'Due This Month', 'var(--allopathy-bg)', 'var(--allopathy)'),
        statCard('🚨', rOverdue, 'Overdue Alert', 'var(--red-bg)', 'var(--red)')
    ]);

    const wrap = el('div', { id: 'vaccinationList' });
    
    if (!mapped.length) {
        wrap.appendChild(el('div', { style: { padding: '32px', textAlign: 'center', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '32px', marginBottom: '10px' }, textContent: '👶' }),
            document.createTextNode('No paediatric patients found. Register them with DOB under 14yrs.')
        ]));
    } else {
        mapped.forEach(item => {
            const m = item.meta;
            const p = item.patient;
            
            const cardBg = m.overdue > 0 ? 'var(--red-bg)' : m.dueSoon > 0 ? 'var(--allopathy-bg)' : 'var(--surface)';
            const bClr = m.overdue > 0 ? 'rgba(220,38,38,0.3)' : m.dueSoon > 0 ? 'rgba(56,189,248,0.3)' : 'var(--border)';
            
            const card = el('div', { style: { background: cardBg, border: `1px solid ${bClr}`, borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' } }, [
                el('div', { style: { flex: '1' } }, [
                    el('div', { style: { fontWeight: '700', fontSize: '14px' }, textContent: p.name }),
                    el('div', { style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' } }, [
                        document.createTextNode(`DOB: ${p.dob ? formatDate(p.dob) : '—'} · Age: ${p.age || '—'} `),
                        el('span', { style: { color: 'var(--teal)', fontWeight: '600', cursor: 'pointer' }, textContent: `💉 View Schedule`, onClick: () => window.openPatientVaccinationRecord && window.openPatientVaccinationRecord(p.name) })
                    ])
                ])
            ]);

            const rightBlock = el('div', { style: { textAlign: 'right' } });
            
            if (m.nextDue) {
                const isOver = m.nextDue.daysLeft < 0;
                rightBlock.appendChild(el('div', { style: { fontSize: '12px', fontWeight: '700', color: isOver ? 'var(--red)' : 'var(--text-primary)' } }, [
                    document.createTextNode(`${isOver ? '🚨 Overdue: ' : '⏳ Next: '} ${m.nextDue.name}`)
                ]));
                rightBlock.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }, textContent: `${isOver ? `${Math.abs(m.nextDue.daysLeft)}d ago` : `Due in ${m.nextDue.daysLeft}d`} — target ${formatDate(m.nextDue.targetDate.toISOString().split('T')[0])}` }));
            } else {
                rightBlock.appendChild(el('span', { style: { background: '#e8f5e9', color: 'var(--green)', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '10px' }, textContent: '✅ Up to date' }));
            }
            
            card.appendChild(rightBlock);
            wrap.appendChild(card);
        });
    }

    container.append(statsRow, wrap);
};

// ─── Follow-Up View ───

export const openFollowupViewSecure = () => {
    store.currentView = 'followup';
    hideAllViews();

    let v = document.getElementById('followupView');
    if (!v) { 
        v = el('div', { id: 'followupView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(v);
    }
    v.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navFollowup');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '📅 Follow-up Reminders';
    if (sub) sub.textContent = 'Manage upcoming patient visits and send automated follow-up SMS/Email notifications';
    if (addBtn) addBtn.style.display = 'none';

    renderFollowupGridWrapper(v);
};

const renderFollowupGridWrapper = (container) => {
    emptyNode(container);

    const ov = computeGlobalFollowupReminders('overdue');
    const td = computeGlobalFollowupReminders('today');
    const wk = computeGlobalFollowupReminders('week');
    const up = computeGlobalFollowupReminders('upcoming');

    const total = ov.length + td.length + wk.length + up.length;

    const statCard = (icon, val, lbl, bg, textClr) => el('div', { style: { background: bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '110px' } }, [
        el('div', { style: { fontSize: '22px' }, textContent: icon }),
        el('div', {}, [
            el('div', { style: { fontSize: '22px', fontWeight: '700', color: textClr, fontFamily: '"DM Serif Display",serif' }, textContent: val }),
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: lbl })
        ])
    ]);

    container.appendChild(el('div', { style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } }, [
        statCard('🚨', ov.length, 'Overdue', 'var(--red-bg)', 'var(--red)'),
        statCard('⚠️', td.length, 'Due Today', 'var(--ayurveda-bg)', 'var(--ayurveda)'),
        statCard('🔵', wk.length, 'This Week', 'var(--allopathy-bg)', 'var(--allopathy)'),
        statCard('📅', up.length, 'Upcoming', 'var(--surface2)', 'var(--text-primary)')
    ]));

    if (total === 0) {
        container.appendChild(el('div', { style: { padding: '32px', textAlign: 'center', color: 'var(--text-muted)' } }, [
            document.createTextNode('No active prescriptions with follow-up reminders.')
        ]));
        return;
    }

    const mkGroup = (title, items, clrCode) => {
        if (!items.length) return null;
        
        const palMap = {
            red: { bg: 'var(--red-bg)', clr: 'var(--red)', icn: '🚨' },
            amber: { bg: 'var(--ayurveda-bg)', clr: 'var(--ayurveda)', icn: '⚠️' },
            blue: { bg: 'var(--allopathy-bg)', clr: 'var(--allopathy)', icn: '🔵' },
            gray: { bg: 'var(--surface2)', clr: 'var(--text-muted)', icn: '⚪' }
        };
        const pMap = palMap[clrCode] || palMap.gray;

        const groupNode = el('div', {}, [
            el('div', { style: { fontSize: '13px', fontWeight: '700', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }, textContent: `${pMap.icn} ${title} (${items.length})` })
        ]);

        items.forEach(r => {
            const rx = r.rx;
            const lblText = Math.abs(r.daysLeft) === r.daysLeft 
                ? (r.daysLeft === 0 ? 'Due TODAY' : `Due in ${r.daysLeft} days — ${formatDate(r.followupDate.toISOString().split('T')[0])}`) 
                : `${Math.abs(r.daysLeft)} days overdue`;

            const btnNotify = (rx.email || rx.phone) 
                ? el('button', { style: { fontSize: '11px', padding: '4px 10px', border: '1px solid var(--teal)', borderRadius: '6px', background: 'transparent', color: 'var(--teal)', cursor: 'pointer' }, textContent: '📧 Notify', onClick: () => window.sendFollowupReminder && window.sendFollowupReminder(rx.id) }) 
                : null;

            groupNode.appendChild(el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } }, [
                el('div', { style: { flex: '1' } }, [
                    el('div', { style: { fontWeight: '600', fontSize: '13.5px' }, textContent: rx.patientName }),
                    el('div', { style: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }, textContent: `🩺 Dr. ${rx.doctorName || '—'} · 🔬 ${rx.diagnosis || '—'}` }),
                    el('div', { style: { fontSize: '12px', marginTop: '3px', color: pMap.clr, fontWeight: '600' }, textContent: lblText })
                ]),
                el('div', { style: { display: 'flex', gap: '6px' } }, [
                    el('button', { style: { fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, textContent: '📅 Reschedule', onClick: () => injectFollowupDateModal(rx.id) }),
                    ...(btnNotify ? [btnNotify] : [])
                ])
            ]));
        });

        return groupNode;
    };

    [
        {t: 'Overdue', d: ov, c: 'red'},
        {t: 'Due Today', d: td, c: 'amber'},
        {t: 'Due This Week', d: wk, c: 'blue'},
        {t: 'Upcoming', d: up, c: 'gray'}
    ].forEach(spec => {
        const node = mkGroup(spec.t, spec.d, spec.c);
        if (node) container.appendChild(node);
    });
};

const injectFollowupDateModal = (rxId) => {
    const rx = (store.prescriptions || []).find(r => r.id === rxId);
    if (!rx) return;

    let overlay = document.getElementById('followupDateOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'followupDateOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const applyAction = async () => {
        const payload = document.getElementById('followupDateInput')?.value || '';
        const ok = await persistPrescriptionFollowupOverride(rxId, payload);
        if (ok) {
            window.closeOverlay('followupDateOverlay');
            window.showToast('📅 Follow-up date re-scheduled.', 'success');
            openFollowupViewSecure(); // Soft reload
        }
    };

    const qSet = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' } });
    [7, 14, 30, 60, 90].forEach(d => {
        const dt = new Date(Date.now() + d * 86400000).toISOString().split('T')[0];
        qSet.appendChild(el('button', { 
            style: { fontSize: '12px', padding: '5px 12px', border: '1px solid var(--border)', borderRadius: '20px', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' },
            textContent: `+${d}d`,
            onClick: () => { const inp = document.getElementById('followupDateInput'); if (inp) inp.value = dt; }
        }));
    });

    const modal = el('div', { className: 'modal', style: { maxWidth: '380px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '📅 Set Follow-up Date' }),
                el('div', { className: 'modal-subtitle', textContent: rx.patientName })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('followupDateOverlay') })
        ]),
        el('div', { className: 'modal-body' }, [
            el('div', { className: 'field' }, [
                el('label', { textContent: 'Follow-up Date' }),
                el('input', { id: 'followupDateInput', type: 'date', attributes: { value: rx.followupDate || '' } })
            ]),
            el('div', { className: 'field', style: { marginTop: '10px' } }, [
                el('label', { textContent: 'Quick set' }),
                qSet
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onClick: () => window.closeOverlay('followupDateOverlay') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '💾 Save', onClick: applyAction })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

// ── Bridge to Global routing handlers (Phase 6 legacy bridging) ──
window.showOpdBoardView = openOpdBoardViewSecure;
window.showVaccinationView = openVaccinationViewSecure;
window.showFollowupView = openFollowupViewSecure;
window.setFollowupDate = injectFollowupDateModal;
