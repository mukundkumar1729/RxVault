// ════════════════════════════════════════════════════════════
//  LAB SERVICE
//  Handles database access, file attachments, and AI proxies
// ════════════════════════════════════════════════════════════

import { db } from '../core/db.js';
import { store } from '../core/store.js';

export const COMMON_LAB_TESTS = [
    'CBC (Complete Blood Count)','LFT (Liver Function Test)','KFT (Kidney Function Test)',
    'Blood Sugar Fasting','Blood Sugar PP','HbA1c','Thyroid (TSH/T3/T4)','Lipid Profile','Urine Routine',
    'Urine Culture','Blood Culture','Chest X-Ray','ECG','2D Echo','Ultrasound Abdomen','CT Scan','MRI',
    'Dengue NS1/IgM','Malaria Antigen','Widal Test','CRP/ESR','Serum Electrolytes','Vitamin D','Vitamin B12',
    'Iron Studies','HIV','HBsAg','HCV','Coagulation profile','Sputum AFB','HRCT Chest','Bone Marrow Biopsy'
];

export const fetchLabOrdersDatabase = async () => {
    if (!store.activeClinicId) return [];
    const { data, error } = await db.from('lab_orders').select('*').eq('clinic_id', store.activeClinicId).order('ordered_on', { ascending: false });
    if (error) { 
        console.error('[Lab Service] Fetch failed', error); 
        return []; 
    }
    return data || [];
};

export const persistLabOrder = async (order) => {
    const { error } = await db.from('lab_orders').upsert(order, { onConflict: 'id' });
    if (error) { 
        console.error('[Lab Service] Upsert failed', error); 
        return false; 
    }
    return true;
};

export const deleteLabOrderDatabase = async (orderId) => {
    const { error } = await db.from('lab_orders').delete().eq('id', orderId);
    return !error;
};

/**
 * Pipes Clinical results securely through the AI Proxy to derive autonomous clinical evaluations.
 */
export const invokeAiLabInterpretation = async (order) => {
    if (!order || !order.result_text) throw new Error('No text result to interpret.');

    // Fallback proxy logic inherited from Phase 4
    const proxyUrl = typeof window.AI_PROXY_URL !== 'undefined' ? window.AI_PROXY_URL : 'https://wavakcolrtrwmjcjkdfc.supabase.co/functions/v1/claude-proxy';
    
    const resp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            messages: [{
                role: 'user',
                content: `You are a clinical assistant interpreting a lab report for Indian clinic Rx Vault. 
                          Test: ${order.test_name} 
                          Patient: ${order.patient_name} 
                          
                          Results:
                          ${order.result_text}
                          
                          Provide a brief (3-5 sentence) clinical interpretation: what is notable, what is normal, and one key clinical recommendation. Be concise and direct.`
            }]
        })
    });

    if (!resp.ok) throw new Error(`Proxy error HTTP ${resp.status}`);
    const data = await resp.json();
    return (data.content || []).map(b => b.text || '').join('').trim();
};

/**
 * Extracts structured data points from raw text uploads autonomously.
 */
export const invokeAiSmartParse = async (rawText, hasAttachment) => {
    const proxyUrl = typeof window.AI_PROXY_URL !== 'undefined' ? window.AI_PROXY_URL : 'https://wavakcolrtrwmjcjkdfc.supabase.co/functions/v1/claude-proxy';
    
    const resp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            messages: [{
                role: 'user',
                content: `Extract lab test values from this report text/data. Return ONLY a structured plain text list.
                          Format: Test Name: Value Unit (Reference Range)
                          Example: Hemoglobin: 13.5 g/dL (12-16)

                          Data:
                          ${rawText}
                          ${hasAttachment ? '[IMAGE DATA ATTACHED]' : ''}`
            }]
        })
    });

    if (!resp.ok) throw new Error(`Proxy error HTTP ${resp.status}`);
    const data = await resp.json();
    return (data.content || []).map(b => b.text || '').join('').trim();
};
