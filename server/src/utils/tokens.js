/**
 * File purpose: Provides focused Tokens helper functions that keep repeated logic out of larger modules.
 */
import jwt from 'jsonwebtoken';

// Authentication must always use the private secret configured for this server.
/**
 * Returns the jwt secret needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {string} The configured JWT signing secret.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

// JWT payloads stay small while binding the user, CSRF companion, and revocation version to one signed session.
/**
 * Creates a signed JWT that identifies an authenticated user.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} session - Security values bound to this browser session.
 * @param {string|undefined} session.csrfToken - CSRF token required for cookie-authenticated mutations.
 * @param {number} session.sessionVersion - Account session version used to revoke older tokens.
 * @returns {string} A signed JWT for the supplied user identifier and session.
 */
export function signToken(userId, { csrfToken, sessionVersion = 0 } = {}) {
  const payload = { userId, sessionVersion: Number(sessionVersion || 0) };
  if (csrfToken) payload.csrfToken = csrfToken;
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}
