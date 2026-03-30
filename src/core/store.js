// ════════════════════════════════════════════════════════════
//  CORE STORE (Reactive State via Proxy)
// ════════════════════════════════════════════════════════════

// Callbacks map: stores listeners for each state key
const listeners = new Map();

// Helper to determine deep equalization to prevent infinite loops
const isEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
  }
  return true;
};

// The proxy trap wrapper for nested objects to trigger root updates
const createReactiveObject = (target, callback, prefix = '') => {
  return new Proxy(target, {
    set(obj, prop, value) {
      if (!isEqual(obj[prop], value)) {
        obj[prop] = typeof value === 'object' && value !== null ? createReactiveObject(value, callback, `${prefix}${prop}.`) : value;
        // Trigger root callback for structured traversal
        callback(`${prefix}${prop}`, value);
      }
      return true;
    },
    get(obj, prop) {
        return obj[prop];
    }
  });
};

const triggerListeners = (key, value) => {
  // exact key listeners
  if (listeners.has(key)) {
    listeners.get(key).forEach(fn => fn(value));
  }
  // catch-all listeners (wildcard '*')
  if (listeners.has('*')) {
    listeners.get('*').forEach(fn => fn(key, value));
  }
};

// Initial state object
const initialState = {
  currentUser: null,
  currentRole: null,
  activeClinicId: null,
  clinics: [],
  isMobile: window.innerWidth <= 768,
  uiElements: {
    sidebarExpanded: true,
    activeTab: 'dashboard'
  }
};

/**
 * 💡 The Reactive Store
 * Use this store to modify state across the application. Any connected UI will automatically re-render.
 * Avoid modifying the global `window` object in favor of `store`.
 */
export const store = createReactiveObject(initialState, triggerListeners);

/**
 * Subscribe to state changes.
 * @param {string} key - The state key to watch (e.g. 'currentUser' or 'uiElements.sidebarExpanded')
 * @param {Function} callback - Function executed on state change.
 * @returns {Function} unsubscribe function.
 */
export const subscribe = (key, callback) => {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(callback);
  
  // Return cleanup mechanism
  return () => {
    const list = listeners.get(key);
    if (list) {
      list.delete(callback);
      if (list.size === 0) listeners.delete(key);
    }
  };
};

/**
 * Standardizes app initialization by wiping potentially stale state
 */
export const resetStore = () => {
    Object.keys(initialState).forEach(key => {
        store[key] = typeof initialState[key] === 'object' && initialState[key] !== null 
                     ? JSON.parse(JSON.stringify(initialState[key])) 
                     : initialState[key];
    });
};
