import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchInvoices, saveInvoice, markInvoicePaid, deleteInvoiceService, calculateInvoiceTotal, getNextInvoiceNo, computeBillingStats, generateInvoicePrintHtml } from '../services/billingService.js';

/**
 * Main entry point for Billing View
 */
export const openBillingViewSecure = async () => {
    store.currentView = 'billing';
    hideAllViews();

    let v = document.getElementById('billingView');
    if (!v) {
        v = el('div', { id: 'billingView' });
        document.querySelector('.main').appendChild(v);
    }
    v.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navBilling');
    
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '💰 Billing & Invoices';
    if (sub) sub.textContent = 'Patient invoices and payment tracking';
    if (addBtn) {
        addBtn.style.display = 'flex';
        addBtn.onclick = openNewInvoiceModal;
        addBtn.innerHTML = '<span>➕ New Invoice</span>';
    }

    await refreshBillingView();
};

const refreshBillingView = async () => {
    const container = document.getElementById('billingView');
    if (!container) return;
    
    emptyNode(container);
    
    // Load data
    await fetchInvoices(store.activeClinicId);
    
    // Render Layout
    const statsRow = el('div', { id: 'billingStats', className: 'stats-grid', style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } });
    const listWrap = el('div', { id: 'billingList' });
    
    container.append(statsRow, listWrap);
    
    renderStats(statsRow);
    renderList(listWrap);
};

const renderStats = (container) => {
    emptyNode(container);
    const stats = computeBillingStats();
    
    const cards = [
        { label: 'Total Invoices', val: stats.count, icon: '📄', bg: 'var(--surface2)', clr: 'var(--text-primary)' },
        { label: 'Total Revenue',  val: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: '💰', bg: 'var(--teal-pale)', clr: 'var(--teal)' },
        { label: 'Collected',      val: `₹${stats.collected.toLocaleString('en-IN')}`, icon: '✅', bg: '#e8f5e9', clr: 'var(--green)' },
        { label: 'Pending',        val: `₹${stats.pending.toLocaleString('en-IN')}`, icon: '⏳', bg: 'var(--red-bg)', clr: 'var(--red)' },
    ];
    
    cards.forEach(s => {
        container.appendChild(el('div', { 
            style: { background: s.bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '120px' } 
        }, [
            el('div', { style: { fontSize: '24px' }, textContent: s.icon }),
            el('div', {}, [
                el('div', { style: { fontSize: '20px', fontWeight: '700', color: s.clr }, textContent: s.val }),
                el('div', { style: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.08em' }, textContent: s.label })
            ])
        ]));
    });
};

const renderList = (container) => {
    emptyNode(container);
    const list = store.invoices || [];

    if (!list.length) {
        container.appendChild(el('div', { className: 'empty-state', style: { padding: '48px', textAlign: 'center', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '52px', marginBottom: '12px' }, textContent: '💰' }),
            el('div', { style: { fontWeight: '600', fontSize: '16px' }, textContent: 'No invoices yet' }),
            el('div', { textContent: 'Click "+ New Invoice" to create one.' })
        ]));
        return;
    }

    const listNodes = list.map(inv => {
        const paid = inv.status === 'paid';
        let items = [];
        try { items = JSON.parse(inv.items_json || '[]'); } catch(e) {}
        
        const disc = parseFloat(inv.discount_amount) || 0;
        const tax = parseFloat(inv.tax_percent) || 0;

        const tableBody = items.map(it => el('tr', {}, [
            el('td', { style: { padding: '6px 10px' }, textContent: it.desc }),
            el('td', { style: { padding: '6px 10px', textAlign: 'right', fontWeight: '600' }, textContent: `₹${Number(it.amount || 0).toLocaleString('en-IN')}` })
        ]));

        if (disc) {
            tableBody.push(el('tr', {}, [
                el('td', { style: { padding: '6px 10px', color: 'var(--green)' }, textContent: 'Discount' }),
                el('td', { style: { padding: '6px 10px', textAlign: 'right', color: 'var(--green)' }, textContent: `−₹${disc.toLocaleString('en-IN')}` })
            ]));
        }

        return el('div', { className: 'rx-card', style: { marginBottom: '12px' } }, [
            el('div', { style: { padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' } }, [
                el('div', { style: { flex: '1', minWidth: '0' } }, [
                    el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
                        el('div', { style: { fontSize: '15px', fontWeight: '700' }, textContent: inv.patient_name }),
                        el('div', { style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', background: 'var(--bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }, textContent: inv.invoice_no }),
                        el('div', { style: { background: paid ? '#e8f5e9' : 'var(--ayurveda-bg)', color: paid ? 'var(--green)' : 'var(--ayurveda)', fontSize: '10px', fontWeight: '700', padding: '2px 10px', borderRadius: '10px' }, textContent: paid ? '✅ PAID' : '⏳ UNPAID' })
                    ]),
                    el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '5px', display: 'flex', gap: '14px', flexWrap: 'wrap' } }, [
                        inv.doctor_name ? el('span', { textContent: `🩺 Dr. ${inv.doctor_name}` }) : null,
                        el('span', { textContent: `📅 ${formatDate(inv.invoice_date)}` }),
                        inv.payment_method ? el('span', { textContent: `💳 ${inv.payment_method}` }) : null
                    ])
                ]),
                el('div', { style: { fontSize: '22px', fontWeight: '700', color: 'var(--teal)', fontFamily: '"DM Serif Display", serif', flexShrink: '0' }, textContent: `₹${Number(inv.total_amount || 0).toLocaleString('en-IN')}` })
            ]),
            // Items Table
            el('div', { style: { borderTop: '1px solid var(--border)', padding: '8px 20px' } }, [
                el('table', { style: { width: '100%', fontSize: '13px', borderCollapse: 'collapse' } }, [
                    el('tbody', {}, tableBody),
                    el('tfoot', {}, [
                        el('tr', { style: { borderTop: '1px solid var(--border2)' } }, [
                            el('td', { style: { padding: '8px 10px', fontWeight: '700' }, textContent: 'Total' }),
                            el('td', { style: { padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--teal)' }, textContent: `₹${Number(inv.total_amount || 0).toLocaleString('en-IN')}` })
                        ])
                    ])
                ])
            ]),
            // Footer Actions
            el('div', { className: 'rx-footer-actions' }, [
                el('button', { className: 'btn-sm btn-outline-teal', textContent: '🖨️ Print', onclick: () => printInvoice(inv) }),
                !paid ? el('button', { className: 'btn-sm btn-teal', textContent: '✅ Mark Paid', onclick: async () => { await markInvoicePaid(inv.id); refreshBillingView(); } }) : null,
                el('button', { className: 'btn-sm btn-outline-red', textContent: '🗑️', onclick: async () => { if (confirm('Delete?')) { await deleteInvoiceService(inv.id); refreshBillingView(); } } })
            ])
        ]);
    });

    container.appendChild(el('div', {}, listNodes));
};

/**
 * New Invoice Creation Modal
 */
export const openNewInvoiceModal = async () => {
    let overlay = document.getElementById('newInvoiceOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'newInvoiceOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const doctors = store.doctors || [];
    const patients = store.patients || [];
    const today = new Date().toISOString().split('T')[0];

    const modal = el('div', { className: 'modal', style: { maxWidth: '600px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '💰 New Invoice' }),
                el('div', { className: 'modal-subtitle', textContent: 'Create patient invoice with line items' })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onclick: () => overlay.classList.remove('open') })
        ]),
        el('div', { className: 'modal-body' }, [
            el('div', { className: 'form-row', style: { marginBottom: '12px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Patient Name *' }),
                    el('input', { id: 'invPatientInp', placeholder: 'Patient name', attributes: { list: 'invPatList' } }),
                    el('datalist', { id: 'invPatList' }, patients.map(p => el('option', { value: p.name })))
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Doctor' }),
                    el('select', { id: 'invDocInp' }, [
                        el('option', { value: '', textContent: '— Select —' }),
                        ...doctors.map(d => el('option', { value: d.name, textContent: `Dr. ${d.name}` }))
                    ])
                ])
            ]),
            el('div', { className: 'form-row' }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Invoice Date *' }),
                    el('input', { id: 'invDateInp', type: 'date', attributes: { value: today } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Payment Method' }),
                    el('select', { id: 'invPayInp' }, ['Cash', 'Card', 'UPI', 'Online', 'Insurance'].map(m => el('option', { textContent: m })))
                ])
            ]),

            // Line Items
            el('div', { style: { margin: '20px 0' } }, [
                el('div', { style: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }, textContent: '📋 Line Items' }),
                el('div', { id: 'invItemsWrap' }),
                el('button', { 
                    className: 'btn-add-medicine', style: { marginTop: '10px' }, 
                    textContent: '＋ Add Item', 
                    onclick: () => addInvoiceItemRow() 
                })
            ]),

            el('div', { className: 'form-row' }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Discount (₹)' }),
                    el('input', { id: 'invDiscInp', type: 'number', attributes: { value: 0 }, oninput: updateModalTotal })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Tax (%)' }),
                    el('input', { id: 'invTaxInp', type: 'number', attributes: { value: 0 }, oninput: updateModalTotal })
                ])
            ]),

            el('div', { style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '14px 0', borderTop: '2px solid var(--border)', marginTop: '20px' } }, [
                el('span', { style: { fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }, textContent: 'TOTAL' }),
                el('span', { id: 'invTotalDisplay', style: { fontSize: '24px', fontWeight: '700', color: 'var(--teal)', fontFamily: '"DM Serif Display", serif' }, textContent: '₹0' })
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onclick: () => overlay.classList.remove('open') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '💾 Save & Update', onclick: () => saveInvoiceFromModal(overlay, false) }),
            el('button', { className: 'btn-sm btn-teal', style: { background: 'var(--teal-dark)' }, textContent: '🖨️ Save & Print', onclick: () => saveInvoiceFromModal(overlay, true) })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Add default item
    addInvoiceItemRow('Consultation Fee', 500);
};

const addInvoiceItemRow = (desc = '', amt = '') => {
    const wrap = document.getElementById('invItemsWrap');
    if (!wrap) return;

    const row = el('div', { className: 'inv-row', style: { display: 'grid', gridTemplateColumns: '1fr 110px 36px', gap: '6px', marginBottom: '6px', alignItems: 'center' } }, [
        el('input', { 
            className: 'inv-desc', placeholder: 'Description', 
            attributes: { value: desc },
            style: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px' },
            oninput: updateModalTotal
        }),
        el('input', { 
            className: 'inv-amt', type: 'number', placeholder: '0', 
            attributes: { value: amt },
            style: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', textAlign: 'right' },
            oninput: updateModalTotal
        }),
        el('button', { 
            style: { width: '32px', height: '32px', border: '1px solid var(--border)', borderRadius: '7px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
            textContent: '✕',
            onclick: (e) => { e.target.closest('.inv-row').remove(); updateModalTotal(); }
        })
    ]);

    wrap.appendChild(row);
    updateModalTotal();
};

const updateModalTotal = () => {
    const items = Array.from(document.querySelectorAll('.inv-row')).map(row => ({
        amount: parseFloat(row.querySelector('.inv-amt').value) || 0
    }));
    const disc = parseFloat(document.getElementById('invDiscInp')?.value) || 0;
    const tax = parseFloat(document.getElementById('invTaxInp')?.value) || 0;
    
    const { total } = calculateInvoiceTotal(items, disc, tax);
    const display = document.getElementById('invTotalDisplay');
    if (display) display.textContent = `₹${total.toLocaleString('en-IN')}`;
    return total;
};

const saveInvoiceFromModal = async (overlay, andPrint) => {
    const patient = document.getElementById('invPatientInp').value.trim();
    const date = document.getElementById('invDateInp').value;
    const doctor = document.getElementById('invDocInp').value;
    const method = document.getElementById('invPayInp').value;
    const disc = parseFloat(document.getElementById('invDiscInp').value) || 0;
    const tax = parseFloat(document.getElementById('invTaxInp').value) || 0;

    if (!patient) return window.showToast('Patient name is required', 'error');

    const items = Array.from(document.querySelectorAll('.inv-row')).map(row => ({
        desc: row.querySelector('.inv-desc').value.trim(),
        amount: parseFloat(row.querySelector('.inv-amt').value) || 0
    })).filter(i => i.desc || i.amount);

    if (!items.length) return window.showToast('Add at least one item', 'error');

    const { total } = calculateInvoiceTotal(items, disc, tax);
    const invNo = await getNextInvoiceNo(store.activeClinicId);

    const inv = {
        id: 'inv_' + Date.now(),
        clinic_id: store.activeClinicId,
        invoice_no: invNo,
        patient_name: patient,
        doctor_name: doctor,
        invoice_date: date,
        items_json: JSON.stringify(items),
        total_amount: total,
        discount_amount: disc,
        tax_percent: tax,
        payment_method: method,
        status: 'unpaid',
        created_at: new Date().toISOString()
    };

    const ok = await saveInvoice(inv);
    if (ok) {
        overlay.classList.remove('open');
        window.showToast(`✅ Invoice ${invNo} created`, 'success');
        if (andPrint) printInvoice(inv);
        await refreshBillingView();
    }
};

const printInvoice = (inv) => {
    const clinic = (store.clinics || []).find(c => c.id === store.activeClinicId);
    const html = generateInvoicePrintHtml(inv, clinic);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
};

// Global Routing Bridge
window.showBillingView = openBillingViewSecure;
window.openNewInvoice = openNewInvoiceModal;
