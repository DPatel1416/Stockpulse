/**
 * File purpose: Defines reusable Error Handler Express middleware that runs before or after route handlers.
 */
// A friendly API error shape avoids exposing stack traces to the client.
/**
 * Creates a clear 404 response when no API route matches the request.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @param {*} next - Express callback that passes control or an error to the next middleware.
 * @returns {void} No value is returned; an HTTP error response is sent.
 */
export function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * Converts unexpected Express errors into a consistent JSON response.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} error - Error being translated, logged, or displayed.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @param {*} next - Express callback that passes control or an error to the next middleware.
 * @returns {void} No value is returned; a JSON error response is sent.
 */
export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Something went wrong on the StockPulse API.' : error.message,
  });
}
