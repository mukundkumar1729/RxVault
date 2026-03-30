// ════════════════════════════════════════════════════════════
//  STOCK SERVICE
//  Handles database access, automatic deductions, and matching algorithms
// ════════════════════════════════════════════════════════════

import { db } from '../core/db.js';
import { store } from '../core/store.js';

/**
 * Fetch all stock items for the active clinic.
 */
export const fetchStockDatabase = async () => {
    if (!store.activeClinicId) return [];
    const { data, error } = await db.from('stock_items').select('*').eq('clinic_id', store.activeClinicId).order('name');
    if (error) { 
        console.error('[Stock Service] Fetch failed', error); 
        return []; 
    }
    return data || [];
};

/**
 * Upsert a stock item mapping.
 */
export const persistStockItem = async (item) => {
    const { error } = await db.from('stock_items').upsert(item, { onConflict: 'id' });
    if (error) { 
        console.error('[Stock Service] Persist failed', error); 
        return false; 
    }
    return true;
};

/**
 * Hard delete a stock item manually.
 */
export const removeStockItem = async (itemId) => {
    const { error } = await db.from('stock_items').delete().eq('id', itemId);
    return !error;
};

// ─── Prescription ↔ Stock Algorithmic Engine ───────────────

/**
 * Analyzes active prescriptions in the Proxy Store to aggregate a unique map 
 * of presently prescribed medicine strings across all patients.
 */
export const aggregateActivePrescriptionNames = () => {
    const names = {};
    (store.prescriptions || []).forEach(rx => {
        if (rx.status !== 'active') return;
        (rx.medicines || []).forEach(m => {
            if (m.name) names[m.name.trim().toLowerCase()] = m.name.trim();
        });
    });
    return Object.values(names);
};

/**
 * Fuzzy match logical evaluation: does the stock item name mathematically align 
 * to a prescribed medicine string token? Matches against base prefixes dynamically.
 */
export const fuzzyStockNameEvaluate = (stockString, rxString) => {
    const stockClean = (stockString || '').toLowerCase().trim();
    const rxClean = (rxString || '').toLowerCase().trim();
    if (!stockClean || !rxClean) return false;
    
    // Isolate pure root prefixes
    const sFirst = stockClean.split(/\s+/)[0];
    const rFirst = rxClean.split(/\s+/)[0];
    
    return stockClean.includes(rFirst) || rxClean.includes(sFirst) || sFirst === rFirst;
};

/**
 * Post-Save Hook Interceptor: Automatically traverses a finalized Prescription 
 * and deducts corresponding stock quantity vectors safely.
 */
export const interceptAndDeductStockForRx = async (rx) => {
    if (!rx.medicines || !rx.medicines.length) return;
    
    // Refetch latest stock to prevent race condition desynchronization
    const liveStock = await fetchStockDatabase();
    if (!liveStock.length) return;

    for (let i = 0; i < rx.medicines.length; i++) {
        const med = rx.medicines[i];
        
        // Find algorithmic exact match against the live dataset
        const stockItem = liveStock.find(s => fuzzyStockNameEvaluate(s.name, med.name));
        
        if (stockItem && stockItem.quantity > 0) {
            stockItem.quantity = Math.max(0, stockItem.quantity - 1);
            await persistStockItem(stockItem);
        }
    }
};
