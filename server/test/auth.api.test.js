/**
 * File purpose: Exercises the authentication API through real Express routes with Supertest.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { findDemoUserByEmail } from '../src/utils/demoStore.js';
import { hashVerificationToken } from '../src/utils/emailVerification.js';

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
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.user.email).toBe(TEST_USER.email);
  });

  it('protects JWT routes and returns the current user for a valid token', async () => {
    const noToken = await request(app).get('/api/auth/me');
    const invalidToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(noToken.status).toBe(401);
    expect(invalidToken.status).toBe(401);

    const token = await registerAndGetToken();
    await request(app).get('/api/auth/verify-email').query({ token, format: 'json' });
    const login = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });

    const profile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe(TEST_USER.email);
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

  it('returns consistent JSON for unknown API routes', async () => {
    const missingRoute = await request(app).get('/api/does-not-exist');

    expect(missingRoute.status).toBe(404);
    expect(missingRoute.body.message).toMatch(/route not found/i);
  });
});
