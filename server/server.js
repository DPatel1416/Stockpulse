/**
 * File purpose: Starts the StockPulse HTTP server and background jobs after environment/database setup.
 */
import dotenv from 'dotenv';
import { app } from './src/app.js';
import { connectDatabase } from './src/config/db.js';
import { processAllPendingOrders } from './src/services/orderService.js';

dotenv.config();

if (!process.env.JWT_SECRET?.trim()) {
  throw new Error('JWT_SECRET must be configured in server/.env before the API can start.');
}

if (process.env.JWT_SECRET.trim().length < 32) {
  console.warn('JWT_SECRET should contain at least 32 characters.');
}

const port = process.env.PORT || 5000;

// The API still starts if MongoDB is unavailable; controllers then use demo memory storage.
/**
 * Starts HTTP and background order processing after the initial database attempt finishes.
 * The API starts even without MongoDB because StockPulse supports in-memory demonstration storage.
 * @returns {void} No value is returned; long-running server processes are started.
 */
connectDatabase().finally(() => {
  /**
   * Logs the local API address after Express begins listening.
   * Keeping startup feedback here makes terminal troubleshooting straightforward.
   * @returns {void} No value is returned; a startup message is written.
   */
  app.listen(port, () => {
    console.log(`StockPulse API running on http://localhost:${port}`);
  });

  let orderSweepRunning = false;
  const orderSweepInterval = Number(process.env.LIMIT_ORDER_POLL_MS || 15000);
  /**
   * Periodically checks whether pending limit orders have reached executable prices.
   * A lock prevents overlapping sweeps when a market-data request takes longer than the interval.
   * @returns {Promise<void>} A promise that resolves after one sweep attempt finishes.
   */
  const orderSweep = setInterval(async () => {
    if (orderSweepRunning) return;
    orderSweepRunning = true;
    try {
      await processAllPendingOrders();
    } catch (error) {
      console.warn(`Limit order check skipped: ${error.message}`);
    } finally {
      orderSweepRunning = false;
    }
  }, Math.max(5000, orderSweepInterval));
  orderSweep.unref();
});
