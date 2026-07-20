/**
 * File purpose: Exercises the authentication API through real Express routes with Supertest.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { findDemoUserByEmail } from '../src/utils/demoStore.js';
import { hashVerificationToken } from '../src/utils/emailVerification.js';
import { hashPasswordResetToken } from '../src/utils/passwordReset.js';
import { renderPasswordResetEmail } from '../src/templates/passwordResetEmailTemplate.js';
import { SESSION_COOKIE_NAME } from '../src/utils/sessionCookies.js';
import { signToken } from '../src/utils/tokens.js';

const TEST_USER = {
  name: 'API Tester',
  email: 'api.tester@example.com',
  password: 'Password!1',
};

/**
 * Reads the latest verification token from the mocked Resend request payload.
 * Pulling it from the email body mirrors how a real user would receive the link.
 * @returns {string} Plain verification token from the last outbound email.
 */
function latestVerificationToken() {
  const lastCall = globalThis.fetch.mock.calls.at(-1);
  const payload = JSON.parse(lastCall?.[1]?.body || '{}');
  const match = String(payload.text || payload.html || '').match(/token=([a-f0-9]+)/i);
  expect(match).toBeTruthy();
  return match[1];
}

/**
 * Registers the standard API test account and returns the token sent by the mocked email provider.
 * Keeping this helper small makes the auth-flow tests read like the user journey.
 * @returns {Promise<string>} Verification token from the registration email.
 */
async function registerAndGetToken() {
  const response = await request(app).post('/api/auth/register').send(TEST_USER);
  expect(response.status).toBe(201);
  return latestVerificationToken();
}

/**
 * Reads the reset token from the latest mocked Resend payload.
 * The plain token should exist only in the email while MongoDB or the demo store keeps its hash.
 * @returns {string} Plain one-time password-reset token.
 */
function latestPasswordResetToken() {
  const lastCall = globalThis.fetch.mock.calls.at(-1);
  const payload = JSON.parse(lastCall?.[1]?.body || '{}');
  const match = String(payload.text || payload.html || '').match(/resetToken=([a-f0-9]+)/i);
  expect(match).toBeTruthy();
  return match[1];
}

describe('auth API', () => {
  it('validates email format without exposing account existence', async () => {
    const valid = await request(app).post('/api/auth/validate-email').send({ email: 'USER@Example.com ' });
    const invalid = await request(app).post('/api/auth/validate-email').send({ email: 'not-an-email' });

    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({ email: 'user@example.com', valid: true });
    expect(invalid.status).toBe(200);
    expect(invalid.body.valid).toBe(false);
  });

  it('registers an unverified account and stores only the hashed verification token', async () => {
    const token = await registerAndGetToken();
    const user = findDemoUserByEmail(TEST_USER.email);

    expect(user.isVerified).toBe(false);
    expect(user.verificationTokenHash).toBe(hashVerificationToken(token));
    expect(user.verificationTokenHash).not.toBe(token);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not expose private details from email-provider errors', async () => {
    const privateProviderEmail = 'private-owner@example.com';
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        message: 'Testing emails can only be sent to ' + privateProviderEmail + '.',
      }),
    });

    const response = await request(app).post('/api/auth/register').send(TEST_USER);

    expect(response.status).toBe(502);
    expect(response.body.message).toBe('The email could not be sent right now. Please try again later.');
    expect(JSON.stringify(response.body)).not.toContain(privateProviderEmail);
  });

  it('rejects duplicate email registration', async () => {
    await registerAndGetToken();

    const duplicate = await request(app).post('/api/auth/register').send(TEST_USER);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/already registered/i);
  });

  it('rejects invalid registration and login requests clearly', async () => {
    const missingRegisterFields = await request(app).post('/api/auth/register').send({ email: 'bad' });
    const weakPassword = await request(app).post('/api/auth/register').send({ name: 'Weak User', email: 'weak@example.com', password: 'password' });
    const missingLoginFields = await request(app).post('/api/auth/login').send({ email: TEST_USER.email });

    expect(missingRegisterFields.status).toBe(400);
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body.message).toMatch(/uppercase/i);
    expect(missingLoginFields.status).toBe(400);
  });

  it('blocks login before email verification and allows login after verification', async () => {
    const token = await registerAndGetToken();

    const blocked = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const verified = await request(app).get('/api/auth/verify-email').query({ token, format: 'json' });
    expect(verified.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    const sessionCookie = login.headers['set-cookie']?.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(login.status).toBe(200);
    expect(login.body.token).toBeUndefined();
    expect(login.body.csrfToken).toEqual(expect.any(String));
    expect(login.body.user.email).toBe(TEST_USER.email);
    expect(sessionCookie).toMatch(/HttpOnly/);
    expect(sessionCookie).toMatch(/SameSite=Lax/);
  });

  it('progressively locks an account for one hour and then 24 hours after repeated failures', async () => {
    const verificationToken = await registerAndGetToken();
    await request(app).get('/api/auth/verify-email').query({ token: verificationToken, format: 'json' });

    for (let attempt = 1; attempt < 5; attempt += 1) {
      const failed = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'WrongPassword!9' });
      expect(failed.status).toBe(401);
    }

    const firstLock = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'WrongPassword!9' });
    const user = findDemoUserByEmail(TEST_USER.email);
    expect(firstLock.status).toBe(423);
    expect(firstLock.body.code).toBe('LOGIN_LOCKED');
    expect(firstLock.body.lockDurationHours).toBe(1);
    expect(user.loginLockLevel).toBe(1);

    const blockedCorrectPassword = await request(app).post('/api/auth/login').send(TEST_USER);
    expect(blockedCorrectPassword.status).toBe(423);

    user.loginLockUntil = new Date(Date.now() - 1000).toISOString();
    for (let attempt = 1; attempt < 5; attempt += 1) {
      const failed = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'WrongPassword!9' });
      expect(failed.status).toBe(401);
    }

    const repeatedLock = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'WrongPassword!9' });
    expect(repeatedLock.status).toBe(423);
    expect(repeatedLock.body.lockDurationHours).toBe(24);
    expect(user.loginLockLevel).toBe(2);

    user.loginLockUntil = new Date(Date.now() - 1000).toISOString();
    const recoveredLogin = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(recoveredLogin.status).toBe(200);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.loginLockUntil).toBeUndefined();
    expect(user.loginLockLevel).toBe(0);
  });

  it('protects auth routes and accepts both browser cookies and explicit API bearer tokens', async () => {
    const noToken = await request(app).get('/api/auth/me');
    const invalidToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(noToken.status).toBe(401);
    expect(invalidToken.status).toBe(401);

    const verificationToken = await registerAndGetToken();
    await request(app).get('/api/auth/verify-email').query({ token: verificationToken, format: 'json' });
    const browser = request.agent(app);
    const login = await browser.post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    const cookieProfile = await browser.get('/api/auth/me');

    expect(login.status).toBe(200);
    expect(cookieProfile.status).toBe(200);
    expect(cookieProfile.body.user.email).toBe(TEST_USER.email);
    expect(cookieProfile.body.csrfToken).toBe(login.body.csrfToken);

    const user = findDemoUserByEmail(TEST_USER.email);
    const bearerToken = signToken(user.id, { sessionVersion: user.sessionVersion });
    const bearerProfile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${bearerToken}`);
    expect(bearerProfile.status).toBe(200);
  });

  it('requires CSRF for cookie mutations and clears the cookie on logout', async () => {
    const verificationToken = await registerAndGetToken();
    await request(app).get('/api/auth/verify-email').query({ token: verificationToken, format: 'json' });
    const browser = request.agent(app);
    const login = await browser.post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });

    const forgedUpdate = await browser.patch('/api/auth/me').send({ name: 'Blocked Update' });
    expect(forgedUpdate.status).toBe(403);
    expect(forgedUpdate.body.code).toBe('CSRF_TOKEN_INVALID');

    const protectedUpdate = await browser
      .patch('/api/auth/me')
      .set('X-CSRF-Token', login.body.csrfToken)
      .send({ name: 'Cookie User' });
    expect(protectedUpdate.status).toBe(200);

    const logout = await browser.post('/api/auth/logout').set('X-CSRF-Token', login.body.csrfToken);
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'].join(';')).toMatch(new RegExp(`${SESSION_COOKIE_NAME}=;`));

    const signedOutProfile = await browser.get('/api/auth/me');
    expect(signedOutProfile.status).toBe(401);
  });

  it('resends verification emails, invalidates the previous token, and rate-limits rapid repeats', async () => {
    const oldToken = await registerAndGetToken();

    const resend = await request(app).post('/api/auth/resend-verification').send({ email: TEST_USER.email });
    const newToken = latestVerificationToken();

    expect(resend.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(newToken).not.toBe(oldToken);

    const oldTokenResult = await request(app).get('/api/auth/verify-email').query({ token: oldToken, format: 'json' });
    expect(oldTokenResult.status).toBe(400);

    const rateLimited = await request(app).post('/api/auth/resend-verification').send({ email: TEST_USER.email });
    expect(rateLimited.status).toBe(429);
  });

  it('resets a verified password with a hashed one-time token', async () => {
    const verificationToken = await registerAndGetToken();
    await request(app).get('/api/auth/verify-email').query({ token: verificationToken, format: 'json' });

    const oldBrowserSession = request.agent(app);
    const oldLogin = await oldBrowserSession.post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(oldLogin.status).toBe(200);

    const requested = await request(app).post('/api/auth/forgot-password').send({ email: TEST_USER.email });
    const resetToken = latestPasswordResetToken();
    const user = findDemoUserByEmail(TEST_USER.email);

    expect(requested.status).toBe(200);
    expect(user.passwordResetTokenHash).toBe(hashPasswordResetToken(resetToken));
    expect(user.passwordResetTokenHash).not.toBe(resetToken);

    user.failedLoginAttempts = 4;
    user.loginLockLevel = 1;
    user.loginLockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const reset = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'NewPassword!2' });
    expect(reset.status).toBe(200);
    expect(user.passwordResetTokenHash).toBeUndefined();
    expect(user.passwordResetTokenExpires).toBeUndefined();
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.loginLockUntil).toBeUndefined();
    expect(user.loginLockLevel).toBe(0);

    const reused = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'AnotherPassword!3' });
    expect(reused.status).toBe(400);
    expect(reused.body.code).toBe('PASSWORD_RESET_INVALID');

    const revokedProfile = await oldBrowserSession.get('/api/auth/me');
    expect(revokedProfile.status).toBe(401);

    const oldPasswordLogin = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    const newLogin = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'NewPassword!2' });
    expect(oldPasswordLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('rejects invalid and expired password-reset tokens', async () => {
    const invalid = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-token', newPassword: 'NewPassword!2' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('PASSWORD_RESET_INVALID');

    await registerAndGetToken();
    await request(app).post('/api/auth/forgot-password').send({ email: TEST_USER.email });
    const resetToken = latestPasswordResetToken();
    const user = findDemoUserByEmail(TEST_USER.email);
    user.passwordResetTokenExpires = new Date(Date.now() - 1000).toISOString();

    const expired = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'NewPassword!2' });
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('PASSWORD_RESET_EXPIRED');
    expect(user.passwordResetTokenHash).toBeUndefined();
  });

  it('keeps forgot-password responses private and rate-limits rapid repeats', async () => {
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toMatch(/if an account exists/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const repeated = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.com' });
    expect(repeated.status).toBe(429);
    expect(repeated.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('renders the reset email with stable dark-mode colors and no translucent card glow', () => {
    const email = renderPasswordResetEmail({ name: 'API Tester', resetUrl: 'https://example.com/login?resetToken=test-token' });

    expect(email.html).toContain('name="color-scheme" content="dark light"');
    expect(email.html).toContain('bgcolor="#07101f"');
    expect(email.html).toContain('bgcolor="#0b1730"');
    expect(email.html).toContain('background-image: none !important');
    expect(email.html).toContain('box-shadow: none !important');
    expect(email.html).not.toContain('rgba(');
  });

  it('returns consistent JSON for unknown API routes', async () => {
    const missingRoute = await request(app).get('/api/does-not-exist');

    expect(missingRoute.status).toBe(404);
    expect(missingRoute.body.message).toMatch(/route not found/i);
  });
});
