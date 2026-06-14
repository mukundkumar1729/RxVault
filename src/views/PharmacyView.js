// ════════════════════════════════════════════════════════════
//  PHARMACY VIEW CONTROLLER
//  Main pharmacy dashboard and navigation
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode } from '../utils/dom.js';

let currentPharmacyOrg = null;
let currentPharmacyView = 'dashboard';

// ─── Initialize Pharmacy View ─────────────────────────────────
export const initPharmacyView = async () => {
    const { dbGetDefaultPharmacyOrg, dbGetPharmacyCustomers, dbGetPharmacyDashboardStats } = await import('../services/pharmacyService.js');
    
    currentPharmacyOrg = await dbGetDefaultPharmacyOrg();
    if (!currentPharmacyOrg) {
        showToast('No pharmacy organization found', 'error');
        return;
    }
    
    renderPharmacyDashboard();
};

// ─── Main Render Function ───────────────────────────────────
export const renderPharmacyView = async () => {
    const pv = document.getElementById('pharmacyView');
    if (!pv) return;
    
    emptyNode(pv);
    
    // Update global page header
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');
    if (titleEl) titleEl.textContent = '🏥 Pharmacy Management';
    if (subtitleEl) subtitleEl.textContent = currentPharmacyOrg?.name || 'Pharmacy';
    
    // Navigation Tabs
    pv.appendChild(el('div', {
        style: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
        children: [
            createPharmacyTab('dashboard', '📊 Dashboard'),
            createPharmacyTab('customers', '👥 Customers'),
            createPharmacyTab('visits', '📝 Visit Log'),
            createPharmacyTab('mr-verify', '📋 MR Verification')
        ]
    }));
    
    // Content Area
    const content = el('div', { id: 'pharmacyContent' });
    pv.appendChild(content);
    
    // Render current view
    renderPharmacyContent();
};

const createPharmacyTab = (viewId, label) => {
    return el('button', {
        className: currentPharmacyView === viewId ? 'btn-tab active' : 'btn-tab',
        textContent: label,
        onClick: () => {
            currentPharmacyView = viewId;
            renderPharmacyContent();
            // Update active tab styling
            document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
        }
    });
};

const renderPharmacyContent = async () => {
    const content = document.getElementById('pharmacyContent');
    if (!content) return;
    
    emptyNode(content);
    
    switch (currentPharmacyView) {
        case 'dashboard':
            await renderDashboard(content);
            break;
        case 'customers':
            await renderCustomers(content);
            break;
        case 'visits':
            await renderVisits(content);
            break;
        case 'mr-verify':
            await renderMrVerify(content);
            break;
    }
};

// ─── Dashboard ─────────────────────────────────────────────
const renderDashboard = async (container) => {
    const { dbGetPharmacyDashboardStats } = await import('../services/pharmacyService.js');
    
    const stats = await dbGetPharmacyDashboardStats(currentPharmacyOrg?.id);
    
    container.appendChild(el('div', { className: 'stats-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' } }, [
        createStatCard('Total Customers', stats.totalCustomers || 0, '👥'),
        createStatCard('Medical Reps', stats.mrCount || 0, '💊'),
        createStatCard('Walk-in Customers', stats.walkinCount || 0, '🚶'),
        createStatCard('Linked Patients', stats.patientCount || 0, '🏥')
    ]));
    
    // Quick Actions
    container.appendChild(el('div', { className: 'section-title', textContent: 'Quick Actions', style: { fontSize: '16px', fontWeight: '600', marginBottom: '12px' } }));
    
    const actionsRow = el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });
    actionsRow.appendChild(el('button', {
        className: 'btn btn-teal',
        textContent: '➕ Register MR',
        onClick: () => { currentPharmacyView = 'customers'; renderPharmacyContent(); }
    }));
    actionsRow.appendChild(el('button', {
        className: 'btn btn-outline-teal',
        textContent: '📝 New Visit',
        onClick: () => { currentPharmacyView = 'visits'; renderPharmacyContent(); }
    }));
    container.appendChild(actionsRow);
};

const createStatCard = (label, value, icon) => {
    return el('div', {
        className: 'stat-card',
        style: { background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' },
        children: [
            el('div', { style: { fontSize: '24px', marginBottom: '8px' }, textContent: icon }),
            el('div', { style: { fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }, textContent: value }),
            el('div', { style: { fontSize: '13px', color: 'var(--text-muted)' }, textContent: label })
        ]
    });
};

// ─── Customers ───────────────────────────────────────────────
const renderCustomers = async (container) => {
    const { dbGetPharmacyCustomers } = await import('../services/pharmacyService.js');
    
    const customers = await dbGetPharmacyCustomers(currentPharmacyOrg?.id);
    
    // Search and Filter
    const filterRow = el('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' } });
    filterRow.appendChild(el('input', {
        type: 'text',
        placeholder: 'Search customers...',
        className: 'search-input',
        style: { flex: '1', minWidth: '200px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px' },
        oninput: (e) => filterCustomers(customers, e.target.value)
    }));
    filterRow.appendChild(el('button', {
        className: 'btn btn-teal',
        textContent: '➕ Add Customer',
        onClick: () => showAddCustomerModal()
    }));
    container.appendChild(filterRow);
    
    // Customer List
    const list = el('div', { id: 'customerList', style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    customers.forEach(c => list.appendChild(createCustomerCard(c)));
    container.appendChild(list);
    
    if (customers.length === 0) {
        container.appendChild(el('div', { 
            style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' },
            textContent: 'No customers registered yet'
        }));
    }
};

const createCustomerCard = (customer) => {
    const typeIcon = { 'mr': '💊', 'walkin': '🚶', 'existing_patient': '🏥' }[customer.customer_type] || '👤';
    const typeLabel = { 'mr': 'Medical Representative', 'walkin': 'Walk-in', 'existing_patient': 'Existing Patient' }[customer.customer_type] || customer.customer_type;
    
    return el('div', {
        className: 'customer-card',
        style: { background: 'var(--surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        children: [
            el('div', { children: [
                el('div', { style: { fontWeight: '600', fontSize: '15px' }, textContent: customer.name }),
                el('div', { style: { fontSize: '12px', color: 'var(--text-muted)' }, textContent: `${typeIcon} ${customer.customer_id} · ${typeLabel}` }),
                customer.phone ? el('div', { style: { fontSize: '12px', color: 'var(--text-muted)' }, textContent: `📞 ${customer.phone}` }) : null
            ].filter(Boolean) }),
            el('div', { children: [
                el('button', {
                    className: 'btn-sm btn-outline-teal',
                    textContent: '📝 Visit',
                    onClick: () => {
                        window.selectedCustomerId = customer.id;
                        window.selectedCustomerType = customer.customer_type;
                        window.selectedCustomerName = customer.name;
                        window.selectedCustomerIdCard = customer.customer_id;
                        quickVisit(customer);
                    }
                })
            ].filter(Boolean) })
        ]
    });
};

const filterCustomers = (customers, search) => {
    const list = document.getElementById('customerList');
    if (!list) return;
    emptyNode(list);
    const q = search.toLowerCase();
    customers.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.customer_id.toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
    ).forEach(c => list.appendChild(createCustomerCard(c)));
};

// ─── Visits ─────────────────────────────────────────────────
const renderVisits = async (container) => {
    const { dbGetAllPharmacyVisits } = await import('../services/pharmacyService.js');
    
    const visits = await dbGetAllPharmacyVisits(currentPharmacyOrg?.id);
    
    container.appendChild(el('div', { 
        style: { fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' },
        textContent: `Showing recent ${visits.length} visits`
    }));
    
    if (visits.length === 0) {
        container.appendChild(el('div', { 
            style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' },
            textContent: 'No visits recorded yet'
        }));
        return;
    }
    
    visits.forEach(v => {
        const custName = v.pharmacy_customers?.name || 'Unknown';
        const custId = v.pharmacy_customers?.customer_id || '';
        const typeIcon = { 'mr': '💊', 'walkin': '🚶', 'existing_patient': '🏥' }[v.customer_type] || '👤';
        
        container.appendChild(el('div', {
            style: { background: 'var(--surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '10px' },
            children: [
                el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
                    el('span', { style: { fontWeight: '600' }, textContent: custName }),
                    el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' }, textContent: v.visit_id })
                ]),
                el('div', { style: { fontSize: '12px', color: 'var(--text-muted)' }, 
                    textContent: `${typeIcon} ${custId} · ${new Date(v.visit_date).toLocaleDateString()}`
                }),
                v.symptoms_free_text ? el('div', { style: { marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }, 
                    textContent: `Symptoms: ${v.symptoms_free_text}`
                }) : null
            ].filter(Boolean)
        }));
    });
};

// ─── MR Verification ───────────────────────────────────────
const renderMrVerify = async (container) => {
    const { dbGetPharmacyCustomers, dbGetPharmacyMrDetail } = await import('../services/pharmacyService.js');
    
    const customers = await dbGetPharmacyCustomers(currentPharmacyOrg?.id);
    const mrCustomers = customers.filter(c => c.customer_type === 'mr');
    
    container.appendChild(el('div', { 
        style: { fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' },
        textContent: `${mrCustomers.length} Medical Representatives registered`
    }));
    
    if (mrCustomers.length === 0) {
        container.appendChild(el('div', { 
            style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' },
            textContent: 'No MRs registered yet'
        }));
        return;
    }
    
    for (const mr of mrCustomers) {
        const mrDetail = await dbGetPharmacyMrDetail(mr.id);
        
        container.appendChild(el('div', {
            style: { background: 'var(--surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '12px' },
            children: [
                el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } }, [
                    el('span', { style: { fontWeight: '600' }, textContent: mr.name }),
                    mrDetail?.is_verified 
                        ? el('span', { style: { background: 'var(--green)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }, textContent: '✓ Verified' })
                        : el('span', { style: { background: 'var(--orange)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }, textContent: 'Pending' })
                ]),
                el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }, textContent: mr.customer_id }),
                mrDetail ? el('div', { style: { fontSize: '12px', color: 'var(--text-muted)' }, 
                    textContent: `🏢 ${mrDetail.company_name || '-'} | 📱 ${mrDetail.phone || '-'} | 🪪 ${mrDetail.id_proof_type?.toUpperCase() || '-'}`
                }) : null
            ].filter(Boolean)
        }));
    }
};

// ─── Add Customer Modal ──────────────────────────────────────────
const showAddCustomerModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = 
        '<div class="modal" style="max-width:450px">' +
        '<div class="modal-header"><div><div class="modal-title">➕ Register Customer</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
        '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Customer Type</label><select id="pharmacyCustomerType" class="premium-input" onchange="toggleCustomerTypeFields()">' +
            '<option value="mr">💊 Medical Representative</option>' +
            '<option value="walkin">🚶 Walk-in Customer</option>' +
            '<option value="existing_patient">🏥 Link Existing Patient</option>' +
        '</select></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Full Name</label><input type="text" id="pharmacyCustomerName" class="premium-input" placeholder="Enter full name"></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Phone Number</label><input type="tel" id="pharmacyCustomerPhone" class="premium-input" placeholder="+91XXXXXXXXXX"></div>' +
        '<div id="mrFields" style="display:none">' +
            '<div class="field" style="margin-bottom:12px"><label>Company</label><input type="text" id="mrCompany" class="premium-input" placeholder="Company name"></div>' +
            '<div class="form-row" style="margin-bottom:12px"><div class="field"><label>ID Proof Type</label><select id="mrIdProofType" class="premium-input"><option value="">Select</option><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="dl">Driving License</option><option value="passport">Passport</option></select></div><div class="field"><label>ID Number</label><input type="text" id="mrIdNumber" class="premium-input" placeholder="ID number"></div></div>' +
        '</div>' +
        '<div id="walkinFields" style="display:none">' +
            '<div class="field" style="margin-bottom:12px"><label>Symptoms (Free Text)</label><textarea id="walkinSymptoms" class="premium-input" rows="3" placeholder="Describe symptoms..."></textarea></div>' +
        '</div>' +
        '<div id="patientFields" style="display:none">' +
            '<div class="field" style="margin-bottom:12px"><label>Search Patient</label><input type="text" id="patientSearch" class="premium-input" placeholder="Search by name or patient ID..." oninput="searchPatients(this.value)"></div>' +
            '<div id="patientSearchResults" style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px"></div>' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="submitPharmacyCustomer()">Register</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
    
    window.toggleCustomerTypeFields = () => {
        const type = document.getElementById('pharmacyCustomerType')?.value;
        document.getElementById('mrFields').style.display = type === 'mr' ? 'block' : 'none';
        document.getElementById('walkinFields').style.display = type === 'walkin' ? 'block' : 'none';
        document.getElementById('patientFields').style.display = type === 'existing_patient' ? 'block' : 'none';
    };
    
    window.searchPatients = async (query) => {
        if (!query || query.length < 2) return;
        const results = document.getElementById('patientSearchResults');
        results.innerHTML = '<div style="padding:8px;color:var(--text-muted)">Searching...</div>';
        
        const { dbSearchPatients } = await import('../services/pharmacyService.js');
        const patients = await dbSearchPatients(query);
        results.innerHTML = patients.slice(0, 5).map(p => 
            `<div class="patient-result" onclick="selectPatient('${p.id}','${p.patient_id}','${p.name}')" style="padding:8px;cursor:pointer;border-radius:4px;margin-bottom:4px;background:var(--surface)">${p.name} (${p.patient_id})</div>`
        ).join('') || '<div style="padding:8px;color:var(--text-muted)">No patients found</div>';
    };
    
    window.selectPatient = (id, patientId, name) => {
        document.getElementById('patientSearch').value = `${name} (${patientId})`;
        document.getElementById('patientSearch').dataset.patientId = id;
        document.getElementById('patientSearch').dataset.patientName = name;
    };
};

const submitPharmacyCustomer = async () => {
    const type = document.getElementById('pharmacyCustomerType')?.value;
    const name = document.getElementById('pharmacyCustomerName')?.value.trim();
    const phone = document.getElementById('pharmacyCustomerPhone')?.value.trim();
    
    if (!name) { showToast('Please enter name', 'error'); return; }
    
    let linkedPatientId = null;
    if (type === 'existing_patient') {
        linkedPatientId = document.getElementById('patientSearch')?.dataset.patientId;
        if (!linkedPatientId) { showToast('Please search and select a patient', 'error'); return; }
    }
    
    const { dbGeneratePharmacyCustomerId, dbUpsertPharmacyCustomer, dbUpsertPharmacyMrDetail } = await import('../services/pharmacyService.js');
    
    const customerId = await dbGeneratePharmacyCustomerId(type);
    
    const customer = {
        id: crypto.randomUUID(),
        customer_id: customerId,
        org_id: currentPharmacyOrg?.id,
        name,
        phone: phone || null,
        customer_type: type,
        linked_patient_id: linkedPatientId,
        is_active: true
    };
    
    const saved = await dbUpsertPharmacyCustomer(customer);
    if (!saved) { showToast('Failed to register customer', 'error'); return; }
    
    if (type === 'mr') {
        const company = document.getElementById('mrCompany')?.value.trim();
        const idProofType = document.getElementById('mrIdProofType')?.value;
        const idNumber = document.getElementById('mrIdNumber')?.value.trim();
        
        const mrDetail = {
            id: crypto.randomUUID(),
            customer_id: saved.id,
            company_name: company || null,
            id_proof_type: idProofType || null,
            id_proof_number: idNumber || null,
            is_verified: false
        };
        await dbUpsertPharmacyMrDetail(mrDetail);
    }
    
    showToast(`${name} registered successfully`, 'success');
    document.querySelector('.modal-overlay.open')?.remove();
    currentPharmacyView = 'customers';
    renderPharmacyContent();
};

const quickVisit = async (customer) => {
    currentPharmacyView = 'visits';
    renderPharmacyContent();
    showVisitModal(customer);
};

// ─── Visit Modal ───────────────────────────────────────────
const showVisitModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = 
        '<div class="modal" style="max-width:450px">' +
        `<div class="modal-header"><div><div class="modal-title">📝 New Visit - ${window.selectedCustomerName}</div></div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>` +
        '<div class="modal-body">' +
        `<div style="margin-bottom:12px;color:var(--text-muted)">Customer: ${window.selectedCustomerIdCard} | ${window.selectedCustomerType}</div>` +
        '<div id="symptomCheckboxes" style="margin-bottom:12px;max-height:200px;overflow-y:auto"></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Additional Symptoms</label><textarea id="visitFreeText" class="premium-input" rows="3" placeholder="Any other symptoms..."></textarea></div>' +
        '<div class="field"><label>Notes</label><textarea id="visitNotes" class="premium-input" rows="2" placeholder="Visit notes..."></textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-sm btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn-sm btn-teal" onclick="submitPharmacyVisit()">Log Visit</button></div>' +
        '</div>';
    document.body.appendChild(overlay);
    
    loadSymptomCheckboxes();
};

const loadSymptomCheckboxes = async () => {
    const container = document.getElementById('symptomCheckboxes');
    const { dbGetPharmacySymptoms } = await import('../services/pharmacyService.js');
    const symptoms = await dbGetPharmacySymptoms(currentPharmacyOrg?.id);
    
    if (symptoms.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted)">No symptoms configured</div>';
        return;
    }
    
    let categories = {};
    symptoms.forEach(s => {
        if (!categories[s.category]) categories[s.category] = [];
        categories[s.category].push(s);
    });
    
    let html = '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Select Symptoms</div>';
    for (const [cat, syms] of Object.entries(categories)) {
        html += `<div style="margin-bottom:8px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${cat}</div>`;
        html += syms.map(s => 
            `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;margin-bottom:4px;cursor:pointer"><input type="checkbox" value="${s.id}" class="symptom-check"> ${s.name}</label>`
        ).join('');
        html += '</div>';
    }
    container.innerHTML = html;
};

const submitPharmacyVisit = async () => {
    const selectedSymptoms = Array.from(document.querySelectorAll('.symptom-check:checked')).map(c => c.value);
    const freeText = document.getElementById('visitFreeText')?.value.trim();
    const notes = document.getElementById('visitNotes')?.value.trim();
    
    if (selectedSymptoms.length === 0 && !freeText) {
        showToast('Please select or describe symptoms', 'error');
        return;
    }
    
    const { dbGeneratePharmacyVisitId, dbUpsertPharmacyVisit } = await import('../services/pharmacyService.js');
    const visitId = await dbGeneratePharmacyVisitId();
    
    const visit = {
        id: crypto.randomUUID(),
        visit_id: visitId,
        org_id: currentPharmacyOrg?.id,
        customer_id: window.selectedCustomerId,
        customer_type: window.selectedCustomerType,
        symptom_ids: selectedSymptoms,
        symptoms_free_text: freeText || null,
        visit_date: new Date().toISOString(),
        notes: notes || null
    };
    
    const saved = await dbUpsertPharmacyVisit(visit);
    if (!saved) { showToast('Failed to log visit', 'error'); return; }
    
    showToast('Visit logged successfully', 'success');
    document.querySelector('.modal-overlay.open')?.remove();
    currentPharmacyView = 'visits';
    renderPharmacyContent();
};

// ─── Render Dashboard (Internal) ──────────────────────────
const renderPharmacyDashboard = async () => {
    renderPharmacyView();
};