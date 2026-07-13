/**
 * File purpose: Prepares backend tests with safe environment defaults and external-service mocks.
 */
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { demoStore } from '../src/utils/demoStore.js';
import { resetVerificationResendLimits } from '../src/utils/emailVerification.js';
import { resetPasswordResetLimits } from '../src/utils/passwordReset.js';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-long-enough-for-stockpulse';
  process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-api-key';
});

beforeEach(() => {
  Object.values(demoStore).forEach((store) => store.clear());
  resetVerificationResendLimits();
  resetPasswordResetLimits();
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'mock-resend-email' }),
    text: async () => JSON.stringify({ id: 'mock-resend-email' }),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

