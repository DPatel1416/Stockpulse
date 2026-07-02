/**
 * File purpose: Translates Market HTTP requests into service calls and JSON responses.
 */
import { catchAsync } from '../utils/catchAsync.js';
import { getMarketEarnings, getMarketNews, getMarketStatus, getMarketSummary, getTopActiveStocks } from '../services/stockDataService.js';

/**
 * Returns the current US and Canadian market-session status.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export const status = catchAsync(async (req, res) => {
  res.json(await getMarketStatus());
});

/**
 * Returns the market summary used by dashboard index cards.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the summary result.
 */
export const summary = catchAsync(async (req, res) => {
  res.json(await getMarketSummary());
});

/**
 * Returns actively traded stocks plus the leading gainers and losers.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the active result.
 */
export const active = catchAsync(async (req, res) => {
  res.json(await getTopActiveStocks());
});

/**
 * Returns the requested market or ticker news feed.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the news result.
 */
export const news = catchAsync(async (req, res) => {
  res.json(await getMarketNews());
});

/**
 * Returns upcoming earnings for the requested market or ticker.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the earnings result.
 */
export const earnings = catchAsync(async (req, res) => {
  res.json(await getMarketEarnings());
});
