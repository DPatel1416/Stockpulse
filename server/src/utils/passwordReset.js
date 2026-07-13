/**
 * File purpose: Generates one-time password-reset tokens and limits reset-email requests.
 */
import { createHash, randomBytes } from 'crypto';

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_WINDOW = 5;
const resetAttempts = new Map();

/**
 * Hashes a plain password-reset token before database storage or comparison.
 * The emailed token remains useful to the user without becoming readable from a leaked user record.
 * @param {string} token - Plain token included in the password-reset link.
 * @returns {string} SHA-256 token hash safe to persist.
 */
export function hashPasswordResetToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Creates a cryptographically secure reset token and its short-lived database representation.
 * @param {Date} now - Clock value used to calculate token expiration.
 * @returns {{token:string, tokenHash:string, expiresAt:Date}} Plain token, stored hash, and expiration time.
 */
export function createPasswordResetToken(now = new Date()) {
  const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  return { token, tokenHash: hashPasswordResetToken(token), expiresAt };
}

/**
 * Checks whether a stored password-reset expiration is missing or in the past.
 * @param {Date|string|undefined} expiresAt - Stored token expiration.
 * @param {Date} now - Clock value used for the comparison.
 * @returns {boolean} True when the token can no longer be used.
 */
export function isPasswordResetTokenExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/**
 * Decides whether another reset message may be requested for an email address.
 * The key is checked before account lookup so rate-limit responses do not expose account existence.
 * @param {string} email - Normalized email address.
 * @param {Date} now - Clock value used for cooldown and window calculations.
 * @returns {{allowed:boolean, retryAfterSeconds:number}} Rate-limit decision.
 */
export function checkPasswordResetLimit(email, now = new Date()) {
  const key = String(email || '').toLowerCase();
  const currentTime = now.getTime();
  const attempt = resetAttempts.get(key);

  if (!attempt || currentTime - attempt.windowStart >= RESET_WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const cooldownRemaining = RESET_COOLDOWN_MS - (currentTime - attempt.lastSentAt);
  if (cooldownRemaining > 0) {
    return { allowed: false, retryAfterSeconds: Math.ceil(cooldownRemaining / 1000) };
  }

  if (attempt.count >= RESET_MAX_PER_WINDOW) {
    const windowRemaining = RESET_WINDOW_MS - (currentTime - attempt.windowStart);
    return { allowed: false, retryAfterSeconds: Math.ceil(windowRemaining / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Records a password-reset request after it has been accepted.
 * Unknown and known accounts are both counted to keep the endpoint resistant to enumeration and abuse.
 * @param {string} email - Normalized email address.
 * @param {Date} now - Clock value used for the limiter entry.
 * @returns {void} The in-memory limiter is updated.
 */
export function recordPasswordResetRequest(email, now = new Date()) {
  const key = String(email || '').toLowerCase();
  const currentTime = now.getTime();
  const attempt = resetAttempts.get(key);

  if (!attempt || currentTime - attempt.windowStart >= RESET_WINDOW_MS) {
    resetAttempts.set(key, { count: 1, lastSentAt: currentTime, windowStart: currentTime });
    return;
  }

  resetAttempts.set(key, { ...attempt, count: attempt.count + 1, lastSentAt: currentTime });
}

/**
 * Clears limiter state so automated tests remain independent.
 * @returns {void} All recorded reset attempts are removed.
 */
export function resetPasswordResetLimits() {
  resetAttempts.clear();
}
