// ════════════════════════════════════════════════════════════
//  LAB VIEW CONTROLLER
//  Safely injects Lab Order Grids, Upload forms, and AI result wrappers
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchLabOrdersDatabase, persistLabOrder, deleteLabOrderDatabase, COMMON_LAB_TESTS, invokeAiLabInterpretation, invokeAiSmartParse } from '../services/labService.js';

let _activeLabOrders = [];

export const openLabOrdersViewSecure = async () => {
    store.currentView = 'labOrders';
    hideAllViews();

    let lv = document.getElementById('labOrdersView');
    if (!lv) { 
        lv = el('div', { id: 'labOrdersView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(lv);
    }
    lv.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navLabOrders');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '🔬 Lab Orders & Results';
    if (sub) sub.textContent = 'Send investigation orders, upload results, attach external lab reports';
    if (addBtn) addBtn.style.display = 'none';

    _activeLabOrders = await fetchLabOrdersDatabase();
    renderLabViewSecure(lv);
};

const renderLabViewSecure = (container) => {
    emptyNode(container);

    const pending = _activeLabOrders.filter(o => o.status === 'ordered').length;
    const received = _activeLabOrders.filter(o => o.status === 'received').length;
    const reviewed = _activeLabOrders.filter(o => o.status === 'reviewed').length;

    // 1. Stats Row
    const statCardBuilder = (icon, val, lbl, bg, textClr) => el('div', { style: { background: bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '110px' } }, [
        el('div', { style: { fontSize: '22px' }, textContent: icon }),
        el('div', {}, [
            el('div', { style: { fontSize: '22px', fontWeight: '700', color: textClr, fontFamily: '"DM Serif Display",serif' }, textContent: val }),
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: lbl })
        ])
    ]);

    const statsRow = el('div', { style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } }, [
        statCardBuilder('🔬', _activeLabOrders.length, 'Total Orders', 'var(--surface2)', 'var(--text-primary)'),
        statCardBuilder('⏳', pending, 'Awaiting Results', 'var(--allopathy-bg)', 'var(--allopathy)'),
        statCardBuilder('📥', received, 'Results In', 'var(--ayurveda-bg)', 'var(--ayurveda)'),
        statCardBuilder('✅', reviewed, 'Reviewed', '#e8f5e9', 'var(--green)')
    ]);

    // 2. Controls Row
    const controlsRow = el('div', { style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' } }, [
        el('input', { id: 'labSearch', type: 'text', attributes: { placeholder: '🔍 Search patient, test, doctor…' }, style: { flex: '1', minWidth: '200px', padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif' }, oninput: triggerLabFilter }),
        el('select', { id: 'labStatusFilter', style: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)' }, onchange: triggerLabFilter }, [
            el('option', { value: 'all', textContent: 'All Status' }),
            el('option', { value: 'ordered', textContent: '⏳ Awaiting Results' }),
            el('option', { value: 'received', textContent: '📥 Results In' }),
            el('option', { value: 'reviewed', textContent: '✅ Reviewed' }),
            el('option', { value: 'external', textContent: '📎 External / Outside' })
        ]),
        el('button', { className: 'btn-add', style: { padding: '9px 16px', fontSize: '13px', whiteSpace: 'nowrap' }, textContent: '🔬 New Order', onClick: () => openNewLabOrderSecure() }),
        el('button', { className: 'btn-sm btn-outline-teal', style: { whiteSpace: 'nowrap', fontSize: '13px', padding: '9px 16px' }, textContent: '📎 Attach External', onClick: openExternalResultSecure })
    ]);

    const listWrap = el('div', { id: 'labOrdersList' });

    container.append(statsRow, controlsRow, listWrap);
    triggerLabFilter();
};

const triggerLabFilter = () => {
    const q = (document.getElementById('labSearch')?.value || '').toLowerCase().trim();
    const status = document.getElementById('labStatusFilter')?.value || 'all';

    const list = _activeLabOrders.filter(o => {
        if (status !== 'all' && o.status !== status) return false;
        if (q) return [(o.patient_name||''), (o.test_name||''), (o.doctor_name||''), (o.lab_name||'')].join(' ').toLowerCase().includes(q);
        return true;
    });

    const wrap = document.getElementById('labOrdersList');
    if (!wrap) return;
    
    emptyNode(wrap);

    if (!list.length) {
        wrap.appendChild(el('div', { style: { padding: '32px', textAlign: 'center', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '32px', marginBottom: '10px' }, textContent: '🔬' }),
            document.createTextNode('No lab orders found.')
        ]));
        return;
    }

    const scMap = {
        ordered:  { bg: 'var(--allopathy-bg)', clr: 'var(--allopathy)', lbl: '⏳ Awaiting' },
        received: { bg: 'var(--ayurveda-bg)',  clr: 'var(--ayurveda)',  lbl: '📥 Results In' },
        reviewed: { bg: '#e8f5e9',             clr: 'var(--green)',     lbl: '✅ Reviewed' },
        external: { bg: 'var(--teal-pale)',    clr: 'var(--teal)',      lbl: '📎 External' }
    };

    list.forEach(order => {
        const sc = scMap[order.status] || scMap.ordered;
        const hasResult = !!(order.result_text || order.result_file_url);
        const daysSince = Math.floor((Date.now() - new Date(order.ordered_on)) / 86400000);
        const urgent = order.status === 'ordered' && daysSince > 2;

        const card = el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '10px', overflow: 'hidden', borderLeft: urgent ? '3px solid var(--red)' : '' } }, [
            // Header Row
            el('div', { style: { padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' } }, [
                el('div', { style: { flex: '1', minWidth: '0' } }, [
                    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
                        el('span', { style: { fontWeight: '700', fontSize: '14px' }, textContent: order.patient_name || '—' }),
                        el('span', { style: { background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }, textContent: order.test_name || '—' }),
                        ...(order.external ? [el('span', { style: { background: 'var(--teal-pale)', color: 'var(--teal)', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }, textContent: '📎 External Lab' })] : [])
                    ]),
                    el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
                        ...(order.doctor_name ? [el('span', { textContent: `🩺 Dr. ${order.doctor_name}` })] : []),
                        el('span', { textContent: `📅 ${formatDate((order.ordered_on||'').split('T')[0])}` }),
                        ...(order.lab_name ? [el('span', { textContent: `🏥 ${order.lab_name}` })] : []),
                        ...(urgent ? [el('span', { style: { color: 'var(--red)', fontWeight: '600' }, textContent: `⚠️ ${daysSince} days, no result` })] : [])
                    ]),
                    ...(order.clinical_notes ? [el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }, textContent: order.clinical_notes })] : [])
                ]),
                el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: '0' } }, [
                    el('span', { style: { background: sc.bg, color: sc.clr, fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '10px' }, textContent: sc.lbl })
                ])
            ])
        ]);

        // Result Segment Native Render
        if (hasResult) {
            const resultBody = el('div', { style: { padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' } }, [
                el('div', { style: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '6px' }, textContent: 'Result' }),
                ...(order.result_text ? [el('div', { style: { fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }, textContent: order.result_text })] : []),
                ...(order.result_file_url ? [el('a', { attributes: { href: order.result_file_url, target: '_blank' }, style: { fontSize: '12px', color: 'var(--teal)' }, textContent: '📄 View attached report' })] : [])
            ]);

            if (order.ai_interpretation) {
                resultBody.appendChild(el('div', { style: { marginTop: '10px', background: 'var(--teal-pale)', borderLeft: '3px solid var(--teal)', padding: '10px 14px', borderRadius: '4px', fontSize: '12.5px' } }, [
                    el('div', { style: { fontWeight: '700', color: 'var(--teal)', marginBottom: '4px' }, textContent: '🤖 AI Interpretation' }),
                    el('div', { textContent: order.ai_interpretation })
                ]));
            }
            card.appendChild(resultBody);
        }

        // Action Buttons Row Segment Native Render
        const actionRowContent = [];
        if (order.status === 'ordered') {
            actionRowContent.push(el('button', { className: 'btn-sm btn-teal', style: { fontSize: '12px' }, textContent: '📥 Upload Result', onClick: () => openUploadResultSecure(order.id) }));
        }
        if (hasResult && order.status !== 'reviewed') {
            actionRowContent.push(el('button', { className: 'btn-sm btn-outline-teal', style: { fontSize: '12px' }, textContent: '✅ Mark Reviewed', onClick: () => triggerMarkReviewedState(order.id) }));
        }
        if (hasResult && !order.ai_interpretation) {
            actionRowContent.push(el('button', { className: 'btn-sm', style: { fontSize: '12px', border: '1px solid var(--homeopathy)', color: 'var(--homeopathy)', background: 'transparent', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }, textContent: '🤖 AI Interpret', onClick: () => triggerAiInterpretationSecure(order.id) }));
        }

        actionRowContent.push(el('button', { style: { fontSize: '12px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, textContent: '🗑️', onClick: () => triggerLabOrderDelete(order.id) }));
        
        card.appendChild(el('div', { style: { padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' } }, actionRowContent));
        
        wrap.appendChild(card);
    });
};

// ─── Modals and Flow Injections ──────────────────────────────────────

const openNewLabOrderSecure = (patientNameFromNavArg) => {
    let overlay = document.getElementById('labOrderOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'labOrderOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const dsPat = window.patientRegistry || [];
    const dsDoc = window.doctorRegistry || [];

    const saveAction = async () => {
        const patient = document.getElementById('loPatient')?.value?.trim();
        const test = document.getElementById('loTest')?.value?.trim();
        const doctor = document.getElementById('loDoctor')?.value || '';
        const lab = document.getElementById('loLab')?.value?.trim();
        const urgency = document.getElementById('loUrgency')?.value || 'routine';
        const notes = document.getElementById('loNotes')?.value?.trim();
        const external = !!document.getElementById('loExternal')?.checked;

        if (!patient || !test) { window.showToast('Patient and test name are required.', 'error'); return; }

        const payload = {
            id: 'lab_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
            clinic_id: store.activeClinicId,
            patient_name: patient,
            test_name: test,
            doctor_name: doctor,
            lab_name: lab,
            urgency,
            clinical_notes: notes,
            external,
            status: external ? 'received' : 'ordered',
            ordered_on: new Date().toISOString()
        };

        const ok = await persistLabOrder(payload);
        if (ok) {
            _activeLabOrders.unshift(payload);
            window.closeOverlay('labOrderOverlay');
            window.showToast(`🔬 Lab order created for ${patient}`, 'success');
            openLabOrdersViewSecure(); // Reload DOM state securely
        } else window.showToast('Failed to save order.', 'error');
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '560px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', id: 'loDynamicTitle', textContent: '🔬 New Lab Order' }),
                el('div', { className: 'modal-subtitle', id: 'loDynamicSub', textContent: 'Send investigation order — internal lab or outside lab' })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('labOrderOverlay') })
        ]),
        el('div', { className: 'modal-body' }, [
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', {}, [document.createTextNode('Patient '), el('span', { textContent: '*' })]),
                    el('input', { id: 'loPatient', type: 'text', attributes: { list: 'loPats', placeholder: 'Patient name', value: patientNameFromNavArg || '' } }),
                    el('datalist', { id: 'loPats' }, dsPat.map(p => el('option', { value: p.name })))
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Ordering Doctor' }),
                    el('select', { id: 'loDoctor' }, [
                        el('option', { value: '', textContent: '— Select —' }),
                        ...dsDoc.map(d => el('option', { value: d.name, textContent: `Dr. ${d.name}` }))
                    ])
                ])
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', {}, [document.createTextNode('Investigation / Test '), el('span', { textContent: '*' })]),
                el('input', { id: 'loTest', type: 'text', attributes: { list: 'loTests', placeholder: 'e.g. CBC, LFT, Chest X-Ray' } }),
                el('datalist', { id: 'loTests' }, COMMON_LAB_TESTS.map(t => el('option', { value: t })))
            ]),
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Lab / Centre' }),
                    el('input', { id: 'loLab', type: 'text', attributes: { placeholder: 'e.g. Dr. Lal PathLabs, SRL, Internal' } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Urgency' }),
                    el('select', { id: 'loUrgency' }, [ el('option', { value: 'routine', textContent: 'Routine' }), el('option', { value: 'urgent', textContent: 'Urgent (24h)' }), el('option', { value: 'stat', textContent: 'STAT (immediate)' }) ])
                ])
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Clinical Notes / Indication' }),
                el('textarea', { id: 'loNotes', attributes: { rows: '2', placeholder: 'e.g. Fever for 5 days, suspect dengue. Check NS1 and CBC.' }, style: { resize: 'vertical' } })
            ]),
            el('div', { className: 'field', style: { marginBottom: '0' } }, [
                el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } }, [
                    el('input', { id: 'loExternal', type: 'checkbox' }),
                    el('span', {}, [document.createTextNode('Test done at '), el('strong', { textContent: 'outside / external' }), document.createTextNode(' lab (not ordered by this clinic)')])
                ])
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onClick: () => window.closeOverlay('labOrderOverlay') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '🔬 Send Order', onClick: saveAction })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

const openExternalResultSecure = () => {
    openNewLabOrderSecure();
    setTimeout(() => {
        const cb = document.getElementById('loExternal');
        if (cb) cb.checked = true;
        const title = document.getElementById('loDynamicTitle');
        if (title) title.textContent = '📎 Attach External Lab Result';
        const sub = document.getElementById('loDynamicSub');
        if (sub) sub.textContent = 'Record a test done outside this clinic — attaches to patient record';
    }, 50);
};

// ── Dropzone Handlers ──
let _lrCacheBase64 = null, _lrCacheMime = null;
const loadLabUploadFile = (file) => {
    if (file.size > 10 * 1024 * 1024) { window.showToast('File too large. Max 10MB.', 'error'); return; }
    _lrCacheMime = file.type;
    const r = new FileReader();
    r.onload = (e) => {
        _lrCacheBase64 = e.target.result;
        const info = document.getElementById('lrFileInfo');
        if (info) info.textContent = `✅ ${file.name} (${Math.round(file.size/1024)} KB) attached`;
    };
    r.readAsDataURL(file);
};

const openUploadResultSecure = (orderId) => {
    const order = _activeLabOrders.find(o => o.id === orderId);
    if (!order) return;

    let overlay = document.getElementById('labResultOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'labResultOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const applyAction = async () => {
        const text = document.getElementById('lrResultText')?.value?.trim();
        const labNotes = document.getElementById('lrLabNotes')?.value?.trim();
        if (!text && !_lrCacheBase64) {
            const err = document.getElementById('lrError');
            if (err) err.textContent = 'Enter result values or attach a file.';
            return;
        }

        order.result_text = text;
        order.result_file_b64 = _lrCacheBase64 || null;
        order.result_file_mime = _lrCacheMime || null;
        order.result_lab_notes = labNotes;
        order.received_on = new Date().toISOString();
        order.status = 'received';
        
        _lrCacheBase64 = null; _lrCacheMime = null;

        const ok = await persistLabOrder(order);
        if (ok) {
            window.closeOverlay('labResultOverlay');
            window.showToast(`📥 Result saved for ${order.patient_name}`, 'success');
            openLabOrdersViewSecure();
        } else window.showToast('Failed to save result.', 'error');
    };

    const smartParseAction = async () => {
        const text = document.getElementById('lrResultText')?.value || '';
        if (!text && !_lrCacheBase64) { window.showToast('Please paste report text or attach a file first.', 'error'); return; }
        
        const loader = document.getElementById('smartParseLoader');
        if (loader) loader.style.display = 'block';

        try {
            const parsed = await invokeAiSmartParse(text, !!_lrCacheBase64);
            if (parsed) {
                document.getElementById('lrResultText').value = parsed;
                window.showToast('✨ Smart Parse successful!', 'success');
            }
        } catch (e) {
            console.error(e);
            window.showToast('AI Parsing failed. Please enter manually.', 'error');
        } finally {
            if (loader) loader.style.display = 'none';
        }
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '560px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '📥 Upload Lab Result' }),
                el('div', { className: 'modal-subtitle', textContent: `${order.patient_name} · ${order.test_name}` })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('labResultOverlay') })
        ]),
        el('div', { className: 'modal-body' }, [
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Paste Result Values' }),
                el('textarea', { id: 'lrResultText', attributes: { rows: '6', placeholder: 'Paste lab report values here:\ne.g. Hemoglobin: 10.2 g/dL\nWBC: 11,500 /µL\nPlatelets: 420,000 /µL' }, style: { resize: 'vertical', minHeight: '140px' } })
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Or Upload PDF / Image' }),
                el('div', { 
                    id: 'lrDropZone', 
                    style: { border: '2px dashed var(--border2)', borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center', cursor: 'pointer' },
                    attributes: { tabindex: "0" }, 
                    onClick: () => { document.getElementById('lrFile')?.click(); },
                    ondragover: (e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--teal)'; },
                    ondragleave: (e) => { e.currentTarget.style.borderColor = ''; },
                    ondrop: (e) => { e.preventDefault(); e.currentTarget.style.borderColor = ''; const file = e.dataTransfer.files[0]; if (file) loadLabUploadFile(file); }
                }, [
                    el('div', { style: { fontSize: '24px', marginBottom: '6px' }, textContent: '📄' }),
                    el('div', { style: { fontSize: '13px', color: 'var(--text-muted)' }, textContent: 'Click or drag PDF/image here' })
                ]),
                el('input', { id: 'lrFile', type: 'file', attributes: { accept: '.pdf,.jpg,.jpeg,.png,.webp' }, style: { display: 'none' }, onchange: (e) => { const file = e.target.files[0]; if (file) loadLabUploadFile(file); } }),
                el('div', { id: 'lrFileInfo', style: { fontSize: '12px', color: 'var(--teal)', marginTop: '6px' } })
            ]),
            el('div', { className: 'field', style: { marginBottom: '0' } }, [
                el('label', { textContent: 'Lab / Reference Range Notes' }),
                el('input', { id: 'lrLabNotes', type: 'text', attributes: { placeholder: 'e.g. Values from Dr. Lal PathLabs, report date 18 Mar 2026' } })
            ]),
            el('div', { id: 'lrError', style: { color: 'var(--red)', fontSize: '12.5px', minHeight: '16px', marginTop: '8px' } }),
            el('div', { id: 'smartParseLoader', style: { display: 'none', marginTop: '10px', padding: '10px', background: 'var(--teal-pale)', borderRadius: '8px', fontSize: '12px', color: 'var(--teal)' }, textContent: '✨ AI is parsing your report... Please wait.' })
        ]),
        el('div', { className: 'modal-footer', style: { justifyContent: 'space-between' } }, [
            el('button', { className: 'btn-sm', style: { background: 'var(--indigo)', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }, textContent: '✨ Smart Parse (AI)', onClick: smartParseAction }),
            el('div', {}, [
                el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onClick: () => window.closeOverlay('labResultOverlay') }),
                el('button', { className: 'btn-sm btn-teal', style: { marginLeft: '8px' }, textContent: '💾 Save Result', onClick: applyAction })
            ])
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

const triggerMarkReviewedState = async (orderId) => {
    const order = _activeLabOrders.find(o => o.id === orderId);
    if (!order) return;
    order.status = 'reviewed';
    order.reviewed_on = new Date().toISOString();
    
    await persistLabOrder(order);
    window.showToast('✅ Marked as reviewed', 'success');
    openLabOrdersViewSecure();
};

const triggerLabOrderDelete = async (orderId) => {
    if (!confirm('Delete this lab order?')) return;
    const ok = await deleteLabOrderDatabase(orderId);
    if (ok) {
        _activeLabOrders = _activeLabOrders.filter(o => o.id !== orderId);
        window.showToast('Deleted.', 'info');
        openLabOrdersViewSecure();
    }
};

const triggerAiInterpretationSecure = async (orderId) => {
    const order = _activeLabOrders.find(o => o.id === orderId);
    if (!order) return;
    if (!order.result_text) { window.showToast('No text result to interpret. Paste values first.', 'error'); return; }
    
    window.showToast('🤖 Running AI interpretation…', 'info');
    try {
        const payload = await invokeAiLabInterpretation(order);
        order.ai_interpretation = payload;
        await persistLabOrder(order);
        
        window.showToast('🤖 AI interpretation complete', 'success');
        openLabOrdersViewSecure();
    } catch (e) {
        window.showToast(`AI interpretation failed: ${e.message}`, 'error');
    }
};

// ── Bridge to Global Memory Namespace mapping (Phase 6 legacy bridging) ──
window.showLabOrdersView = openLabOrdersViewSecure;
window.openNewLabOrderSecure = openNewLabOrderSecure;
