// ════════════════════════════════════════════════════════════
//  ANALYTICS SERVICE
//  Handles computing clinical aggregates, statistical arrays, and reports
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';

/**
 * Derives comprehensive clinical KPI aggregates for the active clinic environment
 */
export const computeClinicalDashboard = () => {
    const rx = store.prescriptions || [];
    const invoices = window.invoices || []; // Optional integration with legacy global till Phase 5
    const patients = window.patientRegistry || []; // Legacy integration

    const total = rx.length;
    const activeRx = rx.filter(p => p.status === 'active').length;
    
    const now = new Date();
    const thisMonth = rx.filter(p => {
        const d = new Date(p.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Diagnoses frequency
    const diagCount = {};
    rx.forEach(p => {
        if (!p.diagnosis) return;
        const diag = p.diagnosis.split(/[,\n]/)[0].trim();
        if (diag) diagCount[diag] = (diagCount[diag] || 0) + 1;
    });
    const topDiags = Object.entries(diagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Medicine usage
    const medCount = {};
    rx.forEach(p => {
        (p.medicines || []).forEach(m => {
            if (m.name) medCount[m.name] = (medCount[m.name] || 0) + 1;
        });
    });
    const topMeds = Object.entries(medCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Type distribution
    const alloCount = rx.filter(p => p.type === 'allopathy').length;
    const homoCount = rx.filter(p => p.type === 'homeopathy').length;
    const ayurCount = rx.filter(p => p.type === 'ayurveda').length;

    // Doctor performance
    const docCount = {};
    rx.forEach(p => { if (p.doctorName) docCount[p.doctorName] = (docCount[p.doctorName] || 0) + 1; });
    const topDoctors = Object.entries(docCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Monthly trend (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const month = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        const count = rx.filter(p => {
            const pd = new Date(p.date);
            return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        }).length;
        monthlyData.push({ month, count });
    }

    // Revenue trend
    const monthlyRevenue = [];
    for (let j = 5; j >= 0; j--) {
        const dr = new Date(); dr.setMonth(dr.getMonth() - j);
        const rev = invoices.filter(inv => {
            if (inv.status !== 'paid') return false;
            const id = new Date(inv.invoice_date);
            return id.getMonth() === dr.getMonth() && id.getFullYear() === dr.getFullYear();
        }).reduce((s, inv) => s + (parseFloat(inv.total_amount) || 0), 0);
        monthlyRevenue.push({ month: dr.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), rev });
    }

    return {
        total,
        activeRx,
        thisMonth,
        patientCount: patients.length,
        topDiags,
        topMeds,
        topDoctors,
        typeDist: { allopathy: alloCount, homeopathy: homoCount, ayurveda: ayurCount },
        monthlyData,
        monthlyRevenue
    };
};

/**
 * Triggers a CSV Payload Generation securely
 */
export const generateReportCSV = () => {
    const rx = store.prescriptions || [];
    const patients = window.patientRegistry || [];
    
    const diagCount = {};
    rx.forEach(p => {
        if (!p.diagnosis) return;
        const diag = p.diagnosis.split(/[,\n]/)[0].trim();
        if (diag) diagCount[diag] = (diagCount[diag] || 0) + 1;
    });
    
    const medCount = {};
    rx.forEach(p => { (p.medicines || []).forEach(m => { if (m.name) medCount[m.name] = (medCount[m.name] || 0) + 1; }); });
    
    const docCount = {};
    rx.forEach(p => { if (p.doctorName) docCount[p.doctorName] = (docCount[p.doctorName] || 0) + 1; });

    let csv = `Rx Vault Clinical Report\nClinic: ${store.activeClinicId || ''}\nGenerated: ${new Date().toLocaleString('en-IN')}\n\n`;
    csv += `SUMMARY\nTotal Prescriptions,${rx.length}\nActive Prescriptions,${rx.filter(p => p.status === 'active').length}\nTotal Patients,${patients.length}\n\n`;
    csv += 'TOP DIAGNOSES\nDiagnosis,Count\n' + Object.entries(diagCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => `${e[0]},${e[1]}`).join('\n') + '\n\n';
    csv += 'TOP MEDICINES\nMedicine,Prescriptions\n' + Object.entries(medCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => `${e[0]},${e[1]}`).join('\n') + '\n\n';
    csv += 'DOCTOR PERFORMANCE\nDoctor,Prescriptions\n' + Object.entries(docCount).sort((a, b) => b[1] - a[1]).map(e => `Dr. ${e[0]},${e[1]}`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rxvault_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); 
    URL.revokeObjectURL(url);
};
