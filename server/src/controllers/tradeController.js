/**
 * File purpose: Translates Trade HTTP requests into service calls and JSON responses.
 */
import { getPortfolioForUser } from '../services/portfolioService.js';
import { cancelOrderForUser, placeOrderForUser, updateLimitOrderForUser } from '../services/orderService.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Creates the trade with the defaults required by the rest of the app.
 * Centralizing creation ensures every new value follows the same defaults and validation.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export const createTrade = catchAsync(async (req, res) => {
  const result = await placeOrderForUser(req.user, req.body);
  const portfolio = await getPortfolioForUser(req.user);
  const statusCode = result.order.status === 'PENDING' ? 202 : 201;

  res.status(statusCode).json({ ...result, portfolio });
});

/**
 * Cancels a pending paper-trading order for the authenticated user.
 * The controller delegates ownership checks and persistence to the order service.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the JSON response is sent.
 */
export const cancelTradeOrder = catchAsync(async (req, res) => {
  const order = await cancelOrderForUser(req.user, req.params.orderId);
  const portfolio = await getPortfolioForUser(req.user);
  res.json({ order, portfolio });
});

/**
 * Updates the trade order while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the update trade order side effects finish.
 */
export const updateTradeOrder = catchAsync(async (req, res) => {
  const result = await updateLimitOrderForUser(req.user, req.params.orderId, req.body);
  const portfolio = await getPortfolioForUser(req.user);
  const statusCode = result.order.status === 'FILLED' ? 201 : 200;

  res.status(statusCode).json({ ...result, portfolio });
});

/**
 * Returns the authenticated user's recent trade ledger.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the list trades result.
 */
export const listTrades = catchAsync(async (req, res) => {
  const portfolio = await getPortfolioForUser(req.user);
  res.json({ transactions: portfolio.transactions, openOrders: portfolio.openOrders });
});
