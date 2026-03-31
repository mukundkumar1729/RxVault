// ════════════════════════════════════════════════════════════
//  DOM UTILITIES (XSS Hardened)
// ════════════════════════════════════════════════════════════

/**
 * Creates an HTMLElement safely preventing DOM-based XSS attacks.
 * Replaces direct `.innerHTML` setting across the application.
 *
 * @param {string} tag - The HTML tag to create (e.g., 'div', 'button').
 * @param {Object} [props={}] - Element properties & attributes.
 *   - Use `className` for classes.
 *   - Use `text` or `textContent` for safe text injection (not HTML).
 *   - Use `dataset` for data-* attributes.
 *   - Use `on[Event]` for attaching event listeners securely.
 * @param {Array<HTMLElement|string>} [children=[]] - Nested DOM elements. Strings injected as safely-escaped TextNodes.
 * @returns {HTMLElement} A securely constructed HTML element.
 */
export const el = (tag, props = {}, children = []) => {
    const element = document.createElement(tag);
  
    // Secure attribute / property assignment
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className' || key === 'class') {
        element.className = value;
      } else if (key === 'text' || key === 'textContent') {
        // Enforces `.textContent`, neutralizing XSS payloads
        element.textContent = value;
      } else if (key === 'html' || key === 'innerHTML') {
        console.warn(`[DOM Security] Unsafe innerHTML injection attempted on <${tag}>. Blocked.`);
        element.textContent = '[XSS BLOCKED]';
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Safe direct event listener binding avoiding inline JS strings
        const eventType = key.slice(2).toLowerCase();
        element.addEventListener(eventType, value);
      } else {
        // Set standard attributes natively
        element.setAttribute(key, value);
      }
    });
  
    // Child injection
    children.forEach(child => {
      if (child == null) return;
      if (typeof child === 'string' || typeof child === 'number') {
        // Strings are strictly appended as Text Nodes, eliminating execution
        element.appendChild(document.createTextNode(String(child)));
      } else if (child instanceof HTMLElement || child instanceof DocumentFragment) {
        element.appendChild(child);
      } else if (Array.isArray(child)) {
          child.forEach(c => {
              if(c instanceof HTMLElement) element.appendChild(c);
              else if (typeof c === 'string' || typeof c === 'number') element.appendChild(document.createTextNode(String(c)));
          })
      }
    });
  
    return element;
  };
  
  /**
   * Securely empties a parent container node, avoiding `.innerHTML = ''`
   * @param {HTMLElement} parent - The target container.
   */
  export const emptyNode = (parent) => {
      if (!parent) return;
      while (parent.firstChild) {
          parent.removeChild(parent.firstChild);
      }
  };
  
  /**
   * Helper to escape HTML characters before output in contexts where element creation is impossible
   * @param {string} str 
   * @returns {string} escaped HTML string
   */
  export const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

/**
 * Hides all view containers to allow a clean state before mounting a new view.
 */
export const hideAllViews = () => {
    const ids = [
        'statsRow', 'controlsBar', 'prescriptionsList', 'aiSearchPanel',
        'doctorsView', 'patientsView', 'pharmacyView',
        'appointmentView', 'billingView', 'vitalsView',
        'labView', 'dietView', 'portalView', 'medImageView',
        'analyticsView', 'rosterView', 'stockView',
        'opdBoardView', 'vaccinationView', 'followupView',
        'locationDirView', 'labOrdersView'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
};
