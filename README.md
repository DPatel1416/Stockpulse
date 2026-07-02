# StockPulse

StockPulse is a full-stack educational stock learning dashboard built from the PRD in `StockPulse_Full_PRD_Codex_Master_Prompt.docx`. It combines a liquid-glass React UI, stock search, watchlists, charts, news, earnings, paper trading, portfolio analytics, and mock AI insights.

This project is for educational paper trading only. It does not provide financial advice and does not place real trades.

## Features

- Responsive React + Vite client with dark, light, and system theme support.
- Premium liquid-glass dashboard, sidebar, bottom mobile navigation, and AI insight panel.
- Dashboard with market summary cards, top active stocks, watchlist preview, portfolio snapshot, news, and earnings.
- Stock detail pages with charts, range filters, volume insight, stats, news, earnings, and quick paper trading.
- Watchlist, paper trading simulator, portfolio analytics, and beginner-friendly Learn page.
- Express REST API with controllers, routes, middleware, MongoDB models, JWT auth, and mock data fallback.
- Paper-trading rules: each user starts with exactly `$10,000` virtual cash, buy orders validate cash, sell orders validate shares, and every simulated trade is recorded.
- AI endpoint returns educational mock responses when `OPENAI_API_KEY` is missing.

## Tech Stack

- Client: React, Vite, React Router, Recharts, Lucide React, Tailwind-ready CSS.
- Server: Node.js, Express, MongoDB/Mongoose, JWT, bcrypt.
- Data: external market APIs can be added in `server/src/services/stockDataService.js`; mock data is used by default.

## Folder Structure

```text
stockpulse/
  README.md
  .gitignore
  client/
    package.json
    index.html
    vite.config.js
    src/
      main.jsx
      App.jsx
      index.css
      routes/
      pages/
      components/
      context/
      services/
      utils/
  server/
    package.json
    server.js
    .env.example
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
```

## Setup

1. Install dependencies:

```bash
npm install --prefix client
npm install --prefix server
```

2. Configure the server environment:

```bash
cp server/.env.example server/.env
```

3. Run the API:

```bash
npm run dev --prefix server
```

4. Run the client:

```bash
npm run dev --prefix client
```

The client runs at `http://127.0.0.1:5173`. The API runs at `http://localhost:5000`.

## Environment Variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/stockpulse
JWT_SECRET=replace_with_long_secret
STOCK_API_KEY=your_market_data_api_key
STOCK_API_PROVIDER=finnhub
OPENAI_API_KEY=optional_openai_key
CLIENT_URL=http://localhost:5173
```

If `MONGO_URI`, `STOCK_API_KEY`, or `OPENAI_API_KEY` are missing or unavailable, the app still runs with demo storage and mock market/AI responses.

### Finnhub Setup

To use Finnhub live market data, set these values in `server/.env`:

```env
STOCK_API_PROVIDER=finnhub
STOCK_API_KEY=your_finnhub_api_key_here
```

Then restart the server. StockPulse uses Finnhub for quotes, company profiles, chart candles, market news, company news, and earnings calendar data. If Finnhub rate-limits a request or a specific endpoint has no data, that route falls back to demo data instead of breaking the page.

## API Summary

- `POST /api/auth/register` creates a user with `$10,000` virtual cash.
- `POST /api/auth/login` authenticates and returns a JWT.
- `POST /api/auth/demo` creates or resumes a demo API session.
- `GET /api/auth/me` returns the current authenticated user.
- `GET /api/market/summary` returns index summary cards.
- `GET /api/market/news` returns global market news.
- `GET /api/market/earnings` returns global earnings events.
- `GET /api/stocks/suggest?query=apple` returns ticker/company suggestions.
- `GET /api/stocks/search/:ticker` returns profile and quote data.
- `GET /api/stocks/:ticker/chart?range=1M` returns chart points.
- `GET /api/stocks/:ticker/news` returns related news.
- `GET /api/stocks/:ticker/earnings` returns earnings data.
- `GET /api/market/active` returns top active stocks.
- `GET /api/watchlist` returns the protected watchlist.
- `POST /api/watchlist` adds a ticker.
- `DELETE /api/watchlist/:ticker` removes a ticker.
- `GET /api/portfolio` returns cash, holdings, P/L, and transactions.
- `POST /api/trades` executes a simulated trade.
- `GET /api/trades` returns transaction history.
- `POST /api/ai/insight` returns an educational AI-style response.

## Mock Data Fallback

The client and server both include demo data so the portfolio demo works without paid APIs. Live API integration should be added behind the `stockDataService` methods so controllers and UI components do not change.

## Future Improvements

- Add real provider adapters for Finnhub, Alpha Vantage, Polygon, or Twelve Data.
- Add Mongo-backed portfolio snapshots for historical performance charts.
- Add focus trapping to modals for stricter accessibility.
- Add automated tests for auth, trades, and watchlist persistence.
- Add deployment configuration for Vercel/Netlify and Render/Railway.
