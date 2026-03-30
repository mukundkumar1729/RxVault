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
import { showLabView, showDietView, showPortalView, showMedImageView } from './views/AiFeatureView.js';
import { openOpdViewSecure } from './views/OpdView.js';

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
const finalizeApplicationMount = () => {
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

    // Trigger AI Mount
    initAiSearchPanelSecure();

    // Trigger Clinical Form Binding safely over Legacy inputs
    attachClinicalHooks();

    // Trigger Legacy Initialization for untouched monolith segments (Phase 5 bridge)
    if (typeof window.initAppForClinic === 'function') {
        window.initAppForClinic();
    }
};

// ── Bridge to UI Events ──

window.selectClinicFinalize = (id) => {
    setActiveClinic(id);
    finalizeApplicationMount();
};

// Map Top-Level Navigation Routes strictly
window.showLocationDirectoryView = openLocationDirectory;
window.showAnalyticsDashboard = openAnalyticsDashboardSecure;

// Phase 6 Final Routing Bindings
window.showAppointments = openAppointmentViewSecure;
window.showBilling = openBillingViewSecure;
window.openVitalsModal = openVitalsModalSecure;
window.openPatientTimeline = openPatientTimelineSecure;
window.showLabView = showLabView;
window.showDietView = showDietView;
window.showPortalView = showPortalView;
window.showMedImageView = showMedImageView;
window.showOpdView = openOpdViewSecure;

window.authLogout = authLogout;

// Begin Bootstrap on load
document.addEventListener('DOMContentLoaded', bootstrapApp);
