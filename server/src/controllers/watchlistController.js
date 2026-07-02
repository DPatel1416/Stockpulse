/**
 * File purpose: Translates Watchlist HTTP requests into service calls and JSON responses.
 */
import { isDatabaseConnected } from '../config/db.js';
import WatchlistItem from '../models/WatchlistItem.js';
import { searchStock } from '../services/stockDataService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { demoStore } from '../utils/demoStore.js';
import { findStock } from '../utils/demoData.js';

/**
 * Converts a database or demo user identifier into a consistent string key.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @returns {string} A stable string identifier for the authenticated request user.
 */
function userId(req) {
  return String(req.user._id || req.user.id);
}

/**
 * Removes demo-only suffixes from company names shown in a saved watchlist.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} company - Company name associated with the ticker.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {string} savedCompanyName - Company label previously stored with a record.
 * @returns {*} The clean watchlist company name result.
 */
function cleanWatchlistCompanyName(company, ticker, savedCompanyName) {
  const candidate = String(company || '').trim();
  const saved = String(savedCompanyName || '').trim();

  if (candidate && !candidate.includes('Demo Company')) return candidate;
  if (saved && !saved.includes('Demo Company')) return saved;
  return ticker;
}

/**
 * Loads a live quote for one saved ticker and falls back safely when unavailable.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {string} savedCompanyName - Company label previously stored with a record.
 * @returns {Promise<*>} A promise resolving to the resolve watchlist stock result.
 */
async function resolveWatchlistStock(ticker, savedCompanyName) {
  try {
    const result = await searchStock(ticker);
    return {
      ...result.stock,
      company: cleanWatchlistCompanyName(result.stock.company, ticker, savedCompanyName),
      isLivePrice: !result.demo,
      priceProvider: result.provider,
      priceMessage: result.message || null,
    };
  } catch {
    const fallback = findStock(ticker);
    return {
      ...fallback,
      company: cleanWatchlistCompanyName(fallback.company, ticker, savedCompanyName),
      isLivePrice: false,
      priceProvider: 'demo',
      priceMessage: 'Live quote unavailable.',
    };
  }
}

/**
 * Loads current quote details for every saved watchlist record.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} items - Items being rendered, filtered, or transformed.
 * @returns {Promise<*>} A promise resolving to the resolve watchlist stocks result.
 */
async function resolveWatchlistStocks(items) {
  return Promise.all(
    items.map((item) => resolveWatchlistStock(item.ticker || item, item.companyName)),
  );
}

/**
 * Returns the authenticated user's saved watchlist with current quote details.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the list watchlist result.
 */
export const listWatchlist = catchAsync(async (req, res) => {
  const id = userId(req);

  if (isDatabaseConnected()) {
    const items = await WatchlistItem.find({ userId: id }).sort({ ticker: 1 }).lean();
    return res.json({ items: await resolveWatchlistStocks(items) });
  }

  const tickers = demoStore.watchlists.get(id) || ['AAPL', 'NVDA'];
  res.json({ demo: true, items: await resolveWatchlistStocks(tickers) });
});

/**
 * Adds the watchlist item while preventing inconsistent duplicate state.
 * A named mutation makes duplicate checks and side effects consistent.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the add watchlist item side effects finish.
 */
export const addWatchlistItem = catchAsync(async (req, res) => {
  const id = userId(req);
  const ticker = String(req.body.ticker || '').trim().toUpperCase();

  if (!ticker) return res.status(400).json({ message: 'Ticker is required.' });

  const stock = await resolveWatchlistStock(ticker);

  if (isDatabaseConnected()) {
    const item = await WatchlistItem.findOneAndUpdate(
      { userId: id, ticker },
      { $setOnInsert: { userId: id, ticker, companyName: stock.company } },
      { upsert: true, new: true },
    );
    return res.status(201).json({ item: stock, savedTicker: item.ticker });
  }

  const current = demoStore.watchlists.get(id) || [];
  if (!current.includes(ticker)) demoStore.watchlists.set(id, [...current, ticker]);
  res.status(201).json({ demo: true, item: stock });
});

/**
 * Removes the watchlist item and performs its required cleanup.
 * A dedicated removal path keeps cleanup behavior consistent.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the remove watchlist item side effects finish.
 */
export const removeWatchlistItem = catchAsync(async (req, res) => {
  const id = userId(req);
  const ticker = req.params.ticker.toUpperCase();

  if (isDatabaseConnected()) {
    await WatchlistItem.deleteOne({ userId: id, ticker });
    return res.json({ removed: ticker });
  }

  demoStore.watchlists.set(id, (demoStore.watchlists.get(id) || []).filter((item) => item !== ticker));
  res.json({ demo: true, removed: ticker });
});
