/**
 * File purpose: Translates Stock HTTP requests into service calls and JSON responses.
 */
import { catchAsync } from '../utils/catchAsync.js';
import { getChart, getEarnings, getNews, getPriceTargets, getStockSuggestions, searchStock } from '../services/stockDataService.js';

/**
 * Returns ticker and company-name suggestions for a search query.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export const suggestions = catchAsync(async (req, res) => {
  res.json(await getStockSuggestions(req.query.query || req.query.q || ''));
});

/**
 * Searches available data for the requested helper.
 * Centralizing search behavior keeps provider and fallback rules consistent.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the matching result.
 */
export const search = catchAsync(async (req, res) => {
  res.json(await searchStock(req.params.ticker));
});

/**
 * Returns historical OHLC chart points for a ticker and range.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the chart result.
 */
export const chart = catchAsync(async (req, res) => {
  res.json(await getChart(req.params.ticker, req.query.range || '1M'));
});

/**
 * Returns the requested market or ticker news feed.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the news result.
 */
export const news = catchAsync(async (req, res) => {
  res.json(await getNews(req.params.ticker));
});

/**
 * Returns upcoming earnings for the requested market or ticker.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the earnings result.
 */
export const earnings = catchAsync(async (req, res) => {
  res.json(await getEarnings(req.params.ticker));
});

/**
 * Returns analyst consensus targets and recent firm ratings for a ticker.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the price targets result.
 */
export const priceTargets = catchAsync(async (req, res) => {
  res.json(await getPriceTargets(req.params.ticker));
});
