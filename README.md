# StockPulse Learn

StockPulse Learn is a full-stack educational paper-trading platform. It helps users practice market research, watchlist management, stock analysis, simulated order placement, and portfolio tracking without risking real money.

This project is for educational use only. It does not provide financial advice, brokerage services, tax advice, legal advice, or real trading.

## Main Features

- Cinematic React login/register experience with guest access and responsive mobile layouts.
- Email verification and secure one-time password recovery using Resend when email delivery is configured.
- JWT-based authentication with protected watchlist, portfolio, account, and trading APIs.
- Guest browsing mode for public exploration without saving data to MongoDB.
- Dashboard with market status, portfolio snapshot, top gainers/losers, active stocks, news, earnings, and watchlist previews.
- Stock search page with ticker/company suggestions, detailed chart ranges, line/candle views, company news, earnings, price targets, ratings, and trade actions.
- Watchlist page with favorite stocks, current prices, watchlist news, analyst price targets, and firm ratings.
- Portfolio page with virtual cash, holdings, recent transactions, pending limit orders, portfolio return chart, and buy/sell order tickets.
- Learn page with beginner-friendly investing lessons, practice cards, reference library, and responsive mobile scrolling.
- Liquid-glass design system split across modular CSS files.
- Automated tests for client utilities/components, backend auth and portfolio logic, plus Playwright E2E smoke tests.

## Technology Stack

- Frontend: React, Vite, React Router, Recharts, Lucide React, Vitest, React Testing Library, Playwright.
- Backend: Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs, Resend email delivery, Vitest, Supertest.
- Market data: Finnhub when configured, Yahoo Finance fallback logic in the backend, and deterministic demo fallbacks when live data is unavailable.
- Deployment: Vercel for the frontend, Render for the backend, MongoDB Atlas for production database storage.

## Project Structure

```text
stockpulse/
  package.json                 Root scripts for dev, lint, test, coverage, and E2E runs.
  playwright.config.js          Playwright configuration for full-stack browser tests.
  vercel.json                   Frontend SPA rewrite configuration for Vercel.
  README.md                     Project setup and architecture summary.
  client/                       React/Vite frontend application.
    src/main.jsx                Frontend entry point and provider mounting.
    src/App.jsx                 Route shell, layout composition, guest modal, footer, and AI panel.
    src/pages/                  Page-level screens such as Login, Dashboard, StockDetails, Portfolio, Watchlist, and Learn.
    src/components/             Reusable UI, layout, legal, stock, auth, AI, and trading components.
    src/context/                Auth, guest-session, and theme providers.
    src/services/api.js         Frontend API client and browser-only fallback behavior.
    src/utils/                  Validation, formatting, market-time, access-choice, and transaction helpers.
    src/styles/                 Modular CSS split by globals, layout, pages, components, and responsive rules.
    src/test/                   Vitest and Testing Library setup.
  server/                       Express backend application.
    server.js                   Backend entry point, database startup, and limit-order polling.
    src/app.js                  Express app, middleware, routes, health/catalog endpoints, and error handler.
    src/config/db.js            MongoDB connection with in-memory demo fallback.
    src/controllers/            Request handlers for auth, market, stocks, watchlist, portfolio, trades, and AI.
    src/routes/                 Route definitions for each API area.
    src/middleware/             JWT authentication and centralized error handling.
    src/models/                 Mongoose schemas for users, holdings, orders, watchlist, transactions, and snapshots.
    src/services/               Market data, email, order execution, and portfolio performance logic.
    src/utils/                  Token, demo-store, email-verification, market-time, and async wrapper helpers.
    src/templates/              Reusable HTML email templates.
    test/                       Backend Vitest/Supertest tests and setup.
```

## Local Setup

Install dependencies from the project root:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Create `server/.env` manually. Do not commit this file.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
CLIENT_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:5000
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=StockPulse Learn <verify@your-domain.com>
STOCK_API_PROVIDER=finnhub
STOCK_API_KEY=your_finnhub_api_key
CANADIAN_MARKET_EXCHANGE=TO,TSX,CA
OPENAI_API_KEY=optional_openai_key
LIMIT_ORDER_POLL_MS=15000
```

Create `client/.env.local` only when the frontend needs a custom API URL:

```env
VITE_API_BASE_URL=/api
```

Run both apps together:

```bash
npm run dev
```

Or run each side separately:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://localhost:5000/api`

## Environment Variables

### Frontend

- `VITE_API_BASE_URL`: Optional API base URL used during local development. Production intentionally uses the same-origin `/api` path so Vercel can proxy requests to Render and keep the secure session cookie first-party.

### Backend

- `PORT`: Backend server port. Render usually injects this automatically.
- `MONGO_URI`: MongoDB connection string. If missing or unavailable, the app falls back to in-memory demo storage.
- `JWT_SECRET`: Secret used to sign JWTs. The server refuses to start without this value and warns if it is shorter than 32 characters.
- `CLIENT_URL`: Frontend origin allowed by CORS and used for auth redirects.
- `API_PUBLIC_URL`: Public backend origin used to build email verification links.
- `SERVER_PUBLIC_URL` or `RENDER_EXTERNAL_URL`: Fallback public backend origin for verification links.
- `RESEND_API_KEY`: Resend API key for verification emails. Without it, email delivery is skipped and a local verification link is logged for development.
- `RESEND_FROM_EMAIL`: Verified sender used by Resend.
- `STOCK_API_PROVIDER`: Market data provider name. The implemented live provider path expects `finnhub`.
- `STOCK_API_KEY`: Finnhub key for live quotes, profiles, charts, news, earnings, market status, and activity data.
- `CANADIAN_MARKET_EXCHANGE`: Optional exchange list used for Canadian market-status checks.
- `OPENAI_API_KEY`: Currently only controls whether the AI response reports demo mode; real OpenAI calls are not implemented in the current controller.
- `LIMIT_ORDER_POLL_MS`: Polling interval for the pending limit-order sweep. The server enforces a minimum of 5000 ms.
- `NODE_ENV`: Controls test/development behavior and logging.

## API Summary

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api` | No | Route catalog for the API. |
| GET | `/health` | No | Health check for deployment monitoring. |
| POST | `/api/auth/register` | No | Create an unverified user and send a verification email. |
| POST | `/api/auth/login` | No | Log in a verified user and create a secure browser session. |
| POST | `/api/auth/forgot-password` | No | Request a one-time password-reset email without exposing account existence. |
| POST | `/api/auth/reset-password` | No | Replace a password using a valid, unexpired reset token. |
| POST | `/api/auth/validate-email` | No | Check basic email format/availability. |
| GET/POST | `/api/auth/verify-email` | No | Verify an email token and redirect or return JSON. |
| POST | `/api/auth/resend-verification` | No | Send a fresh verification email to an unverified account. |
| POST | `/api/auth/demo` | No | Start or resume a demo API session. |
| POST | `/api/auth/logout` | Yes | Clear the browser session cookie. |
| GET | `/api/auth/me` | Yes | Return the authenticated user. |
| PATCH | `/api/auth/me` | Yes | Update account display name. |
| PATCH | `/api/auth/password` | Yes | Change password for a logged-in user. |
| GET | `/api/market/status` | No | Return US and Canadian market status. |
| GET | `/api/market/summary` | No | Return market summary/index data. |
| GET | `/api/market/active` | No | Return top active, top gainers, and top losers. |
| GET | `/api/market/news` | No | Return global market news. |
| GET | `/api/market/earnings` | No | Return upcoming market earnings. |
| GET | `/api/stocks/suggest` | No | Return ticker/company search suggestions. |
| GET | `/api/stocks/search/:ticker` | No | Return normalized profile and quote data. |
| GET | `/api/stocks/:ticker/chart` | No | Return normalized OHLC chart points for a range. |
| GET | `/api/stocks/:ticker/news` | No | Return ticker-specific news. |
| GET | `/api/stocks/:ticker/earnings` | No | Return ticker earnings data. |
| GET | `/api/stocks/:ticker/price-targets` | No | Return analyst price targets and ratings. |
| GET | `/api/watchlist` | Yes | Return the user's watchlist. |
| POST | `/api/watchlist` | Yes | Add a stock to the watchlist. |
| DELETE | `/api/watchlist/:ticker` | Yes | Remove a stock from the watchlist. |
| GET | `/api/portfolio` | Yes | Return portfolio summary, holdings, transactions, and open orders. |
| GET | `/api/portfolio/performance` | Yes | Return portfolio value history for chart ranges. |
| GET | `/api/trades` | Yes | Return trade history/open order data. |
| POST | `/api/trades` | Yes | Place a market or limit paper-trading order. |
| PATCH | `/api/trades/:orderId` | Yes | Update a pending limit order. |
| DELETE | `/api/trades/:orderId` | Yes | Cancel a pending limit order. |
| POST | `/api/ai/insight` | No | Return an educational AI-style explanation. |

## Authentication Notes

Registration creates a user with `isVerified = false`, stores a hashed verification token, and sends the plain token only inside the verification email. Login is blocked until the email is verified. A successful browser login places the signed JWT in an `HttpOnly`, `SameSite=Lax` cookie, so frontend JavaScript cannot read or copy it. Mutating cookie-authenticated requests also send a CSRF token in the `X-CSRF-Token` header. Explicit API clients may still use bearer authentication.

Guest access is handled separately on the frontend. Guest users can explore public pages and temporary watchlist-style interactions, but trading and saved portfolio data require login.

Forgot password uses the same Resend sender as verification. The request endpoint stores only a SHA-256 token hash, emails a one-time link that expires after 30 minutes, and the login page opens a focused new-password form when that link is followed. OTP recovery is not implemented.

## Paper-Trading Notes

Authenticated users start with `$10,000` virtual cash. Market orders fill immediately at the current quote. Limit orders fill immediately only when the quote satisfies the limit condition; otherwise they stay pending. Pending buy orders reserve cash and pending sell orders reserve shares so users cannot overcommit resources. A background sweep checks pending limit orders and fills them when live/demo quotes satisfy the order.

## Testing and Verification

Run the main checks from the project root:

```bash
npm run lint
npm test
npm run test:e2e
npm run build --prefix client
```

Useful focused checks:

```bash
npm run test --prefix client
npm run test --prefix server
npm run test:coverage
```

The test suite mocks external APIs where needed so tests do not depend on live Resend or market-data access.

## Deployment

### Frontend on Vercel

- Deploy the `client` app through Vercel.
- The production client calls the same-origin `/api` path; do not point browser requests directly at Render with `VITE_API_BASE_URL`.
- `client/vercel.json` proxies `/api/*` to the Render service and sends all remaining routes to `index.html` so React Router works on refresh.

### Backend on Render

- Deploy the `server` app through Render.
- Use `npm install --prefix server` as the install command if Render builds from the repo root.
- Use `npm start --prefix server` or run `node server.js` from the `server` directory as the start command.
- Configure `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `API_PUBLIC_URL`, Resend variables, and market-data variables in Render.
- Keep `CLIENT_URL` pointed at the Vercel domain so CORS allows browser requests.

### MongoDB Atlas

- Use a MongoDB Atlas connection string in `MONGO_URI`.
- Allow Render's outbound network access in Atlas network settings.
- If MongoDB is unavailable, the API starts in in-memory demo mode, but data will not persist.

## Security Notes

- Passwords are hashed with bcrypt before storage.
- JWTs are signed on the backend, stored in secure `HttpOnly` browser cookies, and validated by protected middleware.
- Cookie-authenticated mutations require a matching CSRF token; bearer-authenticated API clients remain supported without browser CSRF handling.
- Password changes and successful password resets increment the user's session version, invalidating previously issued sessions.
- Email verification and password-reset tokens are hashed before being stored.
- Five incorrect passwords lock an account for one hour; another failed cycle after expiry escalates the lock to 24 hours.
- Secrets belong only in `.env`, Vercel, or Render environment settings.
- Do not commit `server/.env`, API keys, MongoDB connection strings, or JWT secrets.
- This is an educational paper-trading app, not a production brokerage system.
