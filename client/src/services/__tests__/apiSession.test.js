/**
 * File purpose: Verifies that browser API requests use cookie credentials and CSRF headers without exposing JWTs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, STORAGE_KEYS } from '../api.js';

/**
 * Creates a successful fetch response for one API payload.
 * @param {object} payload - JSON body returned by the mocked API.
 * @returns {object} Minimal fetch-compatible response.
 */
function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

describe('cookie session API requests', () => {
  beforeEach(() => {
    localStorage.clear();
    api.clearSessionSecurity();
    globalThis.fetch = vi.fn();
  });

  it('includes cookies, keeps JWTs out of headers, and adds CSRF only to mutations', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'legacy-browser-token');
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1' }, csrfToken: 'csrf-session-token' }))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1', name: 'Updated' } }))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1', name: 'Updated' }, csrfToken: 'csrf-session-token' }));

    await api.login({ email: 'user@example.com', password: 'Password!1' });
    await api.updateProfile({ name: 'Updated' });
    await api.getCurrentUser();

    const loginOptions = globalThis.fetch.mock.calls[0][1];
    const updateOptions = globalThis.fetch.mock.calls[1][1];
    const profileOptions = globalThis.fetch.mock.calls[2][1];

    expect(loginOptions.credentials).toBe('include');
    expect(loginOptions.headers.Authorization).toBeUndefined();
    expect(updateOptions.headers['X-CSRF-Token']).toBe('csrf-session-token');
    expect(profileOptions.headers['X-CSRF-Token']).toBeUndefined();
  });
});