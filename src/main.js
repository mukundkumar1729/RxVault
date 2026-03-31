// ════════════════════════════════════════════════════════════
//  RxVault MAIN ENTRY POINT (ES6 Modular Architecture)
//  Boots Authentication -> Tenancy (Clinic) -> Data -> Router
// ════════════════════════════════════════════════════════════

import { store } from './core/store.js';
import { syncCurrentUserStatus, authLogout } from './services/authService.js';
import { executeAuthGate } from './views/AuthView.js';
import { loadAuthorizedClinics, resolveInitialClinicRoute, getActiveClinic, setActiveClinic } from './services/clinicService.js';
import { openClinicGate, closeClinicGate, renderClinicSelectionGrid } from './views/ClinicView.js';

// Global Patching for Legacy Interop during transition (Phase 5 bridge)
import { openLocationDirectory } from './views/LocationView.js';
import { initAiSearchPanelSecure } from './views/AiView.js';
import { openAnalyticsDashboardSecure } from './views/AnalyticsView.js';
import { attachClinicalHooks } from './views/ClinicalView.js';

// Final Phase 6 Modular View Imports
import { openAppointmentViewSecure } from './views/AppointmentView.js';
import { openBillingViewSecure } from './views/BillingView.js';
import { openVitalsModalSecure } from './views/VitalsView.js';
import { openPatientTimelineSecure } from './views/TimelineView.js';
import { openLabViewSecure, openDietViewSecure, openPortalViewSecure, openMedImageViewSecure } from './views/AiFeatureView.js';
import { openOpdBoardViewSecure, openVaccinationViewSecure, openFollowupViewSecure } from './views/OpdView.js';
import { initPrescriptionView, applyFilters, clearFilters, setView, filterByType } from './views/PrescriptionView.js';
import { initDoctorsView, renderDoctorsGrid } from './views/DoctorView.js';
import { initPatientsView, renderPatientsGrid } from './views/PatientView.js';
import { hideAllViews } from './utils/dom.js';

/**
 * Stage 1: Authentication Initialization
 */
const bootstrapApp = async () => {
    console.log('[RxVault] Application Bootstrap Initialized');
    
    // Validate session token with server
    const user = await syncCurrentUserStatus();
    
    if (!user) {
        console.log('[RxVault] No active session. Halting boot sequence for Auth Gate.');
        // If not authenticated, open login/register gate
        executeAuthGate();
        return;
    }

    console.log(`[RxVault] Session Valid: ${user.name}`);
    
    // UI Setup: Ensure sidebars are visible for authenticated users
    const sidebar = document.getElementById('appShellSideNavbar');
    if (sidebar) sidebar.style.display = 'block';

    // ── Legacy Bridging for Untouched Monolith Components ──
    window.currentUser = store.currentUser;
    // Bind legacy permissions object manually
    import('./services/authService.js').then(module => {
        window.getEffectiveRole = module.getEffectiveRole;
        window.isSuperAdmin = module.isSuperAdmin;
        window.hasRole = module.hasRole;
        window.can = module.can;
    });

    // Stage 2: Clinic Tenancy Resolution
    await initializeTenancyGate(user);
};

/**
 * Stage 2: Clinic Hydration and Routing
 */
const initializeTenancyGate = async (user) => {
    // Show a loading state if global exists
    if (typeof window.showLoading === 'function') window.showLoading('Loading clinics…');

    const clinics = await loadAuthorizedClinics(user);
    const route = resolveInitialClinicRoute(clinics);
    
    if (typeof window.hideLoading === 'function') window.hideLoading();

    if (route === 'EMPTY') {
        const isSuperAdmin = typeof window.isSuperAdmin === 'function' ? window.isSuperAdmin() : false;
        if (isSuperAdmin) {
            openClinicGate();
        } else {
            if (typeof window.showToast === 'function') window.showToast('No clinics assigned. Contact your admin.', 'error');
            logoutSession();
        }
        return;
    }

    if (route === 'MULTIPICK') {
        openClinicGate();
        return;
    }

    // route === 'READY' (Single clinic auto-resolved, or localStorage restored)
    finalizeApplicationMount();
};

/**
 * Stage 3: Feature System Mount
 */
const finalizeApplicationMount = async () => {
    closeClinicGate();
    
    const activeClinic = getActiveClinic();
    if (!activeClinic) return;

    // Render Global Topbars
    const topClinicName = document.getElementById('topbarClinicName');
    const topClinicIcon = document.getElementById('topbarClinicIcon');
    if (topClinicName) topClinicName.textContent = activeClinic.name;
    if (topClinicIcon) topClinicIcon.textContent = activeClinic.logo || '🏥';

    // Render User
    const topUserName = document.getElementById('topbarUserName');
    const topUserRole = document.getElementById('topbarUserRole');
    if (topUserName && store.currentUser) topUserName.textContent = store.currentUser.name;
    if (topUserRole && store.currentUser) topUserRole.textContent = window.formatRole ? window.formatRole(store.currentUser.role) : store.currentUser.role;

    // Initialize Modular Views BEFORE data hydration to ensure subscribers catch the update
    initDoctorsView();
    initPatientsView();
    initPrescriptionView();

    // ── DATA HYDRATION ──
    // Fetch base records to populate badges and dashboard counts
    try {
        if (typeof window.dbGetPrescriptions === 'function') store.prescriptions = await window.dbGetPrescriptions(activeClinic.id);
        if (typeof window.dbGetDoctors === 'function') store.doctors = await window.dbGetDoctors(activeClinic.id);
        if (typeof window.dbGetPatients === 'function') store.patients = await window.dbGetPatients(activeClinic.id);
        if (typeof window.dbGetAppointments === 'function') store.appointments = await window.dbGetAppointments(activeClinic.id);
        if (typeof window.dbGetInvoices === 'function') store.invoices = await window.dbGetInvoices(activeClinic.id);
        
        refreshGlobalCounts();
        
        // Force initial view renders if they are active
        renderDoctorsGrid(store.doctors);
        renderPatientsGrid(store.patients);
        if (!store.currentView || store.currentView === 'all') applyFilters();
        
    } catch (e) {
        console.error('[RxVault] Data hydration failed:', e);
    }

    // Trigger AI Mount
    initAiSearchPanelSecure();

    // Trigger Clinical Form Binding safely over Legacy inputs
    attachClinicalHooks();


    // Trigger Legacy Initialization for untouched monolith segments (Phase 5 bridge)
    if (typeof window.initAppForClinic === 'function') {
        window.initAppForClinic();
    }
};

/**
 * Updates all sidebar badges and dashboard count cards based on current store state.
 */
export const refreshGlobalCounts = () => {
    const counts = {
        all: (store.prescriptions || []).length,
        doctors: (store.doctors || []).length,
        patients: (store.patients || []).length,
        appointments: (store.appointments || []).length,
        billing: (store.invoices || []).length,
        pharmacy: (store.prescriptions || []).filter(r => r.status === 'active').length
    };

    // Update Dashboard Cards
    const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    updateEl('statsTotal', counts.all);
    updateEl('badgeAll', counts.all);
    updateEl('badgeDoctors', counts.doctors);
    updateEl('badgePatients', counts.patients);
    updateEl('badgeAppointments', counts.appointments);
    updateEl('badgeBilling', counts.billing);
    updateEl('badgePharmacy', counts.pharmacy);

    // Update specific Rx type counts if dashboard elements are present
    const types = ['allopathy', 'homeopathy', 'ayurveda'];
    types.forEach(t => {
        const c = (store.prescriptions || []).filter(r => r.type === t).length;
        updateEl(`stats${t.charAt(0).toUpperCase() + t.slice(1)}`, c);
        updateEl(`badge${t.charAt(0).toUpperCase() + t.slice(1)}`, c);
    });
};

// ── Bridge to UI Events ──

window.selectClinicFinalize = (id) => {
    setActiveClinic(id);
    finalizeApplicationMount();
};

// Map Top-Level Navigation Routes strictly to Sidebar Event Handlers
window.showDoctorView = () => {
    setView('doctors');
    renderDoctorsGrid(store.doctors);
};
window.showPatientsView = () => {
    setView('patients');
    renderPatientsGrid(store.patients);
};
window.showAppointmentView = openAppointmentViewSecure;
window.showStaffListView = () => setView('staff');
window.showLocationDirectoryView = openLocationDirectory;
window.showPharmacyView = () => setView('pharmacy');
window.showStockView = () => setView('stock');
window.showBillingView = openBillingViewSecure;

window.showLabOrdersView = () => setView('labOrders');
window.showFollowupView = openFollowupViewSecure;
window.showVaccinationView = openVaccinationViewSecure;
window.showOpdBoardView = openOpdBoardViewSecure;

window.showAnalyticsDashboard = openAnalyticsDashboardSecure;
window.showAnalyticsView = () => setView('analytics');
window.showOutbreakView = () => setView('outbreak');
window.showRosterView = () => setView('roster');

window.openAdminPanel = () => setView('admin');
window.openStaffModal = () => setView('staff');
window.openClinicSwitcher = openClinicGate;
window.toggleUserMenu = () => {
    const dropdown = document.querySelector('.user-menu-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
};

// Phase 6 Final Routing Bindings
window.showAppointments = openAppointmentViewSecure;
window.showBilling = openBillingViewSecure;
window.openVitalsModal = openVitalsModalSecure;
window.openPatientTimeline = openPatientTimelineSecure;
window.showLabView = openLabViewSecure;
window.showDietView = openDietViewSecure;
window.showPortalView = openPortalViewSecure;
window.showMedImageView = openMedImageViewSecure;
window.showOpdView = openOpdBoardViewSecure;

// Native Web-component routing handlers mapped from index.html
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.setView = setView;
window.filterByType = filterByType;
window.hideAllViews = hideAllViews;
window.refreshGlobalCounts = refreshGlobalCounts;

if (typeof window.openAddModal !== 'function') {
    window.openAddModal = () => {
       // Fallback bridge to legacy form script if already loaded
       if (typeof window._openAddModalLegacy === 'function') window._openAddModalLegacy();
    };
}

window.authLogout = authLogout;

// Begin Bootstrap on load
document.addEventListener('DOMContentLoaded', bootstrapApp);
