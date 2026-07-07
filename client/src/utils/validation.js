/**
 * File purpose: Holds small shared validation helpers used by forms before calling the API.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_REQUIREMENT_MESSAGE = 'Password must be at least 8 characters and include one uppercase letter and one special character.';

/**
 * Checks whether a value looks like a normal email address.
 * This is intentionally simple because the server and browser should only reject obvious mistakes here.
 * @param {*} value - Email value typed by the user.
 * @returns {boolean} True when the value has a valid email shape.
 */
export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim().toLowerCase());
}
/**
 * Checks whether a password meets the minimum StockPulse account rule.
 * Keeping this helper shared lets register and account settings show the same guidance.
 * @param {*} value - Password value typed by the user.
 * @returns {boolean} True when the password is long enough and includes required character types.
 */
export function isStrongPassword(value) {
  return PASSWORD_PATTERN.test(String(value || ''));
}
