/**
 * File purpose: Builds a current portfolio view by combining cash, holdings, quotes, transactions, accounts, and open orders.
 */
import { isDatabaseConnected } from '../config/db.js';
import Holding from '../models/Holding.js';
import PaperAccount from '../models/PaperAccount.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { findStock } from '../utils/demoData.js';
import { getDemoPortfolio } from '../utils/demoStore.js';
import { getOpenOrdersForUser, getOrderReservations, processPendingOrdersForUser } from './orderService.js';
import { searchStock } from './stockDataService.js';

/**
 * Converts a database or demo user identifier into a consistent string key.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {string} A stable string identifier for database and demo users.
 */
function toUserId(user) {
  return String(user._id || user.id);
}

/**
 * Returns the holding quote needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {Promise<*>} A promise resolving to the requested holding quote result.
 */
async function getHoldingQuote(ticker) {
  try {
    const result = await searchStock(ticker);
    return {
      stock: result.stock,
      isLivePrice: !result.demo,
      priceProvider: result.provider,
      priceMessage: result.message || null,
    };
  } catch {
    return {
      stock: findStock(ticker),
      isLivePrice: false,
      priceProvider: 'demo',
      priceMessage: 'Live quote unavailable.',
    };
  }
}

/**
 * Adds a current quote, market value, and gain/loss values to one stored holding.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {object} holding - Stored holding to enrich with a current quote.
 * @returns {Promise<*>} A promise resolving to the enrich holding result.
 */
async function enrichHolding(holding) {
  const quote = await getHoldingQuote(holding.ticker);
  const currentPrice = Number(quote.stock.price || 0);
  const marketValue = currentPrice * holding.shares;
  const costBasis = holding.averageCost * holding.shares;

  return {
    ticker: holding.ticker,
    companyName: quote.stock.company || holding.companyName,
    logo: quote.stock.logo || null,
    shares: holding.shares,
    averageCost: holding.averageCost,
    currentPrice,
    marketValue,
    profitLoss: marketValue - costBasis,
    profitLossPercent: costBasis ? ((marketValue - costBasis) / costBasis) * 100 : 0,
    sector: quote.stock.sector,
    isLivePrice: quote.isLivePrice,
    priceProvider: quote.priceProvider,
    priceMessage: quote.priceMessage,
  };
}

/**
 * Constructs the portfolio response from its source values.
 * A named builder keeps multi-step construction logic testable and reusable.
 * @param {*} options - Named settings that adjust the operation.
 * @returns {*} The constructed portfolio response result.
 */
function buildPortfolioResponse({ demo, virtualCash, holdings, transactions, accounts = [], openOrders = [] }) {
  const investedValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const costBasis = holdings.reduce((sum, holding) => sum + holding.averageCost * holding.shares, 0);
  const reservations = getOrderReservations(openOrders);

  return {
    demo,
    virtualCash,
    availableBuyingPower: Math.max(0, Number((virtualCash - reservations.reservedCash).toFixed(2))),
    reservedCash: reservations.reservedCash,
    reservedShares: reservations.reservedShares,
    investedValue,
    totalValue: virtualCash + investedValue,
    totalProfitLoss: investedValue - costBasis,
    totalProfitLossPercent: costBasis ? ((investedValue - costBasis) / costBasis) * 100 : 0,
    holdings,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      id: String(transaction._id || transaction.id),
      type: transaction.type || 'TRADE',
      direction: transaction.direction || (transaction.side === 'BUY' ? 'OUT' : 'IN'),
    })),
    openOrders,
    accounts,
  };
}

// Portfolio response shape is shared by the page and the trade confirmation flow.
/**
 * Returns the portfolio for user needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {Promise<*>} A promise resolving to the requested portfolio for user result.
 */
export async function getPortfolioForUser(user) {
  // Checking the portfolio also evaluates pending limits against the latest quote.
  await processPendingOrdersForUser(user);
  const openOrders = await getOpenOrdersForUser(user);

  if (!isDatabaseConnected()) {
    const demoPortfolio = getDemoPortfolio(toUserId(user));
    const enrichedHoldings = await Promise.all(demoPortfolio.holdings.map(enrichHolding));
    return buildPortfolioResponse({
      demo: true,
      virtualCash: demoPortfolio.virtualCash,
      holdings: enrichedHoldings,
      transactions: demoPortfolio.transactions,
      accounts: demoPortfolio.accounts,
      openOrders,
    });
  }

  const userId = toUserId(user);
  const [freshUser, holdings, transactions, accounts] = await Promise.all([
    User.findById(userId),
    Holding.find({ userId }).sort({ ticker: 1 }).lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
    PaperAccount.find({ userId }).sort({ type: 1 }).lean(),
  ]);

  const enrichedHoldings = await Promise.all(holdings.map(enrichHolding));

  return buildPortfolioResponse({
    demo: false,
    virtualCash: freshUser.virtualCash,
    holdings: enrichedHoldings,
    transactions,
    openOrders,
    accounts: accounts.map((account) => ({
      id: String(account._id),
      type: account.type,
      institution: account.institution,
      balance: account.balance,
    })),
  });
}
