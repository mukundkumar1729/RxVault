// ════════════════════════════════════════════════════════════
//  PHARMACY SERVICE - API functions for pharmacy management
// ════════════════════════════════════════════════════════════

import { db } from '../supabase.js';

// ─── Pharmacy Organizations ──────────────────────────────────

export const dbGetPharmacyOrgs = async () => {
    const { data, error } = await db.from('pharmacy_orgs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
    if (error) { console.error('dbGetPharmacyOrgs', error); return []; }
    return data || [];
};

export const dbGetDefaultPharmacyOrg = async () => {
    const { data, error } = await db.from('pharmacy_orgs')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();
    if (error) { console.error('dbGetDefaultPharmacyOrg', error); return null; }
    return data;
};

export const dbUpsertPharmacyOrg = async (org) => {
    const { data, error } = await db.from('pharmacy_orgs')
        .upsert(org, { onConflict: 'id' })
        .select()
        .single();
    if (error) { console.error('dbUpsertPharmacyOrg', error); return null; }
    return data;
};

// ─── Pharmacy Customers ─────────────────────────────────────

export const dbGetPharmacyCustomers = async (orgId) => {
    const { data, error } = await db.from('pharmacy_customers')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (error) { console.error('dbGetPharmacyCustomers', error); return []; }
    return data || [];
};

export const dbGetPharmacyCustomerById = async (customerId) => {
    const { data, error } = await db.from('pharmacy_customers')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
    if (error) { console.error('dbGetPharmacyCustomerById', error); return null; }
    return data;
};

export const dbUpsertPharmacyCustomer = async (customer) => {
    const { data, error } = await db.from('pharmacy_customers')
        .upsert(customer, { onConflict: 'id' })
        .select()
        .single();
    if (error) { console.error('dbUpsertPharmacyCustomer', error); return null; }
    return data;
};

export const dbGeneratePharmacyCustomerId = async (type) => {
    // Call database function
    const { data, error } = await db.rpc('gen_pharmacy_customer_id', { p_type: type });
    if (error) { 
        console.error('dbGeneratePharmacyCustomerId RPC error', error);
        // Fallback: generate locally
        const prefix = { 'mr': 'PMR', 'walkin': 'PWI', 'existing_patient': 'PEP' }[type] || 'P';
        return prefix + Date.now().toString(36).toUpperCase();
    }
    return data;
};

// ─── MR Details ────────────────────────────────────────────────

export const dbGetPharmacyMrDetail = async (customerId) => {
    const { data, error } = await db.from('pharmacy_mr_details')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
    if (error) { console.error('dbGetPharmacyMrDetail', error); return null; }
    return data;
};

export const dbUpsertPharmacyMrDetail = async (mrDetail) => {
    const { data, error } = await db.from('pharmacy_mr_details')
        .upsert(mrDetail, { onConflict: 'id' })
        .select()
        .single();
    if (error) { console.error('dbUpsertPharmacyMrDetail', error); return null; }
    return data;
};

// ─── Pharmacy Visits ─────────────────────────────────────────

export const dbGetPharmacyVisits = async (customerId) => {
    const { data, error } = await db.from('pharmacy_visits')
        .select('*')
        .eq('customer_id', customerId)
        .order('visit_date', { ascending: false });
    if (error) { console.error('dbGetPharmacyVisits', error); return []; }
    return data || [];
};

export const dbGetAllPharmacyVisits = async (orgId) => {
    const { data, error } = await db.from('pharmacy_visits')
        .select('*, pharmacy_customers(name, customer_id, customer_type)')
        .order('visit_date', { ascending: false })
        .limit(100);
    if (error) { console.error('dbGetAllPharmacyVisits', error); return []; }
    return data || [];
};

export const dbUpsertPharmacyVisit = async (visit) => {
    const { data, error } = await db.from('pharmacy_visits')
        .upsert(visit, { onConflict: 'id' })
        .select()
        .single();
    if (error) { console.error('dbUpsertPharmacyVisit', error); return null; }
    return data;
};

export const dbGeneratePharmacyVisitId = async () => {
    const { data, error } = await db.rpc('gen_pharmacy_visit_id');
    if (error) { 
        console.error('dbGeneratePharmacyVisitId RPC error', error);
        return 'PVIS' + Date.now().toString(36).toUpperCase();
    }
    return data;
};

// ─── Symptom Master ─────────────────────────────────────────

export const dbGetPharmacySymptoms = async (orgId) => {
    const { data, error } = await db.from('pharmacy_symptom_master')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
    if (error) { console.error('dbGetPharmacySymptoms', error); return []; }
    return data || [];
};

export const dbUpsertPharmacySymptom = async (symptom) => {
    const { data, error } = await db.from('pharmacy_symptom_master')
        .upsert(symptom, { onConflict: 'id' })
        .select()
        .single();
    if (error) { console.error('dbUpsertPharmacySymptom', error); return null; }
    return data;
};

// ─── Dashboard Stats ────────────────────────────────────────

export const dbGetPharmacyDashboardStats = async (orgId) => {
    const { data: customers } = await db.from('pharmacy_customers')
        .select('customer_type', { count: 'exact' })
        .eq('org_id', orgId)
        .eq('is_active', true);
    
    const { data: today } = await db.from('pharmacy_visits')
        .select('*', { count: 'exact' })
        .eq('customer_type', 'walkin');
    
    const mrCount = (customers || []).filter(c => c.customer_type === 'mr').length;
    const walkinCount = (customers || []).filter(c => c.customer_type === 'walkin').length;
    const patientCount = (customers || []).filter(c => c.customer_type === 'existing_patient').length;
    
    return {
        totalCustomers: mrCount + walkinCount + patientCount,
        mrCount,
        walkinCount,
        patientCount
    };
};

// ─── Patient Search for Pharmacy ───────────────────────────────

export const dbSearchPatients = async (query) => {
    if (!query || query.length < 2) return [];
    
    const { data, error } = await db.from('patients')
        .select('id, patient_id, name')
        .or(`name.ilike.%${query}%,patient_id.ilike.%${query}%`)
        .limit(10);
    
    if (error) { console.error('dbSearchPatients', error); return []; }
    return data || [];
};