/**
 * File purpose: Provides focused Format helper functions that keep repeated logic out of larger modules.
 */
// Small formatting helpers keep currency, percent, and volume labels consistent across pages.
/**
 * Formats the currency for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

/**
 * Formats the compact number for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
export function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
}

/**
 * Formats the percent for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
export function formatPercent(value) {
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
}

/**
 * Returns the change class needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The CSS class representing positive, negative, or neutral movement.
 */
export function getChangeClass(value) {
  return Number(value) >= 0 ? 'positive' : 'negative';
}
