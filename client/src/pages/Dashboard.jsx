/**
 * File purpose: Assembles the Dashboard screen from reusable components, API data, and page-specific interactions.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarClock, LogIn, Newspaper, Star, TrendingUp, WalletCards } from 'lucide-react';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import GlassCard from '../components/ui/GlassCard';
import Skeleton from '../components/ui/Skeleton';
import Select from '../components/ui/Select';
import StockLogo, { StockIdentity } from '../components/stock/StockLogo';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../context/GuestSessionContext';
import { api } from '../services/api';
import { loadGuestWatchlistStocks } from '../utils/guestWatchlist';
import { formatCompactNumber, formatCurrency, formatPercent, getChangeClass } from '../utils/format';

/**
 * Returns the industry name needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} stock - Normalized stock quote and company details.
 * @returns {string} The normalized industry label displayed by dashboard filters.
 */
function getIndustryName(stock) {
  const industry = String(stock?.sector || '').trim();
  return industry && industry !== 'Demo Market' ? industry : 'Other';
}

/**
 * Returns the earnings company label needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {*} The requested earnings company label result.
 */
function getEarningsCompanyLabel(item) {
  return item?.company && !item.company.includes('Demo Company') ? item.company : 'Upcoming report';
}

/**
 * Returns the finite change needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} stock - Normalized stock quote and company details.
 * @returns {*} The requested finite change result.
 */
function getFiniteChange(stock) {
  const value = Number(stock?.change);
  return Number.isFinite(value) ? value : null;
}

/**
 * Orders the movers using the shared comparison rule.
 * Centralizing ordering rules keeps lists consistent throughout the interface.
 * @param {Array<object>} stocks - Stock records to sort, filter, or display.
 * @param {string} direction - Direction that controls ordering or money movement.
 * @returns {*} The ordered movers result.
 */
function sortMovers(stocks, direction) {
  return stocks
    .map((stock) => ({ stock, changeValue: getFiniteChange(stock) }))
    .filter(({ changeValue }) => changeValue !== null && (direction === 'gainer' ? changeValue > 0 : changeValue < 0))
    .sort((first, second) => {
      const changeSort = direction === 'gainer'
        ? second.changeValue - first.changeValue
        : first.changeValue - second.changeValue;
      if (changeSort !== 0) return changeSort;
      return Number(second.stock.volume || 0) - Number(first.stock.volume || 0);
    })
    .slice(0, 3)
    .map(({ stock }) => stock);
}

/**
 * Returns the news ticker needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {*} The requested news ticker result.
 */
function getNewsTicker(item) {
  const ticker = String(item?.ticker || '').trim().toUpperCase();
  return ticker && ticker !== 'MARKET' && /[A-Z]/.test(ticker) ? ticker : '';
}

// Dashboard gives a market overview and fast paths into search, watchlist, portfolio, and learning.
/**
 * Renders the dashboard React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionReady } = useAuth();
  const { watchlistTickers, addGuestTicker, removeGuestTicker } = useGuestSession();
  const { showToast } = useToasts();
  const [activeStocks, setActiveStocks] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [globalNews, setGlobalNews] = useState([]);
  const [watchlistNews, setWatchlistNews] = useState([]);
  const [watchlistEarnings, setWatchlistEarnings] = useState([]);
  const [marketMovers, setMarketMovers] = useState({ gainers: [], losers: [] });
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const industryOptions = useMemo(
    () => ['All', ...Array.from(new Set(activeStocks.map(getIndustryName))).sort()],
    [activeStocks],
  );

  const filteredActiveStocks = useMemo(
    () => selectedIndustry === 'All'
      ? activeStocks
      : activeStocks.filter((stock) => getIndustryName(stock) === selectedIndustry),
    [activeStocks, selectedIndustry],
  );
  const visibleActiveStocks = useMemo(
    () => filteredActiveStocks.slice(0, 4),
    [filteredActiveStocks],
  );

  const topGainers = useMemo(
    () => {
      const dayGainers = sortMovers(marketMovers.gainers || [], 'gainer');
      return dayGainers.length ? dayGainers : sortMovers(filteredActiveStocks, 'gainer');
    },
    [filteredActiveStocks, marketMovers.gainers],
  );
  const topLosers = useMemo(
    () => {
      const dayLosers = sortMovers(marketMovers.losers || [], 'loser');
      return dayLosers.length ? dayLosers : sortMovers(filteredActiveStocks, 'loser');
    },
    [filteredActiveStocks, marketMovers.losers],
  );
  const heroPulseItems = useMemo(() => {
    const volumeLeader = [...activeStocks]
      .filter((stock) => Number.isFinite(Number(stock.volume)))
      .sort((a, b) => Number(b.volume) - Number(a.volume))[0];
    const strongestMover = [...activeStocks]
      .filter((stock) => Number.isFinite(Number(stock.change)))
      .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))[0];
    const nextReport = [...watchlistEarnings]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

    return [
      {
        label: 'Most traded',
        value: volumeLeader?.ticker || '--',
        detail: volumeLeader ? `${formatCompactNumber(volumeLeader.volume)} volume` : 'Awaiting market data',
        icon: Activity,
        stock: volumeLeader,
        route: volumeLeader ? `/stock/${volumeLeader.ticker}` : '/stock/AAPL',
      },
      {
        label: 'Biggest move',
        value: strongestMover?.ticker || '--',
        detail: strongestMover ? formatPercent(strongestMover.change) : 'Awaiting movers',
        icon: TrendingUp,
        stock: strongestMover,
        route: strongestMover ? `/stock/${strongestMover.ticker}` : '/stock/AAPL',
        detailClass: strongestMover ? getChangeClass(strongestMover.change) : '',
      },
      {
        label: 'Watchlist',
        value: String(watchlist.length),
        detail: isAuthenticated
          ? (watchlist.length === 1 ? 'symbol tracked' : 'symbols tracked')
          : (watchlist.length === 1 ? 'temporary symbol' : 'temporary symbols'),
        icon: Star,
        route: '/watchlist',
      },
      {
        label: 'Next report',
        value: nextReport?.ticker || '--',
        detail: nextReport ? `${nextReport.date} - ${nextReport.time}` : 'No watched dates',
        icon: CalendarClock,
        stock: nextReport,
        route: nextReport ? `/stock/${nextReport.ticker}` : '/watchlist',
      },
    ];
  }, [activeStocks, isAuthenticated, watchlist.length, watchlistEarnings]);

  useEffect(() => {
    if (!industryOptions.includes(selectedIndustry)) {
      setSelectedIndustry('All');
    }
  }, [industryOptions, selectedIndustry]);

  useEffect(() => {
    /**
     * Removes repeated news articles while preserving their original order.
     * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
     * @param {*} items - Items being rendered, filtered, or transformed.
     * @returns {*} The dedupe news result.
     */
    function dedupeNews(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = item.id || item.url || item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    /**
     * Keeps one upcoming earnings record per ticker.
     * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
     * @param {*} items - Items being rendered, filtered, or transformed.
     * @returns {*} The dedupe earnings result.
     */
    function dedupeEarnings(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = `${item.ticker}-${item.date}-${item.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    /**
     * Loads the dashboard and prepares it for the current workflow.
     * Separating loading from rendering keeps asynchronous state easier to follow.
     * @returns {Promise<*>} A promise resolving to the loaded dashboard result.
     */
    async function loadDashboard() {
      if (!isSessionReady) return;

      setIsLoading(true);
      const [activeResult, watchlistResult, portfolioResult, newsResult] = await Promise.all([
        api.getMarketActive(),
        isAuthenticated ? api.getWatchlist() : loadGuestWatchlistStocks(watchlistTickers).then((items) => ({ items })),
        isAuthenticated ? api.getPortfolio() : Promise.resolve(null),
        api.getNews(''),
      ]);

      setActiveStocks(activeResult.stocks);
      setMarketMovers({
        gainers: activeResult.gainers || [],
        losers: activeResult.losers || [],
      });
      const freshWatchlist = await refreshWatchlistPrices(watchlistResult.items);

      setWatchlist(freshWatchlist);
      setPortfolio(portfolioResult);
      setGlobalNews(newsResult.news);

      if (freshWatchlist.length) {
        const [watchlistNewsResults, watchlistEarningsResults] = await Promise.all([
          Promise.all(freshWatchlist.map((stock) => api.getNews(stock.ticker))),
          Promise.all(freshWatchlist.map((stock) => api.getEarnings(stock.ticker))),
        ]);
        setWatchlistNews(dedupeNews(watchlistNewsResults.flatMap((result) => result.news || [])));
        setWatchlistEarnings(dedupeEarnings(watchlistEarningsResults.flatMap((result) => result.earnings || [])));
      } else {
        setWatchlistNews([]);
        setWatchlistEarnings([]);
      }

      setIsLoading(false);
    }

    loadDashboard();
  }, [isAuthenticated, isSessionReady, watchlistTickers]);

  /**
   * Reloads current prices for all tickers displayed in a watchlist.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {*} items - Items being rendered, filtered, or transformed.
   * @returns {Promise<*>} A promise resolving to the refresh watchlist prices result.
   */
  async function refreshWatchlistPrices(items) {
    return Promise.all(
      items.map(async (stock) => {
        if (stock.isLivePrice) return stock;

        try {
          const result = await api.searchStock(stock.ticker);
          return result?.stock && !result.demo
            ? { ...stock, ...result.stock, isLivePrice: true, priceProvider: result.provider }
            : stock;
        } catch {
          return stock;
        }
      }),
    );
  }

  /**
   * Reloads watchlist news and earnings when the saved ticker set changes.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {Promise<*>} A promise resolving to the refresh watchlist context result.
   */
  async function refreshWatchlistContext() {
    const sourceItems = isAuthenticated
      ? (await api.getWatchlist()).items
      : await loadGuestWatchlistStocks(watchlistTickers);
    const freshWatchlist = await refreshWatchlistPrices(sourceItems);
    setWatchlist(freshWatchlist);
    const [watchlistNewsResults, watchlistEarningsResults] = await Promise.all([
      Promise.all(freshWatchlist.map((stock) => api.getNews(stock.ticker))),
      Promise.all(freshWatchlist.map((stock) => api.getEarnings(stock.ticker))),
    ]);
    const seen = new Set();
    setWatchlistNews(watchlistNewsResults.flatMap((newsResult) => newsResult.news || []).filter((item) => {
      const key = item.id || item.url || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
    const seenEarnings = new Set();
    setWatchlistEarnings(watchlistEarningsResults.flatMap((earningsResult) => earningsResult.earnings || []).filter((item) => {
      const key = `${item.ticker}-${item.date}-${item.time}`;
      if (seenEarnings.has(key)) return false;
      seenEarnings.add(key);
      return true;
    }));
  }

  /**
   * Switches the ticker between its supported states.
   * Keeping the state transition named makes interactive behavior easier to trace.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {Promise<void>} A promise that resolves after the toggle ticker side effects finish.
   */
  async function toggleTicker(ticker) {
    const isSaved = watchlist.some((stock) => stock.ticker === ticker);

    if (!isAuthenticated) {
      if (isSaved) {
        removeGuestTicker(ticker);
        showToast(`${ticker} removed from this temporary guest watchlist.`, 'info');
      } else {
        addGuestTicker(ticker);
        showToast(`${ticker} added temporarily. Refreshing will clear guest changes.`, 'success');
      }
      return;
    }

    if (isSaved) {
      await api.removeWatchlist(ticker);
      showToast(`${ticker} removed from your watchlist.`, 'info');
    } else {
      await api.addWatchlist(ticker);
      showToast(`${ticker} added to your watchlist.`, 'success');
    }

    await refreshWatchlistContext();
  }

  /**
   * Renders the news list from the current data and interface state.
   * A render helper keeps repeated interface branches readable.
   * @param {*} items - Items being rendered, filtered, or transformed.
   * @param {string} emptyMessage - Message shown when the supplied collection has no items.
   * @param {string} layout - Visual arrangement selected for the rendered items.
   * @returns {JSX.Element} The rendered news list interface.
   */
  function renderNewsList(items, emptyMessage, layout = 'inline-symbol') {
    if (!items.length) {
      return <p className="muted">{emptyMessage}</p>;
    }

    return (
      <div className="news-list scroll-panel">
        {items.map((item) => {
          const newsTicker = getNewsTicker(item);

          return (
            <a className={`news-row ${layout === 'left-identity' ? 'news-row-left-identity' : ''}`} href={item.url} target="_blank" rel="noreferrer" key={item.id || item.url || item.title}>
              {layout === 'left-identity' && newsTicker && (
                <span className="news-row-side-identity" aria-label={`${newsTicker} related news`}>
                  <StockLogo ticker={newsTicker} logo={item.logo} company={item.company} size={28} />
                  <span>
                    <strong>{newsTicker}</strong>
                    {item.company && <small className="muted">{item.company}</small>}
                  </span>
                </span>
              )}
              <div className="news-row-copy">
                <strong>{item.title}</strong>
                <p className="muted">{item.summary}</p>
                <span className="news-row-meta">
                  <small className="muted">{item.source} - {item.publishedAt}</small>
                  {layout !== 'left-identity' && newsTicker && (
                    <span className="news-row-symbol" aria-label={`${newsTicker} related news`}>
                      <StockLogo ticker={newsTicker} logo={item.logo} company={item.company} size={22} />
                      <span>
                        <strong>{newsTicker}</strong>
                        {item.company && <small className="muted">{item.company}</small>}
                      </span>
                    </span>
                  )}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  /**
   * Checks whether the current ticker is already present in the watchlist.
   * Keeping the condition in one predicate makes branching rules consistent and self-contained.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {boolean} True when the condition is satisfied; otherwise false.
   */
  function isWatchlisted(ticker) {
    return watchlist.some((stock) => stock.ticker === ticker);
  }

  /**
   * Renders the mover list from the current data and interface state.
   * A render helper keeps repeated interface branches readable.
   * @param {string} title - Display title used by the generated content.
   * @param {*} items - Items being rendered, filtered, or transformed.
   * @param {string} emptyMessage - Message shown when the supplied collection has no items.
   * @returns {JSX.Element} The rendered mover list interface.
   */
  function renderMoverList(title, items, emptyMessage) {
    return (
      <div className="mover-panel">
        <h3>{title}</h3>
        {items.length ? (
          <div className="mover-list">
            {items.map((stock) => (
              <button className="mover-row" key={stock.ticker} type="button" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                <StockIdentity stock={stock} size={32} />
                <span>
                  <strong className={getChangeClass(stock.change)}>{formatPercent(stock.change)}</strong>
                  <small className="muted">{formatCurrency(stock.price)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{emptyMessage}</p>
        )}
      </div>
    );
  }

  /**
   * Renders the ticker tape from the current data and interface state.
   * A render helper keeps repeated interface branches readable.
   * @returns {JSX.Element} The rendered ticker tape interface.
   */
  function renderTickerTape() {
    const tickerItems = activeStocks.length ? activeStocks : [];
    const tapeItems = [...tickerItems, ...tickerItems];

    if (!tickerItems.length) {
      return <Skeleton rows={2} />;
    }

    return (
      <GlassCard className="ticker-tape-card">
        <div className="ticker-tape-shell" aria-label="Moving active stock ticker tape">
          <div className="ticker-tape-track">
            {tapeItems.map((stock, index) => (
              <button
                className="ticker-tape-item"
                key={`${stock.ticker}-${index}`}
                type="button"
                onClick={() => navigate(`/stock/${stock.ticker}`)}
              >
                <StockLogo stock={stock} size={24} />
                <strong>{stock.ticker}</strong>
                <span>{formatCurrency(stock.price)}</span>
                <span className={getChangeClass(stock.change)}>{formatPercent(stock.change)}</span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  /**
   * Renders the earnings ticker from the current data and interface state.
   * A render helper keeps repeated interface branches readable.
   * @param {*} items - Items being rendered, filtered, or transformed.
   * @param {string} emptyMessage - Message shown when the supplied collection has no items.
   * @returns {JSX.Element} The rendered earnings ticker interface.
   */
  function renderEarningsTicker(items, emptyMessage) {
    if (!items.length) {
      return <p className="muted">{emptyMessage}</p>;
    }

    const tickerItems = [...items, ...items, ...items];

    return (
      <div className="market-earnings-ticker" aria-label="Moving upcoming earnings list">
        <div className="market-earnings-track">
          {tickerItems.map((item, index) => (
            <button
              className="market-earnings-row"
              key={`${item.ticker}-${item.date}-${index}`}
              type="button"
              onClick={() => navigate(`/stock/${item.ticker}`)}
            >
              <span>
                <span className="ticker-chip-with-logo ticker-chip-plain">
                  <StockLogo stock={item} ticker={item.ticker} size={24} />
                  <strong>{item.ticker}</strong>
                </span>
                <small className="muted">{getEarningsCompanyLabel(item)}</small>
              </span>
              <span>
                <strong>{item.date}</strong>
                <small className="muted">{item.time}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <GlassCard variant="glow">
        <div className="content-grid" style={{ alignItems: 'center' }}>
          <div className="span-8 hero-copy">
            <h1 className="page-title" style={{ margin: '18px 0 12px' }}>StockPulse</h1>
            <p className="muted" style={{ maxWidth: 680, fontSize: '1.08rem' }}>
              A virtual trading platform for students and aspiring investors to explore the market, practise trading, and build confidence without risking real money.
            </p>
            <div className="hero-pulse-grid" aria-label="Dashboard market pulse">
              {heroPulseItems.map(({ label, value, detail, icon: Icon, route, detailClass, stock: pulseStock }) => (
                <button className="hero-pulse-item" key={label} type="button" onClick={() => navigate(route)}>
                  <span className="hero-pulse-icon">
                    {pulseStock ? <StockLogo stock={pulseStock} ticker={value} size={24} /> : <Icon size={17} />}
                  </span>
                  <span className="hero-pulse-text">
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <span className={detailClass || ''}>{detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="span-4">
            <GlassCard variant="compact" className="hero-portfolio-card">
              <div className="section-title">
                <h2>Portfolio Snapshot</h2>
                <WalletCards className="positive" />
              </div>
              {portfolio ? (
                <div className="portfolio-metrics-list">
                  <div className="portfolio-metric-row">
                    <span className="muted">Virtual cash</span>
                    <strong>{formatCurrency(portfolio.virtualCash)}</strong>
                  </div>
                  <div className="portfolio-metric-row">
                    <span className="muted">Total value</span>
                    <strong>{formatCurrency(portfolio.totalValue)}</strong>
                    <small className={getChangeClass(portfolio.totalProfitLossPercent)}>
                      {Number(portfolio.totalProfitLossPercent) >= 0 ? '+' : ''}
                      {Number(portfolio.totalProfitLossPercent).toFixed(2)}% today
                    </small>
                  </div>
                  <Button className="full-width-button" onClick={() => navigate('/portfolio')}>Open portfolio</Button>
                </div>
              ) : isAuthenticated ? (
                <Skeleton rows={4} />
              ) : (
                <div className="guest-account-prompt">
                  <p className="muted">Sign in to access your virtual portfolio, saved stocks, and paper trades.</p>
                  <Button variant="secondary" onClick={() => navigate('/login')}><LogIn size={16} />Log in to start</Button>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </GlassCard>

      {renderTickerTape()}

      <div className="dashboard-grid">
        <div className="page-stack dashboard-main-column">
          <GlassCard className="market-activity-card">
            <div className="section-title market-activity-title">
              <h2>Top Active Stocks by Volume</h2>
              <Select
                className="industry-select"
                id="industry-filter"
                label="Industry filter"
                value={selectedIndustry}
                options={industryOptions}
                onValueChange={setSelectedIndustry}
              />
            </div>
            {isLoading ? (
              <Skeleton rows={6} />
            ) : (
              <div className="market-activity-stack">
                <div className="table-wrap active-stocks-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Company</th>
                        <th>Industry</th>
                        <th>Price</th>
                        <th>Change</th>
                        <th>Volume</th>
                        <th>Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleActiveStocks.map((stock) => (
                        <tr key={stock.ticker}>
                          <td>
                            <button className="chip ticker-chip-with-logo" type="button" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                              <StockLogo stock={stock} size={22} />
                              {stock.ticker}
                            </button>
                          </td>
                          <td>{stock.company}</td>
                          <td>{getIndustryName(stock)}</td>
                          <td>{formatCurrency(stock.price)}</td>
                          <td className={getChangeClass(stock.change)}>{formatPercent(stock.change)}</td>
                          <td>{formatCompactNumber(stock.volume)}</td>
                          <td>
                            <Button
                              className={`star-action ${isWatchlisted(stock.ticker) ? 'saved' : ''}`}
                              variant="ghost"
                              iconOnly
                              aria-label={`${isWatchlisted(stock.ticker) ? 'Remove' : 'Add'} ${stock.ticker} ${isWatchlisted(stock.ticker) ? 'from' : 'to'} ${isAuthenticated ? 'watchlist' : 'temporary guest watchlist'}`}
                              title={isAuthenticated ? 'Update watchlist' : 'Temporary until refresh'}
                              onClick={() => toggleTicker(stock.ticker)}
                            >
                              <Star size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mover-grid">
                  {renderMoverList('Top 3 Gainers', topGainers, 'No day gainers returned yet.')}
                  {renderMoverList('Top 3 Losers', topLosers, 'No day losers returned yet.')}
                </div>
              </div>
            )}
          </GlassCard>

        </div>

        <aside className="page-stack dashboard-sidebar">
          <GlassCard className="dashboard-side-card watchlist-preview-card">
            <div className="section-title">
              <h2>Watchlist Preview</h2>
            </div>
            {watchlist.length ? (
              <div className="scroll-panel watchlist-preview-list">
                {watchlist.map((stock) => (
                  <button className="chip watchlist-preview-chip" key={stock.ticker} type="button" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                    <StockIdentity stock={stock} size={26} compact subtitle={formatCurrency(stock.price)} />
                    <span className={getChangeClass(stock.change)}>{formatPercent(stock.change)}</span>
                  </button>
                ))}
              </div>
            ) : isAuthenticated ? (
              <EmptyState title="No watchlist yet" message="Add your first stock to start tracking." actionLabel="Search stocks" onAction={() => navigate('/stock/AAPL')} />
            ) : (
              <EmptyState title="Temporary watchlist is empty" message="Add stocks while browsing. Guest favorites reset when the page refreshes." actionLabel="Search stocks" onAction={() => navigate('/stock/AAPL')} />
            )}
          </GlassCard>

          <GlassCard className="dashboard-side-card market-earnings-card">
            <div className="section-title">
              <h2>Watchlist Upcoming Earnings</h2>
              <CalendarClock size={18} className="muted" />
            </div>
            {renderEarningsTicker(watchlistEarnings, 'Add stocks to your watchlist to see their upcoming earnings.')}
          </GlassCard>
        </aside>
      </div>

      <div className="content-grid dashboard-bottom-grid">
        <div className="span-6">
          <GlassCard className="dashboard-bottom-card">
            <div className="section-title">
              <h2>Global Market News</h2>
              <Newspaper size={20} className="muted" />
            </div>
            {renderNewsList(globalNews, 'No global market news found.')}
          </GlassCard>
        </div>
        <div className="span-6">
          <GlassCard className="dashboard-bottom-card">
            <div className="section-title">
              <h2>Watchlist News</h2>
              <Star size={20} className="gold" />
            </div>
            {renderNewsList(watchlistNews, 'Add stocks to your watchlist to see related news here.', 'left-identity')}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
