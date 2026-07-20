/**
 * File purpose: Sends StockPulse transactional emails through Resend while keeping secrets on the server.
 */
import { renderVerificationEmail } from '../templates/verificationEmailTemplate.js';
import { renderPasswordResetEmail } from '../templates/passwordResetEmailTemplate.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'StockPulse Learn <onboarding@resend.dev>';

/**
 * Builds the public API URL used inside email verification links.
 * Prefer explicit production config because hosted servers often sit behind proxies with internal hostnames.
 * @param {*} req - Express request used as a local-development fallback.
 * @returns {string} Public API origin without a trailing slash.
 */
function getApiOrigin(req) {
  const configuredOrigin = process.env.API_PUBLIC_URL || process.env.SERVER_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');

  const protocol = req?.protocol || 'http';
  const host = req?.get?.('host') || `localhost:${process.env.PORT || 5000}`;
  return `${protocol}://${host}`;
}

/**
 * Builds a one-time verification URL that points at the backend verification endpoint.
 * The backend owns the token validation and then redirects users back to the client login page.
 * @param {*} req - Express request used to discover the local API origin when not configured.
 * @param {string} token - Plain verification token sent only to the user's inbox.
 * @returns {string} Public verification URL.
 */
export function buildVerificationUrl(req, token) {
  const url = new URL('/api/auth/verify-email', getApiOrigin(req));
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Builds the frontend URL where a user chooses a replacement password.
 * The API validates the token only when the form is submitted, so the email opens inside the existing login experience.
 * @param {string} token - Plain one-time password-reset token.
 * @returns {string} Public client URL containing the reset token.
 */
export function buildPasswordResetUrl(token) {
  const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
  const url = new URL('/login', clientOrigin);
  url.searchParams.set('resetToken', token);
  return url.toString();
}

/**
 * Sends a generic HTML email through Resend's HTTP API.
 * Using fetch avoids adding a new runtime dependency while keeping the Resend API key server-only.
 * @param {object} options - Email payload values.
 * @param {string|string[]} options.to - Recipient email address or addresses.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.html - Responsive HTML email body.
 * @param {string} options.text - Plain-text fallback email body.
 * @returns {Promise<object>} Resend API result, or a development skip marker when no key is configured.
 */
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured. Transactional email was not sent; configure Resend before production use.');
    return { skipped: true, provider: 'resend' };
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Provider errors can include private account details, so they must never become browser-facing messages.
    if (process.env.NODE_ENV !== 'test') {
      console.error('Resend email delivery failed with status ' + response.status + '.');
    }
    const error = new Error('The email could not be sent right now. Please try again later.');
    error.statusCode = 502;
    throw error;
  }

  return data;
}

/**
 * Sends the StockPulse account-verification email.
 * This wrapper keeps controller code independent from template structure and Resend request details.
 * @param {object} options - Verification email values.
 * @param {*} options.req - Express request used to build the public verification URL.
 * @param {object} options.user - User receiving the verification email.
 * @param {string} options.token - Plain verification token that will be sent only by email.
 * @returns {Promise<object>} Email provider result.
 */
export async function sendVerificationEmail({ req, user, token }) {
  const verificationUrl = buildVerificationUrl(req, token);
  const email = renderVerificationEmail({ name: user.name, verificationUrl });
  const result = await sendEmail({ to: user.email, subject: email.subject, html: email.html, text: email.text });

  if (result.skipped && process.env.NODE_ENV !== 'production') {
    console.warn(`Local verification link for ${user.email}: ${verificationUrl}`);
  }

  return result;
}

/**
 * Sends a one-time password-reset link using the same server-only Resend configuration as verification email.
 * @param {object} options - Password-reset email values.
 * @param {object} options.user - User receiving the reset email.
 * @param {string} options.token - Plain token sent only to the user inbox.
 * @returns {Promise<object>} Resend provider result.
 */
export async function sendPasswordResetEmail({ user, token }) {
  const resetUrl = buildPasswordResetUrl(token);
  const email = renderPasswordResetEmail({ name: user.name, resetUrl });
  const result = await sendEmail({ to: user.email, subject: email.subject, html: email.html, text: email.text });

  if (result.skipped && process.env.NODE_ENV !== 'production') {
    console.warn(`Local password-reset link for ${user.email}: ${resetUrl}`);
  }

  return result;
}
