/**
 * Fetches HTML content from a URL and injects it into a target container.
 * @param {string} url - The path to the HTML file.
 * @param {string} targetId - The ID of the div where content should be rendered.
 */
// 1. Configuration: Add all your page mappings here
const COMPONENT_CONFIG = [
    { url: 'component/appshell-side-navbar.html', targetId: 'appShellSideNavbar' },
    { url: 'component/appshell-topbar.html', targetId: 'appshellTopbar' },
    { url: 'component/stats-row.html', targetId: 'statsRow' },
    { url: 'component/controls-bar.html', targetId: 'controlsBar' },
    { url: 'component/admin-modal.html', targetId: 'adminModal' },
    { url: 'component/add-doctor.html', targetId: 'doctorFormModal' },
    { url: 'component/patient-reg.html', targetId: 'registerModal' },
    { url: 'component/staff-management.html', targetId: 'staffModal' },
    { url: 'component/change-password.html', targetId: 'changePassModal' },
    { url: 'component/rx-modal.html', targetId: 'rxFormModal' },
    { url: 'component/body-map.html', targetId: 'bodyMapContainer', callback: 'initBodyMap' },
    { url: 'component/clinic-gate.html', targetId: 'clinicGate' },
    { url: 'component/delete-confirmation.html', targetId: 'confirmModal' },
];


async function loadComponent({ url, targetId, callback }) {
    const container = document.getElementById(targetId);
    if (!container) {
        console.warn(`[Loader] Container #${targetId} not found for ${url}`);
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        container.innerHTML = html;

        // Execute callback if provided
        if (callback && typeof window[callback] === 'function') {
            window[callback]();
        }
    } catch (err) {
        console.error(`Failed to load ${url}:`, err);
    }
}

async function initializeDashboard() {

    for (const config of COMPONENT_CONFIG) {
        await loadComponent(config);
    }

}


// Fire it off!
initializeDashboard();