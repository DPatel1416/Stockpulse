/**
 * File purpose: Tests the email-verification authentication flow with mocked Resend delivery.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { login, register, resendVerification, verifyEmail } from '../src/controllers/authController.js';
import { demoStore, findDemoUserByEmail } from '../src/utils/demoStore.js';
import { hashVerificationToken, resetVerificationResendLimits } from '../src/utils/emailVerification.js';

const TEST_USER = {
  name: 'Verification Tester',
  email: 'verify@example.com',
  password: 'Password!1',
};
let sentEmails = [];

process.env.JWT_SECRET = 'test_jwt_secret_that_is_long_enough_for_stockpulse';
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'StockPulse Learn <verify@example.com>';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.API_PUBLIC_URL = 'http://localhost:5000';

/**
 * Resets the in-memory stores and captures outgoing Resend payloads.
 * Isolating state makes every test independent and avoids real network calls.
 * @returns {void} No value is returned; test globals are reset.
 */
beforeEach(() => {
  sentEmails = [];
  Object.values(demoStore).forEach((store) => store.clear());
  resetVerificationResendLimits();

  globalThis.fetch = async (url, options) => {
    sentEmails.push({ url, ...JSON.parse(options.body) });
    return { ok: true, json: async () => ({ id: `mock_email_${sentEmails.length}` }) };
  };
});

/**
 * Builds a minimal Express-like request object for controller tests.
 * Controllers only need body/query/header helpers, so this keeps the tests lightweight.
 * @param {object} options - Request values supplied to a controller.
 * @returns {object} Mock Express request.
 */
function createRequest({ body = {}, query = {}, headers = {} } = {}) {
  return {
    body,
    query,
    protocol: 'http',
    get(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'host') return 'localhost:5000';
      return headers[key] || '';
    },
  };
}

/**
 * Builds a minimal Express-like response object for controller tests.
 * Capturing status/body lets assertions inspect the controller output directly.
 * @returns {object} Mock Express response.
 */
function createResponse() {
  return {
    statusCode: 200,
    body: null,
    redirectedTo: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(statusOrUrl, maybeUrl) {
      if (typeof statusOrUrl === 'number') {
        this.statusCode = statusOrUrl;
        this.redirectedTo = maybeUrl;
      } else {
        this.statusCode = 302;
        this.redirectedTo = statusOrUrl;
      }
      return this;
    },
  };
}

/**
 * Invokes a wrapped Express controller and returns its captured response.
 * The catchAsync wrapper reports failures through next, so tests rethrow next errors.
 * @param {Function} handler - Controller handler to execute.
 * @param {object} requestOptions - Mock request values.
 * @returns {Promise<object>} Captured response object.
 */
async function invoke(handler, requestOptions) {
  const req = createRequest(requestOptions);
  const res = createResponse();
  let nextError;

  await handler(req, res, (error) => {
    nextError = error;
  });

  if (nextError) throw nextError;
  return res;
}

/**
 * Registers the standard test user and returns the verification token sent by email.
 * Reading the token from the mocked email mirrors how a real user receives the link.
 * @returns {Promise<string>} Plain verification token from the email URL.
 */
async function registerAndExtractToken() {
  const response = await invoke(register, { body: TEST_USER });
  assert.equal(response.statusCode, 201);
  assert.equal(sentEmails.length, 1);
  const match = sentEmails[0].text.match(/token=([a-f0-9]+)/i);
  assert.ok(match, 'verification token should be present in the email link');
  return match[1];
}

test('registration creates an unverified account and sends a hashed-token verification email', async () => {
  const token = await registerAndExtractToken();
  const user = findDemoUserByEmail(TEST_USER.email);

  assert.equal(user.isVerified, false);
  assert.ok(user.verificationTokenHash);
  assert.notEqual(user.verificationTokenHash, token);
  assert.equal(user.verificationTokenHash, hashVerificationToken(token));
  assert.ok(user.verificationTokenExpires);
  assert.match(sentEmails[0].subject, /Verify your StockPulse Learn email/);
});

test('email verification validates the token, marks the user verified, and prevents reuse', async () => {
  const token = await registerAndExtractToken();

  const success = await invoke(verifyEmail, { query: { token, format: 'json' } });
  const user = findDemoUserByEmail(TEST_USER.email);

  assert.equal(success.statusCode, 200);
  assert.equal(user.isVerified, true);
  assert.equal(user.verificationTokenHash, undefined);
  assert.equal(user.verificationTokenExpires, undefined);

  const reused = await invoke(verifyEmail, { query: { token, format: 'json' } });
  assert.equal(reused.statusCode, 400);
  assert.match(reused.body.message, /invalid|already been used/i);
});

test('invalid verification token is rejected gracefully', async () => {
  const response = await invoke(verifyEmail, { query: { token: 'bad-token', format: 'json' } });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /invalid/i);
});

test('expired verification token is rejected and cleared from the account', async () => {
  const token = await registerAndExtractToken();
  const user = findDemoUserByEmail(TEST_USER.email);
  user.verificationTokenExpires = new Date(Date.now() - 1000).toISOString();

  const response = await invoke(verifyEmail, { query: { token, format: 'json' } });

  assert.equal(response.statusCode, 410);
  assert.equal(user.isVerified, false);
  assert.equal(user.verificationTokenHash, undefined);
  assert.match(response.body.message, /expired/i);
});

test('resend verification invalidates the previous token and sends a new email', async () => {
  const oldToken = await registerAndExtractToken();
  const oldHash = findDemoUserByEmail(TEST_USER.email).verificationTokenHash;

  const resend = await invoke(resendVerification, { body: { email: TEST_USER.email } });
  const user = findDemoUserByEmail(TEST_USER.email);
  const newToken = sentEmails[1].text.match(/token=([a-f0-9]+)/i)[1];

  assert.equal(resend.statusCode, 200);
  assert.equal(sentEmails.length, 2);
  assert.notEqual(user.verificationTokenHash, oldHash);
  assert.equal(user.verificationTokenHash, hashVerificationToken(newToken));

  const oldTokenResponse = await invoke(verifyEmail, { query: { token: oldToken, format: 'json' } });
  assert.equal(oldTokenResponse.statusCode, 400);
});

test('login before verification is blocked with a resend-friendly error', async () => {
  await registerAndExtractToken();

  const response = await invoke(login, { body: { email: TEST_USER.email, password: TEST_USER.password } });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(response.body.canResendVerification, true);
});

test('login after verification returns the normal JWT session', async () => {
  const token = await registerAndExtractToken();
  await invoke(verifyEmail, { query: { token, format: 'json' } });

  const response = await invoke(login, { body: { email: TEST_USER.email, password: TEST_USER.password } });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.email, TEST_USER.email);
});