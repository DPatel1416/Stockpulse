/**
 * File purpose: Provides focused Catch Async helper functions that keep repeated logic out of larger modules.
 */
// catchAsync prevents repeated try/catch blocks in route controllers.
/**
 * Wraps an asynchronous route handler so rejected promises reach Express error middleware.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Function} handler - Asynchronous Express route handler to wrap.
 * @returns {Function} An Express handler that forwards rejected promises to error middleware.
 */
export function catchAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
