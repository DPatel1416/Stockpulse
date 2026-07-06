/**
 * File purpose: Holds small shared validation helpers used by forms before calling the API.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks whether a value looks like a normal email address.
 * This is intentionally simple because the server and browser should only reject obvious mistakes here.
 * @param {*} value - Email value typed by the user.
 * @returns {boolean} True when the value has a valid email shape.
 */
export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim().toLowerCase());
}
