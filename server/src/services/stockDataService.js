/**
 * File purpose: Coordinates live and fallback stock quotes, charts, news, earnings, market movers, and company metadata.
 */
import { demoNews, demoStocks, findStock, marketIndexes } from '../utils/demoData.js';
import {
  formatMarketDate,
  formatMarketDateTime,
  formatMarketTime,
  getMarketSessionTimestamps,
} from '../utils/marketTime.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const YAHOO_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_QUERY_BASE_URL = 'https://query1.finance.yahoo.com';
const CACHE_TTL_MS = 60_000;
const cache = new Map();
let yahooSession = null;
const activeSymbols = [
  'NVDA',
  'TSLA',
  'AAPL',
  'AMD',
  'AMZN',
  'MSFT',
  'META',
  'GOOGL',
  'NFLX',
  'PLTR',
  'INTC',
  'COIN',
  'UBER',
  'SHOP',
  'BABA',
  'DIS',
];
const activeSymbolMetadata = {
  AAPL: { company: 'Apple Inc.', sector: 'Technology' },
  AMD: { company: 'Advanced Micro Devices Inc.', sector: 'Technology' },
  AMZN: { company: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  BABA: { company: 'Alibaba Group Holding Ltd.', sector: 'Consumer Cyclical' },
  COIN: { company: 'Coinbase Global Inc.', sector: 'Financial Services' },
  DIS: { company: 'The Walt Disney Company', sector: 'Communication Services' },
  GOOGL: { company: 'Alphabet Inc.', sector: 'Communication Services' },
  INTC: { company: 'Intel Corporation', sector: 'Technology' },
  META: { company: 'Meta Platforms Inc.', sector: 'Communication Services' },
  MU: { company: 'Micron Technology Inc.', sector: 'Technology' },
  MSFT: { company: 'Microsoft Corporation', sector: 'Technology' },
  NFLX: { company: 'Netflix Inc.', sector: 'Communication Services' },
  NVDA: { company: 'NVIDIA Corporation', sector: 'Technology' },
  PLTR: { company: 'Palantir Technologies Inc.', sector: 'Technology' },
  SHOP: { company: 'Shopify Inc.', sector: 'Technology' },
  TSLA: { company: 'Tesla Inc.', sector: 'Consumer Cyclical' },
  UBER: { company: 'Uber Technologies Inc.', sector: 'Technology' },
};

const logoSymbolAliases = {
  GOOGL: 'GOOG',
  META: 'FB',
};

const newsTickerAliases = {
  AAPL: ['APPLE', 'IPHONE', 'IPAD', 'MACBOOK', 'IOS'],
  AMD: ['ADVANCED MICRO DEVICES', 'AMD'],
  AMZN: ['AMAZON', 'AWS'],
  BABA: ['ALIBABA'],
  COIN: ['COINBASE'],
  DIS: ['DISNEY'],
  GOOGL: ['ALPHABET', 'GOOGLE', 'YOUTUBE'],
  INTC: ['INTEL'],
  META: ['META', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP'],
  MSFT: ['MICROSOFT', 'AZURE'],
  MU: ['MICRON'],
  NFLX: ['NETFLIX'],
  NVDA: ['NVIDIA'],
  PLTR: ['PALANTIR'],
  SHOP: ['SHOPIFY'],
  TSLA: ['TESLA'],
  UBER: ['UBER'],
};

/**
 * Returns the preferred logo url needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {string|null} providerLogo - Logo URL supplied by the market-data provider.
 * @returns {string|null} The best available company logo URL, or null when none is known.
 */
function getPreferredLogoUrl(ticker, providerLogo = null) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase();
  if (providerLogo) return providerLogo;
  if (!normalizedTicker || normalizedTicker === 'MARKET') return null;
  const logoSymbol = logoSymbolAliases[normalizedTicker] || normalizedTicker;
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(logoSymbol)}.png`;
}

Object.entries(activeSymbolMetadata).forEach(([symbol, metadata]) => {
  metadata.logo = getPreferredLogoUrl(symbol);
});
const marketStatusConfigs = [
  { code: 'US', label: 'US', exchange: 'US', timezone: 'America/New_York', openMinutes: 570, closeMinutes: 960 },
  {
    code: 'CA',
    label: 'Canada',
    exchange: 'TO',
    timezone: 'America/Toronto',
    openMinutes: 570,
    closeMinutes: 960,
  },
];

// stockDataService is the only place controllers should know about market data providers.
/**
 * Checks whether Finnhub is configured as the live market-data provider.
 * Routes use this gate before calling Finnhub so missing keys fall back cleanly to demo data.
 * @returns {boolean} True when Finnhub is configured as the live stock-data provider.
 */
function shouldUseFinnhub() {
  const provider = String(process.env.STOCK_API_PROVIDER || 'finnhub').toLowerCase();
  return Boolean(process.env.STOCK_API_KEY) && provider === 'finnhub';
}

/**
 * Returns the demo message needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {*} The requested demo message result.
 */
function getDemoMessage() {
  return 'Live Finnhub data unavailable, showing sample data.';
}

/**
 * Fetches JSON through the shared cache to reduce duplicate provider requests.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} cacheKey - Stable key used to reuse recent provider responses.
 * @param {string|URL} url - Remote resource address.
 * @param {*} options - Named settings that adjust the operation.
 * @param {number} cacheTtlMs - Milliseconds a provider response remains reusable.
 * @returns {Promise<*>} A promise resolving to the cached fetch json result.
 */
async function cachedFetchJson(cacheKey, url, options = {}, cacheTtlMs = CACHE_TTL_MS) {
  const cached = cache.get(cacheKey);

  if (cacheTtlMs > 0 && cached && Date.now() - cached.createdAt < cacheTtlMs) {
    return cached.data;
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }

  const data = await response.json();
  // Fresh requests bypass the old value but still seed the shared cache for the portfolio response that follows.
  cache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

/**
 * Fetches a Yahoo Finance page while preserving cookies needed by follow-up requests.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string|URL} url - Remote resource address.
 * @param {*} options - Named settings that adjust the operation.
 * @returns {Promise<*>} A promise resolving to the yahoo fetch result.
 */
async function yahooFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns the response cookies needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Response} response - Fetch response whose cookies or JSON are being read.
 * @returns {*} The requested response cookies result.
 */
function getResponseCookies(response) {
  const rawCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  return rawCookies.map((cookie) => cookie.split(';')[0]).filter(Boolean);
}

/**
 * Merges response cookies into the cookie header used for Yahoo requests.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Array<string>} ...cookieGroups - Cookie header groups to merge.
 * @returns {*} The merge cookies result.
 */
function mergeCookies(...cookieGroups) {
  const cookies = new Map();

  cookieGroups.flat().filter(Boolean).forEach((cookie) => {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex > 0) cookies.set(cookie.slice(0, separatorIndex), cookie);
  });

  return [...cookies.values()].join('; ');
}

/**
 * Returns the yahoo session needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {boolean} forceRefresh - Whether cached data should be bypassed.
 * @returns {Promise<*>} A promise resolving to the requested yahoo session result.
 */
async function getYahooSession(forceRefresh = false) {
  if (!forceRefresh && yahooSession && Date.now() - yahooSession.createdAt < 20 * 60_000) {
    return yahooSession;
  }

  const headers = {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
  };
  let cookie = '';

  // Yahoo may issue its session cookie from this lightweight bootstrap request.
  try {
    const bootstrap = await yahooFetch('https://fc.yahoo.com', { headers, redirect: 'manual' });
    cookie = mergeCookies(getResponseCookies(bootstrap));
  } catch {
    // The crumb endpoint can still succeed without a separate bootstrap request.
  }

  const crumbResponse = await yahooFetch(`${YAHOO_QUERY_BASE_URL}/v1/test/getcrumb`, {
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
  });

  if (!crumbResponse.ok) throw new Error(`Yahoo Finance session failed with status ${crumbResponse.status}`);
  const crumb = (await crumbResponse.text()).trim();
  cookie = mergeCookies(cookie, getResponseCookies(crumbResponse));

  if (!crumb || crumb.startsWith('<') || crumb.length > 200) {
    throw new Error('Yahoo Finance did not return a valid session crumb.');
  }

  yahooSession = { crumb, cookie, headers, createdAt: Date.now() };
  return yahooSession;
}

/**
 * Returns the yahoo raw value needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {*} The requested yahoo raw value result.
 */
function getYahooRawValue(value) {
  const candidate = value && typeof value === 'object' ? value.raw : value;
  const numericValue = Number(candidate);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Returns the yahoo positive raw value needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {*} The requested yahoo positive raw value result.
 */
function getYahooPositiveRawValue(value) {
  const numericValue = getYahooRawValue(value);
  return numericValue !== null && numericValue > 0 ? numericValue : null;
}

/**
 * Returns the yahoo price targets needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {boolean} forceRefresh - Whether cached data should be bypassed.
 * @returns {Promise<*>} A promise resolving to the requested yahoo price targets result.
 */
async function getYahooPriceTargets(ticker, forceRefresh = false) {
  const session = await getYahooSession(forceRefresh);
  const url = new URL(`${YAHOO_QUERY_BASE_URL}/v10/finance/quoteSummary/${encodeURIComponent(ticker)}`);
  url.searchParams.set('modules', 'financialData,upgradeDowngradeHistory');
  url.searchParams.set('crumb', session.crumb);
  const response = await yahooFetch(url, {
    headers: { ...session.headers, ...(session.cookie ? { Cookie: session.cookie } : {}) },
  });

  if ((response.status === 401 || response.status === 403) && !forceRefresh) {
    yahooSession = null;
    return getYahooPriceTargets(ticker, true);
  }

  if (!response.ok) throw new Error(`Yahoo Finance analyst request failed with status ${response.status}`);
  const payload = await response.json();
  const result = payload?.quoteSummary?.result?.[0];

  if (!result) throw new Error(payload?.quoteSummary?.error?.description || 'Yahoo Finance returned no analyst result.');

  const financialData = result.financialData || {};
  const targetValues = {
    high: getYahooPositiveRawValue(financialData.targetHighPrice),
    mean: getYahooPositiveRawValue(financialData.targetMeanPrice),
    median: getYahooPositiveRawValue(financialData.targetMedianPrice),
    low: getYahooPositiveRawValue(financialData.targetLowPrice),
  };
  const hasConsensus = Object.values(targetValues).some((value) => value !== null);
  const history = Array.isArray(result.upgradeDowngradeHistory?.history)
    ? result.upgradeDowngradeHistory.history
    : [];
  const firms = history
    .filter((item) => item.firm)
    .slice(0, 24)
    .map((item) => ({
      company: item.firm,
      action: item.action || 'Update',
      fromGrade: item.fromGrade || null,
      toGrade: item.toGrade || 'Rating updated',
      date: item.epochGradeDate ? new Date(item.epochGradeDate * 1000).toISOString() : null,
    }));

  return {
    demo: false,
    provider: 'yahoo',
    source: 'Yahoo Finance analyst data',
    ticker,
    consensus: hasConsensus ? { ...targetValues, lastUpdated: null } : null,
    firms,
    message: hasConsensus || firms.length ? null : 'Yahoo Finance returned no current analyst target data for this stock.',
  };
}

/**
 * Formats the yahoo market cap for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @param {string} fallbackTicker - Ticker used when provider metadata omits one.
 * @returns {string} The formatted value ready for display.
 */
function formatYahooMarketCap(value, fallbackTicker) {
  const marketCap = getYahooRawValue(value);
  if (!marketCap || marketCap <= 0) return findStock(fallbackTicker || 'AAPL').marketCap;

  if (marketCap >= 1_000_000_000_000) return `${(marketCap / 1_000_000_000_000).toFixed(1)}T`;
  if (marketCap >= 1_000_000_000) return `${(marketCap / 1_000_000_000).toFixed(1)}B`;
  if (marketCap >= 1_000_000) return `${(marketCap / 1_000_000).toFixed(1)}M`;
  return `${marketCap.toFixed(0)}`;
}

/**
 * Transforms the yahoo screener quote from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {*} The normalized yahoo screener quote result.
 */
function mapYahooScreenerQuote(item) {
  const ticker = String(item.symbol || '').trim().toUpperCase();
  const fallback = getStockFallback(ticker);
  const price = getYahooRawValue(item.regularMarketPrice) ?? fallback.price;
  const change = getYahooRawValue(item.regularMarketChangePercent) ?? fallback.change;
  const open = getYahooRawValue(item.regularMarketOpen) ?? fallback.open;
  const previousClose = getYahooRawValue(item.regularMarketPreviousClose) ?? fallback.previousClose;
  const dayLow = getYahooRawValue(item.regularMarketDayLow);
  const dayHigh = getYahooRawValue(item.regularMarketDayHigh);
  const fiftyTwoWeekLow = getYahooRawValue(item.fiftyTwoWeekLow);
  const fiftyTwoWeekHigh = getYahooRawValue(item.fiftyTwoWeekHigh);

  return {
    ticker,
    company: getCleanCompanyName(item.longName || item.shortName || item.displayName, ticker, fallback),
    sector: normalizeSector(item.sector || fallback.sector),
    logo: getPreferredLogoUrl(ticker, fallback.logo),
    price,
    change,
    volume: getYahooRawValue(item.regularMarketVolume) ?? fallback.volume,
    avgVolume: getYahooRawValue(item.averageDailyVolume3Month) ?? fallback.avgVolume,
    marketCap: formatYahooMarketCap(item.marketCap, ticker),
    pe: getYahooRawValue(item.trailingPE) ?? fallback.pe,
    dayRange: dayLow && dayHigh ? `$${dayLow.toFixed(2)} - $${dayHigh.toFixed(2)}` : fallback.dayRange,
    yearRange: fiftyTwoWeekLow && fiftyTwoWeekHigh ? `$${fiftyTwoWeekLow.toFixed(2)} - $${fiftyTwoWeekHigh.toFixed(2)}` : fallback.yearRange,
    open,
    previousClose,
  };
}

/**
 * Returns the yahoo screener stocks needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} scrId - Yahoo screener identifier.
 * @param {number} limit - Maximum number of records to return.
 * @param {boolean} forceRefresh - Whether cached data should be bypassed.
 * @returns {Promise<*>} A promise resolving to the requested yahoo screener stocks result.
 */
async function getYahooScreenerStocks(scrId, limit = 8, forceRefresh = false) {
  const cacheKey = ['yahoo-screener', scrId, limit].join(':');
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.createdAt < 60_000) return cached.data;

  const createScreenerUrl = () => {
    const url = new URL(YAHOO_QUERY_BASE_URL + '/v1/finance/screener/predefined/saved');
    url.searchParams.set('scrIds', scrId);
    url.searchParams.set('count', String(limit));
    url.searchParams.set('start', '0');
    url.searchParams.set('formatted', 'false');
    url.searchParams.set('region', 'US');
    url.searchParams.set('lang', 'en-US');
    return url;
  };

  let payload;

  try {
    // The screener JSON normally works without authentication. Trying it first
    // avoids Yahoo's cookie bootstrap, which is commonly blocked on cloud hosts.
    const directResponse = await yahooFetch(createScreenerUrl(), {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0 StockPulse/1.0',
      },
    });

    if (!directResponse.ok) {
      throw new Error('Direct Yahoo screener request failed with status ' + directResponse.status);
    }

    payload = await directResponse.json();
    if (!payload?.finance?.result?.[0]?.quotes?.length) {
      throw new Error('Direct Yahoo screener response contained no quotes.');
    }
  } catch (directError) {
    // Some Yahoo regions still require a cookie and crumb, so retain the
    // authenticated session route as the secondary provider path.
    const session = await getYahooSession(forceRefresh);
    const sessionUrl = createScreenerUrl();
    sessionUrl.searchParams.set('crumb', session.crumb);
    const response = await yahooFetch(sessionUrl, {
      headers: { ...session.headers, ...(session.cookie ? { Cookie: session.cookie } : {}) },
    });

    if ((response.status === 401 || response.status === 403) && !forceRefresh) {
      yahooSession = null;
      return getYahooScreenerStocks(scrId, limit, true);
    }

    if (!response.ok) {
      throw new Error(
        'Yahoo Finance screener request failed with status '
        + response.status
        + '. Direct request: '
        + directError.message,
      );
    }

    payload = await response.json();
  }

  const quotes = payload?.finance?.result?.[0]?.quotes || [];
  const stocks = quotes
    .map(mapYahooScreenerQuote)
    .filter((stock) => stock.ticker && Number.isFinite(Number(stock.change)))
    .slice(0, limit);

  cache.set(cacheKey, { createdAt: Date.now(), data: stocks });
  return stocks;
}

/**
 * Sends an authenticated Finnhub request through the shared market-data boundary.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} path - API path appended to the configured server URL.
 * @param {object} params - Query parameters sent to the market-data provider.
 * @param {*} options2 - Input value for options2.
 * @returns {Promise<*>} A promise resolving to the finnhub request result.
 */
async function finnhubRequest(path, params = {}, { fresh = false } = {}) {
  if (!shouldUseFinnhub()) {
    throw new Error('Finnhub API key is not configured.');
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);
  Object.entries({ ...params, token: process.env.STOCK_API_KEY }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return cachedFetchJson(url.toString(), url, {}, fresh ? 0 : CACHE_TTL_MS);
}

/**
 * Formats the market cap for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {object} profile - Provider company profile metadata.
 * @returns {string} The formatted value ready for display.
 */
function formatMarketCap(profile) {
  if (!profile?.marketCapitalization) return findStock(profile?.ticker || 'AAPL').marketCap;
  const capInMillions = Number(profile.marketCapitalization);

  if (capInMillions >= 1_000_000) {
    return `${(capInMillions / 1_000_000).toFixed(1)}T`;
  }

  if (capInMillions >= 1_000) {
    return `${(capInMillions / 1_000).toFixed(1)}B`;
  }

  return `${capInMillions.toFixed(1)}M`;
}

/**
 * Returns the stock fallback needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {*} The requested stock fallback result.
 */
function getStockFallback(ticker) {
  const normalizedTicker = String(ticker || 'AAPL').toUpperCase();
  return { ...findStock(normalizedTicker), ...(activeSymbolMetadata[normalizedTicker] || {}) };
}

/**
 * Checks whether a company label came from generated demo data.
 * This prevents placeholder company names from leaking into live-looking watchlist rows.
 * @param {string} company - Company name associated with the ticker.
 * @returns {boolean} True when the company label is a demo placeholder.
 */
function isDemoCompanyName(company) {
  return String(company || '').includes('Demo Company');
}

/**
 * Returns the clean company name needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} company - Company name associated with the ticker.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} fallback - Value returned when stored or provider data is unavailable.
 * @returns {*} The requested clean company name result.
 */
function getCleanCompanyName(company, ticker, fallback = {}) {
  const normalizedTicker = String(ticker || fallback.ticker || '').toUpperCase();
  const candidate = String(company || '').trim();
  const fallbackCompany = String(fallback.company || activeSymbolMetadata[normalizedTicker]?.company || '').trim();

  if (candidate && !isDemoCompanyName(candidate)) return candidate;
  if (fallbackCompany && !isDemoCompanyName(fallbackCompany)) return fallbackCompany;
  return normalizedTicker || 'Unknown company';
}

/**
 * Converts the sector into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {string} sector - Provider sector or industry label.
 * @returns {*} The normalized sector result.
 */
function normalizeSector(sector) {
  const value = String(sector || '').trim();
  return value && value !== 'Demo Market' ? value : 'Other';
}

/**
 * Returns the market exchange needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} config - Configuration values that control the operation.
 * @returns {*} The requested market exchange result.
 */
function getMarketExchange(config) {
  if (config.code !== 'CA') {
    return config.exchange;
  }

  return (process.env.CANADIAN_MARKET_EXCHANGE || config.exchange).split(',')[0].trim();
}

/**
 * Returns the market exchange options needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} config - Configuration values that control the operation.
 * @returns {*} The requested market exchange options result.
 */
function getMarketExchangeOptions(config) {
  if (config.code !== 'CA') {
    return [config.exchange];
  }

  return (process.env.CANADIAN_MARKET_EXCHANGE || 'TO,TSX,CA')
    .split(',')
    .map((exchange) => exchange.trim())
    .filter(Boolean);
}

/**
 * Transforms the quote to stock from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {object} quote - Current provider quote and its source metadata.
 * @param {object} profile - Provider company profile metadata.
 * @returns {*} The normalized quote to stock result.
 */
function mapQuoteToStock(ticker, quote = {}, profile = {}) {
  const fallback = getStockFallback(ticker);
  const normalizedTicker = String(profile.ticker || ticker || fallback.ticker).toUpperCase();
  const currentPrice = Number(quote.c || fallback.price);
  const open = Number(quote.o || fallback.open);
  const previousClose = Number(quote.pc || fallback.previousClose);
  const high = Number(quote.h || fallback.price);
  const low = Number(quote.l || fallback.price);
  const changePercent = quote.dp !== undefined ? Number(quote.dp) : fallback.change;

  return {
    ticker: normalizedTicker,
    company: getCleanCompanyName(profile.name || profile.company, normalizedTicker, fallback),
    sector: normalizeSector(profile.finnhubIndustry || profile.sector || fallback.sector),
    logo: getPreferredLogoUrl(normalizedTicker, profile.logo || fallback.logo),
    price: currentPrice,
    change: changePercent,
    volume: fallback.volume,
    avgVolume: fallback.avgVolume,
    marketCap: formatMarketCap({ ...profile, ticker }),
    pe: fallback.pe,
    dayRange: `$${low.toFixed(2)} - $${high.toFixed(2)}`,
    yearRange: fallback.yearRange,
    open,
    previousClose,
  };
}

/**
 * Orders the by volume using the shared comparison rule.
 * Centralizing ordering rules keeps lists consistent throughout the interface.
 * @param {Array<object>} stocks - Stock records to sort, filter, or display.
 * @returns {*} The ordered by volume result.
 */
function sortByVolume(stocks) {
  return [...stocks].sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0));
}

/**
 * Orders the by change using the shared comparison rule.
 * Centralizing ordering rules keeps lists consistent throughout the interface.
 * @param {Array<object>} stocks - Stock records to sort, filter, or display.
 * @param {string} direction - Direction that controls ordering or money movement.
 * @returns {*} The ordered by change result.
 */
function sortByChange(stocks, direction) {
  return [...stocks]
    .filter((stock) => {
      const change = Number(stock.change);
      return Number.isFinite(change) && (direction === 'gainer' ? change > 0 : change < 0);
    })
    .sort((a, b) => direction === 'gainer' ? Number(b.change) - Number(a.change) : Number(a.change) - Number(b.change));
}

/**
 * Completes a mover list with valid live fallback quotes without replacing the
 * preferred screener ranking or showing the same ticker twice.
 * @param {Array<object>} preferredStocks - Primary screener results.
 * @param {Array<object>} fallbackStocks - Secondary live quote candidates.
 * @param {'gainer'|'loser'} direction - Required sign and ordering direction.
 * @param {number} limit - Maximum number of movers to return.
 * @returns {Array<object>} Up to the requested number of unique, correctly signed movers.
 */
export function selectTopMovers(preferredStocks, fallbackStocks, direction, limit = 3) {
  const seen = new Set();
  return [
    ...sortByChange(preferredStocks || [], direction),
    ...sortByChange(fallbackStocks || [], direction),
  ].filter((stock) => {
    const ticker = String(stock?.ticker || '').trim().toUpperCase();
    if (!ticker || seen.has(ticker)) return false;
    seen.add(ticker);
    return true;
  }).slice(0, limit);
}

/**
 * Returns the recent volume needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} symbol - Ticker symbol identifying the stock.
 * @param {number} fallbackVolume - Volume used when the provider omits a usable value.
 * @returns {Promise<*>} A promise resolving to the requested recent volume result.
 */
async function getRecentVolume(symbol, fallbackVolume) {
  try {
    const candles = await finnhubRequest('/stock/candle', {
      symbol,
      resolution: 'D',
      from: getUnixSeconds(-10),
      to: getUnixSeconds(),
    });

    if (candles.s !== 'ok' || !Array.isArray(candles.v) || !candles.v.length) {
      return fallbackVolume;
    }

    return Number(candles.v.at(-1) || fallbackVolume);
  } catch {
    return fallbackVolume;
  }
}

/**
 * Loads a normalized quote/profile pair from Finnhub.
 * The freshQuote option is used by trading flows so execution checks are not based on stale cache data.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {object} options - Quote options for live stock lookup.
 * @param {boolean} options.freshQuote - Whether to bypass cached quotes for the quote request.
 * @returns {Promise<object>} Normalized stock profile and quote data from Finnhub.
 */
async function getFinnhubStock(ticker, { freshQuote = false } = {}) {
  const normalizedTicker = String(ticker || 'AAPL').toUpperCase();
  const [profile, quote] = await Promise.all([
    finnhubRequest('/stock/profile2', { symbol: normalizedTicker }),
    finnhubRequest('/quote', { symbol: normalizedTicker }, { fresh: freshQuote }),
  ]);

  return mapQuoteToStock(normalizedTicker, quote, profile);
}

/**
 * Returns the finnhub profile or fallback needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} symbol - Ticker symbol identifying the stock.
 * @param {*} fallback - Value returned when stored or provider data is unavailable.
 * @returns {Promise<*>} A promise resolving to the requested finnhub profile or fallback result.
 */
async function getFinnhubProfileOrFallback(symbol, fallback) {
  try {
    const profile = await finnhubRequest('/stock/profile2', { symbol });
    return { ...fallback, ...profile };
  } catch {
    return fallback;
  }
}

/**
 * Returns the date string needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {number} daysOffset - Calendar-day offset from the reference date.
 * @returns {*} The requested date string result.
 */
function getDateString(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the unix seconds needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {number} daysOffset - Calendar-day offset from the reference date.
 * @returns {*} The requested unix seconds result.
 */
function getUnixSeconds(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Returns the candle config needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @returns {*} The requested candle config result.
 */
function getCandleConfig(range) {
  const configs = {
    '1D': { resolution: '15', from: getUnixSeconds(-1) },
    '5D': { resolution: '60', from: getUnixSeconds(-9) },
    '1M': { resolution: '60', from: getUnixSeconds(-30) },
    '3M': { resolution: 'D', from: getUnixSeconds(-90) },
    '6M': { resolution: 'D', from: getUnixSeconds(-180) },
    '1Y': { resolution: 'W', from: getUnixSeconds(-365) },
    '5Y': { resolution: 'M', from: getUnixSeconds(-365 * 5) },
    MAX: { resolution: 'M', from: getUnixSeconds(-365 * 5) },
  };

  return configs[range] || configs['1M'];
}

/**
 * Returns the yahoo chart config needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @returns {*} The requested yahoo chart config result.
 */
function getYahooChartConfig(range) {
  return {
    '1D': { range: '1d', interval: '5m' },
    '5D': { range: '5d', interval: '15m' },
    '1M': { range: '1mo', interval: '1h' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y', interval: '1d' },
    '5Y': { range: '5y', interval: '1wk' },
    MAX: { range: '5y', interval: '1wk' },
  }[range] || { range: '1mo', interval: '1d' };
}

/**
 * Produces repeatable pseudo-random variation from a stable seed.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {number} seed - Stable number used to make generated data repeatable.
 * @param {*} index - Zero-based position of the current item.
 * @param {number} salt - Additional number that creates a separate deterministic sequence.
 * @returns {number} A repeatable decimal value between zero and one.
 */
function seededNoise(seed, index, salt = 0) {
  const rawValue = Math.sin(seed * 12.9898 + index * 78.233 + salt * 37.719) * 43758.5453;
  return rawValue - Math.floor(rawValue);
}

/**
 * Formats the chart label for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {Date} date - Date being inspected or adjusted.
 * @param {*} range - Requested chart or performance time range.
 * @returns {string} The formatted value ready for display.
 */
function formatChartLabel(date, range) {
  if (range === '1D') {
    return formatMarketTime(date);
  }

  if (range === '5D') {
    return formatMarketDateTime(date);
  }

  if (range === '1M') {
    return formatMarketDateTime(date, { month: 'short', day: 'numeric' }, { hour: 'numeric' });
  }

  return formatMarketDate(date);
}


/**
 * Constructs the quote anchored chart data from its source values.
 * This is the final offline fallback: generated points end at the current quote so demo charts stay plausible.
 * @param {object} stock - Normalized stock quote and company details.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Array<object>} Generated OHLC chart points anchored to the latest quote.
 */
function buildQuoteAnchoredChartData(stock, range) {
  const pointsByRange = { '1D': 27, '5D': 70, '1M': 90, '3M': 66, '6M': 48, '1Y': 56, '5Y': 72, MAX: 72 };
  const volatilityByRange = { '1D': 0.0014, '5D': 0.0028, '1M': 0.0034, '3M': 0.0054, '6M': 0.0065, '1Y': 0.0085, '5Y': 0.012, MAX: 0.012 };
  const now = new Date();
  const sessionTimestamps = range === '1D'
    ? getMarketSessionTimestamps(now, 1, 15)
    : range === '5D'
      ? getMarketSessionTimestamps(now, 5, 30)
      : null;
  const points = sessionTimestamps?.length || pointsByRange[range] || pointsByRange['1M'];
  const currentPrice = Number(stock.price || 100);
  const baseVolume = Number(stock.avgVolume || stock.volume || 1_000_000);
  const seed = String(stock.ticker || 'AAPL').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const trendPercent = Number(stock.change || 0) / 100;
  const volatility = volatilityByRange[range] || volatilityByRange['1M'];
  const prices = [];
  let rollingPrice = currentPrice * (1 - trendPercent * 0.55 + (seededNoise(seed, 0, 5) - 0.5) * volatility * points);

  for (let index = 0; index < points; index += 1) {
    const noise = (seededNoise(seed, index, 1) - 0.5) * currentPrice * volatility;
    const secondaryNoise = (seededNoise(seed, index, 2) - 0.5) * currentPrice * volatility * 0.45;
    const drift = (trendPercent * currentPrice) / Math.max(points / 2, 1);
    const meanReversion = (currentPrice - rollingPrice) * 0.018;

    rollingPrice = Math.max(0.01, rollingPrice + drift + noise + secondaryNoise + meanReversion);
    prices.push(rollingPrice);
  }

  const endingOffset = currentPrice - prices.at(-1);

  return Array.from({ length: points }, (_, index) => {
    const progress = points === 1 ? 1 : index / (points - 1);
    const price = Number((prices[index] + endingOffset * progress).toFixed(2));
    const previousPrice = prices[index - 1] || prices[index];
    const priceVelocity = Math.abs(price - previousPrice) / Math.max(currentPrice, 1);
    const volumeNoise = 0.62 + seededNoise(seed, index, 3) * 0.72;
    const volumePulse = priceVelocity * 18;
    const labelDate = new Date(now);

    if (sessionTimestamps) {
      labelDate.setTime(sessionTimestamps[index].getTime());
    } else if (range === '1D') {
      labelDate.setMinutes(now.getMinutes() - (points - index - 1) * 15);
    } else if (range === '1M') {
      labelDate.setHours(now.getHours() - (points - index - 1) * 8);
    } else if (range === '3M') {
      labelDate.setHours(now.getHours() - (points - index - 1) * 33);
    } else if (range === '6M') {
      labelDate.setDate(now.getDate() - (points - index - 1) * 4);
    } else if (range === '1Y') {
      labelDate.setDate(now.getDate() - (points - index - 1) * 7);
    } else {
      labelDate.setMonth(now.getMonth() - (points - index - 1));
    }

    const open = Number((index ? prices[index - 1] + endingOffset * Math.max(0, progress - (1 / Math.max(points - 1, 1))) : price).toFixed(2));
    const wickSize = Math.max(0.01, Math.abs(price - open) * 0.4 + currentPrice * volatility * 0.25);
    const high = Number((Math.max(open, price) + wickSize).toFixed(2));
    const low = Number(Math.max(0.01, Math.min(open, price) - wickSize).toFixed(2));

    return {
      label: formatChartLabel(labelDate, range),
      timestamp: labelDate.toISOString(),
      open,
      high,
      low,
      close: price,
      price,
      volume: Math.round(baseVolume * (volumeNoise + volumePulse)),
      candleRange: [low, high],
    };
  });
}

/**
 * Transforms the candles from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {object} candles - Raw OHLC candle response from the provider.
 * @param {*} range - Requested chart or performance time range.
 * @returns {*} The normalized candles result.
 */
function mapCandles(candles, range) {
  if (candles.s !== 'ok' || !Array.isArray(candles.c)) {
    return null;
  }

  return candles.c.map((close, index) => {
    const date = new Date(candles.t[index] * 1000);
    const label = formatChartLabel(date, range);

    const open = Number(candles.o?.[index] ?? close);
    const high = Number(candles.h?.[index] ?? close);
    const low = Number(candles.l?.[index] ?? close);
    const normalizedClose = Number(close);

    return {
      label,
      timestamp: date.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(normalizedClose.toFixed(2)),
      price: Number(normalizedClose.toFixed(2)),
      volume: Number(candles.v?.[index] || 0),
      candleRange: [Number(low.toFixed(2)), Number(high.toFixed(2))],
    };
  });
}

/**
 * Transforms Yahoo candles from provider shape into StockPulse's shared OHLC shape.
 * Yahoo's adjusted close is applied back across OHLC values so split-adjusted ranges do not distort long charts.
 * @param {object} chart - Raw provider chart payload.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Array<object>|null} Normalized chart points or null when the payload is unusable.
 */
function mapYahooCandles(chart, range) {
  const timestamps = chart?.timestamp;
  const quote = chart?.indicators?.quote?.[0];
  const adjustedCloses = chart?.indicators?.adjclose?.[0]?.adjclose || [];

  if (!Array.isArray(timestamps) || !quote) return null;

  return timestamps.map((timestamp, index) => {
    const rawClose = Number(quote.close?.[index]);
    const rawOpen = Number(quote.open?.[index]);
    const rawHigh = Number(quote.high?.[index]);
    const rawLow = Number(quote.low?.[index]);

    if (![rawOpen, rawHigh, rawLow, rawClose].every(Number.isFinite)) return null;

    const adjustedClose = Number(adjustedCloses[index]);
    const adjustment = Number.isFinite(adjustedClose) && rawClose ? adjustedClose / rawClose : 1;
    const open = Number((rawOpen * adjustment).toFixed(2));
    const high = Number((rawHigh * adjustment).toFixed(2));
    const low = Number((rawLow * adjustment).toFixed(2));
    const close = Number((rawClose * adjustment).toFixed(2));
    const date = new Date(timestamp * 1000);

    return {
      label: formatChartLabel(date, range),
      timestamp: date.toISOString(),
      open,
      high,
      low,
      close,
      price: close,
      volume: Number(quote.volume?.[index] || 0),
      candleRange: [low, high],
    };
  }).filter(Boolean);
}

/**
 * Returns the yahoo chart needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Promise<*>} A promise resolving to the requested yahoo chart result.
 */
async function getYahooChart(ticker, range) {
  const config = getYahooChartConfig(range);
  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(ticker)}`);
  url.searchParams.set('range', config.range);
  url.searchParams.set('interval', config.interval);
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('events', 'div,splits');

  const data = await cachedFetchJson(`yahoo:${ticker}:${range}`, url, {
    headers: { 'User-Agent': 'Mozilla/5.0 StockPulse/1.0' },
  });
  const error = data?.chart?.error;
  const chart = data?.chart?.result?.[0];

  if (error || !chart) {
    throw new Error(error?.description || 'Historical chart data was unavailable.');
  }

  const points = mapYahooCandles(chart, range);
  if (!points?.length) throw new Error('Historical chart contained no usable OHLC points.');
  return points;
}

/**
 * Checks whether a ticker contains only the supported symbol characters.
 * This avoids showing logo/news metadata for text that is clearly not a ticker.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {boolean} True when the ticker shape is supported.
 */
function isValidTickerSymbol(ticker) {
  return /^(?=.*[A-Z])[A-Z0-9.-]{1,12}$/.test(String(ticker || '').trim().toUpperCase());
}

/**
 * Matches company aliases in article text to the most likely stock ticker.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} text - Source text inspected for ticker references.
 * @returns {*} The infer news ticker from text result.
 */
function inferNewsTickerFromText(text) {
  const normalizedText = String(text || '').toUpperCase();
  if (!normalizedText) return '';

  return Object.entries(newsTickerAliases).find(([, aliases]) => (
    aliases.some((alias) => normalizedText.includes(alias))
  ))?.[0] || '';
}

/**
 * Returns the primary news ticker needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} related - Provider text containing related ticker symbols.
 * @param {string} preferredTicker - Ticker preferred when several symbols are present.
 * @param {string} newsText - Article title and summary used for ticker inference.
 * @returns {*} The requested primary news ticker result.
 */
function getPrimaryNewsTicker(related, preferredTicker = '', newsText = '') {
  const requestedTicker = String(preferredTicker || '').trim().toUpperCase();
  if (isValidTickerSymbol(requestedTicker)) return requestedTicker;

  const relatedTickers = String(related || '')
    .toUpperCase()
    .split(/[^A-Z0-9.-]+/)
    .map((ticker) => ticker.trim())
    .filter(Boolean);

  return relatedTickers.find(isValidTickerSymbol) || inferNewsTickerFromText(newsText) || 'MARKET';
}

/**
 * Transforms the news item from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {*} item - Current item being rendered or transformed.
 * @param {string} preferredTicker - Ticker preferred when several symbols are present.
 * @returns {*} The normalized news item result.
 */
function mapNewsItem(item, preferredTicker = '') {
  const ticker = getPrimaryNewsTicker(item.related, preferredTicker, `${item.headline || ''} ${item.summary || ''}`);
  const fallback = ticker === 'MARKET' ? {} : getStockFallback(ticker);

  return {
    id: String(item.id),
    ticker,
    company: ticker === 'MARKET' ? null : getCleanCompanyName(null, ticker, fallback),
    logo: getPreferredLogoUrl(ticker, fallback.logo),
    source: item.source || 'Finnhub',
    title: item.headline,
    summary: item.summary || 'No summary available.',
    publishedAt: item.datetime ? new Date(item.datetime * 1000).toLocaleString() : 'Recent',
    url: item.url,
  };
}

/**
 * Transforms the earnings item from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {*} The normalized earnings item result.
 */
function mapEarningsItem(item) {
  const ticker = String(item.symbol || item.ticker || '').toUpperCase();
  const fallback = getStockFallback(ticker);

  return {
    ticker,
    company: getCleanCompanyName(item.name || item.company, ticker, fallback),
    logo: getPreferredLogoUrl(ticker, fallback.logo),
    date: item.date || null,
    time: item.hour || item.time || 'Time unavailable',
    epsEstimate: item.epsEstimate ?? null,
  };
}

/**
 * Transforms the upcoming earnings from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {object} result - Provider response being normalized.
 * @param {number} limit - Maximum number of records to return.
 * @returns {*} The normalized upcoming earnings result.
 */
function mapUpcomingEarnings(result, limit) {
  const today = getDateString();
  const rows = Array.isArray(result?.earningsCalendar) ? result.earningsCalendar : [];

  return rows
    .map(mapEarningsItem)
    .filter((item) => item.ticker && item.date && item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker))
    .slice(0, limit);
}

/**
 * Returns the no live earnings response needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} message - Human-readable text shown to the user.
 * @returns {*} The requested no live earnings response result.
 */
function getNoLiveEarningsResponse(message) {
  return {
    demo: false,
    provider: shouldUseFinnhub() ? 'finnhub' : 'none',
    source: 'Finnhub earnings calendar',
    message,
    earnings: [],
  };
}

/**
 * Returns the local suggestions needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} query - Ticker or company-name search text.
 * @returns {*} The requested local suggestions result.
 */
function getLocalSuggestions(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return demoStocks
    .filter((stock) => stock.ticker.toLowerCase().includes(normalizedQuery) || stock.company.toLowerCase().includes(normalizedQuery))
    .map((stock) => ({
      ticker: stock.ticker,
      company: stock.company,
      type: 'Common Stock',
      logo: stock.logo || null,
      source: 'demo',
    }));
}

/**
 * Transforms the finnhub suggestion from its provider shape into the app's shared shape.
 * Keeping this transformation named makes the source-to-result relationship easier to inspect.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {*} The normalized finnhub suggestion result.
 */
function mapFinnhubSuggestion(item) {
  const fallback = getStockFallback(item.symbol);

  return {
    ticker: item.symbol,
    company: item.description || item.displaySymbol || item.symbol,
    type: item.type || 'Equity',
    logo: fallback.logo || null,
    source: 'finnhub',
  };
}

/**
 * Returns the market date parts needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} timeZone - IANA market time-zone identifier.
 * @returns {*} The requested market date parts result.
 */
function getMarketDateParts(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/**
 * Returns the local market status needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} config - Configuration values that control the operation.
 * @param {string} message - Human-readable text shown to the user.
 * @returns {*} The requested local market status result.
 */
function getLocalMarketStatus(config, message = getDemoMessage()) {
  const parts = getMarketDateParts(config.timezone);
  const exchange = getMarketExchange(config);
  const weekday = parts.weekday;
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  const minutes = hour * 60 + minute;
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const isOpen = isWeekday && minutes >= config.openMinutes && minutes < config.closeMinutes;
  const session = isOpen ? 'regular' : minutes < config.openMinutes && isWeekday ? 'pre-market' : 'closed';

  return {
    demo: true,
    provider: 'demo',
    code: config.code,
    label: config.label,
    exchange,
    isOpen,
    session,
    holiday: null,
    timezone: config.timezone,
    message,
  };
}

/**
 * Returns the single market status needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} config - Configuration values that control the operation.
 * @returns {Promise<*>} A promise resolving to the requested single market status result.
 */
async function getSingleMarketStatus(config) {
  if (!shouldUseFinnhub()) {
    return getLocalMarketStatus(config);
  }

  let lastError = null;

  try {
    for (const exchange of getMarketExchangeOptions(config)) {
      try {
        const status = await finnhubRequest('/stock/market-status', { exchange });

        return {
          demo: false,
          provider: 'finnhub',
          code: config.code,
          label: config.label,
          exchange: status.exchange || exchange,
          isOpen: Boolean(status.isOpen),
          session: status.session || (status.isOpen ? 'regular' : 'closed'),
          holiday: status.holiday || null,
          timezone: status.timezone || config.timezone,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  } catch (error) {
    return getLocalMarketStatus(config, `${getDemoMessage()} ${error.message}`);
  }
}

/**
 * Returns the market status needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {Promise<*>} A promise resolving to the requested market status result.
 */
export async function getMarketStatus() {
  const markets = await Promise.all(marketStatusConfigs.map((config) => getSingleMarketStatus(config)));
  const usMarket = markets.find((market) => market.code === 'US') || markets[0];

  return {
    ...usMarket,
    demo: markets.every((market) => market.demo),
    provider: markets.some((market) => market.provider === 'finnhub') ? 'finnhub' : 'demo',
    markets,
  };
}

/**
 * Returns the market summary needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {Promise<*>} A promise resolving to the requested market summary result.
 */
export async function getMarketSummary() {
  if (shouldUseFinnhub()) {
    try {
      const indexes = await Promise.all(
        marketIndexes.map(async (index) => {
          const quote = await finnhubRequest('/quote', { symbol: index.symbol });
          return {
            ...index,
            price: Number(quote.c || index.price),
            change: quote.dp !== undefined ? Number(quote.dp) : index.change,
          };
        }),
      );

      return { demo: false, provider: 'finnhub', indexes };
    } catch (error) {
      return { demo: true, provider: 'demo', message: `${getDemoMessage()} ${error.message}`, indexes: marketIndexes };
    }
  }

  return {
    demo: true,
    provider: 'demo',
    message: getDemoMessage(),
    indexes: marketIndexes,
  };
}

/**
 * Returns the stock suggestions needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} query - Ticker or company-name search text.
 * @returns {Promise<*>} A promise resolving to the requested stock suggestions result.
 */
export async function getStockSuggestions(query) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return { demo: true, provider: 'demo', suggestions: [] };
  }

  if (shouldUseFinnhub()) {
    try {
      const result = await finnhubRequest('/search', { q: normalizedQuery });
      const suggestions = (result.result || [])
        .filter((item) => item.symbol && item.description)
        .slice(0, 8)
        .map(mapFinnhubSuggestion);

      return {
        demo: false,
        provider: 'finnhub',
        suggestions: suggestions.length ? suggestions : getLocalSuggestions(normalizedQuery),
      };
    } catch (error) {
      return {
        demo: true,
        provider: 'demo',
        message: `${getDemoMessage()} ${error.message}`,
        suggestions: getLocalSuggestions(normalizedQuery),
      };
    }
  }

  return {
    demo: true,
    provider: 'demo',
    suggestions: getLocalSuggestions(normalizedQuery),
  };
}

/**
 * Searches live Finnhub data first and falls back to local demo stocks when the provider is unavailable.
 * The returned object always contains a normalized stock so the React pages can keep rendering.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {object} options - Search options.
 * @param {boolean} options.freshQuote - Whether to bypass cached quotes for order execution or price refreshes.
 * @returns {Promise<object>} Matching stock response with provider/demo metadata.
 */
export async function searchStock(ticker, { freshQuote = false } = {}) {
  if (shouldUseFinnhub()) {
    try {
      return {
        demo: false,
        provider: 'finnhub',
        stock: await getFinnhubStock(ticker, { freshQuote }),
      };
    } catch (error) {
      const fallback = findStock(ticker);
      return {
        demo: true,
        provider: 'demo',
        message: `${getDemoMessage()} ${error.message}`,
        stock: {
          ...fallback,
          company: getCleanCompanyName(fallback.company, ticker, fallback),
          logo: fallback.logo || null,
        },
      };
    }
  }

  const fallback = findStock(ticker);
  return {
    demo: true,
    provider: 'demo',
    message: getDemoMessage(),
    stock: {
      ...fallback,
      company: getCleanCompanyName(fallback.company, ticker, fallback),
      logo: fallback.logo || null,
    },
  };
}

/**
 * Returns normalized OHLC chart points using the best available provider.
 * The order is Finnhub candles, real Yahoo Finance history, then quote-anchored generated demo data.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Promise<object>} A promise resolving to normalized chart metadata and price points.
 */
export async function getChart(ticker, range) {
  const normalizedTicker = String(ticker || 'AAPL').toUpperCase();
  const updatedAt = new Date().toISOString();
  let finnhubCandleError = null;

  if (shouldUseFinnhub()) {
    try {
      const config = getCandleConfig(range);
      const candles = await finnhubRequest('/stock/candle', {
        symbol: normalizedTicker,
        resolution: config.resolution,
        from: config.from,
        to: getUnixSeconds(),
      });
      const points = mapCandles(candles, range);

      if (!points?.length) {
        throw new Error('No candle data returned for this range.');
      }

      return { demo: false, provider: 'finnhub', source: 'Finnhub candles', ticker: normalizedTicker, range, updatedAt, points };
    } catch (error) {
      finnhubCandleError = error;
    }
  }

  try {
    const points = await getYahooChart(normalizedTicker, range);
    return {
      demo: false,
      provider: 'yahoo',
      source: 'Yahoo Finance OHLC history',
      ticker: normalizedTicker,
      range,
      updatedAt,
      message: finnhubCandleError ? 'Finnhub candle history was unavailable, so real Yahoo Finance history is shown.' : null,
      points,
    };
  } catch (historicalError) {
    const fallbackStock = shouldUseFinnhub()
      ? await getFinnhubStock(normalizedTicker).catch(() => findStock(normalizedTicker))
      : findStock(normalizedTicker);

    return {
      demo: true,
      provider: 'demo',
      source: 'Estimated offline range',
      ticker: normalizedTicker,
      range,
      updatedAt,
      message: `Real historical data is temporarily unavailable. ${historicalError.message}`,
      points: buildQuoteAnchoredChartData(fallbackStock, range),
    };
  }
}

/**
 * Returns the news needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {Promise<*>} A promise resolving to the requested news result.
 */
export async function getNews(ticker) {
  const normalizedTicker = String(ticker || '').toUpperCase();

  if (shouldUseFinnhub() && normalizedTicker) {
    try {
      const news = await finnhubRequest('/company-news', {
        symbol: normalizedTicker,
        from: getDateString(-14),
        to: getDateString(),
      });

      return {
        demo: false,
        provider: 'finnhub',
        news: news.slice(0, 5).map((item) => mapNewsItem(item, normalizedTicker)),
      };
    } catch (error) {
      return {
        demo: true,
        provider: 'demo',
        message: `${getDemoMessage()} ${error.message}`,
        news: demoNews.filter((item) => !normalizedTicker || item.ticker === normalizedTicker).slice(0, 5),
      };
    }
  }

  return {
    demo: true,
    provider: 'demo',
    news: demoNews.filter((item) => !normalizedTicker || item.ticker === normalizedTicker).slice(0, 5),
  };
}

/**
 * Returns the market news needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {Promise<*>} A promise resolving to the requested market news result.
 */
export async function getMarketNews() {
  if (shouldUseFinnhub()) {
    try {
      const news = await finnhubRequest('/news', { category: 'general' });
      return {
        demo: false,
        provider: 'finnhub',
        // Keep a fuller feed available because the dashboard card scrolls internally.
        news: news.slice(0, 15).map(mapNewsItem),
      };
    } catch (error) {
      return { demo: true, provider: 'demo', message: `${getDemoMessage()} ${error.message}`, news: demoNews };
    }
  }

  return {
    demo: true,
    provider: 'demo',
    news: demoNews,
  };
}

/**
 * Returns the earnings needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {Promise<*>} A promise resolving to the requested earnings result.
 */
export async function getEarnings(ticker) {
  const normalizedTicker = String(ticker || '').toUpperCase();

  if (shouldUseFinnhub() && normalizedTicker) {
    try {
      const result = await finnhubRequest('/calendar/earnings', {
        symbol: normalizedTicker,
        from: getDateString(),
        to: getDateString(120),
      });

      return {
        demo: false,
        provider: 'finnhub',
        source: 'Finnhub earnings calendar',
        asOf: new Date().toISOString(),
        earnings: mapUpcomingEarnings(result, 4),
      };
    } catch (error) {
      return getNoLiveEarningsResponse(`Live upcoming earnings unavailable: ${error.message}`);
    }
  }

  return getNoLiveEarningsResponse('Finnhub API key is not configured, so live upcoming earnings cannot be loaded.');
}

/**
 * Returns the price targets needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {Promise<*>} A promise resolving to the requested price targets result.
 */
export async function getPriceTargets(ticker) {
  const normalizedTicker = String(ticker || '').toUpperCase();

  if (!normalizedTicker) {
    return {
      demo: false,
      provider: 'none',
      ticker: normalizedTicker,
      message: 'Choose a ticker to load analyst targets.',
      consensus: null,
      firms: [],
    };
  }

  if (shouldUseFinnhub()) {
    const [targetResult, firmResult] = await Promise.allSettled([
      finnhubRequest('/stock/price-target', { symbol: normalizedTicker }),
      finnhubRequest('/stock/upgrade-downgrade', { symbol: normalizedTicker }),
    ]);
    const target = targetResult.status === 'fulfilled' ? targetResult.value : null;
    const firmRows = firmResult.status === 'fulfilled' && Array.isArray(firmResult.value) ? firmResult.value : [];
    /**
     * Converts one raw analyst target into the normalized target shape used by the client.
     * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
     * @param {*} value - Value to inspect, transform, or display.
     * @returns {*} The as target result.
     */
    const asTarget = (value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
    };
    const consensus = target ? {
      high: asTarget(target.targetHigh),
      mean: asTarget(target.targetMean),
      median: asTarget(target.targetMedian),
      low: asTarget(target.targetLow),
      lastUpdated: target.lastUpdated || null,
    } : null;
    const hasConsensus = consensus && Object.values(consensus).some((value) => value !== null);
    const firms = firmRows
      .filter((item) => item.company)
      .slice(0, 24)
      .map((item) => ({
        company: item.company,
        action: item.action || 'Update',
        fromGrade: item.fromGrade || null,
        toGrade: item.toGrade || 'Rating updated',
        date: item.gradeTime ? new Date(item.gradeTime * 1000).toISOString() : null,
      }));

    if (hasConsensus || firms.length) {
      return {
        demo: false,
        provider: 'finnhub',
        source: 'Finnhub analyst data',
        ticker: normalizedTicker,
        consensus: hasConsensus ? consensus : null,
        firms,
        message: null,
      };
    }
  }

  try {
    return await getYahooPriceTargets(normalizedTicker);
  } catch {
    return {
      demo: false,
      provider: 'none',
      ticker: normalizedTicker,
      consensus: null,
      firms: [],
      message: 'No current analyst targets were returned by Finnhub or Yahoo Finance.',
    };
  }
}

/**
 * Returns the market earnings needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {Promise<*>} A promise resolving to the requested market earnings result.
 */
export async function getMarketEarnings() {
  if (shouldUseFinnhub()) {
    try {
      const result = await finnhubRequest('/calendar/earnings', {
        from: getDateString(),
        to: getDateString(120),
      });

      return {
        demo: false,
        provider: 'finnhub',
        source: 'Finnhub earnings calendar',
        asOf: new Date().toISOString(),
        earnings: mapUpcomingEarnings(result, 12),
      };
    } catch (error) {
      return getNoLiveEarningsResponse(`Live upcoming earnings unavailable: ${error.message}`);
    }
  }

  return getNoLiveEarningsResponse('Finnhub API key is not configured, so live upcoming earnings cannot be loaded.');
}

/**
 * Returns top active stocks, daily gainers, and daily losers for the dashboard.
 * Volume leaders come from the curated active universe, while daily gainers/losers prefer Yahoo screeners when available.
 * @returns {Promise<object>} Market activity groups for the dashboard.
 */
export async function getTopActiveStocks() {
  if (shouldUseFinnhub()) {
    try {
      const [stocks, gainers, losers] = await Promise.all([
        Promise.all(
          activeSymbols.map(async (symbol) => {
            const fallback = getStockFallback(symbol);
            const [quote, profile, volume] = await Promise.all([
              finnhubRequest('/quote', { symbol }),
              getFinnhubProfileOrFallback(symbol, fallback),
              getRecentVolume(symbol, fallback.volume),
            ]);

            return {
              ...mapQuoteToStock(symbol, quote, profile),
              volume,
            };
          }),
        ),
        getYahooScreenerStocks('day_gainers', 25).catch(() => []),
        getYahooScreenerStocks('day_losers', 25).catch(() => []),
      ]);
      const volumeStocks = sortByVolume(stocks);
      const topGainers = selectTopMovers(gainers, volumeStocks, 'gainer');
      const topLosers = selectTopMovers(losers, volumeStocks, 'loser');

      return {
        demo: false,
        provider: gainers.length || losers.length ? 'finnhub+yahoo' : 'finnhub',
        message: 'Volume leaders use Finnhub quotes; day gainers and losers use the latest available Yahoo Finance screener results.',
        stocks: volumeStocks,
        gainers: topGainers,
        losers: topLosers,
      };
    } catch (error) {
      const stocks = sortByVolume(demoStocks);
      return {
        demo: true,
        provider: 'demo',
        message: `${getDemoMessage()} ${error.message}`,
        stocks,
        gainers: sortByChange(stocks, 'gainer').slice(0, 3),
        losers: sortByChange(stocks, 'loser').slice(0, 3),
      };
    }
  }

  const stocks = sortByVolume(demoStocks);
  return {
    demo: true,
    provider: 'demo',
    message: getDemoMessage(),
    stocks,
    gainers: sortByChange(stocks, 'gainer').slice(0, 3),
    losers: sortByChange(stocks, 'loser').slice(0, 3),
  };
}
