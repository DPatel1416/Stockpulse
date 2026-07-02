/**
 * File purpose: Assembles the Watchlist screen from reusable components, API data, and page-specific interactions.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Activity, BadgeCheck, CalendarClock, Plus, Star, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import Select from '../components/ui/Select';
import StockLogo, { StockIdentity } from '../components/stock/StockLogo';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../context/GuestSessionContext';
import { api } from '../services/api';
import { formatCurrency, formatPercent, getChangeClass } from '../utils/format';
import { loadGuestWatchlistStocks } from '../utils/guestWatchlist';

/**
 * Returns the display company name needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} stock - Normalized stock quote and company details.
 * @returns {string} A clean company name suitable for the watchlist interface.
 */
function getDisplayCompanyName(stock) {
  const company = String(stock?.company || '').trim();
  return company && !company.includes('Demo Company') ? company : stock.ticker;
}

/**
 * Converts the watchlist items into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {Array<object>} watchlistItems - Saved watchlist records to enrich with quotes.
 * @returns {*} The normalized watchlist items result.
 */
function normalizeWatchlistItems(watchlistItems) {
  return watchlistItems.map((stock) => {
    const currentPrice = Number(stock?.currentPrice ?? stock?.price);

    return {
      ...stock,
      company: getDisplayCompanyName(stock),
      price: Number.isFinite(currentPrice) ? currentPrice : stock.price,
    };
  });
}

/**
 * Reloads current prices for all tickers displayed in a watchlist.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Array<object>} watchlistItems - Saved watchlist records to enrich with quotes.
 * @returns {Promise<*>} A promise resolving to the refresh watchlist prices result.
 */
async function refreshWatchlistPrices(watchlistItems) {
  return Promise.all(
    watchlistItems.map(async (stock) => {
      if (stock.isLivePrice) return stock;

      try {
        const result = await api.searchStock(stock.ticker);

        if (result?.stock && !result.demo) {
          return {
            ...stock,
            ...result.stock,
            currentPrice: result.stock.price,
            isLivePrice: true,
            priceProvider: result.provider,
          };
        }
      } catch {
        // Keep the last known quote when a refresh request is temporarily unavailable.
      }

      return stock;
    }),
  );
}

/**
 * Returns the next earnings needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Array<object>} earnings - Raw or normalized earnings records.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {*} The requested next earnings result.
 */
function getNextEarnings(earnings, ticker) {
  return earnings
    .filter((item) => item.ticker === ticker)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))[0];
}

/**
 * Returns the move position needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {number} change - Percentage price movement.
 * @returns {*} The requested move position result.
 */
function getMovePosition(change) {
  const numericChange = Number(change);
  if (!Number.isFinite(numericChange)) return 50;
  return Math.max(6, Math.min(94, 50 + (numericChange / 8) * 44));
}

/**
 * Formats the firm action for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {string} action - Provider rating action to convert into friendly wording.
 * @returns {string} The formatted value ready for display.
 */
function formatFirmAction(action) {
  const labels = {
    down: 'Downgraded',
    init: 'Initiated',
    main: 'Maintained',
    reit: 'Reiterated',
    up: 'Upgraded',
  };

  return labels[String(action || '').toLowerCase()] || action || 'Rating update';
}

// Watchlist stores the tickers a learner wants to monitor between sessions.
/**
 * Renders the watchlist React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Watchlist() {
  const navigate = useNavigate();
  const { openInsight } = useOutletContext();
  const { showToast } = useToasts();
  const { isAuthenticated, isSessionReady } = useAuth();
  const { watchlistTickers, addGuestTicker, removeGuestTicker } = useGuestSession();
  const [items, setItems] = useState([]);
  const [news, setNews] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [selectedTargetTicker, setSelectedTargetTicker] = useState('');
  const [selectedFirmTicker, setSelectedFirmTicker] = useState('');
  const [targetData, setTargetData] = useState({ consensus: null, message: null });
  const [firmData, setFirmData] = useState({ firms: [], message: null });
  const [ticker, setTicker] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Refreshes watchlist quotes, related news, earnings, and analyst data.
   * One coordinated request cycle keeps every panel based on the same set of watched tickers.
   * @param {boolean} showLoading - Whether to show the full loading state during the refresh.
   * @returns {Promise<void>} A promise that resolves after all watchlist panels are updated.
   */
  const refresh = useCallback(async (showLoading = false) => {
    if (!isSessionReady) return;
    if (showLoading) setIsLoading(true);
    const watchlistResult = isAuthenticated
      ? await api.getWatchlist()
      : { items: await loadGuestWatchlistStocks(watchlistTickers) };
    const freshItems = await refreshWatchlistPrices(watchlistResult.items || []);
    setItems(normalizeWatchlistItems(freshItems));

    if (freshItems.length) {
      const [newsResults, earningsResults] = await Promise.all([
        Promise.all(freshItems.map((stock) => api.getNews(stock.ticker))),
        Promise.all(freshItems.map((stock) => api.getEarnings(stock.ticker))),
      ]);
      const uniqueNews = new Map();
      const uniqueEarnings = new Map();

      newsResults.flatMap((result) => result.news || []).forEach((item) => {
        uniqueNews.set(item.id || item.url || `${item.ticker}-${item.title}`, item);
      });
      earningsResults.flatMap((result) => result.earnings || []).forEach((item) => {
        uniqueEarnings.set(`${item.ticker}-${item.date}`, item);
      });

      setNews([...uniqueNews.values()]);
      setEarnings([...uniqueEarnings.values()]);
    } else {
      setNews([]);
      setEarnings([]);
    }

    if (showLoading) setIsLoading(false);
  }, [isAuthenticated, isSessionReady, watchlistTickers]);

  useEffect(() => {
    if (!isSessionReady) return undefined;
    refresh(true);
    const refreshTimer = window.setInterval(() => refresh(false), 60_000);

    return () => window.clearInterval(refreshTimer);
  }, [isSessionReady, refresh]);

  useEffect(() => {
    if (!items.length) {
      setSelectedTargetTicker('');
      setSelectedFirmTicker('');
      return;
    }

    if (!items.some((item) => item.ticker === selectedTargetTicker)) {
      setSelectedTargetTicker(items[0].ticker);
    }

    if (!items.some((item) => item.ticker === selectedFirmTicker)) {
      setSelectedFirmTicker(items[0].ticker);
    }
  }, [items, selectedFirmTicker, selectedTargetTicker]);

  useEffect(() => {
    let isActive = true;

    if (!selectedTargetTicker) {
      setTargetData({ consensus: null, message: null });
      return undefined;
    }

    setTargetData({ consensus: null, message: 'Loading analyst targets...' });
    api.getPriceTargets(selectedTargetTicker).then((result) => {
      if (isActive) setTargetData({ consensus: result.consensus, message: result.message });
    });

    return () => {
      isActive = false;
    };
  }, [selectedTargetTicker]);

  useEffect(() => {
    let isActive = true;

    if (!selectedFirmTicker) {
      setFirmData({ firms: [], message: null });
      return undefined;
    }

    setFirmData({ firms: [], message: 'Loading firm ratings...' });
    api.getPriceTargets(selectedFirmTicker).then((result) => {
      if (isActive) setFirmData({ firms: result.firms || [], message: result.message });
    });

    return () => {
      isActive = false;
    };
  }, [selectedFirmTicker]);

  /**
   * Adds the stock while preventing inconsistent duplicate state.
   * A named mutation makes duplicate checks and side effects consistent.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the add stock side effects finish.
   */
  async function addStock(event) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) return;

    if (isAuthenticated) {
      await api.addWatchlist(normalizedTicker);
      showToast(`${normalizedTicker} added to watchlist.`, 'success');
    } else {
      const result = await api.searchStock(normalizedTicker);
      addGuestTicker(result.stock.ticker);
      showToast(`${result.stock.ticker} added temporarily. Refreshing will clear guest changes.`, 'success');
    }
    setTicker('');
    if (isAuthenticated) refresh(false);
  }

  /**
   * Removes the stock and performs its required cleanup.
   * A dedicated removal path keeps cleanup behavior consistent.
   * @param {string} symbol - Ticker symbol identifying the stock.
   * @returns {Promise<void>} A promise that resolves after the remove stock side effects finish.
   */
  async function removeStock(symbol) {
    if (isAuthenticated) {
      await api.removeWatchlist(symbol);
      showToast(`${symbol} removed from watchlist.`, 'info');
      refresh(false);
    } else {
      removeGuestTicker(symbol);
      showToast(`${symbol} removed from this temporary guest watchlist.`, 'info');
    }
  }

  const advancingCount = items.filter((stock) => Number(stock.change) > 0).length;
  const nextWatchlistReport = earnings
    .filter((item) => items.some((stock) => stock.ticker === item.ticker))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))[0];

  return (
    <div className="page-stack">
      <GlassCard variant="glow">
        <div className="section-title">
          <div>
            <span className="chip">Saved tickers</span>
            <h1 className="page-title" style={{ margin: '14px 0 8px' }}>Watchlist</h1>
            <p className="muted">Monitor prices, volume, news, and earnings for stocks you are learning about.</p>
          </div>
          <Button onClick={() => openInsight({ screen: 'Watchlist', tickers: items.map((item) => item.ticker) })}>Ask AI</Button>
        </div>
        <form onSubmit={addStock} style={{ display: 'flex', gap: 10, alignItems: 'end', maxWidth: 520 }}>
          <Input label="Add stock" name="watchlist-ticker" placeholder="Ticker symbol" value={ticker} onChange={(event) => setTicker(event.target.value)} />
          <Button type="submit"><Plus size={18} /> <span style={{ marginLeft: 8 }}>Add</span></Button>
        </form>
      </GlassCard>

      {isLoading ? (
        <Skeleton rows={4} />
      ) : items.length ? (
        <GlassCard className="watchlist-list-card">
          <div className="section-title">
            <div>
              <h2>Watchlist Pulse</h2>
              <p className="muted">Live prices and the next known company events.</p>
            </div>
            <Star size={20} className="gold" />
          </div>
          <div className="watchlist-pulse-summary" aria-label="Watchlist summary">
            <span><Activity size={17} /><small>Tracking</small><strong>{items.length} stocks</strong></span>
            <span><TrendingUp size={17} /><small>Advancing</small><strong>{advancingCount} today</strong></span>
            <span><CalendarClock size={17} /><small>Next report</small><strong>{nextWatchlistReport ? `${nextWatchlistReport.ticker} | ${nextWatchlistReport.date}` : 'Not announced'}</strong></span>
          </div>
          <div className="watchlist-row-list">
            {items.map((stock) => {
              const nextEarnings = getNextEarnings(earnings, stock.ticker);

              return (
                <div className="watchlist-row" key={stock.ticker}>
                  <button className="watchlist-row-main" type="button" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                    <StockIdentity className="watchlist-stock-identity" stock={stock} company={getDisplayCompanyName(stock)} size={36} />
                    <span className="watchlist-row-earnings">
                      <small className="muted">Upcoming earnings</small>
                      <strong>{nextEarnings?.date || 'Not announced'}</strong>
                      <small className="muted">
                        {nextEarnings
                          ? `${nextEarnings.time || 'Time unavailable'} | EPS ${nextEarnings.epsEstimate ? `$${nextEarnings.epsEstimate}` : 'not available'}`
                          : 'No live earnings date available'}
                      </small>
                    </span>
                    <span className="watchlist-row-price">
                      <strong>{formatCurrency(stock.price)}</strong>
                      <small className={getChangeClass(stock.change)}>
                        {Number(stock.change) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {formatPercent(stock.change)}
                      </small>
                    </span>
                    <span className="watchlist-row-move" aria-hidden="true">
                      <i className={getChangeClass(stock.change)} style={{ left: `${getMovePosition(stock.change)}%` }} />
                    </span>
                  </button>
                  <Button variant="ghost" iconOnly aria-label={`Remove ${stock.ticker}`} onClick={() => removeStock(stock.ticker)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : (
        <EmptyState title="Add your first stock" message="Search a ticker to start tracking price, news, and earnings." actionLabel="Try AAPL" onAction={() => setTicker('AAPL')} />
      )}

      <div className="dashboard-grid watchlist-context-grid">
        <GlassCard className="watchlist-context-card" bodyClassName="watchlist-context-body">
          <h2>Watchlist News Feed</h2>
          <div className="watchlist-context-list scroll-panel">
            {news.length ? news.map((item) => (
              <a
                className="watchlist-context-item"
                href={item.url || `/stock/${item.ticker}`}
                key={item.id || item.url || `${item.ticker}-${item.title}`}
                target={item.url ? '_blank' : undefined}
                rel={item.url ? 'noreferrer' : undefined}
              >
                <span>
                  <span className="ticker-chip-with-logo ticker-chip-plain">
                    <StockLogo ticker={item.ticker || 'MARKET'} logo={item.logo} size={24} />
                    <strong>{item.ticker || 'MARKET'}</strong>
                  </span>
                  <small className="muted">{item.source || 'Market news'}</small>
                </span>
                <p>{item.title}</p>
              </a>
            )) : <p className="muted watchlist-context-empty">No watchlist news is available right now.</p>}
          </div>
        </GlassCard>
        <GlassCard className="watchlist-context-card" bodyClassName="watchlist-context-body watchlist-target-body">
          <div className="watchlist-target-header">
            <span><Target size={18} className="positive" /><h2>Analyst Price Targets</h2></span>
            <Select
              ariaLabel="Price target stock"
              className="watchlist-card-ticker-select"
              value={selectedTargetTicker}
              options={items.map((stock) => ({ value: stock.ticker, label: stock.ticker }))}
              onValueChange={setSelectedTargetTicker}
            />
          </div>
          <div className="price-target-scroll scroll-panel">
            {targetData.consensus && (
              <div className="price-target-summary">
                {[
                  ['High estimate', targetData.consensus.high],
                  ['Mean estimate', targetData.consensus.mean],
                  ['Median estimate', targetData.consensus.median],
                  ['Low estimate', targetData.consensus.low],
                ].map(([label, value]) => (
                  <div className="price-target-row" key={label}><span>{label}</span><strong>{value ? formatCurrency(value) : '--'}</strong></div>
                ))}
              </div>
            )}
            {!targetData.consensus && <p className="muted watchlist-context-empty">{targetData.message || 'No analyst target data is available.'}</p>}
          </div>
        </GlassCard>
        <GlassCard className="watchlist-context-card" bodyClassName="watchlist-context-body watchlist-firm-body">
          <div className="watchlist-firm-header">
            <span><BadgeCheck size={18} className="positive" /><h2>Latest Firm Ratings</h2></span>
            <Select
              ariaLabel="Firm rating stock"
              className="watchlist-card-ticker-select"
              value={selectedFirmTicker}
              options={items.map((stock) => ({ value: stock.ticker, label: stock.ticker }))}
              onValueChange={setSelectedFirmTicker}
            />
          </div>
          <div className="firm-rating-scroll scroll-panel">
            {firmData.firms?.length ? firmData.firms.map((firm, index) => (
              <div className="analyst-firm-row" key={`${firm.company}-${firm.date || index}`}>
                <span>
                  <strong>{firm.company}</strong>
                  <small className="muted">{firm.date ? new Date(firm.date).toLocaleDateString('en-CA') : 'Date unavailable'}</small>
                </span>
                <span>
                  <strong>{firm.toGrade}</strong>
                  <small className="muted">{formatFirmAction(firm.action)}</small>
                </span>
              </div>
            )) : <p className="muted watchlist-context-empty">{firmData.message || 'No current firm ratings are available for this stock.'}</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
