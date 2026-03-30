// ════════════════════════════════════════════════════════════
//  STOCK VIEW CONTROLLER
//  Safely injects Inventory Dashboards and Pharmacy Control Modals
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, escapeHtml, hideAllViews } from '../utils/dom.js';
import { fetchStockDatabase, persistStockItem, removeStockItem, aggregateActivePrescriptionNames, fuzzyStockNameEvaluate } from '../services/stockService.js';

let _activeStockItems = [];

// Helper Date function
const formatStockDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

export const openStockViewSecure = async () => {
    store.currentView = 'stock';
    hideAllViews();
    
    let sv = document.getElementById('stockView');
    if (!sv) { 
        sv = el('div', { id: 'stockView' });
        const mainNode = document.querySelector('.main');
        if (mainNode) mainNode.appendChild(sv);
    }
    sv.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navStock');
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '📦 Stock & Inventory';
    if (sub) sub.textContent = 'Track medicine stock levels and get low-stock alerts';
    if (addBtn) addBtn.style.display = 'none';

    _activeStockItems = await fetchStockDatabase();
    renderStockInterface(sv);
};

const renderStockInterface = (container) => {
    emptyNode(container);

    const lowStock = _activeStockItems.filter(i => i.quantity <= i.min_quantity && i.quantity > 0);
    const outOfStock = _activeStockItems.filter(i => i.quantity === 0);
    const totalItems = _activeStockItems.length;
    const totalValue = _activeStockItems.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unit_price || 0)), 0);

    const prescribedNames = aggregateActivePrescriptionNames();
    const prescMissing = prescribedNames.filter(name => !_activeStockItems.some(s => fuzzyStockNameEvaluate(s.name, name)));
    const prescLow = _activeStockItems.filter(s => s.quantity > 0 && s.quantity <= s.min_quantity && prescribedNames.some(n => fuzzyStockNameEvaluate(s.name, n)));

    // 1. Controls Row
    const controlsRow = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' } });
    
    const searchWrapper = el('div', { style: { position: 'relative', flex: 1, minWidth: '200px' } }, [
        el('span', { style: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }, textContent: '🔍' }),
        el('input', { 
            id: 'stockSearch', 
            type: 'text', 
            placeholder: 'Search medicine…',
            style: { width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', boxSizing: 'border-box' },
            oninput: triggerStockFilter
        })
    ]);

    const filterType = el('select', { 
        id: 'stockFilter',
        style: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)' },
        onchange: triggerStockFilter
    }, [
        el('option', { value: 'all', textContent: 'All Items' }),
        el('option', { value: 'low', textContent: '⚠️ Low Stock' }),
        el('option', { value: 'out', textContent: '🔴 Out of Stock' }),
        el('option', { value: 'ok', textContent: '✅ In Stock' }),
        el('option', { value: 'prescribed_missing', textContent: '🚫 Prescribed — Not in Stock' }),
        el('option', { value: 'prescribed_low', textContent: '📉 Prescribed — Low in Stock' })
    ]);

    const filterExpiry = el('select', { 
        id: 'stockExpiryFilter',
        style: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)' },
        onchange: triggerStockFilter
    }, [
        el('option', { value: 'valid', textContent: '✅ Valid (Non-Expired)' }),
        el('option', { value: 'soon', textContent: '⚠️ Expiring Soon (<30d)' }),
        el('option', { value: 'expired', textContent: '🔴 Expired' }),
        el('option', { value: 'all_inc_expired', textContent: '📦 Include Expired' })
    ]);

    const btnAddStock = el('button', { className: 'btn-add', style: { padding: '9px 16px', fontSize: '13px', whiteSpace: 'nowrap' }, onClick: () => openAddStockItemSecure(null), textContent: '＋ Add Item' });

    controlsRow.append(searchWrapper, filterType, filterExpiry, btnAddStock);

    // 2. Stats Block
    const generateStatCard = (icon, val, lbl, bg, textClr) => el('div', { style: { background: bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '110px' } }, [
        el('div', { style: { fontSize: '22px' }, textContent: icon }),
        el('div', {}, [
            el('div', { style: { fontSize: '20px', fontWeight: '700', color: textClr, fontFamily: '"DM Serif Display",serif' }, textContent: val }),
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.06em' }, textContent: lbl })
        ])
    ]);

    const statsRow = el('div', { style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } }, [
        generateStatCard('📦', totalItems, 'Total Items', 'var(--surface2)', 'var(--text-primary)'),
        generateStatCard('⚠️', lowStock.length, 'Low Stock', 'var(--ayurveda-bg)', 'var(--ayurveda)'),
        generateStatCard('🔴', outOfStock.length, 'Out of Stock', 'var(--red-bg)', 'var(--red)'),
        generateStatCard('💰', '₹' + totalValue.toLocaleString('en-IN'), 'Stock Value', 'var(--teal-pale)', 'var(--teal)'),
        generateStatCard('🚫', prescMissing.length, 'Prescribed Missing', 'var(--red-bg)', 'var(--red)'),
        generateStatCard('📉', prescLow.length, 'Prescribed Low', 'var(--ayurveda-bg)', 'var(--ayurveda)')
    ]);

    // 3. Low Stock Alert Banner
    let alertBanner = null;
    if (lowStock.length > 0) {
        alertBanner = el('div', { style: { background: 'var(--ayurveda-bg)', border: '1px solid rgba(180,83,9,0.3)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
            el('span', { style: { fontSize: '18px' }, textContent: '⚠️' }),
            el('div', { style: { fontSize: '13px', color: 'var(--ayurveda)' } }, [
                el('strong', { textContent: `${lowStock.length} item(s) ` }),
                document.createTextNode('are running low: '),
                el('span', { style: { fontWeight: '600' }, textContent: lowStock.slice(0, 5).map(i => `${i.name} (${i.quantity} left)`).join(', ') + (lowStock.length > 5 ? ' +more' : '') })
            ])
        ]);
    }

    // 4. Content Area
    const tableWrap = el('div', { id: 'stockTableWrap' });

    container.append(controlsRow, statsRow);
    if (alertBanner) container.appendChild(alertBanner);
    container.appendChild(tableWrap);

    // Initial table render
    triggerStockFilter();
};

const triggerStockFilter = () => {
    const q = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();
    const fil = document.getElementById('stockFilter')?.value || 'all';
    const exp = document.getElementById('stockExpiryFilter')?.value || 'valid';

    const prescribedNames = aggregateActivePrescriptionNames();
    const today = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    let list = [];

    if (fil === 'prescribed_missing') {
        const inStockPrescribed = _activeStockItems.filter(i => i.quantity === 0 && prescribedNames.some(n => fuzzyStockNameEvaluate(i.name, n)));
        const missingNames = prescribedNames.filter(name => !_activeStockItems.some(s => fuzzyStockNameEvaluate(s.name, name)));
        
        const virtualMissing = missingNames.map(name => ({ id: '__missing__' + name, name, quantity: 0, min_quantity: 0, category: '—', unit: '—', unit_price: 0, expiry_date: null, _virtual: true }));
        list = inStockPrescribed.concat(virtualMissing);
    } else if (fil === 'prescribed_low') {
        list = _activeStockItems.filter(i => i.quantity > 0 && i.quantity <= i.min_quantity && prescribedNames.some(n => fuzzyStockNameEvaluate(i.name, n)));
    } else {
        list = _activeStockItems.filter(i => {
            if (fil === 'low') return i.quantity > 0 && i.quantity <= i.min_quantity;
            if (fil === 'out') return i.quantity === 0;
            if (fil === 'ok')  return i.quantity > i.min_quantity;
            return true;
        });
    }

    list = list.filter(i => {
        if (!i.expiry_date) return (exp !== 'expired' && exp !== 'soon'); 
        const expDate = new Date(i.expiry_date);
        const isExpired = expDate < today;
        const isSoon = !isExpired && (expDate - today) < thirtyDays;

        if (exp === 'valid') return !isExpired;
        if (exp === 'soon') return isSoon;
        if (exp === 'expired') return isExpired;
        if (exp === 'all_inc_expired') return true;
        return !isExpired;
    });

    if (q) {
        list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
    }

    const wrap = document.getElementById('stockTableWrap');
    if (!wrap) return;
    
    emptyNode(wrap);
    wrap.appendChild(buildStockGridDOM(list, fil, prescribedNames));
};

const buildStockGridDOM = (items, filterType = 'all', prescribedNames = []) => {
    if (!items.length) {
        const isContext = (filterType === 'prescribed_missing' || filterType === 'prescribed_low');
        if (isContext) {
            return el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center' } }, [
                el('div', { style: { fontSize: '36px', marginBottom: '10px' }, textContent: '✅' }),
                el('div', { style: { fontWeight: '600', color: 'var(--text-secondary)', fontSize: '14px' }, textContent: filterType === 'prescribed_missing' ? 'All prescribed medicines are available in stock. ✅' : 'No prescribed medicines are running low. ✅' })
            ]);
        }
        return el('div', { className: 'empty-state' }, [
            el('div', { className: 'empty-icon', textContent: '📦' }),
            el('div', { className: 'empty-title', textContent: 'No items in inventory' }),
            el('div', { className: 'empty-sub', textContent: 'Click "+ Add Item" to add medicines to stock.' })
        ]);
    }

    const container = el('div');
    
    // Add banner if showing context filter
    if (filterType === 'prescribed_missing' || filterType === 'prescribed_low') {
        const isMissing = filterType === 'prescribed_missing';
        container.appendChild(el('div', { style: { background: isMissing ? 'var(--red-bg)' : 'var(--ayurveda-bg)', border: `1px solid ${isMissing ? 'rgba(220,38,38,0.3)' : 'rgba(180,83,9,0.3)'}`, borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
            el('span', { style: { fontSize: '20px' }, textContent: isMissing ? '🚫' : '📉' }),
            el('div', { style: { fontSize: '13px', color: isMissing ? 'var(--red)' : 'var(--ayurveda)' } }, [
                el('strong', { textContent: `${items.length} medicine(s) ` }),
                document.createTextNode(isMissing ? 'from active prescriptions are not available in inventory.' : 'from active prescriptions are running low and need restocking.')
            ])
        ]));
    }

    const tableWrapper = el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' } });
    const table = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } });
    
    const thead = el('thead');
    const headRow = el('tr', { style: { background: 'var(--surface2)' } });
    ['Medicine','Category','Stock','Min Level','Unit Price','Value','Expiry','Actions'].forEach(h => {
        headRow.appendChild(el('th', { style: { padding: '10px 14px', textAlign: h==='Actions'||h==='Stock'||h==='Min Level'||h==='Expiry' ? 'center' : h.includes('Price')||h.includes('Value') ? 'right' : 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }, textContent: h }));
    });
    thead.appendChild(headRow);

    const tbody = el('tbody');
    const today = new Date();

    items.forEach(item => {
        const isVirtual = !!item._virtual;
        const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
        const isExpired = expiry && expiry < today;
        const isSoon = expiry && !isExpired && (expiry - today) < 30 * 24 * 60 * 60 * 1000;
        const valueStr = isVirtual ? '—' : '₹' + ((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('en-IN');
        
        let statusObj = { bg: '#e8f5e9', clr: 'var(--green)' };
        if (isVirtual) statusObj = { bg: 'var(--red-bg)', clr: 'var(--red)' };
        else if (item.quantity === 0) statusObj = { bg: 'var(--red-bg)', clr: 'var(--red)' };
        else if (item.quantity <= item.min_quantity) statusObj = { bg: 'var(--ayurveda-bg)', clr: 'var(--ayurveda)' };

        const tr = el('tr', { 
            style: { borderBottom: '1px solid var(--border)', transition: 'background 0.12s', color: isExpired ? 'var(--text-muted)' : '', background: isExpired ? 'rgba(220,38,38,0.02)' : '' },
            onmouseenter: function() { this.style.background = 'var(--surface2)' },
            onmouseleave: function() { this.style.background = isExpired ? 'rgba(220,38,38,0.02)' : '' }
        });

        // Col 1: Name & Rx Context
        const nameCell = el('td', { style: { padding: '10px 14px' } }, [
            el('div', { style: { fontWeight: '600', textDecoration: isExpired ? 'line-through' : 'none' }, textContent: item.name }),
            el('div', { style: { fontSize: '11.5px', color: 'var(--text-muted)' }, textContent: item.unit || '' })
        ]);

        if (!isVirtual) {
            const matRx = (store.prescriptions || []).filter(rx => rx.status === 'active' && (rx.medicines || []).some(m => fuzzyStockNameEvaluate(item.name, m.name)));
            if (matRx.length) {
                nameCell.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--teal)', marginTop: '2px' }, textContent: `📋 In ${matRx.length} active Rx · ${matRx.slice(0, 3).map(rx => rx.patientName).join(', ')}${matRx.length > 3 ? ' +more' : ''}` }));
            }
        }

        // Col 2: Category
        const catCell = el('td', { style: { padding: '10px 14px' } }, [
            isVirtual 
                ? el('span', { style: { color: 'var(--text-muted)', fontSize: '12px' }, textContent: '—' })
                : el('span', { style: { background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '8px', fontSize: '11.5px' }, textContent: item.category || 'General' })
        ]);

        // Col 3: Stock Badge
        const stockCell = el('td', { style: { padding: '10px 14px', textAlign: 'center' } }, [
            el('span', { style: { background: statusObj.bg, color: statusObj.clr, fontWeight: '700', padding: '3px 10px', borderRadius: '10px', fontSize: '12px' }, textContent: isVirtual ? 'Not in library' : item.quantity })
        ]);

        // Col 4: Min Level
        const minCell = el('td', { style: { padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)' }, textContent: isVirtual ? '—' : (item.min_quantity || 0) });

        // Col 5: Unit Price
        const priceCell = el('td', { style: { padding: '10px 14px', textAlign: 'right' }, textContent: isVirtual ? '—' : `₹${(item.unit_price || 0).toLocaleString('en-IN')}` });

        // Col 6: Value
        const valCell = el('td', { style: { padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: 'var(--teal)' }, textContent: valueStr });

        // Col 7: Expiry
        const expCell = el('td', { style: { padding: '10px 14px', textAlign: 'center', color: isExpired ? 'var(--red)' : isSoon ? 'var(--red)' : 'var(--text-muted)', fontWeight: isExpired||isSoon ? '700' : '400' }, textContent: isExpired ? '🔴 EXPIRED' : (formatStockDate(item.expiry_date) + (isSoon ? ' ⚠️' : '')) });

        // Col 8: Actions
        const actCell = el('td', { style: { padding: '10px 14px', textAlign: 'center' } });
        if (isVirtual) {
            actCell.appendChild(el('button', { style: { fontSize: '11px', padding: '4px 10px', border: '1px solid var(--teal)', borderRadius: '6px', background: 'var(--teal)', color: '#fff', cursor: 'pointer', fontWeight: '600' }, textContent: '＋ Add to Stock', onClick: () => openAddStockItemSecure({ name: item.name }) }));
        } else {
            const btnWrap = el('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center' } }, [
                el('button', { style: { fontSize: '11px', padding: '4px 10px', border: '1px solid var(--teal)', borderRadius: '6px', background: 'transparent', color: 'var(--teal)', cursor: 'pointer' }, textContent: '± Adjust', onClick: () => openAdjustStockSecure(item) }),
                el('button', { style: { fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, textContent: '✏️', onClick: () => openAddStockItemSecure(item) }),
                el('button', { style: { fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }, textContent: '🗑️', onClick: () => tryDeleteStockItem(item.id, item.name) })
            ]);
            actCell.appendChild(btnWrap);
        }

        tr.append(nameCell, catCell, stockCell, minCell, priceCell, valCell, expCell, actCell);
        tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    return container;
};

// ─── Modal Engineering ──────────────────────────────────────────

const openAddStockItemSecure = (itemObj) => {
    let overlay = document.getElementById('stockItemOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'stockItemOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const isEdit = itemObj && itemObj.id;
    const catList = ['General','Antibiotic','Analgesic','Antacid','Antidiabetic','Cardiac','Ayurvedic','Homeopathic','Vitamin','Other'];

    const saveAction = async () => {
        const name = document.getElementById('stkName')?.value?.trim();
        if (!name) { window.showToast('Medicine name is required.', 'error'); return; }
        
        const payload = {
            id: isEdit ? itemObj.id : ('stk_' + Date.now() + '_' + Math.random().toString(36).slice(2,5)),
            clinic_id: store.activeClinicId,
            name: name,
            category: document.getElementById('stkCategory')?.value || 'General',
            quantity: parseInt(document.getElementById('stkQty')?.value || '0', 10),
            unit: document.getElementById('stkUnit')?.value || 'tablets',
            min_quantity: parseInt(document.getElementById('stkMin')?.value || '10', 10),
            unit_price: parseFloat(document.getElementById('stkPrice')?.value || '0'),
            batch_no: document.getElementById('stkBatch')?.value || '',
            expiry_date: document.getElementById('stkExpiry')?.value || null,
            updated_at: new Date().toISOString()
        };

        const ok = await persistStockItem(payload);
        if (ok) {
            window.closeOverlay('stockItemOverlay');
            window.showToast(`✅ ${name} saved`, 'success');
            openStockViewSecure(); // Soft reload
        }
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '520px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [ el('div', { className: 'modal-title', textContent: (isEdit ? '✏️ Edit' : '➕ Add') + ' Stock Item' }) ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('stockItemOverlay') })
        ]),
        el('div', { className: 'modal-body' }, [
            // Row 1
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Medicine Name *' }),
                    el('input', { id: 'stkName', type: 'text', attributes: { placeholder: 'e.g. Paracetamol 500mg', value: itemObj?.name || '' } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Category' }),
                    el('select', { id: 'stkCategory' }, catList.map(c => el('option', { value: c, textContent: c, selected: c === (itemObj?.category || 'General') })))
                ])
            ]),
            // Row 2
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Current Quantity *' }),
                    el('input', { id: 'stkQty', type: 'number', attributes: { min: '0', value: itemObj?.quantity || 0 } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Unit (tablet/ml/strip)' }),
                    el('input', { id: 'stkUnit', type: 'text', attributes: { placeholder: 'tablets', value: itemObj?.unit || 'tablets' } })
                ])
            ]),
            // Row 3
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Min Stock Level (alert threshold)' }),
                    el('input', { id: 'stkMin', type: 'number', attributes: { min: '0', value: itemObj?.min_quantity || 10 } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Unit Price (₹)' }),
                    el('input', { id: 'stkPrice', type: 'number', attributes: { min: '0', step: '0.01', value: itemObj?.unit_price || 0 } })
                ])
            ]),
            // Row 4
            el('div', { className: 'form-row', style: { marginBottom: '0' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Batch Number' }),
                    el('input', { id: 'stkBatch', type: 'text', attributes: { placeholder: 'e.g. BT2024001', value: itemObj?.batch_no || '' } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Expiry Date' }),
                    el('input', { id: 'stkExpiry', type: 'date', attributes: { value: itemObj?.expiry_date || '' } })
                ])
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onClick: () => window.closeOverlay('stockItemOverlay') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '💾 Save Item', onClick: saveAction })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

const openAdjustStockSecure = (itemObj) => {
    let overlay = document.getElementById('adjustStockOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'adjustStockOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const applyAction = async () => {
        const qty = parseInt(document.getElementById('adjQty')?.value || '0', 10);
        const type = document.querySelector('input[name="adjType"]:checked')?.value || 'add';
        
        if (!qty || qty <= 0) { window.showToast('Enter a valid quantity.', 'error'); return; }
        
        const newQty = type === 'add' ? itemObj.quantity + qty : Math.max(0, itemObj.quantity - qty);
        
        itemObj.quantity = newQty;
        itemObj.updated_at = new Date().toISOString();

        const ok = await persistStockItem(itemObj);
        if (ok) {
            window.closeOverlay('adjustStockOverlay');
            window.showToast(`${type==='add'?'➕ Added':'➖ Removed'} ${qty} units · New stock: ${newQty}`, 'success');
            if (newQty <= itemObj.min_quantity) window.showToast(`⚠️ ${itemObj.name} is now below minimum stock level!`, 'error');
            openStockViewSecure();
        }
    };

    const modal = el('div', { className: 'modal', style: { maxWidth: '360px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [ 
                el('div', { className: 'modal-title', textContent: '± Adjust Stock' }),
                el('div', { className: 'modal-subtitle' }, [
                    document.createTextNode(`${itemObj.name} · Current: `),
                    el('strong', { textContent: itemObj.quantity })
                ])
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onClick: () => window.closeOverlay('adjustStockOverlay') })
        ]),
        el('div', { className: 'modal-body' }, [
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Adjustment Type' }),
                el('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } }, [
                    el('label', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' } }, [
                        el('input', { type: 'radio', name: 'adjType', value: 'add', attributes: { checked: 'true' } }),
                        document.createTextNode('➕ Add Stock')
                    ]),
                    el('label', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' } }, [
                        el('input', { type: 'radio', name: 'adjType', value: 'remove' }),
                        document.createTextNode('➖ Remove')
                    ])
                ])
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Quantity *' }),
                el('input', { id: 'adjQty', type: 'number', attributes: { placeholder: 'Enter quantity', min: '1' }, style: { fontSize: '16px', textAlign: 'center' } })
            ]),
            el('div', { className: 'field', style: { marginBottom: '0' } }, [
                el('label', { textContent: 'Reason' }),
                el('input', { id: 'adjReason', type: 'text', attributes: { placeholder: 'e.g. New purchase, Dispensed, Expired…' } })
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onClick: () => window.closeOverlay('adjustStockOverlay') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '✅ Apply', onClick: applyAction })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('adjQty')?.focus(), 100);
};

const tryDeleteStockItem = async (id, name) => {
    if (!confirm(`Delete ${name} from inventory?`)) return;
    const ok = await removeStockItem(id);
    if (ok) {
        window.showToast(`Deleted ${name}`, 'info');
        openStockViewSecure();
    }
};

// ─── Export global mapping for legacy hooks ──────────
window.showStockView = openStockViewSecure;
