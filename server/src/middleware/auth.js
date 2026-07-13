/**
 * File purpose: Verifies signed sessions and protects cookie-authenticated mutations from CSRF.
 */
import jwt from 'jsonwebtoken';
import { isDatabaseConnected } from '../config/db.js';
import User from '../models/User.js';
import { findDemoUserById } from '../utils/demoStore.js';
import { csrfTokensMatch, readRequestCookie } from '../utils/sessionCookies.js';
import { getJwtSecret } from '../utils/tokens.js';

/**
 * Verifies an HttpOnly session cookie or an explicit bearer token and attaches its user to the request.
 * Bearer support remains for tests and non-browser clients; the React app uses only the safer cookie path.
 * @param {object} req - Express request containing cookie or Authorization credentials.
 * @param {object} res - Express response used for authentication failures.
 * @param {Function} next - Express callback that continues to the protected handler.
 * @returns {Promise<void>} Resolves after authentication succeeds or an error response is sent.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = readRequestCookie(req);
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = isDatabaseConnected() ? await User.findById(decoded.userId).select('-passwordHash') : findDemoUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    if (Number(decoded.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    req.user = user;
    req.auth = decoded;
    req.authMethod = bearerToken ? 'bearer' : 'cookie';
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

/**
 * Requires a matching CSRF header for state-changing requests authenticated by an automatic cookie.
 * Explicit bearer tokens are exempt because browsers do not attach Authorization headers cross-site automatically.
 * @param {object} req - Authenticated Express request.
 * @param {object} res - Express response used for CSRF failures.
 * @param {Function} next - Express callback that continues to the protected handler.
 * @returns {void} Continues safe requests or returns a 403 response.
 */
export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.authMethod !== 'cookie') {
    next();
    return;
  }

  const suppliedToken = req.get('x-csrf-token');
  if (!csrfTokensMatch(req.auth?.csrfToken, suppliedToken)) {
    res.status(403).json({
      message: 'Your secure session could not be validated. Refresh the page and try again.',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }

  next();
}