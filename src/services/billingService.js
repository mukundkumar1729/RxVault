import { store } from '../core/store.js';
import { formatDate } from '../utils/formatters.js';

/**
 * Fetches invoices for a clinic and updates the store
 */
export const fetchInvoices = async (clinicId) => {
    const data = await window.dbGetInvoices(clinicId);
    store.invoices = data || [];
    return store.invoices;
};

/**
 * Persists a new or updated invoice
 */
export const saveInvoice = async (inv) => {
    const ok = await window.dbUpsertInvoice(inv);
    if (ok) {
        const idx = (store.invoices || []).findIndex(i => i.id === inv.id);
        if (idx !== -1) store.invoices[idx] = inv;
        else store.invoices = [inv, ...(store.invoices || [])];
    }
    return ok;
};

/**
 * Marks an invoice as paid
 */
export const markInvoicePaid = async (id) => {
    const inv = (store.invoices || []).find(i => i.id === id);
    if (!inv) return false;
    
    const updated = { ...inv, status: 'paid', paid_at: new Date().toISOString() };
    const ok = await window.dbUpsertInvoice(updated);
    if (ok) {
        inv.status = 'paid';
        inv.paid_at = updated.paid_at;
    }
    return ok;
};

/**
 * Deletes an invoice
 */
export const deleteInvoiceService = async (id) => {
    // Note: raw db call as dbDeleteInvoice is not in supabase.js yet (it was used as raw .delete() in features.js)
    const { error } = await window.db.from('invoices').delete().eq('id', id);
    if (!error) {
        store.invoices = (store.invoices || []).filter(i => i.id !== id);
    }
    return !error;
};

/**
 * Calculates invoice subtotal and total
 */
export const calculateInvoiceTotal = (items = [], discount = 0, taxPercent = 0) => {
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const total = (subtotal - discount) * (1 + taxPercent / 100);
    return {
        subtotal: Math.max(0, subtotal),
        total: Math.max(0, Math.round(total * 100) / 100)
    };
};

/**
 * Generates the next invoice number
 */
export const getNextInvoiceNo = async (clinicId) => {
    return await window.dbGetNextInvoiceNo(clinicId);
};

/**
 * Computes billing statistics from current store
 */
export const computeBillingStats = () => {
    const list = store.invoices || [];
    const totalRevenue = list.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const collected = list.filter(i => i.status === 'paid').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const pending = list.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    
    return {
        count: list.length,
        totalRevenue,
        collected,
        pending
    };
};

/**
 * Generates full standalone HTML for printing an invoice
 */
export const generateInvoicePrintHtml = (inv, clinic) => {
    const items = JSON.parse(inv.items_json || '[]');
    const disc = parseFloat(inv.discount_amount) || 0;
    const tax = parseFloat(inv.tax_percent) || 0;
    const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
    
    const itemsHtml = items.map(it => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.desc}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${Number(it.amount || 0).toLocaleString('en-IN')}</td>
        </tr>`).join('');

    const taxVal = (subtotal - disc) * tax / 100;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice ${inv.invoice_no}</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; padding: 32px; color: #1a1a2e; font-size: 13px; }
        .header { display: flex; justify-content: space-between; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 3px solid #0a7c6e; }
        .brand { font-family: "DM Serif Display", serif; font-size: 26px; color: #0a7c6e; }
        .clinic { font-size: 12px; color: #666; margin-top: 3px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 8px; background: #f0f4f8; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .05em; }
        .total-row { font-size: 18px; font-weight: 700; color: #0a7c6e; border-top: 2px solid #0a7c6e; }
        .footer { margin-top: 48px; border-top: 1px solid #eee; padding-top: 16px; font-size: 11px; color: #888; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body onload="window.print()">
    <div class="header">
        <div>
            <div class="brand">💊 Rx Vault</div>
            <div class="clinic">${clinic ? (clinic.logo + ' ' + clinic.name) : ''}<br>${clinic?.address || ''}</div>
        </div>
        <div style="text-align:right">
            <div style="font-family:'DM Serif Display',serif;font-size:22px;font-weight:700;color:#1a1a2e">INVOICE</div>
            <div style="font-family:monospace;font-size:15px;color:#0a7c6e;margin-top:4px">${inv.invoice_no}</div>
            <div style="font-size:12px;color:#666;margin-top:4px">Date: ${formatDate(inv.invoice_date)}</div>
            <div class="badge" style="margin-top:8px;background:${inv.status === 'paid' ? '#e8f5e9' : '#fff7ed'};color:${inv.status === 'paid' ? '#16a34a' : '#d97706'}">
                ${inv.status === 'paid' ? 'PAID' : 'UNPAID'}
            </div>
        </div>
    </div>
    <div style="margin-bottom:20px;padding:14px;background:#f7fafc;border-radius:8px">
        <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#888;margin-bottom:6px">Billed To</div>
        <div style="font-size:15px;font-weight:700">${inv.patient_name}</div>
        ${inv.doctor_name ? `<div style="color:#555;margin-top:2px">Attending: Dr. ${inv.doctor_name}</div>` : ''}
    </div>
    <table>
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
            ${itemsHtml}
            ${disc ? `<tr><td style="padding:8px;color:#16a34a">Discount</td><td style="padding:8px;text-align:right;color:#16a34a">−₹${disc.toLocaleString('en-IN')}</td></tr>` : ''}
            ${tax ? `<tr><td style="padding:8px;color:#666">Tax (${tax}%)</td><td style="padding:8px;text-align:right;color:#666">₹${taxVal.toFixed(2)}</td></tr>` : ''}
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td style="padding:10px 8px;font-weight:700">Total</td>
                <td style="padding:10px 8px;text-align:right;font-weight:700">₹${Number(inv.total_amount || 0).toLocaleString('en-IN')}</td>
            </tr>
        </tfoot>
    </table>
    <div class="footer">Generated by Rx Vault · ${new Date().toLocaleDateString('en-IN')}</div>
</body>
</html>`;
};
