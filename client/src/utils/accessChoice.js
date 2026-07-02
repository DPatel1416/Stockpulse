/**
 * File purpose: Provides focused Access Choice helper functions that keep repeated logic out of larger modules.
 */
export const ACCESS_CHOICE_KEY = 'stockpulse_access_choice';

// Persisting the choice prevents the welcome dialog from interrupting returning guests.
/**
 * Stores whether a visitor chose guest access or an account flow.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {'guest'|'account'} choice - Access mode selected by the visitor.
 * @returns {*} The remember access choice result.
 */
export function rememberAccessChoice(choice) {
  localStorage.setItem(ACCESS_CHOICE_KEY, choice);
}
