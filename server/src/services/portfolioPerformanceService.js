/**
 * File purpose: Reconstructs historical portfolio values from trades, holdings, snapshots, and market candles.
 */
import { isDatabaseConnected } from '../config/db.js';
import PortfolioSnapshot from '../models/PortfolioSnapshot.js';
import Transaction from '../models/Transaction.js';
import { demoStore } from '../utils/demoStore.js';
import {
  atMarketMinute,
  firstTradingDayOfYear,
  getActiveTradingDay,
  isRegularMarketTime,
  normalizeToMarketTime,
  subtractTradingDays,
} from '../utils/marketTime.js';
import { getChart } from './stockDataService.js';

const RANGE_ALIASES = new Set(['1D', '5D', '1M', '30D', '3M', '6M', '1Y', '5Y', 'YTD']);
const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const TRADING_DAY_RANGES = {
  '5D': 5,
  '1M': 21,
  '30D': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '5Y': 1260,
};
const CHART_RANGE_ALIASES = {
  '30D': '1M',
  YTD: '1Y',
};

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
 * Returns the range start needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @returns {*} The requested range start result.
 */
function getRangeStart(range, now = new Date()) {
  const activeTradingDay = getActiveTradingDay(now);

  if (range === 'YTD') return atMarketMinute(firstTradingDayOfYear(activeTradingDay), MARKET_OPEN_MINUTES);
  if (range === '1D') return atMarketMinute(activeTradingDay, MARKET_OPEN_MINUTES);

  const tradingDays = TRADING_DAY_RANGES[range] || 1;
  return atMarketMinute(subtractTradingDays(activeTradingDay, Math.max(0, tradingDays - 1)), MARKET_OPEN_MINUTES);
}

/**
 * Copies the numeric cash, invested value, and total value used in a portfolio snapshot.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @returns {object} Numeric cash, invested value, and total value fields for a snapshot.
 */
function snapshotValues(portfolio) {
  return {
    totalValue: Number(portfolio.totalValue || 0),
    cash: Number(portfolio.virtualCash || 0),
    investedValue: Number(portfolio.investedValue || 0),
  };
}

/**
 * Checks whether enough time or value change has occurred to save another snapshot.
 * Keeping the condition in one predicate makes branching rules consistent and self-contained.
 * @param {object|null} latest - Most recently recorded value.
 * @param {*} values - Collection of values used by the calculation.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @returns {boolean} True when the condition is satisfied; otherwise false.
 */
function shouldRecordSnapshot(latest, values, now) {
  if (!latest) return true;

  const valueChanged = Math.abs(Number(latest.totalValue) - values.totalValue) >= 0.01
    || Math.abs(Number(latest.cash) - values.cash) >= 0.01
    || Math.abs(Number(latest.investedValue) - values.investedValue) >= 0.01;
  const latestTime = new Date(latest.createdAt).getTime();

  return valueChanged || now.getTime() - latestTime >= SNAPSHOT_INTERVAL_MS;
}

/**
 * Records the snapshot only after its values are ready for persistence.
 * Keeping persistence in one helper prevents duplicate or inconsistent records.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @returns {Promise<void>} A promise that resolves after the record snapshot side effects finish.
 */
async function recordSnapshot(user, portfolio, now) {
  const userId = toUserId(user);
  const values = snapshotValues(portfolio);

  if (!isDatabaseConnected()) {
    const snapshots = demoStore.portfolioSnapshots.get(userId) || [];
    const latest = snapshots.at(-1);

    if (shouldRecordSnapshot(latest, values, now)) {
      snapshots.push({ id: crypto.randomUUID(), ...values, createdAt: now.toISOString() });
      demoStore.portfolioSnapshots.set(userId, snapshots);
    }

    return;
  }

  const latest = await PortfolioSnapshot.findOne({ userId }).sort({ createdAt: -1 }).lean();
  if (shouldRecordSnapshot(latest, values, now)) {
    await PortfolioSnapshot.create({ userId, ...values, createdAt: now });
  }
}

/**
 * Reads the snapshots from its persistence boundary for the calling workflow.
 * Keeping storage access here prevents persistence details from spreading through the application.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @returns {Promise<*>} A promise resolving to the stored snapshots result.
 */
async function readSnapshots(user, range, rangeStart) {
  const userId = toUserId(user);

  if (!isDatabaseConnected()) {
    const snapshots = demoStore.portfolioSnapshots.get(userId) || [];
    const beforeRange = [...snapshots].reverse().find((snapshot) => new Date(snapshot.createdAt) < rangeStart);
    const withinRange = snapshots.filter((snapshot) => new Date(snapshot.createdAt) >= rangeStart);
    return beforeRange ? [beforeRange, ...withinRange] : withinRange;
  }

  const [beforeRange, withinRange] = await Promise.all([
    PortfolioSnapshot.findOne({ userId, createdAt: { $lt: rangeStart } }).sort({ createdAt: -1 }).lean(),
    PortfolioSnapshot.find({ userId, createdAt: { $gte: rangeStart } }).sort({ createdAt: 1 }).limit(600).lean(),
  ]);

  return beforeRange ? [beforeRange, ...withinRange] : withinRange;
}

/**
 * Constructs the performance points from its source values.
 * A named builder keeps multi-step construction logic testable and reusable.
 * @param {Array<object>} snapshots - Recorded portfolio-value snapshots.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} now - Reference time used to make the calculation deterministic.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @returns {*} The constructed performance points result.
 */
function buildPerformancePoints(snapshots, rangeStart, now, portfolio) {
  const currentValues = snapshotValues(portfolio);
  const rangeEnd = normalizeToMarketTime(now);
  const source = snapshots.length ? snapshots : [{ ...currentValues, createdAt: rangeEnd }];
  const normalizedPoints = [...source, { ...currentValues, createdAt: rangeEnd }]
    .map((snapshot, index) => {
      const recordedAt = normalizeToMarketTime(snapshot.createdAt);
      const timestamp = index === 0 && recordedAt < rangeStart ? rangeStart : recordedAt;

      return {
        timestamp,
        totalValue: Number(snapshot.totalValue || 0),
        cash: Number(snapshot.cash || 0),
        investedValue: Number(snapshot.investedValue || 0),
      };
    })
    .filter((point) => point.timestamp >= rangeStart && point.timestamp <= rangeEnd)
    .sort((a, b) => a.timestamp - b.timestamp);
  const dedupedByTimestamp = new Map();

  normalizedPoints.forEach((point) => {
    dedupedByTimestamp.set(point.timestamp.getTime(), point);
  });

  const sourcePoints = [...dedupedByTimestamp.values()];

  if (!sourcePoints.length) {
    sourcePoints.push({ timestamp: rangeStart, ...currentValues });
  }

  if (sourcePoints.length === 1 && sourcePoints[0].timestamp > rangeStart) {
    sourcePoints.unshift({ ...sourcePoints[0], timestamp: rangeStart });
  }

  if (sourcePoints.at(-1).timestamp < rangeEnd) {
    sourcePoints.push({ ...sourcePoints.at(-1), timestamp: rangeEnd });
  }

  const baseline = Number(sourcePoints[0].totalValue || 0);

  return sourcePoints.map((snapshot) => {
    const totalValue = Number(snapshot.totalValue || 0);
    const returnValue = totalValue - baseline;

    return {
      timestamp: snapshot.timestamp.toISOString(),
      totalValue,
      cash: Number(snapshot.cash || 0),
      investedValue: Number(snapshot.investedValue || 0),
      returnValue,
      returnPercent: baseline ? (returnValue / baseline) * 100 : 0,
    };
  });
}

/**
 * Reads the trade ledger from its persistence boundary for the calling workflow.
 * Keeping storage access here prevents persistence details from spreading through the application.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @returns {Promise<*>} A promise resolving to the stored trade ledger result.
 */
async function readTradeLedger(user, rangeStart) {
  const userId = toUserId(user);

  if (!isDatabaseConnected()) {
    return (demoStore.transactions.get(userId) || [])
      .filter((transaction) => {
        const createdAt = new Date(transaction.createdAt);
        return (transaction.type || 'TRADE') === 'TRADE'
          && Number.isFinite(createdAt.getTime())
          && createdAt >= rangeStart;
      })
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
  }

  return Transaction.find({
    userId,
    $or: [{ type: 'TRADE' }, { type: { $exists: false } }],
    createdAt: { $gte: rangeStart },
  }).sort({ createdAt: 1 }).limit(2000).lean();
}

/**
 * Converts the trade into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @returns {*} The normalized trade result.
 */
function normalizeTrade(transaction) {
  const createdAt = normalizeToMarketTime(transaction.createdAt);
  const quantity = Number(transaction.quantity);
  const total = Number(transaction.total);
  const ticker = String(transaction.ticker || '').trim().toUpperCase();
  const side = String(transaction.side || '').trim().toUpperCase();

  if (!ticker || !['BUY', 'SELL'].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(total)) {
    return null;
  }

  return {
    ticker,
    side,
    quantity,
    total,
    createdAt,
  };
}

/**
 * Loads the historical series and prepares it for the current workflow.
 * Separating loading from rendering keeps asynchronous state easier to follow.
 * @param {Array<string>} tickers - Ticker symbols to resolve into stock records.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @returns {Promise<*>} A promise resolving to the loaded historical series result.
 */
async function loadHistoricalSeries(tickers, range, rangeStart, rangeEnd, portfolio) {
  const chartRange = CHART_RANGE_ALIASES[range] || range;
  const histories = new Map();

  // Small batches avoid flooding the market provider for diversified portfolios.
  for (let index = 0; index < tickers.length; index += 6) {
    const batch = tickers.slice(index, index + 6);
    const results = await Promise.all(batch.map(async (ticker) => {
      const chart = await getChart(ticker, chartRange);
      const points = (chart.points || [])
        .map((point) => ({
          timestamp: new Date(point.timestamp),
          price: Number(point.close ?? point.price),
        }))
        .filter((point) => (
          Number.isFinite(point.timestamp.getTime())
          && Number.isFinite(point.price)
          && point.price > 0
          && isRegularMarketTime(point.timestamp)
        ))
        .sort((first, second) => first.timestamp - second.timestamp);

      return [ticker, points];
    }));

    results.forEach(([ticker, points]) => histories.set(ticker, points));
  }

  // The final market point must agree with the live prices used by the portfolio totals.
  (portfolio.holdings || []).forEach((holding) => {
    const ticker = String(holding.ticker || '').toUpperCase();
    const currentPrice = Number(holding.currentPrice);
    if (!ticker || !Number.isFinite(currentPrice) || currentPrice <= 0) return;

    const points = histories.get(ticker) || [];
    points.push({ timestamp: new Date(rangeEnd), price: currentPrice });
    histories.set(ticker, points.sort((first, second) => first.timestamp - second.timestamp));
  });

  histories.forEach((points, ticker) => {
    histories.set(ticker, points.filter((point) => point.timestamp >= rangeStart && point.timestamp <= rangeEnd));
  });

  return histories;
}

/**
 * Returns the historical timeline needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Map<string, Array<object>>} histories - Historical price series grouped by ticker.
 * @param {Array<object>} trades - Chronological trade records used to rebuild account state.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @returns {*} The requested historical timeline result.
 */
function getHistoricalTimeline(histories, trades, rangeStart, rangeEnd) {
  const longestSeries = [...histories.values()].reduce(
    (longest, points) => (points.length > longest.length ? points : longest),
    [],
  );
  const timestamps = new Set([rangeStart.getTime(), rangeEnd.getTime()]);

  longestSeries.forEach((point) => timestamps.add(point.timestamp.getTime()));
  trades.forEach((trade) => {
    if (trade.createdAt >= rangeStart && trade.createdAt <= rangeEnd) {
      timestamps.add(trade.createdAt.getTime());
    }
  });

  return [...timestamps]
    .sort((first, second) => first - second)
    .map((timestamp) => new Date(timestamp));
}

/**
 * Returns the opening account state needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {Array<object>} trades - Chronological trade records used to rebuild account state.
 * @returns {*} The requested opening account state result.
 */
function getOpeningAccountState(portfolio, trades) {
  const shares = new Map(
    (portfolio.holdings || []).map((holding) => [
      String(holding.ticker || '').toUpperCase(),
      Number(holding.shares || 0),
    ]),
  );
  let cash = Number(portfolio.virtualCash || 0);

  // Reverse every in-range trade to recover the account immediately before the range begins.
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

  shares.forEach((quantity, ticker) => {
    shares.set(ticker, Math.abs(quantity) < 0.0001 ? 0 : Number(quantity.toFixed(4)));
  });

  return { cash, shares };
}

/**
 * Constructs the market performance points from its source values.
 * A named builder keeps multi-step construction logic testable and reusable.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {Map<string, Array<object>>} histories - Historical price series grouped by ticker.
 * @param {Array<object>} trades - Chronological trade records used to rebuild account state.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @returns {*} The constructed market performance points result.
 */
function buildMarketPerformancePoints(portfolio, histories, trades, rangeStart, rangeEnd) {
  const timeline = getHistoricalTimeline(histories, trades, rangeStart, rangeEnd);
  const state = getOpeningAccountState(portfolio, trades);
  const priceIndexes = new Map();
  const latestPrices = new Map();
  let tradeIndex = 0;

  const points = timeline.map((timestamp) => {
    while (tradeIndex < trades.length && trades[tradeIndex].createdAt <= timestamp) {
      const trade = trades[tradeIndex];
      const existingShares = Number(state.shares.get(trade.ticker) || 0);

      if (trade.side === 'BUY') {
        state.shares.set(trade.ticker, existingShares + trade.quantity);
        state.cash -= trade.total;
      } else {
        state.shares.set(trade.ticker, Math.max(0, existingShares - trade.quantity));
        state.cash += trade.total;
      }

      tradeIndex += 1;
    }

    histories.forEach((series, ticker) => {
      let priceIndex = Number(priceIndexes.get(ticker) ?? -1);

      while (priceIndex + 1 < series.length && series[priceIndex + 1].timestamp <= timestamp) {
        priceIndex += 1;
      }

      priceIndexes.set(ticker, priceIndex);
      const pricePoint = series[priceIndex] || series[0];
      if (pricePoint) latestPrices.set(ticker, pricePoint.price);
    });

    const investedValue = [...state.shares.entries()].reduce((total, [ticker, quantity]) => {
      if (quantity <= 0) return total;
      const price = Number(latestPrices.get(ticker) || 0);
      return total + quantity * price;
    }, 0);
    const cash = Number(state.cash.toFixed(2));
    const normalizedInvestedValue = Number(investedValue.toFixed(2));

    return {
      timestamp,
      cash,
      investedValue: normalizedInvestedValue,
      totalValue: Number((cash + normalizedInvestedValue).toFixed(2)),
    };
  });

  if (points.length) {
    const currentValues = snapshotValues(portfolio);
    points[points.length - 1] = {
      timestamp: new Date(rangeEnd),
      ...currentValues,
    };
  }

  const baseline = Number(points[0]?.totalValue || 0);
  return points.map((point) => {
    const returnValue = Number(point.totalValue || 0) - baseline;

    return {
      timestamp: point.timestamp.toISOString(),
      totalValue: Number(point.totalValue || 0),
      cash: Number(point.cash || 0),
      investedValue: Number(point.investedValue || 0),
      returnValue,
      returnPercent: baseline ? (returnValue / baseline) * 100 : 0,
    };
  });
}

/**
 * Reprices historical holdings from market candles so inactive days still show real movement.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} rangeStart - Inclusive beginning of the requested performance range.
 * @param {Date} rangeEnd - Inclusive end of the requested performance range.
 * @returns {Promise<*>} A promise resolving to the reconstruct market performance result.
 */
async function reconstructMarketPerformance(user, portfolio, range, rangeStart, rangeEnd) {
  const ledger = await readTradeLedger(user, rangeStart);
  const trades = ledger.map(normalizeTrade).filter(Boolean);
  const tickers = [...new Set([
    ...(portfolio.holdings || []).map((holding) => String(holding.ticker || '').toUpperCase()),
    ...trades.map((trade) => trade.ticker),
  ].filter(Boolean))];

  if (!tickers.length) return [];

  const histories = await loadHistoricalSeries(tickers, range, rangeStart, rangeEnd, portfolio);
  if (![...histories.values()].some((points) => points.length > 1)) return [];

  return buildMarketPerformancePoints(portfolio, histories, trades, rangeStart, rangeEnd);
}

// Historical candles reprice holdings even when the user has not opened StockPulse for several days.
/**
 * Returns the portfolio performance needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {*} portfolio - Current portfolio values, holdings, transactions, and orders.
 * @param {string} requestedRange - Untrusted range value received from the API request.
 * @returns {Promise<object>} A promise resolving to timestamped portfolio values for the selected range.
 */
export async function getPortfolioPerformance(user, portfolio, requestedRange) {
  const range = RANGE_ALIASES.has(requestedRange) ? requestedRange : '1D';
  const now = new Date();
  const rangeStart = getRangeStart(range, now);
  const rangeEnd = normalizeToMarketTime(now);

  await recordSnapshot(user, portfolio, now);
  const marketPoints = await reconstructMarketPerformance(user, portfolio, range, rangeStart, rangeEnd);
  let points = marketPoints;

  if (!points.length) {
    const snapshots = await readSnapshots(user, range, rangeStart);
    points = buildPerformancePoints(snapshots, rangeStart, now, portfolio);
  }

  return {
    range,
    updatedAt: now.toISOString(),
    marketUpdatedAt: rangeEnd.toISOString(),
    points,
  };
}
