/**
 * File purpose: Provides focused Guest Watchlist helper functions that keep repeated logic out of larger modules.
 */
import { api } from '../services/api';

// Guest favorites resolve live quotes but remain in the in-memory guest context rather than any database.
/**
 * Loads the guest watchlist stocks and prepares it for the current workflow.
 * Separating loading from rendering keeps asynchronous state easier to follow.
 * @param {Array<string>} tickers - Ticker symbols to resolve into stock records.
 * @returns {Promise<Array<object>>} A promise resolving to current stock details for the guest tickers.
 */
export async function loadGuestWatchlistStocks(tickers) {
  const results = await Promise.all(tickers.map((ticker) => api.searchStock(ticker).catch(() => null)));
  return results.map((result) => result?.stock).filter(Boolean);
}
