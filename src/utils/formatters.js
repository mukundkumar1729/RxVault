// ════════════════════════════════════════════════════════════
//  DATE & TEXT FORMATTERS (ES6 Module)
// ════════════════════════════════════════════════════════════

/**
 * Formats a Date object or ISO string into a locale-friendly Indian standard string.
 * @param {string|Date} d - The date to format
 * @returns {string} e.g. "24 Oct 2023"
 */
export const formatDate = (d) => {
    if (!d) return '—';
    try {
      const ds = String(d).length > 10 ? d : `${d}T00:00:00`;
      return new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return d;
    }
};
  
/**
 * Adds days to a given YYYY-MM-DD string.
 * @param {string} dateStr 
 * @param {number} days 
 * @returns {string} ISO Date string
 */
export const addDays = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

/**
 * Returns today's date formatted as YYYY-MM-DD.
 * @returns {string}
 */
export const todayISO = () => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Capitalizes the first letter of a string safely.
 * @param {string} str 
 * @returns {string}
 */
export const capitalize = (str) => {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
};
