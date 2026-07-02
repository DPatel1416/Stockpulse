/**
 * File purpose: Translates Portfolio HTTP requests into service calls and JSON responses.
 */
import { getPortfolioForUser } from '../services/portfolioService.js';
import { getPortfolioPerformance as getPerformance } from '../services/portfolioPerformanceService.js';
import { catchAsync } from '../utils/catchAsync.js';

// Portfolio funding is intentionally unavailable; the client only previews that future flow.
/**
 * Returns the portfolio needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export const getPortfolio = catchAsync(async (req, res) => {
  res.json(await getPortfolioForUser(req.user));
});

/**
 * Returns the portfolio performance needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<object>} A promise resolving to timestamped portfolio values for the selected range.
 */
export const getPortfolioPerformance = catchAsync(async (req, res) => {
  const portfolio = await getPortfolioForUser(req.user);
  res.json(await getPerformance(req.user, portfolio, String(req.query.range || '1D').toUpperCase()));
});
