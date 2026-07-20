/**
 * File purpose: Verifies incomplete market-screener lists are completed with
 * valid live candidates without duplicates or incorrect change signs.
 */
import { describe, expect, it } from 'vitest';
import { selectTopMovers } from '../src/services/stockDataService.js';

describe('market mover selection', () => {
  it('fills an incomplete gainer list and preserves the preferred result first', () => {
    const preferred = [{ ticker: 'AAA', change: 8 }];
    const fallback = [
      { ticker: 'AAA', change: 8 },
      { ticker: 'BBB', change: 5 },
      { ticker: 'CCC', change: 3 },
      { ticker: 'DDD', change: -4 },
    ];

    expect(selectTopMovers(preferred, fallback, 'gainer').map((stock) => stock.ticker))
      .toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('fills an incomplete loser list and excludes non-negative candidates', () => {
    const preferred = [{ ticker: 'AAA', change: -9 }, { ticker: 'BBB', change: -7 }];
    const fallback = [
      { ticker: 'CCC', change: -5 },
      { ticker: 'DDD', change: 2 },
      { ticker: 'EEE', change: 0 },
    ];

    expect(selectTopMovers(preferred, fallback, 'loser').map((stock) => stock.ticker))
      .toEqual(['AAA', 'BBB', 'CCC']);
  });
});