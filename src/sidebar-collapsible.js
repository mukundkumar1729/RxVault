// ════════════════════════════════════════════════════════════
//  SIDEBAR COLLAPSIBLE SECTIONS
//  - Toggles sections open/closed with animation
//  - Persists state to localStorage
//  - Shows a teal dot when a section has an active item but is collapsed
// ════════════════════════════════════════════════════════════

var SIDEBAR_STATE_KEY = 'rxvault_sidebar_state';

// ─── Toggle a sidebar section open / closed ──────────────
function toggleSidebarSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;

  var isCollapsed = section.classList.toggle('collapsed');

  // Persist state
  saveSidebarState(sectionId, isCollapsed);

  // Update active dot visibility for this section
  updateSectionDot(section);
}

// ─── Save collapsed state to localStorage ────────────────
function saveSidebarState(sectionId, isCollapsed) {
  var state = loadSidebarStateRaw();
  if (isCollapsed) {
    state[sectionId] = 'collapsed';
  } else {
    delete state[sectionId]; // open is the default, no need to store
  }
  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state));
  } catch(e) {}
}

function loadSidebarStateRaw() {
  try {
    return JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY) || '{}');
  } catch(e) { return {}; }
}

// ─── Restore sidebar state on page load ──────────────────
function restoreSidebarState() {
  var state = loadSidebarStateRaw();
  document.querySelectorAll('.sidebar-collapsible').forEach(function(section) {
    if (state[section.id] === 'collapsed') {
      section.classList.add('collapsed');
    }
    updateSectionDot(section);
  });
}

// ─── Update the active-dot indicator ─────────────────────
// Shows a small teal dot on the section label when:
// the section is collapsed AND contains an active nav item
function updateSectionDot(section) {
  var isCollapsed = section.classList.contains('collapsed');
  var hasActive   = section.querySelector('.nav-item.active') !== null;
  var dotId       = 'dot' + section.id.replace('sidebar', '');
  var dot         = document.getElementById(dotId);
  if (!dot) return;
  if (isCollapsed && hasActive) {
    dot.classList.add('visible');
  } else {
    dot.classList.remove('visible');
  }
}

// ─── Refresh all dots (call after nav-item active changes) ─
function refreshSidebarDots() {
  document.querySelectorAll('.sidebar-collapsible').forEach(function(section) {
    updateSectionDot(section);
  });
}

// ─── Collapse all sections ────────────────────────────────
function collapseAllSidebarSections() {
  document.querySelectorAll('.sidebar-collapsible').forEach(function(section) {
    section.classList.add('collapsed');
    saveSidebarState(section.id, true);
    updateSectionDot(section);
  });
}

// ─── Expand all sections ──────────────────────────────────
function expandAllSidebarSections() {
  document.querySelectorAll('.sidebar-collapsible').forEach(function(section) {
    section.classList.remove('collapsed');
    saveSidebarState(section.id, false);
    updateSectionDot(section);
  });
}

// ─── Auto-expand the section that contains the active item ─
// Call this whenever the active nav item changes
function expandActiveSection() {
  document.querySelectorAll('.sidebar-collapsible').forEach(function(section) {
    if (section.querySelector('.nav-item.active')) {
      section.classList.remove('collapsed');
      saveSidebarState(section.id, false);
      updateSectionDot(section);
    }
  });
}

// ─── Init on DOM ready ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  restoreSidebarState();

  // Patch setNavActive (defined in features.js) to also refresh dots
  if (typeof setNavActive === 'function') {
    var _origSetNavActive = setNavActive;
    setNavActive = function(navId) {
      _origSetNavActive(navId);
      // Small delay so the class has been applied
      setTimeout(refreshSidebarDots, 20);
    };
  }

  // Also hook into the nav-item click directly as a fallback
  document.querySelectorAll('.sidebar .nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setTimeout(refreshSidebarDots, 30);
    });
  });
});
