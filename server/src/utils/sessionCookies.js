/**
 * File purpose: Creates, reads, and clears secure browser-session cookies and CSRF tokens.
 */
import { randomBytes, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE_NAME = 'stockpulse_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Detects hosted production environments where cookies must be restricted to HTTPS.
 * Render exposes deployment variables even when NODE_ENV was not set explicitly.
 * @returns {boolean} True when the cookie must include the Secure attribute.
 */
function isProductionSession() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
}

/**
 * Returns the shared cookie attributes used when creating the browser session.
 * SameSite=Lax works because Vercel proxies /api through the frontend origin in production.
 * @returns {object} Express cookie options for a seven-day HttpOnly session.
 */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProductionSession(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
    priority: 'high',
  };
}

/**
 * Writes the signed JWT into a cookie that browser JavaScript cannot read.
 * @param {object} res - Express response receiving the Set-Cookie header.
 * @param {string} token - Signed JWT session token.
 * @returns {void} The response is updated with the session cookie.
 */
export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/**
 * Removes the session using the same attributes that were used to create it.
 * @param {object} res - Express response receiving the expired cookie header.
 * @returns {void} The response is updated to clear the browser session.
 */
export function clearSessionCookie(res) {
  const { maxAge, ...options } = getSessionCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

/**
 * Reads one cookie value from an incoming request without adding a parsing dependency.
 * JWT cookie values use URL-safe characters, while decodeURIComponent handles encoded clients safely.
 * @param {object} req - Express request containing the Cookie header.
 * @param {string} name - Cookie name to locate.
 * @returns {string|null} Decoded cookie value, or null when absent.
 */
export function readRequestCookie(req, name = SESSION_COOKIE_NAME) {
  const header = String(req.headers?.cookie || '');

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Creates the per-session token required on cookie-authenticated state-changing requests.
 * @returns {string} Cryptographically random CSRF token returned to the trusted frontend.
 */
export function createCsrfToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Compares CSRF tokens without leaking partial-match timing information.
 * @param {string|undefined} expected - Token signed inside the JWT.
 * @param {string|undefined} provided - Token supplied by the frontend request header.
 * @returns {boolean} True only when both complete tokens match.
 */
export function csrfTokensMatch(expected, provided) {
  const expectedBuffer = Buffer.from(String(expected || ''));
  const providedBuffer = Buffer.from(String(provided || ''));
  if (!expectedBuffer.length || expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}