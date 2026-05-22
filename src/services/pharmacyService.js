// ════════════════════════════════════════════════════════════
//  PHARMACY SERVICE - API functions for pharmacy management
// ════════════════════════════════════════════════════════════

import { db } from '../supabase.js';

// ─── Pharmacy Organizations ──────────────────────────────────

// ─── Pharmacy Data Export ────────────────────────────────────
export const exportPharmacyCustomersToCSV = async (orgId) => {
    const customers = await dbGetPharmacyCustomers(orgId);
    
    // CSV Header
    let csv = 'Customer ID,Customer Name,Customer Type,Phone,Linked Patient ID,Is Active,Created At\n';
    
    // CSV Rows
    customers.forEach(customer => {
        csv += `"${customer.customer_id || ''}","${customer.name || ''}","${customer.customer_type || ''}","${customer.phone || ''}","${customer.linked_patient_id || ''}","${customer.is_active ? 'true' : 'false'}","${customer.created_at || ''}"\n`;
    });
    
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy_customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportPharmacyVisitsToCSV = async (orgId) => {
    const visits = await dbGetAllPharmacyVisits(orgId);
    
    // CSV Header
    let csv = 'Visit ID,Visit Date,Customer ID,Customer Name,Customer Type,Symptoms,Notes,Is Active,Created At\n';
    
    // CSV Rows
    visits.forEach(visit => {
        const symptoms = visit.symptom_ids && visit.symptom_ids.length > 0 
            ? visit.symptom_ids.map(id => {
                const symptom = visit.pharmacy_symptom_master?.find(s => s.id === id);
                return symptom ? symptom.name : 'Unknown';
            }).join('; ') 
            : visit.symptoms_free_text || '';
            
        csv += `"${visit.visit_id || ''}","${new Date(visit.visit_date || 0).toISOString()}","${visit.customer_id || ''}","${visit.pharmacy_customers?.name || ''}","${visit.customer_type || ''}","${symptoms.replace(/"/g, '""')}","${(visit.notes || '').replace(/"/g, '""')}","${visit.is_active ? 'true' : 'false'}","${visit.created_at || ''}"\n`;
    });
    
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy_visits_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportPharmacyCustomersToExcel = async (orgId) => {
    if (typeof XLSX === 'undefined') {
        showToast('Excel export requires SheetJS. Please contact administrator.', 'error');
        return;
    }
    
    const customers = await dbGetPharmacyCustomers(orgId);
    
    // Prepare data for Excel
    const data = [['Customer ID', 'Customer Name', 'Customer Type', 'Phone', 'Linked Patient ID', 'Is Active', 'Created At']];
    
    customers.forEach(customer => {
        data.push([
            customer.customer_id || '',
            customer.name || '',
            customer.customer_type || '',
            customer.phone || '',
            customer.linked_patient_id || '',
            customer.is_active ? 'true' : 'false',
            customer.created_at || ''
        ]);
    });
    
    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    
    // Trigger download
    XLSX.writeFile(wb, `pharmacy_customers_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportPharmacyVisitsToExcel = async (orgId) => {
    if (typeof XLSX === 'undefined') {
        showToast('Excel export requires SheetJS. Please contact administrator.', 'error');
        return;
    }
    
    const visits = await dbGetAllPharmacyVisits(orgId);
    
    // Prepare data for Excel
    const data = [['Visit ID', 'Visit Date', 'Customer ID', 'Customer Name', 'Customer Type', 'Symptoms', 'Notes', 'Is Active', 'Created At']];
    
    visits.forEach(visit => {
        const symptoms = visit.symptom_ids && visit.symptom_ids.length > 0 
            ? visit.symptom_ids.map(id => {
                const symptom = visit.pharmacy_symptom_master?.find(s => s.id === id);
                return symptom ? symptom.name : 'Unknown';
            }).join('; ') 
            : visit.symptoms_free_text || '';
            
        data.push([
            visit.visit_id || '',
            new Date(visit.visit_date || 0).toISOString(),
            visit.customer_id || '',
            visit.pharmacy_customers?.name || '',
            visit.customer_type || '',
            symptoms,
            visit.notes || '',
            visit.is_active ? 'true' : 'false',
            visit.created_at || ''
        ]);
    });
    
    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visits');
    
    // Trigger download
    XLSX.writeFile(wb, `pharmacy_visits_${new Date().toISOString().split('T')[0]}.xlsx`);
};

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

// ─── Analytics Data ─────────────────────────────────────────
export const dbGetPharmacyVisitsForAnalytics = async (orgId) => {
    try {
        // Get visits for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Get daily visit counts for the last 30 days
        const { data: dailyVisits, error: dailyError } = await db
            .from('pharmacy_visits')
            .select('visit_date')
            .eq('org_id', orgId)
            .gte('visit_date', thirtyDaysAgo.toISOString())
            .order('visit_date', { ascending: true });
        
        if (dailyError) throw dailyError;
        
        // Process daily visits data
        const dailyVisitMap = {};
        dailyVisits?.forEach(visit => {
            const date = new Date(visit.visit_date).toISOString().split('T')[0];
            dailyVisitMap[date] = (dailyVisitMap[date] || 0) + 1;
        });
        
        const dailyVisitsArray = Object.keys(dailyVisitMap)
            .map(date => ({ date, count: dailyVisitMap[date] }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Get top symptoms
        const { data: symptomData, error: symptomError } = await db
            .from('pharmacy_visits')
            .select('symptom_ids, symptoms_free_text, pharmacy_symptom_master!inner(name)')
            .eq('org_id', orgId)
            .not('symptom_ids', 'is', '[]')
            .limit(1000);
        
        if (symptomError) throw symptomError;
        
        // Process symptoms data
        const symptomCountMap = {};
        
        // Count from symptom_ids (predefined symptoms for MR)
        symptomData?.forEach(visit => {
            if (visit.symptom_ids && Array.isArray(visit.symptom_ids)) {
                visit.symptom_ids.forEach(symptomId => {
                    if (visit.pharmacy_symptom_master && Array.isArray(visit.pharmacy_symptom_master)) {
                        const symptom = visit.pharmacy_symptom_master.find(s => s.id === symptomId);
                        if (symptom) {
                            symptomCountMap[symptom.name] = (symptomCountMap[symptom.name] || 0) + 1;
                        }
                    }
                });
            }
            
            // Count from symptoms_free_text (free text for walk-in/linked patient)
            if (visit.symptoms_free_text && typeof visit.symptoms_free_text === 'string') {
                // Simple word frequency for free text symptoms
                const words = visit.symptoms_free_text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
                words.forEach(word => {
                    symptomCountMap[word] = (symptomCountMap[word] || 0) + 1;
                });
            }
        });
        
        // Get top 10 symptoms
        const topSymptoms = Object.entries(symptomCountMap)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        return {
            dailyVisits: dailyVisitsArray,
            topSymptoms: topSymptoms
        };
    } catch (error) {
        console.error('dbGetPharmacyVisitsForAnalytics error:', error);
        return {
            dailyVisits: [],
            topSymptoms: []
        };
    }
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
