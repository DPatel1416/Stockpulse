/**
 * File purpose: Handles educational AI-insight requests and provides a safe local explanation fallback.
 */
import { catchAsync } from '../utils/catchAsync.js';

// Mock AI keeps the product useful without an OPENAI_API_KEY and always includes safety copy.
/**
 * Returns a beginner-friendly AI explanation for the supplied dashboard context.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the HTTP response is sent.
 */
export const insight = catchAsync(async (req, res) => {
  const prompt = req.body.prompt || 'Explain this market data.';
  const context = req.body.context || {};
  const subject = context.stock?.ticker || context.screen || 'this StockPulse view';

  res.json({
    demo: !process.env.OPENAI_API_KEY,
    answer: `Educational explanation only, not financial advice. For ${subject}, start by comparing price change, volume versus average volume, recent headlines, and portfolio exposure. Your question was: "${prompt}". These signals help students describe what happened without making buy, sell, or hold recommendations.`,
  });
});
