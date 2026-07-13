/**
 * File purpose: Provides the client API layer, browser-storage fallbacks, and local paper-trading behavior when the server is unavailable.
 */
import {
  buildChartData,
  demoNews,
  demoStocks,
  findStock,
  initialPortfolio,
} from '../data/mockData';

// Same-origin /api proxies keep the HttpOnly session first-party in local development and production.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
let sessionCsrfToken = '';
const STORAGE_KEYS = {
  token: 'stockpulse_token',
  user: 'stockpulse_user',
  watchlist: 'stockpulse_watchlist',
  portfolio: 'stockpulse_portfolio',
};

/**
 * Reads the json from its persistence boundary for the calling workflow.
 * Keeping storage access here prevents persistence details from spreading through the application.
 * @param {string} key - Browser-storage or cache key.
 * @param {*} fallback - Value returned when stored or provider data is unavailable.
 * @returns {*} Parsed browser-storage data, or the supplied fallback when parsing fails.
 */
function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Writes the json to its configured storage location.
 * Centralizing writes keeps browser or database storage behavior consistent.
 * @param {string} key - Browser-storage or cache key.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {void|*} No value is required; the write json state changes are applied.
 */
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Stores the non-secret CSRF companion for the current in-memory cookie session.
 * The signed JWT remains inaccessible inside the server-issued HttpOnly cookie.
 * @param {string|undefined} token - CSRF token returned by login or session validation.
 * @returns {void} The API request layer is updated for later mutations.
 */
function setSessionCsrfToken(token) {
  sessionCsrfToken = String(token || '');
}

/**
 * Clears browser-readable session helpers after logout or an authentication failure.
 * @returns {void} No server credential is touched because the JWT exists only in the cookie.
 */
function clearSessionSecurity() {
  sessionCsrfToken = '';
}

/**
 * Sends an API request and uses an approved local fallback only when the server cannot be reached.
 * HTTP errors still surface to the UI; fallbacks only cover connection failures for local/demo resilience.
 * @param {string} path - API path appended to the configured server URL.
 * @param {*} options - Named settings that adjust the operation.
 * @param {Function|undefined} fallbackResolver - Local resolver used only when the API cannot be reached.
 * @returns {Promise<*>} A promise resolving to the server response or approved local fallback.
 */
async function request(path, options = {}, fallbackResolver) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const method = String(options.method || 'GET').toUpperCase();

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && sessionCsrfToken) {
    headers['X-CSRF-Token'] = sessionCsrfToken;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch (error) {
    // Demo data is used only when the API cannot be reached, never for rejected requests.
    if (fallbackResolver) {
      return fallbackResolver(error);
    }

    throw new Error('Unable to connect to the StockPulse API.');
  }

  const data = await response.json().catch(() => null);
  if (data?.csrfToken) setSessionCsrfToken(data.csrfToken);

  if (!response.ok) {
    if (response.status === 401) clearSessionSecurity();
    const error = new Error(data?.message || `API request failed with status ${response.status}.`);
    error.status = response.status;
    error.code = data?.code;
    error.email = data?.email;
    error.retryAfterSeconds = data?.retryAfterSeconds;
    error.canResendVerification = Boolean(data?.canResendVerification);
    throw error;
  }

  return data;
}

/**
 * Returns the local watchlist needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {*} The requested local watchlist result.
 */
function getLocalWatchlist() {
  return readJson(STORAGE_KEYS.watchlist, ['AAPL', 'NVDA']).map((ticker) => findStock(ticker));
}

/**
 * Returns the local portfolio needed by the calling screen or service.
 * Local portfolio storage mirrors the server response shape so the UI can keep working during API outages.
 * @returns {object} Portfolio summary assembled from browser storage.
 */
function getLocalPortfolio() {
  const portfolio = readJson(STORAGE_KEYS.portfolio, initialPortfolio);
  portfolio.holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  portfolio.transactions = Array.isArray(portfolio.transactions) ? portfolio.transactions : [];
  portfolio.openOrders = Array.isArray(portfolio.openOrders) ? portfolio.openOrders : [];
  const processedOrder = processLocalLimitOrders(portfolio);
  if (processedOrder) saveLocalPortfolio(portfolio);
  const accounts = Array.isArray(portfolio.accounts) ? portfolio.accounts : initialPortfolio.accounts;
  const enrichedHoldings = portfolio.holdings.map((holding) => {
    const stock = findStock(holding.ticker);
    const marketValue = stock.price * holding.shares;
    const costBasis = holding.averageCost * holding.shares;

    return {
      ...holding,
      currentPrice: stock.price,
      marketValue,
      profitLoss: marketValue - costBasis,
      profitLossPercent: costBasis ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      sector: stock.sector,
      logo: stock.logo || holding.logo || null,
    };
  });

  const investedValue = enrichedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const totalValue = portfolio.virtualCash + investedValue;
  const costBasis = enrichedHoldings.reduce((sum, holding) => sum + holding.averageCost * holding.shares, 0);
  const reservedCash = portfolio.openOrders.reduce((sum, order) => sum + (order.side === 'BUY' ? Number(order.limitPrice) * Number(order.quantity) : 0), 0);
  const reservedShares = portfolio.openOrders.reduce((summary, order) => {
    if (order.side === 'SELL') summary[order.ticker] = (summary[order.ticker] || 0) + Number(order.quantity);
    return summary;
  }, {});

  return {
    demo: true,
    virtualCash: portfolio.virtualCash,
    availableBuyingPower: Math.max(0, Number((portfolio.virtualCash - reservedCash).toFixed(2))),
    reservedCash: Number(reservedCash.toFixed(2)),
    reservedShares,
    investedValue,
    totalValue,
    totalProfitLoss: investedValue - costBasis,
    totalProfitLossPercent: costBasis ? ((investedValue - costBasis) / costBasis) * 100 : 0,
    holdings: enrichedHoldings,
    transactions: portfolio.transactions,
    openOrders: portfolio.openOrders,
    accounts,
  };
}

const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const PERFORMANCE_TRADING_DAY_RANGES = {
  '5D': 5,
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '5Y': 1260,
};

/**
 * Checks whether a date falls on Saturday or Sunday.
 * Keeping the condition in one predicate makes branching rules consistent and self-contained.
 * @param {Date} date - Date being inspected or adjusted.
 * @returns {object} The cancelled order and refreshed local portfolio.
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Creates a copy of a date positioned at a specific regular-session minute.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Date} date - Date being inspected or adjusted.
 * @param {number} minuteOfDay - Minutes elapsed since midnight in local market time.
 * @returns {Date} A new date positioned at the requested market minute.
 */
function atMarketMinute(date, minuteOfDay) {
  const result = new Date(date);
  result.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return result;
}

/**
 * Finds the nearest earlier weekday trading date.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Date} date - Date being inspected or adjusted.
 * @returns {Date} The nearest earlier weekday trading date.
 */
function previousTradingDay(date) {
  const result = new Date(date);

  do {
    result.setDate(result.getDate() - 1);
  } while (isWeekend(result));

  return result;
}

/**
 * Finds the nearest later weekday trading date.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Date} date - Date being inspected or adjusted.
 * @returns {Date} The nearest later weekday trading date.
 */
function nextTradingDay(date) {
  const result = new Date(date);

  do {
    result.setDate(result.getDate() + 1);
  } while (isWeekend(result));

  return result;
}

/**
 * Moves backward by a requested number of weekdays while skipping weekends.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Date} date - Date being inspected or adjusted.
 * @param {number} daysBack - Number of weekday trading sessions to move backward.
 * @returns {Date} The date reached after skipping the requested number of trading days.
 */
function subtractTradingDays(date, daysBack) {
  const result = new Date(date);
  let remaining = daysBack;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (!isWeekend(result)) remaining -= 1;
  }

  return result;
}

/**
 * Returns the active trading day needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @returns {*} The requested active trading day result.
 */
function getActiveTradingDay(now = new Date()) {
  if (isWeekend(now)) return previousTradingDay(now);
  if (now < atMarketMinute(now, MARKET_OPEN_MINUTES)) return previousTradingDay(now);
  return now;
}

/**
 * Converts the supplied value to a valid market time.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {Date} A valid timestamp clamped to a regular market session.
 */
function normalizeToMarketTime(value) {
  const date = new Date(value);

  if (isWeekend(date)) return atMarketMinute(previousTradingDay(date), MARKET_CLOSE_MINUTES);
  if (date < atMarketMinute(date, MARKET_OPEN_MINUTES)) return atMarketMinute(previousTradingDay(date), MARKET_CLOSE_MINUTES);
  if (date > atMarketMinute(date, MARKET_CLOSE_MINUTES)) return atMarketMinute(date, MARKET_CLOSE_MINUTES);
  return date;
}

/**
 * Returns the performance range start needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @returns {*} The requested performance range start result.
 */
function getPerformanceRangeStart(range, now = new Date()) {
  const activeTradingDay = getActiveTradingDay(now);

  if (range === 'YTD') {
    const firstDay = new Date(activeTradingDay.getFullYear(), 0, 1);
    return atMarketMinute(isWeekend(firstDay) ? nextTradingDay(firstDay) : firstDay, MARKET_OPEN_MINUTES);
  }

  if (range === '1D') return atMarketMinute(activeTradingDay, MARKET_OPEN_MINUTES);

  const tradingDays = PERFORMANCE_TRADING_DAY_RANGES[range] || 1;
  return atMarketMinute(subtractTradingDays(activeTradingDay, Math.max(0, tradingDays - 1)), MARKET_OPEN_MINUTES);
}

/**
 * Converts the local performance trade into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @returns {*} The normalized local performance trade result.
 */
function normalizeLocalPerformanceTrade(transaction, rangeStart, rangeEnd) {
  const rawCreatedAt = new Date(transaction.createdAt);
  const quantity = Number(transaction.quantity);
  const total = Number(transaction.total);
  const ticker = String(transaction.ticker || '').trim().toUpperCase();
  const side = String(transaction.side || '').trim().toUpperCase();

  if (
    (transaction.type || 'TRADE') !== 'TRADE'
    || !Number.isFinite(rawCreatedAt.getTime())
    || rawCreatedAt < rangeStart
    || !ticker
    || !['BUY', 'SELL'].includes(side)
    || !Number.isFinite(quantity)
    || quantity <= 0
    || !Number.isFinite(total)
  ) {
    return null;
  }

  const createdAt = normalizeToMarketTime(rawCreatedAt);
  if (createdAt > rangeEnd) return null;

  return { ticker, side, quantity, total, createdAt };
}

/**
 * Constructs the browser-only performance series from stored demo portfolio data.
 * This rewinds the browser-only portfolio, reapplies trades, and prices each point from deterministic demo history.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @returns {Array<object>} Timestamped local portfolio-value points.
 */
function buildLocalPerformanceSeries(portfolio, range, rangeStart, rangeEnd) {
  const trades = (portfolio.transactions || [])
    .map((transaction) => normalizeLocalPerformanceTrade(transaction, rangeStart, rangeEnd))
    .filter(Boolean)
    .sort((first, second) => first.createdAt - second.createdAt);
  const tickers = [...new Set([
    ...(portfolio.holdings || []).map((holding) => String(holding.ticker || '').toUpperCase()),
    ...trades.map((trade) => trade.ticker),
  ].filter(Boolean))];

  if (!tickers.length) return [];

  const chartRange = range === 'YTD' ? '1Y' : range;
  const histories = new Map(tickers.map((ticker) => {
    const points = buildChartData(ticker, chartRange)
      .map((point) => ({
        timestamp: new Date(point.timestamp),
        price: Number(point.price),
      }))
      .filter((point) => (
        Number.isFinite(point.timestamp.getTime())
        && point.timestamp >= rangeStart
        && point.timestamp <= rangeEnd
        && Number.isFinite(point.price)
        && point.price > 0
      ))
      .sort((first, second) => first.timestamp - second.timestamp);
    const holding = (portfolio.holdings || []).find((item) => item.ticker === ticker);
    const currentPrice = Number(holding?.currentPrice);

    if (Number.isFinite(currentPrice) && currentPrice > 0) {
      points.push({ timestamp: new Date(rangeEnd), price: currentPrice });
    }

    return [ticker, points];
  }));
  const longestSeries = [...histories.values()].reduce(
    (longest, points) => (points.length > longest.length ? points : longest),
    [],
  );

  if (longestSeries.length < 2) return [];

  const timestamps = new Set([rangeStart.getTime(), rangeEnd.getTime()]);
  longestSeries.forEach((point) => timestamps.add(point.timestamp.getTime()));
  trades.forEach((trade) => timestamps.add(trade.createdAt.getTime()));
  const timeline = [...timestamps].sort((first, second) => first - second).map((timestamp) => new Date(timestamp));
  const shares = new Map(
    (portfolio.holdings || []).map((holding) => [
      String(holding.ticker || '').toUpperCase(),
      Number(holding.shares || 0),
    ]),
  );
  let cash = Number(portfolio.virtualCash || 0);

  [...trades].reverse().forEach((trade) => {
    const existingShares = Number(shares.get(trade.ticker) || 0);
    if (trade.side === 'BUY') {
      shares.set(trade.ticker, existingShares - trade.quantity);
      cash += trade.total;
    } else {
      shares.set(trade.ticker, existingShares + trade.quantity);
      cash -= trade.total;
    }
  });

  const priceIndexes = new Map();
  const latestPrices = new Map();
  let tradeIndex = 0;

  const points = timeline.map((timestamp) => {
    while (tradeIndex < trades.length && trades[tradeIndex].createdAt <= timestamp) {
      const trade = trades[tradeIndex];
      const existingShares = Number(shares.get(trade.ticker) || 0);
      if (trade.side === 'BUY') {
        shares.set(trade.ticker, existingShares + trade.quantity);
        cash -= trade.total;
      } else {
        shares.set(trade.ticker, Math.max(0, existingShares - trade.quantity));
        cash += trade.total;
      }
      tradeIndex += 1;
    }

    histories.forEach((series, ticker) => {
      let priceIndex = Number(priceIndexes.get(ticker) ?? -1);
      while (priceIndex + 1 < series.length && series[priceIndex + 1].timestamp <= timestamp) priceIndex += 1;
      priceIndexes.set(ticker, priceIndex);
      const pricePoint = series[priceIndex] || series[0];
      if (pricePoint) latestPrices.set(ticker, pricePoint.price);
    });

    const investedValue = [...shares.entries()].reduce((total, [ticker, quantity]) => (
      quantity > 0 ? total + quantity * Number(latestPrices.get(ticker) || 0) : total
    ), 0);
    const normalizedCash = Number(cash.toFixed(2));
    const normalizedInvestedValue = Number(investedValue.toFixed(2));

    return {
      timestamp: timestamp.toISOString(),
      cash: normalizedCash,
      investedValue: normalizedInvestedValue,
      totalValue: Number((normalizedCash + normalizedInvestedValue).toFixed(2)),
    };
  });

  points[points.length - 1] = {
    timestamp: rangeEnd.toISOString(),
    cash: Number(portfolio.virtualCash || 0),
    investedValue: Number(portfolio.investedValue || 0),
    totalValue: Number(portfolio.totalValue || 0),
  };

  return points;
}

/**
 * Returns the local portfolio performance needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @returns {*} The requested local portfolio performance result.
 */
function getLocalPortfolioPerformance(range) {
  const portfolio = getLocalPortfolio();
  const now = new Date();
  const rangeStart = getPerformanceRangeStart(range, now);
  const marketUpdatedAt = normalizeToMarketTime(now);
  let points = buildLocalPerformanceSeries(portfolio, range, rangeStart, marketUpdatedAt);

  if (!points.length) {
    points = [
      {
        timestamp: rangeStart.toISOString(),
        totalValue: portfolio.totalValue,
        cash: portfolio.virtualCash,
        investedValue: portfolio.investedValue,
      },
      {
        timestamp: marketUpdatedAt.toISOString(),
        totalValue: portfolio.totalValue,
        cash: portfolio.virtualCash,
        investedValue: portfolio.investedValue,
      },
    ];
  }

  const baseline = Number(points[0]?.totalValue || 0);
  points = points.map((point) => {
    const returnValue = Number(point.totalValue || 0) - baseline;
    return {
      ...point,
      returnValue,
      returnPercent: baseline ? (returnValue / baseline) * 100 : 0,
    };
  });

  return {
    demo: true,
    range,
    updatedAt: now.toISOString(),
    marketUpdatedAt: marketUpdatedAt.toISOString(),
    points,
  };
}

/**
 * Saves the local portfolio at the module's persistence boundary.
 * A dedicated persistence helper keeps storage side effects easy to locate.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @returns {void|*} No value is required; the save local portfolio state changes are applied.
 */
function saveLocalPortfolio(portfolio) {
  writeJson(STORAGE_KEYS.portfolio, portfolio);
}

/**
 * Checks whether a browser-only limit order is executable at the current price.
 * Keeping the condition in one predicate makes branching rules consistent and self-contained.
 * @param {'BUY'|'SELL'} side - Order side that determines cash and share movement.
 * @param {number} marketPrice - Current executable stock price.
 * @param {number} limitPrice - Requested maximum buy price or minimum sell price.
 * @returns {boolean} True when the local limit order should fill at the current demo quote.
 */
function shouldFillLocalLimit(side, marketPrice, limitPrice) {
  return side === 'BUY' ? marketPrice <= limitPrice : marketPrice >= limitPrice;
}

/**
 * Applies a filled browser-only order to local cash, holdings, and transaction history.
 * Executions use the current quote, not the limit price, to match realistic price-improvement behavior.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {object} stock - Normalized stock quote and company details.
 * @returns {object} Executed browser-only trade record.
 */
function fillLocalOrder(portfolio, order, stock) {
  const quantity = Number(order.quantity);
  const total = Number((quantity * stock.price).toFixed(2));
  const existingHolding = portfolio.holdings.find((holding) => holding.ticker === stock.ticker);

  if (order.side === 'BUY' && total > portfolio.virtualCash) {
    throw new Error('Insufficient virtual cash when the order reached its execution price.');
  }

  if (order.side === 'SELL' && (!existingHolding || existingHolding.shares < quantity)) {
    throw new Error('Insufficient shares when the order reached its execution price.');
  }

  if (order.side === 'BUY') {
    portfolio.virtualCash = Number((portfolio.virtualCash - total).toFixed(2));
    if (existingHolding) {
      const newShareCount = existingHolding.shares + quantity;
      existingHolding.averageCost = Number(
        (((existingHolding.averageCost * existingHolding.shares) + total) / newShareCount).toFixed(4),
      );
      existingHolding.shares = newShareCount;
    } else {
      portfolio.holdings.push({ ticker: stock.ticker, companyName: stock.company, logo: stock.logo || null, shares: quantity, averageCost: stock.price });
    }
  } else {
    portfolio.virtualCash = Number((portfolio.virtualCash + total).toFixed(2));
    existingHolding.shares = Number((existingHolding.shares - quantity).toFixed(4));
    portfolio.holdings = portfolio.holdings.filter((holding) => holding.shares > 0);
  }

  const trade = {
    id: crypto.randomUUID(),
    type: 'TRADE',
    direction: order.side === 'BUY' ? 'OUT' : 'IN',
    ticker: stock.ticker,
    side: order.side,
    orderType: order.orderType,
    limitPrice: order.orderType === 'LIMIT' ? Number(order.limitPrice) : undefined,
    quantity,
    price: stock.price,
    priceProvider: 'demo',
    total,
    createdAt: new Date().toISOString(),
  };
  portfolio.transactions.unshift(trade);
  return trade;
}

/**
 * Processes pending local limit orders whenever the browser fallback portfolio is read.
 * Filled orders are removed from the open list so reserved cash and shares are released correctly.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @returns {boolean} True when at least one open local order changed state.
 */
function processLocalLimitOrders(portfolio) {
  let changed = false;

  portfolio.openOrders = portfolio.openOrders.filter((order) => {
    const stock = findStock(order.ticker);
    if (!shouldFillLocalLimit(order.side, stock.price, Number(order.limitPrice))) return true;

    try {
      fillLocalOrder(portfolio, order, stock);
    } catch {
      // A rejected local order is removed so it no longer reserves virtual cash or shares.
    }
    changed = true;
    return false;
  });

  return changed;
}

/**
 * Validates and executes a browser-only paper trade at the current demo quote.
 * Non-marketable limits are stored as open orders; market and marketable limit orders fill immediately.
 * @param {object} order - Normalized market or limit order being processed.
 * @returns {object} Trade or pending-order result shaped like the server response.
 */
function executeLocalTrade(order) {
  const portfolio = readJson(STORAGE_KEYS.portfolio, initialPortfolio);
  const stock = findStock(order.ticker);
  const quantity = Number(order.quantity);
  const side = order.side.toUpperCase();
  const orderType = String(order.orderType || 'MARKET').toUpperCase();
  const limitPrice = Number(order.limitPrice);
  portfolio.holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  portfolio.transactions = Array.isArray(portfolio.transactions) ? portfolio.transactions : [];
  portfolio.openOrders = Array.isArray(portfolio.openOrders) ? portfolio.openOrders : [];

  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive whole number.');
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Side must be BUY or SELL.');
  if (!['MARKET', 'LIMIT'].includes(orderType)) throw new Error('Order type must be MARKET or LIMIT.');
  if (orderType === 'LIMIT' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) throw new Error('Enter a valid limit price.');

  const fillsAtQuote = orderType === 'MARKET' || shouldFillLocalLimit(side, stock.price, limitPrice);
  const reservedCash = portfolio.openOrders.reduce((sum, item) => sum + (item.side === 'BUY' ? item.limitPrice * item.quantity : 0), 0);
  const requiredCash = quantity * (orderType === 'LIMIT' && !fillsAtQuote ? limitPrice : stock.price);
  if (side === 'BUY' && requiredCash > portfolio.virtualCash - reservedCash) throw new Error('This order exceeds available virtual cash after open orders are reserved.');

  const existingHolding = portfolio.holdings.find((holding) => holding.ticker === stock.ticker);
  const reservedShares = portfolio.openOrders
    .filter((item) => item.side === 'SELL' && item.ticker === stock.ticker)
    .reduce((sum, item) => sum + Number(item.quantity), 0);
  if (side === 'SELL' && (!existingHolding || quantity > existingHolding.shares - reservedShares)) throw new Error('This order exceeds shares available after open sell orders are reserved.');

  const normalizedOrder = { ticker: stock.ticker, side, orderType, quantity, limitPrice };
  if (orderType === 'LIMIT' && !fillsAtQuote) {
    const pendingOrder = {
      id: crypto.randomUUID(),
      ...normalizedOrder,
      companyName: stock.company,
      submittedPrice: stock.price,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    portfolio.openOrders.unshift(pendingOrder);
    saveLocalPortfolio(portfolio);
    return { demo: true, trade: null, order: pendingOrder, portfolio: getLocalPortfolio() };
  }

  const trade = fillLocalOrder(portfolio, normalizedOrder, stock);

  saveLocalPortfolio(portfolio);
  return {
    demo: true,
    trade,
    order: { ...normalizedOrder, id: trade.id, status: 'FILLED', filledPrice: trade.price, total: trade.total },
    portfolio: getLocalPortfolio(),
  };
}

/**
 * Cancels a browser-only pending order and releases its reserved cash or shares.
 * Keeping local cancellation here mirrors the server API when the backend is unavailable.
 * @param {string} orderId - Identifier of the pending order.
 * @returns {object} Cancelled order plus the refreshed local portfolio.
 */
function cancelLocalTradeOrder(orderId) {
  const portfolio = readJson(STORAGE_KEYS.portfolio, initialPortfolio);
  portfolio.openOrders = Array.isArray(portfolio.openOrders) ? portfolio.openOrders : [];
  const order = portfolio.openOrders.find((item) => item.id === orderId);
  if (!order) throw new Error('This order is no longer open and cannot be cancelled.');
  portfolio.openOrders = portfolio.openOrders.filter((item) => item.id !== orderId);
  saveLocalPortfolio(portfolio);
  return { demo: true, order: { ...order, status: 'CANCELLED', cancelledAt: new Date().toISOString() }, portfolio: getLocalPortfolio() };
}

/**
 * Updates the local trade order while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {string} orderId - Identifier of the pending order.
 * @param {*} payload - Validated data supplied by the caller.
 * @returns {object} The updated or filled order together with the refreshed local portfolio.
 */
function updateLocalTradeOrder(orderId, payload) {
  const portfolio = readJson(STORAGE_KEYS.portfolio, initialPortfolio);
  const limitPrice = Number(payload.limitPrice);
  portfolio.holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  portfolio.transactions = Array.isArray(portfolio.transactions) ? portfolio.transactions : [];
  portfolio.openOrders = Array.isArray(portfolio.openOrders) ? portfolio.openOrders : [];

  if (!Number.isFinite(limitPrice) || limitPrice <= 0) throw new Error('Enter a valid limit price.');

  const order = portfolio.openOrders.find((item) => item.id === orderId);
  if (!order) throw new Error('This order is no longer open and cannot be updated.');

  const stock = findStock(order.ticker);
  const quantity = Number(order.quantity);
  const fillsAtQuote = shouldFillLocalLimit(order.side, stock.price, limitPrice);
  const reservedCash = portfolio.openOrders.reduce((sum, item) => {
    if (item.id === orderId || item.side !== 'BUY') return sum;
    return sum + Number(item.limitPrice) * Number(item.quantity);
  }, 0);
  const requiredCash = order.side === 'BUY' ? quantity * (fillsAtQuote ? stock.price : limitPrice) : 0;

  if (order.side === 'BUY' && requiredCash > portfolio.virtualCash - reservedCash) {
    throw new Error('This order exceeds available virtual cash after open orders are reserved.');
  }

  const existingHolding = portfolio.holdings.find((holding) => holding.ticker === stock.ticker);
  const reservedShares = portfolio.openOrders
    .filter((item) => item.id !== orderId && item.side === 'SELL' && item.ticker === stock.ticker)
    .reduce((sum, item) => sum + Number(item.quantity), 0);
  if (order.side === 'SELL' && (!existingHolding || quantity > existingHolding.shares - reservedShares)) {
    throw new Error('This order exceeds shares available after open sell orders are reserved.');
  }

  order.limitPrice = limitPrice;
  order.updatedAt = new Date().toISOString();

  if (!fillsAtQuote) {
    saveLocalPortfolio(portfolio);
    return { demo: true, trade: null, order, portfolio: getLocalPortfolio() };
  }

  portfolio.openOrders = portfolio.openOrders.filter((item) => item.id !== orderId);
  const trade = fillLocalOrder(portfolio, { ...order, orderType: 'LIMIT', limitPrice }, stock);
  const filledOrder = { ...order, status: 'FILLED', filledPrice: trade.price, total: trade.total };
  saveLocalPortfolio(portfolio);
  return { demo: true, trade, order: filledOrder, portfolio: getLocalPortfolio() };
}

/**
 * Returns the local suggestions needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} query - Ticker or company-name search text.
 * @returns {*} The requested local suggestions result.
 */
function getLocalSuggestions(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return demoStocks
    .filter((stock) => stock.ticker.toLowerCase().includes(normalizedQuery) || stock.company.toLowerCase().includes(normalizedQuery))
    .map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      type: 'Common Stock',
      logo: stock.logo || null,
      source: 'demo',
    }));
}

/**
 * Orders the stocks by volume using the shared comparison rule.
 * Centralizing ordering rules keeps lists consistent throughout the interface.
 * @param {Array<object>} stocks - Stock records to sort, filter, or display.
 * @returns {*} The ordered stocks by volume result.
 */
function sortStocksByVolume(stocks) {
  return [...stocks].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0));
}

/**
 * Orders the stocks by change using the shared comparison rule.
 * Centralizing ordering rules keeps lists consistent throughout the interface.
 * @param {Array<object>} stocks - Stock records to sort, filter, or display.
 * @param {string} direction - Direction that controls ordering or money movement.
 * @returns {*} The ordered stocks by change result.
 */
function sortStocksByChange(stocks, direction) {
  return [...stocks]
    .filter((stock) => {
      const change = Number(stock.change);
      return Number.isFinite(change) && (direction === 'gainer' ? change > 0 : change < 0);
    })
    .sort((a, b) => direction === 'gainer' ? Number(b.change) - Number(a.change) : Number(a.change) - Number(b.change));
}

/**
 * Returns the local market status needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} config - Configuration values that control the operation.
 * @returns {*} The requested local market status result.
 */
function getLocalMarketStatus(config) {
  const easternParts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const parts = Object.fromEntries(easternParts.map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  const isWeekday = !['Sat', 'Sun'].includes(parts.weekday);
  const isOpen = isWeekday && minutes >= config.openMinutes && minutes < config.closeMinutes;

  return {
    demo: true,
    provider: 'demo',
    code: config.code,
    label: config.label,
    exchange: config.exchange,
    isOpen,
    session: isOpen ? 'regular' : minutes < config.openMinutes && isWeekday ? 'pre-market' : 'closed',
    holiday: null,
    timezone: config.timezone,
    message: 'Live market status unavailable, showing a local market-hours estimate.',
  };
}

/**
 * Returns the demo market status needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {*} The requested demo market status result.
 */
function getDemoMarketStatus() {
  const markets = [
    getLocalMarketStatus({ code: 'US', label: 'US', exchange: 'US', timezone: 'America/New_York', openMinutes: 570, closeMinutes: 960 }),
    getLocalMarketStatus({ code: 'CA', label: 'Canada', exchange: 'TO', timezone: 'America/Toronto', openMinutes: 570, closeMinutes: 960 }),
  ];
  const usMarket = markets[0];

  return {
    ...usMarket,
    markets,
  };
}

export const api = {
  /**
   * Authenticates supplied credentials and stores the resulting session where appropriate.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} credentials - Email and password submitted for authentication.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  /**
   * Ends the server-managed browser session and expires its HttpOnly cookie.
   * @returns {Promise<object>} Logout confirmation from the API.
   */
  logout: () => request('/auth/logout', { method: 'POST' }),

  setSessionCsrfToken,
  clearSessionSecurity,

  /**
   * Creates a user account and starts its authenticated session.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Requests a fresh verification email for an unverified account.
   * Keeping this endpoint in the API layer prevents pages from knowing backend route strings.
   * @param {object} payload - Email address that should receive another verification email.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  resendVerification: (payload) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Requests a one-time password-reset link for an email address.
   * @param {object} payload - Email address entered in the forgot-password dialog.
   * @returns {Promise<object>} Generic password-reset request response.
   */
  requestPasswordReset: (payload) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Replaces a password using the one-time token from the reset email.
   * @param {object} payload - Reset token and validated replacement password.
   * @returns {Promise<object>} Completed password-reset response.
   */
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Returns the current user needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getCurrentUser: () => request('/auth/me'),

  /**
   * Updates the profile while preserving related state invariants.
   * Keeping mutation rules together protects related state from drifting out of sync.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  updateProfile: (payload) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  /**
   * Updates the password while preserving related state invariants.
   * Keeping mutation rules together protects related state from drifting out of sync.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  updatePassword: (payload) => request('/auth/password', { method: 'PATCH', body: JSON.stringify(payload) }),

  /**
   * Starts the legacy demo session used when that explicit flow is requested.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  startDemoSession: () =>
    request('/auth/demo', { method: 'POST' }, () => {
      const user = { id: 'demo-user', name: 'Demo Student', email: 'demo@stockpulse.test' };
      writeJson(STORAGE_KEYS.user, user);
      return { demo: true, user };
    }),

  /**
   * Returns the market status needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getMarketStatus: () =>
    request('/market/status', {}, () => getDemoMarketStatus()),

  /**
   * Returns the market active needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getMarketActive: () =>
    request('/market/active', {}, () => ({
      demo: true,
      message: 'Live data unavailable, showing sample data.',
      stocks: sortStocksByVolume(demoStocks),
      gainers: sortStocksByChange(demoStocks, 'gainer').slice(0, 3),
      losers: sortStocksByChange(demoStocks, 'loser').slice(0, 3),
    })),

  /**
   * Searches available data for the requested stock.
   * Centralizing search behavior keeps provider and fallback rules consistent.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  searchStock: (ticker) =>
    request(`/stocks/search/${ticker}`, {}, () => ({
      demo: true,
      message: 'Live data unavailable, showing sample data.',
      stock: findStock(ticker),
    })),

  /**
   * Returns the stock suggestions needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {string} query - Ticker or company-name search text.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getStockSuggestions: (query) =>
    request(`/stocks/suggest?query=${encodeURIComponent(query)}`, {}, () => ({
      demo: true,
      provider: 'demo',
      suggestions: getLocalSuggestions(query),
    })),

  /**
   * Returns the chart needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @param {*} range - Requested chart or performance time range.
   * @returns {Promise<object>} A promise resolving to normalized chart metadata and price points.
   */
  getChart: (ticker, range) =>
    request(`/stocks/${ticker}/chart?range=${range}`, {}, () => ({
      demo: true,
      provider: 'demo',
      source: 'Local generated range',
      ticker: String(ticker || '').toUpperCase(),
      range,
      updatedAt: new Date().toISOString(),
      message: 'Backend chart route unavailable, showing local generated data.',
      points: buildChartData(ticker, range),
    })),

  /**
   * Returns the news needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getNews: (ticker) =>
    request(ticker ? `/stocks/${ticker}/news` : '/market/news', {}, () => ({
      demo: true,
      news: demoNews.filter((item) => item.ticker === ticker || !ticker).slice(0, 5),
    })),

  /**
   * Returns the earnings needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getEarnings: (ticker) =>
    request(ticker ? `/stocks/${ticker}/earnings` : '/market/earnings', {}, () => ({
      demo: false,
      provider: 'none',
      message: 'Live upcoming earnings are unavailable right now.',
      earnings: [],
    })),

  /**
   * Returns the price targets needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getPriceTargets: (ticker) =>
    request(`/stocks/${ticker}/price-targets`, {}, () => ({
      demo: false,
      provider: 'none',
      ticker: String(ticker || '').toUpperCase(),
      message: 'Live analyst target data is unavailable right now.',
      consensus: null,
      firms: [],
    })),

  /**
   * Returns the watchlist needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getWatchlist: () =>
    request('/watchlist', {}, () => ({
      demo: true,
      items: getLocalWatchlist(),
    })),

  /**
   * Adds the watchlist while preventing inconsistent duplicate state.
   * A named mutation makes duplicate checks and side effects consistent.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  addWatchlist: (ticker) =>
    request(
      '/watchlist',
      { method: 'POST', body: JSON.stringify({ ticker }) },
      () => {
        const current = readJson(STORAGE_KEYS.watchlist, ['AAPL', 'NVDA']);
        const normalizedTicker = ticker.toUpperCase();
        if (!current.includes(normalizedTicker)) {
          writeJson(STORAGE_KEYS.watchlist, [...current, normalizedTicker]);
        }
        return { demo: true, item: findStock(normalizedTicker) };
      },
    ),

  /**
   * Removes the watchlist and performs its required cleanup.
   * A dedicated removal path keeps cleanup behavior consistent.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  removeWatchlist: (ticker) =>
    request(
      `/watchlist/${ticker}`,
      { method: 'DELETE' },
      () => {
        const next = readJson(STORAGE_KEYS.watchlist, ['AAPL', 'NVDA']).filter((item) => item !== ticker);
        writeJson(STORAGE_KEYS.watchlist, next);
        return { demo: true, removed: ticker };
      },
    ),

  /**
   * Returns the portfolio needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  getPortfolio: () =>
    request('/portfolio', {}, () => getLocalPortfolio()),

  /**
   * Returns the portfolio performance needed by the calling screen or service.
   * Centralizing this lookup keeps callers independent from where the data comes from.
   * @param {*} range - Requested chart or performance time range.
   * @returns {Promise<object>} A promise resolving to timestamped portfolio values for the selected range.
   */
  getPortfolioPerformance: (range) =>
    request(`/portfolio/performance?range=${encodeURIComponent(range)}`, {}, () => getLocalPortfolioPerformance(range)),

  /**
   * Submits a paper-trading order and returns the updated portfolio.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} order - Normalized market or limit order being processed.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  placeTrade: (order) =>
    request(
      '/trades',
      { method: 'POST', body: JSON.stringify(order) },
      () => executeLocalTrade(order),
    ),

  /**
   * Cancels a pending paper-trading order through the API.
   * Keeping this request in the API layer prevents components from depending on HTTP details.
   * @param {string} orderId - Identifier of the pending order.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  cancelTradeOrder: (orderId) =>
    request(
      `/trades/${orderId}`,
      { method: 'DELETE' },
      () => cancelLocalTradeOrder(orderId),
    ),

  /**
   * Updates the trade order while preserving related state invariants.
   * Keeping mutation rules together protects related state from drifting out of sync.
   * @param {string} orderId - Identifier of the pending order.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  updateTradeOrder: (orderId, payload) =>
    request(
      `/trades/${orderId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      () => updateLocalTradeOrder(orderId, payload),
    ),

  /**
   * Requests an educational AI explanation for the supplied context.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the API response.
   */
  askAI: (payload) =>
    request(
      '/ai/insight',
      { method: 'POST', body: JSON.stringify(payload) },
      () => ({
        demo: true,
        answer:
          'Educational explanation only, not financial advice. In this demo context, compare price change, volume versus average volume, and the related headlines to understand what learners often watch before forming their own questions.',
      }),
    ),
};

export { STORAGE_KEYS };
