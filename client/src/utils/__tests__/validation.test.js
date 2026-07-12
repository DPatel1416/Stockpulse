/**
 * File purpose: Tests shared form validation helpers used by login, register, and account settings.
 */
import { describe, expect, it } from 'vitest';
import { isStrongPassword, isValidEmail, PASSWORD_REQUIREMENT_MESSAGE } from '../validation.js';

describe('validation helpers', () => {
  it('accepts normal email addresses and rejects obvious invalid shapes', () => {
    expect(isValidEmail(' USER@example.com ')).toBe(true);
    expect(isValidEmail('missing-at-symbol')).toBe(false);
    expect(isValidEmail('person@example')).toBe(false);
  });

  it('requires passwords to be at least 8 characters with uppercase and special characters', () => {
    expect(isStrongPassword('Password!1')).toBe(true);
    expect(isStrongPassword('password!1')).toBe(false);
    expect(isStrongPassword('Password1')).toBe(false);
    expect(isStrongPassword('Pass!1')).toBe(false);
    expect(PASSWORD_REQUIREMENT_MESSAGE).toMatch(/uppercase/i);
  });
});
