/**
 * File purpose: Tests portfolio response calculations used by the portfolio API.
 */
import { describe, expect, it } from 'vitest';
import { buildPortfolioResponse } from '../src/services/portfolioService.js';

describe('portfolio calculation helpers', () => {
  it('combines cash, holdings, and open order reservations into a portfolio summary', () => {
    const portfolio = buildPortfolioResponse({
      demo: true,
      virtualCash: 10_000,
      holdings: [
        { ticker: 'AAPL', shares: 2, averageCost: 100, marketValue: 250 },
        { ticker: 'MSFT', shares: 1, averageCost: 200, marketValue: 180 },
      ],
      transactions: [{ id: 't1', side: 'BUY', total: 200 }],
      openOrders: [{ id: 'o1', ticker: 'AAPL', side: 'BUY', quantity: 3, limitPrice: 50, status: 'PENDING', orderType: 'LIMIT' }],
    });

    expect(portfolio.investedValue).toBe(430);
    expect(portfolio.totalValue).toBe(10430);
    expect(portfolio.totalProfitLoss).toBe(30);
    expect(portfolio.availableBuyingPower).toBe(9850);
    expect(portfolio.transactions[0].direction).toBe('OUT');
  });
});
