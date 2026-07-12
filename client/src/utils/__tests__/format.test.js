/**
 * File purpose: Tests shared formatting helpers so cards and tables display values consistently.
 */
import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatCurrency, formatPercent, getChangeClass } from '../format.js';

describe('format helpers', () => {
  it('formats money, compact numbers, and percent changes for display', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCompactNumber(1_250_000)).toBe('1.3M');
    expect(formatPercent(2.345)).toBe('+2.35%');
    expect(formatPercent(-1.2)).toBe('-1.20%');
  });

  it('maps positive and negative values to the CSS classes used by the UI', () => {
    expect(getChangeClass(0)).toBe('positive');
    expect(getChangeClass(5)).toBe('positive');
    expect(getChangeClass(-0.01)).toBe('negative');
  });
});
