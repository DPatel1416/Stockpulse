/**
 * File purpose: Provides reusable email-verification token and resend-rate-limit helpers for authentication.
 */
import { createHash, randomBytes } from 'crypto';

export const VERIFICATION_TOKEN_TTL_HOURS = 24;
const VERIFICATION_TOKEN_BYTES = 32;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_WINDOW_MS = 60 * 60 * 1000;
const RESEND_MAX_PER_WINDOW = 5;
const resendAttempts = new Map();

/**
 * Hashes a plain verification token before it is stored or compared.
 * Hashing the token protects users if database records are exposed because emailed tokens remain secret.
 * @param {string} token - Plain verification token from a generated email link.
 * @returns {string} SHA-256 token hash safe to store in the database.
 */
export function hashVerificationToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Creates a secure verification token pair and expiration timestamp.
 * Returning both plain and hashed values lets the email receive the plain token while storage keeps only the hash.
 * @param {Date} now - Clock value used to calculate the expiration timestamp.
 * @returns {{token:string, tokenHash:string, expiresAt:Date}} Generated token data.
 */
export function createEmailVerificationToken(now = new Date()) {
  const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  return { token, tokenHash: hashVerificationToken(token), expiresAt };
}

/**
 * Checks whether a stored verification expiration timestamp is no longer valid.
 * Keeping this comparison centralized prevents token lifetime rules from drifting across controllers.
 * @param {Date|string|undefined} expiresAt - Stored expiration value from MongoDB or demo storage.
 * @param {Date} now - Clock value used for the comparison.
 * @returns {boolean} True when the token is missing or expired.
 */
export function isVerificationTokenExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/**
 * Checks whether another verification email may be sent to the supplied email address.
 * This intentionally simple in-memory limiter prevents accidental resend spam without adding infrastructure.
 * @param {string} email - Normalized account email address.
 * @param {Date} now - Clock value used for cooldown/window calculations.
 * @returns {{allowed:boolean, retryAfterSeconds:number}} Rate-limit decision for the resend request.
 */
export function checkVerificationResendLimit(email, now = new Date()) {
  const key = String(email || '').toLowerCase();
  const currentTime = now.getTime();
  const attempt = resendAttempts.get(key);

  if (!attempt || currentTime - attempt.windowStart >= RESEND_WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const cooldownRemaining = RESEND_COOLDOWN_MS - (currentTime - attempt.lastSentAt);
  if (cooldownRemaining > 0) {
    return { allowed: false, retryAfterSeconds: Math.ceil(cooldownRemaining / 1000) };
  }

  if (attempt.count >= RESEND_MAX_PER_WINDOW) {
    const windowRemaining = RESEND_WINDOW_MS - (currentTime - attempt.windowStart);
    return { allowed: false, retryAfterSeconds: Math.ceil(windowRemaining / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Records that a resend verification email has just been sent.
 * Splitting the read and write steps lets controllers avoid counting failed email-send attempts.
 * @param {string} email - Normalized account email address.
 * @param {Date} now - Clock value used for the rate-limit entry.
 * @returns {void} No value is returned; the in-memory limiter is updated.
 */
export function recordVerificationResend(email, now = new Date()) {
  const key = String(email || '').toLowerCase();
  const currentTime = now.getTime();
  const attempt = resendAttempts.get(key);

  if (!attempt || currentTime - attempt.windowStart >= RESEND_WINDOW_MS) {
    resendAttempts.set(key, { count: 1, lastSentAt: currentTime, windowStart: currentTime });
    return;
  }

  resendAttempts.set(key, { ...attempt, count: attempt.count + 1, lastSentAt: currentTime });
}

/**
 * Clears resend limiter state for automated tests.
 * Production code does not call this; tests need deterministic isolation between cases.
 * @returns {void} No value is returned; limiter memory is cleared.
 */
export function resetVerificationResendLimits() {
  resendAttempts.clear();
}