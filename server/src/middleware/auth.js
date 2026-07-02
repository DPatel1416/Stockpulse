/**
 * File purpose: Defines reusable Auth Express middleware that runs before or after route handlers.
 */
import jwt from 'jsonwebtoken';
import { isDatabaseConnected } from '../config/db.js';
import User from '../models/User.js';
import { findDemoUserById } from '../utils/demoStore.js';
import { getJwtSecret } from '../utils/tokens.js';

// Protected routes accept real JWTs and also support the in-memory demo user fallback.
/**
 * Verifies the bearer token and attaches the authenticated user to the request.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @param {*} next - Express callback that passes control or an error to the next middleware.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = isDatabaseConnected() ? await User.findById(decoded.userId).select('-passwordHash') : findDemoUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
