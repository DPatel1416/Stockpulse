/**
 * File purpose: Provides deterministic market, news, earnings, chart, and portfolio data for offline demonstrations.
 */
// Central mock data keeps the app useful when market APIs, MongoDB, or the backend are unavailable.
export const marketIndexes = [
  { name: 'S&P 500', symbol: 'SPY', price: 6447.12, change: 0.82, status: 'Open' },
  { name: 'Nasdaq', symbol: 'QQQ', price: 574.3, change: 1.18, status: 'Open' },
  { name: 'Dow Jones', symbol: 'DIA', price: 468.91, change: -0.24, status: 'Open' },
];

export const demoStocks = [
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    sector: 'Technology',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',
    price: 228.87,
    change: 2.14,
    volume: 64200000,
    avgVolume: 55800000,
    marketCap: '3.4T',
    pe: 34.2,
    dayRange: '$224.80 - $230.14',
    yearRange: '$164.08 - $237.49',
    open: 225.44,
    previousClose: 224.08,
  },
  {
    ticker: 'TSLA',
    company: 'Tesla Inc.',
    sector: 'Consumer Cyclical',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png',
    price: 346.22,
    change: -1.41,
    volume: 91100000,
    avgVolume: 78900000,
    marketCap: '1.1T',
    pe: 88.7,
    dayRange: '$338.22 - $352.10',
    yearRange: '$138.80 - $414.50',
    open: 350.16,
    previousClose: 351.17,
  },
  {
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    sector: 'Technology',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png',
    price: 183.64,
    change: 3.08,
    volume: 174200000,
    avgVolume: 139000000,
    marketCap: '4.5T',
    pe: 52.9,
    dayRange: '$177.90 - $185.33',
    yearRange: '$90.69 - $195.95',
    open: 178.42,
    previousClose: 178.14,
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft Corporation',
    sector: 'Technology',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png',
    price: 512.19,
    change: 0.64,
    volume: 28400000,
    avgVolume: 24600000,
    marketCap: '3.8T',
    pe: 39.6,
    dayRange: '$506.40 - $515.60',
    yearRange: '$380.38 - $523.81',
    open: 508.98,
    previousClose: 508.93,
  },
  {
    ticker: 'AMZN',
    company: 'Amazon.com Inc.',
    sector: 'Consumer Cyclical',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png',
    price: 224.11,
    change: 0.37,
    volume: 41200000,
    avgVolume: 39900000,
    marketCap: '2.4T',
    pe: 36.4,
    dayRange: '$220.70 - $226.49',
    yearRange: '$151.61 - $233.00',
    open: 222.54,
    previousClose: 223.28,
  },
];

export const demoNews = [
  {
    id: 'n1',
    ticker: 'AAPL',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',
    source: 'Market Desk',
    title: 'Megacap technology stocks lift major indexes in active session',
    summary: 'Large technology names traded higher as investors focused on product cycles and earnings resilience.',
    publishedAt: 'Today, 9:42 AM',
    url: 'https://example.com/news/market-desk',
  },
  {
    id: 'n2',
    ticker: 'NVDA',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png',
    source: 'Fintech Wire',
    title: 'AI infrastructure demand keeps semiconductor volume elevated',
    summary: 'Chipmakers saw stronger-than-average volume, a useful signal for students comparing activity levels.',
    publishedAt: 'Today, 10:12 AM',
    url: 'https://example.com/news/semis',
  },
  {
    id: 'n3',
    ticker: 'TSLA',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png',
    source: 'Learning Markets',
    title: 'EV names mixed as traders weigh delivery data and margins',
    summary: 'Price movement remained volatile, highlighting why paper trading can help learners practice risk controls.',
    publishedAt: 'Yesterday, 4:17 PM',
    url: 'https://example.com/news/ev',
  },
  {
    id: 'n4',
    ticker: 'MSFT',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png',
    source: 'Cloud Ledger',
    title: 'Cloud software stocks steady before upcoming earnings reports',
    summary: 'Analysts watched revenue growth and margins, two common earnings concepts covered in StockPulse Learn.',
    publishedAt: 'Yesterday, 1:08 PM',
    url: 'https://example.com/news/cloud',
  },
];

export const demoEarnings = [
  { ticker: 'AAPL', company: 'Apple Inc.', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png', date: '2026-07-30', time: 'After close', epsEstimate: 1.42 },
  { ticker: 'MSFT', company: 'Microsoft Corporation', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png', date: '2026-07-28', time: 'After close', epsEstimate: 3.31 },
  { ticker: 'AMZN', company: 'Amazon.com Inc.', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png', date: '2026-08-01', time: 'After close', epsEstimate: 1.08 },
  { ticker: 'NVDA', company: 'NVIDIA Corporation', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png', date: '2026-08-26', time: 'After close', epsEstimate: 1.23 },
];

export const learningTerms = [
  {
    term: 'Stock',
    topic: 'Getting Started',
    short: 'A small ownership stake in a public company.',
    example: 'Owning one share means you participate in that company\'s gains, losses, and sometimes dividends.',
  },
  {
    term: 'ETF',
    topic: 'Getting Started',
    short: 'A fund that trades like a stock and can hold many investments.',
    example: 'A broad-market ETF can spread one purchase across hundreds of companies.',
  },
  {
    term: 'Index',
    topic: 'Getting Started',
    short: 'A benchmark that tracks a defined group of investments.',
    example: 'An index measures a market segment; an index fund or ETF is one way to invest alongside it.',
  },
  {
    term: 'Volume',
    topic: 'Market Activity',
    short: 'How many shares traded during a period.',
    example: 'If NVDA trades 174M shares while its average is 139M, activity is above normal.',
  },
  {
    term: 'Market Cap',
    topic: 'Company Size',
    short: 'Share price multiplied by total shares outstanding.',
    example: 'A $100 stock with 1B shares has a $100B market cap.',
  },
  {
    term: 'Earnings',
    topic: 'Company Results',
    short: 'A scheduled report where a company shares revenue, profit, and guidance.',
    example: 'A stock can move after earnings because new information changes expectations.',
  },
  {
    term: 'EPS',
    topic: 'Company Results',
    short: 'Earnings per share, or profit divided by shares outstanding.',
    example: 'If profit is $1B and shares are 500M, EPS is $2.00.',
  },
  {
    term: 'P/E Ratio',
    topic: 'Valuation',
    short: 'Price divided by earnings per share.',
    example: 'A $50 stock with $2 EPS has a P/E of 25.',
  },
  {
    term: 'Bid and Ask',
    topic: 'Placing Orders',
    short: 'The best current buyer price and seller price.',
    example: 'The difference between a $99.95 bid and $100.05 ask is the bid-ask spread.',
  },
  {
    term: 'Market Order',
    topic: 'Placing Orders',
    short: 'An order intended to fill quickly at the best available price.',
    example: 'The final fill can differ from the displayed quote when a stock moves quickly.',
  },
  {
    term: 'Limit Order',
    topic: 'Placing Orders',
    short: 'An order that sets the worst price you are willing to accept.',
    example: 'A buy limit at $50 will not fill above $50, but it may not fill at all.',
  },
  {
    term: '52-Week Range',
    topic: 'Price Context',
    short: 'The lowest and highest price over the past year.',
    example: 'If price is near the top of the range, learners can compare momentum and risk.',
  },
  {
    term: 'Diversification',
    topic: 'Risk',
    short: 'Spreading exposure across different companies or sectors.',
    example: 'Owning only one stock can make a paper portfolio swing more sharply.',
  },
  {
    term: 'Volatility',
    topic: 'Risk',
    short: 'How sharply and frequently an investment price changes.',
    example: 'A volatile stock can move several percent in a day in either direction.',
  },
  {
    term: 'Time Horizon',
    topic: 'Risk',
    short: 'How long money can stay invested before you expect to need it.',
    example: 'Money needed next year usually cannot tolerate the same risk as money intended for decades later.',
  },
  {
    term: 'Dollar-Cost Averaging',
    topic: 'Building Habits',
    short: 'Investing a consistent amount on a regular schedule.',
    example: 'A learner might practice adding the same virtual amount each month instead of guessing one perfect entry day.',
  },
  {
    term: 'Compounding',
    topic: 'Building Habits',
    short: 'Returns generating additional returns over time.',
    example: 'Growth can accelerate when gains remain invested, although real returns are never guaranteed.',
  },
  {
    term: 'Expense Ratio',
    topic: 'Costs',
    short: 'The annual operating cost charged by a fund.',
    example: 'A 0.25% expense ratio is about $2.50 per year for every $1,000 invested, before market changes.',
  },
  {
    term: 'Dividend',
    topic: 'Investment Returns',
    short: 'Cash a company may distribute to shareholders.',
    example: 'Dividends can be changed or stopped and are only one part of total return.',
  },
  {
    term: 'P/L',
    topic: 'Portfolio Math',
    short: 'Profit or loss compared with what you paid.',
    example: 'Buying 5 shares at $100 and seeing them rise to $110 creates $50 unrealized P/L.',
  },
];

export const initialPortfolio = {
  virtualCash: 10000,
  transactions: [],
  openOrders: [],
  accounts: [
    { type: 'CASH', institution: 'StockPulse Demo Bank', balance: 10000 },
  ],
  holdings: [
    { ticker: 'AAPL', companyName: 'Apple Inc.', shares: 4, averageCost: 214.2 },
    { ticker: 'NVDA', companyName: 'NVIDIA Corporation', shares: 5, averageCost: 161.35 },
  ],
};

export const insightPrompts = [
  'Explain today volume in beginner terms',
  'Summarize the latest news headlines',
  'What does my paper portfolio P/L mean?',
  'Explain earnings without giving advice',
];

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
 * Returns the market session timestamps needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Date} referenceDate - Date used to decide which market sessions are current.
 * @param {number} sessionCount - Number of regular trading sessions to include.
 * @param {number} intervalMinutes - Minutes between generated market points.
 * @returns {*} The requested market session timestamps result.
 */
function getMarketSessionTimestamps(referenceDate, sessionCount, intervalMinutes) {
  const latestSession = new Date(referenceDate);
  const marketOpenMinutes = 9 * 60 + 30;
  const marketCloseMinutes = 16 * 60;
  const currentMinutes = latestSession.getHours() * 60 + latestSession.getMinutes();

  while (latestSession.getDay() === 0 || latestSession.getDay() === 6 || currentMinutes < marketOpenMinutes) {
    latestSession.setDate(latestSession.getDate() - 1);
    if (latestSession.getDay() !== 0 && latestSession.getDay() !== 6) break;
  }

  const sessions = [];
  const cursor = new Date(latestSession);
  while (sessions.length < sessionCount) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) sessions.unshift(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  return sessions.flatMap((session, sessionIndex) => {
    const isCurrentSession = sessionIndex === sessions.length - 1
      && session.toDateString() === new Date(referenceDate).toDateString()
      && currentMinutes >= marketOpenMinutes
      && currentMinutes < marketCloseMinutes;
    const sessionEndMinutes = isCurrentSession ? currentMinutes : marketCloseMinutes;
    const timestamps = [];

    for (let minute = marketOpenMinutes; minute <= sessionEndMinutes; minute += intervalMinutes) {
      const point = new Date(session);
      point.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      timestamps.push(point);
    }

    return timestamps;
  });
}

/**
 * Returns the chart date needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @param {Array<object>} points - Timestamped chart or performance points.
 * @param {*} index - Zero-based position of the current item.
 * @returns {*} The requested chart date result.
 */
function getChartDate(range, points, index) {
  const labelDate = new Date();

  if (range === '1M') {
    labelDate.setHours(labelDate.getHours() - (points - index - 1) * 8);
  } else if (range === '3M') {
    labelDate.setHours(labelDate.getHours() - (points - index - 1) * 33);
  } else if (range === '6M') {
    labelDate.setDate(labelDate.getDate() - (points - index - 1) * 4);
  } else if (range === '1Y') {
    labelDate.setDate(labelDate.getDate() - (points - index - 1) * 7);
  } else {
    labelDate.setMonth(labelDate.getMonth() - (points - index - 1));
  }

  return labelDate;
}

/**
 * Returns the chart label needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} range - Requested chart or performance time range.
 * @param {Date} labelDate - Date represented by a chart label.
 * @returns {*} The requested chart label result.
 */
function getChartLabel(range, labelDate) {
  if (range === '1D') {
    return labelDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (range === '5D') {
    return `${labelDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${labelDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  return range === '1M'
    ? `${labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${labelDate.toLocaleTimeString('en-US', { hour: 'numeric' })}`
    : labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Generated chart points mimic a restrained market walk for offline/demo fallback.
/**
 * Constructs the chart data from its source values.
 * A named builder keeps multi-step construction logic testable and reusable.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Array<object>} Deterministic timestamped chart points for the requested ticker and range.
 */
export function buildChartData(ticker = 'AAPL', range = '1M') {
  const stock = findStock(ticker);
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
  const seed = stock.ticker.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
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
    const pointDate = sessionTimestamps?.[index] || getChartDate(range, points, index);

    return {
      label: getChartLabel(range, pointDate),
      timestamp: pointDate.toISOString(),
      price,
      volume: Math.round(baseVolume * (volumeNoise + volumePulse)),
    };
  });
}

/**
 * Finds the stock that matches the caller's criteria.
 * A dedicated lookup keeps matching rules consistent for every caller.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {*} The matching stock result.
 */
export function findStock(ticker) {
  const normalizedTicker = String(ticker || 'AAPL').toUpperCase();
  const seed = normalizedTicker.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const syntheticPrice = Number((45 + (seed % 420) + (seed % 17) / 10).toFixed(2));
  const syntheticChange = Number((((seed % 900) / 100) - 4.5).toFixed(2));
  const syntheticVolume = 8_000_000 + (seed % 75) * 1_100_000;

  return demoStocks.find((stock) => stock.ticker === normalizedTicker) || {
    ticker: normalizedTicker,
    company: `${normalizedTicker} Demo Company`,
    sector: 'Other',
    logo: null,
    price: syntheticPrice,
    change: syntheticChange,
    volume: syntheticVolume,
    avgVolume: Math.round(syntheticVolume * 0.82),
    marketCap: `${Math.max(2, seed % 600)}B`,
    pe: Number((12 + (seed % 55) / 2).toFixed(1)),
    dayRange: `$${(syntheticPrice * 0.98).toFixed(2)} - $${(syntheticPrice * 1.02).toFixed(2)}`,
    yearRange: `$${(syntheticPrice * 0.62).toFixed(2)} - $${(syntheticPrice * 1.28).toFixed(2)}`,
    open: Number((syntheticPrice * 0.995).toFixed(2)),
    previousClose: Number((syntheticPrice / (1 + syntheticChange / 100)).toFixed(2)),
  };
}
