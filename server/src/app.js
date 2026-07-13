/**
 * File purpose: Builds the reusable Express application without starting an HTTP listener.
 * Tests import this file directly with Supertest, while server.js imports the same app for production startup.
 */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { isDatabaseConnected } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';

dotenv.config();

const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
].filter(Boolean));

/**
 * Creates the configured Express application used by runtime and tests.
 * Separating app creation from app.listen keeps API tests fast and avoids port conflicts.
 * @returns {import('express').Express} Configured Express application instance.
 */
export function createApp() {
  const app = express();

  // CORS allows the Vite client to call the API during local development and deployed frontend usage.
  app.use(cors({
    /**
     * Returns the request origin that should be accepted by the CORS policy.
     * Keeping the allowlist check beside CORS configuration makes accepted development origins easy to audit.
     * @param {string|undefined} origin - Origin value sent by the browser.
     * @param {Function} callback - CORS callback that receives either approval or an error.
     * @returns {void} No value is returned; the callback receives the decision.
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
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

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
        auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/auth/forgot-password', 'POST /api/auth/reset-password', 'POST /api/auth/validate-email', 'GET /api/auth/verify-email', 'POST /api/auth/resend-verification', 'POST /api/auth/demo', 'GET /api/auth/me'],
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

  return app;
}

export const app = createApp();
