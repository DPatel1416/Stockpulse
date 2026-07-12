/**
 * File purpose: Tests the helper that remembers whether visitors chose guest or account access.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_CHOICE_KEY, rememberAccessChoice } from '../accessChoice.js';

describe('access choice helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the visitor access choice in browser storage', () => {
    rememberAccessChoice('guest');

    expect(localStorage.getItem(ACCESS_CHOICE_KEY)).toBe('guest');
  });
});
