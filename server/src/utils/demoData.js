/**
 * File purpose: Provides focused Demo Data helper functions that keep repeated logic out of larger modules.
 */
// Server-side mock data mirrors the client fallback so API demos stay consistent.
export const demoStocks = [
  { ticker: 'AAPL', company: 'Apple Inc.', sector: 'Technology', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png', price: 228.87, change: 2.14, volume: 64200000, avgVolume: 55800000, marketCap: '3.4T', pe: 34.2, dayRange: '$224.80 - $230.14', yearRange: '$164.08 - $237.49', open: 225.44, previousClose: 224.08 },
  { ticker: 'TSLA', company: 'Tesla Inc.', sector: 'Consumer Cyclical', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png', price: 346.22, change: -1.41, volume: 91100000, avgVolume: 78900000, marketCap: '1.1T', pe: 88.7, dayRange: '$338.22 - $352.10', yearRange: '$138.80 - $414.50', open: 350.16, previousClose: 351.17 },
  { ticker: 'NVDA', company: 'NVIDIA Corporation', sector: 'Technology', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png', price: 183.64, change: 3.08, volume: 174200000, avgVolume: 139000000, marketCap: '4.5T', pe: 52.9, dayRange: '$177.90 - $185.33', yearRange: '$90.69 - $195.95', open: 178.42, previousClose: 178.14 },
  { ticker: 'MSFT', company: 'Microsoft Corporation', sector: 'Technology', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png', price: 512.19, change: 0.64, volume: 28400000, avgVolume: 24600000, marketCap: '3.8T', pe: 39.6, dayRange: '$506.40 - $515.60', yearRange: '$380.38 - $523.81', open: 508.98, previousClose: 508.93 },
  { ticker: 'AMZN', company: 'Amazon.com Inc.', sector: 'Consumer Cyclical', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png', price: 224.11, change: 0.37, volume: 41200000, avgVolume: 39900000, marketCap: '2.4T', pe: 36.4, dayRange: '$220.70 - $226.49', yearRange: '$151.61 - $233.00', open: 222.54, previousClose: 223.28 },
];

export const marketIndexes = [
  { name: 'S&P 500', symbol: 'SPY', price: 6447.12, change: 0.82, status: 'Open' },
  { name: 'Nasdaq', symbol: 'QQQ', price: 574.3, change: 1.18, status: 'Open' },
  { name: 'Dow Jones', symbol: 'DIA', price: 468.91, change: -0.24, status: 'Open' },
];

export const demoNews = [
  { id: 'n1', ticker: 'AAPL', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png', source: 'Market Desk', title: 'Megacap technology stocks lift major indexes in active session', summary: 'Large technology names traded higher as investors focused on product cycles and earnings resilience.', publishedAt: 'Today, 9:42 AM', url: 'https://example.com/news/market-desk' },
  { id: 'n2', ticker: 'NVDA', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png', source: 'Fintech Wire', title: 'AI infrastructure demand keeps semiconductor volume elevated', summary: 'Chipmakers saw stronger-than-average volume, a useful signal for students comparing activity levels.', publishedAt: 'Today, 10:12 AM', url: 'https://example.com/news/semis' },
  { id: 'n3', ticker: 'TSLA', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png', source: 'Learning Markets', title: 'EV names mixed as traders weigh delivery data and margins', summary: 'Price movement remained volatile, highlighting why paper trading can help learners practice risk controls.', publishedAt: 'Yesterday, 4:17 PM', url: 'https://example.com/news/ev' },
  { id: 'n4', ticker: 'MSFT', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png', source: 'Cloud Ledger', title: 'Cloud software stocks steady before upcoming earnings reports', summary: 'Analysts watched revenue growth and margins, two common earnings concepts covered in StockPulse Learn.', publishedAt: 'Yesterday, 1:08 PM', url: 'https://example.com/news/cloud' },
];

export const demoEarnings = [
  { ticker: 'AAPL', company: 'Apple Inc.', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png', date: '2026-07-30', time: 'After close', epsEstimate: 1.42 },
  { ticker: 'MSFT', company: 'Microsoft Corporation', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png', date: '2026-07-28', time: 'After close', epsEstimate: 3.31 },
  { ticker: 'AMZN', company: 'Amazon.com Inc.', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png', date: '2026-08-01', time: 'After close', epsEstimate: 1.08 },
  { ticker: 'NVDA', company: 'NVIDIA Corporation', logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png', date: '2026-08-26', time: 'After close', epsEstimate: 1.23 },
];

/**
 * Finds the stock that matches the caller's criteria.
 * A dedicated lookup keeps matching rules consistent for every caller.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {object} The matching known stock or a deterministic fallback stock.
 */
export function findStock(ticker = 'AAPL') {
  const normalizedTicker = ticker.toUpperCase();
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

/**
 * Constructs the chart data from its source values.
 * A named builder keeps multi-step construction logic testable and reusable.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} range - Requested chart or performance time range.
 * @returns {Array<object>} Deterministic timestamped chart points for the requested ticker and range.
 */
export function buildChartData(ticker = 'AAPL', range = '1M') {
  const stock = findStock(ticker);
  const pointsByRange = { '1D': 16, '5D': 20, '1M': 30, '3M': 40, '6M': 48, '1Y': 52, '5Y': 72, MAX: 72 };
  const points = pointsByRange[range] || 30;
  const seed = stock.ticker.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin((index + seed) / 4) * 3.5;
    const drift = (index - points / 2) * (stock.change >= 0 ? 0.28 : -0.22);
    return {
      label: range === '1D' ? `${9 + Math.floor(index / 2)}:${index % 2 ? '30' : '00'}` : `P${index + 1}`,
      price: Number((stock.price - points * 0.18 + wave + drift).toFixed(2)),
      volume: Math.round(stock.avgVolume * (0.55 + Math.abs(Math.sin(index / 3)))),
    };
  });
}
