/**
 * File purpose: Creates the Express API server, installs middleware and routes, and reports startup/database status.
 */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase, isDatabaseConnected } from './src/config/db.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import aiRoutes from './src/routes/aiRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import marketRoutes from './src/routes/marketRoutes.js';
import portfolioRoutes from './src/routes/portfolioRoutes.js';
import stockRoutes from './src/routes/stockRoutes.js';
import tradeRoutes from './src/routes/tradeRoutes.js';
import watchlistRoutes from './src/routes/watchlistRoutes.js';
import { processAllPendingOrders } from './src/services/orderService.js';

dotenv.config();

if (!process.env.JWT_SECRET?.trim()) {
  throw new Error('JWT_SECRET must be configured in server/.env before the API can start.');
}

if (process.env.JWT_SECRET.trim().length < 32) {
  console.warn('JWT_SECRET should contain at least 32 characters.');
}

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
].filter(Boolean));

// CORS allows the Vite client to call the API during local development.
app.use(cors({
  /**
   * Returns the request origin that should be accepted by the CORS policy.
   * Keeping the allowlist check beside CORS configuration makes accepted development origins easy to audit.
   * @param {string|undefined} origin - The origin value used by this operation.
   * @param {Function} callback - CORS callback that receives either approval or an error.
   * @returns {void} No value is returned; the CORS callback receives the decision.
   */
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

/**
 * Describes the API when someone opens the server root in a browser.
 * Keeping this response small prevents users from mistaking the API port for the React application.
 * @param {object} req - Express request for the server root.
 * @param {object} res - Express response used to send service information.
 * @returns {void} No value is returned; a JSON response is sent.
 */
app.get('/', (req, res) => {
  res.json({
    service: 'StockPulse API',
    message: 'Open the React app on the Vite port, or use /api for the API route catalog.',
  });
});

/**
 * Lists the available API route groups for developers testing the backend directly.
 * A route catalog makes the development server self-describing without adding a separate documentation service.
 * @param {object} req - Express request for the API catalog.
 * @param {object} res - Express response used to send route information.
 * @returns {void} No value is returned; a JSON response is sent.
 */
app.get('/api', (req, res) => {
  res.json({
    service: 'StockPulse API',
    routes: {
      health: 'GET /api/health',
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/demo', 'GET /api/auth/me'],
      market: ['GET /api/market/status', 'GET /api/market/summary', 'GET /api/market/active', 'GET /api/market/news', 'GET /api/market/earnings'],
      stocks: ['GET /api/stocks/suggest?query=apple', 'GET /api/stocks/search/:ticker', 'GET /api/stocks/:ticker/chart?range=1M', 'GET /api/stocks/:ticker/news', 'GET /api/stocks/:ticker/earnings'],
      watchlist: ['GET /api/watchlist', 'POST /api/watchlist', 'DELETE /api/watchlist/:ticker'],
      portfolio: ['GET /api/portfolio', 'GET /api/portfolio/performance?range=1D'],
      trades: ['GET /api/trades', 'POST /api/trades', 'PATCH /api/trades/:orderId', 'DELETE /api/trades/:orderId'],
      ai: ['POST /api/ai/insight'],
    },
  });
});

/**
 * Reports whether the API, authentication configuration, and MongoDB connection are available.
 * Health information is intentionally shallow so it is useful without exposing secrets.
 * @param {object} req - Express request for the health endpoint.
 * @param {object} res - Express response used to send service status.
 * @returns {void} No value is returned; a JSON response is sent.
 */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'StockPulse API',
    database: isDatabaseConnected() ? 'connected' : 'unavailable',
    authentication: 'configured',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

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
