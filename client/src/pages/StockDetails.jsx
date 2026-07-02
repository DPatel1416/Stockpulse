/**
 * File purpose: Assembles the Stock Details screen from reusable components, API data, and page-specific interactions.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Maximize2, Minimize2, Star, TrendingUp } from 'lucide-react';
import EarningsCard from '../components/stock/EarningsCard';
import NewsCard from '../components/stock/NewsCard';
import StockChart from '../components/stock/StockChart';
import StockLogo from '../components/stock/StockLogo';
import TradeTicket from '../components/trading/TradeTicket';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import GlassCard from '../components/ui/GlassCard';
import Skeleton from '../components/ui/Skeleton';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGuestSession } from '../context/GuestSessionContext';
import { api } from '../services/api';
import { formatCurrency, formatPercent, getChangeClass } from '../utils/format';

/**
 * Returns the chart tone class needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Array<object>} points - Timestamped chart or performance points.
 * @param {object} fallbackStock - Stock record used when live history is unavailable.
 * @returns {string} A positive, negative, or neutral stock-tone CSS class.
 */
function getChartToneClass(points, fallbackStock) {
  const chartPrices = (points || [])
    .map((point) => Number(point.close ?? point.price))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (chartPrices.length >= 2) {
    const firstPrice = chartPrices[0];
    const lastPrice = chartPrices.at(-1);
    if (lastPrice > firstPrice) return 'stock-tone-positive';
    if (lastPrice < firstPrice) return 'stock-tone-negative';
  }

  const fallbackChange = Number(fallbackStock?.change || 0);
  if (fallbackChange > 0) return 'stock-tone-positive';
  if (fallbackChange < 0) return 'stock-tone-negative';
  return 'stock-tone-neutral';
}

// StockDetails focuses the learner on one ticker: chart, stats, news, earnings, trading, and AI context.
/**
 * Renders the stock details React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function StockDetails() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { openInsight } = useOutletContext();
  const { showToast } = useToasts();
  const { isAuthenticated, isSessionReady } = useAuth();
  const { watchlistTickers, addGuestTicker, removeGuestTicker } = useGuestSession();
  const [stock, setStock] = useState(null);
  const [chart, setChart] = useState([]);
  const [chartInfo, setChartInfo] = useState(null);
  const [chartUpdatedAt, setChartUpdatedAt] = useState(null);
  const [weekRange, setWeekRange] = useState(null);
  const [news, setNews] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [range, setRange] = useState('1M');
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [newsCardHeight, setNewsCardHeight] = useState(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    /**
     * Loads the stock and prepares it for the current workflow.
     * Separating loading from rendering keeps asynchronous state easier to follow.
     * @returns {Promise<*>} A promise resolving to the loaded stock result.
     */
    async function loadStock() {
      if (!isSessionReady) return;

      setIsLoading(true);
      setStock(null);
      setChart([]);
      setChartInfo(null);
      setIsChartExpanded(false);

      try {
        const [stockResult, newsResult, earningsResult, portfolioResult, watchlistResult] = await Promise.all([
          api.searchStock(ticker),
          api.getNews(ticker),
          api.getEarnings(ticker),
          isAuthenticated ? api.getPortfolio() : Promise.resolve(null),
          isAuthenticated ? api.getWatchlist() : Promise.resolve({ items: [] }),
        ]);

        if (!isActive) return;
        setStock(stockResult.stock);
        setNews(newsResult.news);
        setEarnings(earningsResult.earnings);
        setPortfolio(portfolioResult);
        setIsInWatchlist(watchlistResult.items.some((item) => item.ticker === stockResult.stock.ticker));
      } catch {
        if (isActive) setStock(null);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadStock();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, isSessionReady, ticker]);

  useEffect(() => {
    if (!isAuthenticated) setIsInWatchlist(watchlistTickers.includes(String(ticker || '').toUpperCase()));
  }, [isAuthenticated, ticker, watchlistTickers]);

  useEffect(() => {
    let isActive = true;
    setIsChartLoading(true);

    api.getChart(ticker, range)
      .then((chartResult) => {
        if (!isActive) return;
        setChart(chartResult.points || []);
        setChartInfo(chartResult);
        setChartUpdatedAt(chartResult.updatedAt || chartResult.lastUpdatedAt || new Date().toISOString());
      })
      .catch(() => {
        // Keep the previous chart visible if a range refresh is temporarily unavailable.
      })
      .finally(() => {
        if (isActive) setIsChartLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [range, ticker]);

  useEffect(() => {
    if (!isChartExpanded) return undefined;

    /**
     * Handles the escape interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle escape state changes are applied.
     */
    function handleEscape(event) {
      if (event.key === 'Escape') setIsChartExpanded(false);
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isChartExpanded]);

  useEffect(() => {
    let isActive = true;

    api.getChart(ticker, '1Y').then((result) => {
      if (!isActive) return;
      const highs = (result.points || []).map((point) => Number(point.high ?? point.price)).filter((value) => Number.isFinite(value) && value > 0);
      const lows = (result.points || []).map((point) => Number(point.low ?? point.price)).filter((value) => Number.isFinite(value) && value > 0);
      const closes = (result.points || []).map((point) => Number(point.close ?? point.price)).filter((value) => Number.isFinite(value) && value > 0);

      setWeekRange(highs.length && lows.length && closes.length ? {
        high: Math.max(...highs),
        low: Math.min(...lows),
        average: closes.reduce((sum, value) => sum + value, 0) / closes.length,
      } : null);
    });

    return () => {
      isActive = false;
    };
  }, [ticker]);

  const volumeInsight = useMemo(() => {
    if (!stock) return '';
    const ratio = stock.volume / stock.avgVolume;
    if (ratio > 1.2) return 'Today volume is higher than average, which means more shares are changing hands than usual.';
    if (ratio < 0.8) return 'Today volume is below average, so price moves may be happening with lighter activity.';
    return 'Today volume is close to average, suggesting normal trading activity for this stock.';
  }, [stock]);
  const stockToneClass = useMemo(() => getChartToneClass(chart, stock), [chart, stock]);

  useLayoutEffect(() => {
    if (isLoading) return undefined;

    /**
     * Updates the news card height while preserving related state invariants.
     * Keeping mutation rules together protects related state from drifting out of sync.
     * @returns {void|*} No value is required; the update news card height state changes are applied.
     */
    function updateNewsCardHeight() {
      const isSingleColumn = window.matchMedia('(max-width: 1180px)').matches;
      const sidebarHeight = sidebarRef.current?.getBoundingClientRect().height || 0;

      if (isSingleColumn) {
        setNewsCardHeight(null);
        return;
      }

      if (!sidebarHeight) return;

      setNewsCardHeight(Math.max(520, Math.round(sidebarHeight)));
    }

    updateNewsCardHeight();

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateNewsCardHeight);
    if (resizeObserver) {
      if (sidebarRef.current) resizeObserver.observe(sidebarRef.current);
    }

    window.addEventListener('resize', updateNewsCardHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateNewsCardHeight);
    };
  }, [earnings.length, isLoading, news.length, portfolio]);

  /**
   * Switches the watchlist between its supported states.
   * Keeping the state transition named makes interactive behavior easier to trace.
   * @returns {Promise<void>} A promise that resolves after the toggle watchlist side effects finish.
   */
  async function toggleWatchlist() {
    if (!isAuthenticated) {
      if (isInWatchlist) {
        removeGuestTicker(stock.ticker);
        showToast(`${stock.ticker} removed from this temporary guest watchlist.`, 'info');
      } else {
        addGuestTicker(stock.ticker);
        showToast(`${stock.ticker} added temporarily. Refreshing will clear guest changes.`, 'success');
      }
      return;
    }

    if (isInWatchlist) {
      await api.removeWatchlist(stock.ticker);
      setIsInWatchlist(false);
      showToast(`${stock.ticker} removed from your watchlist.`, 'info');
      return;
    }

    await api.addWatchlist(stock.ticker);
    setIsInWatchlist(true);
    showToast(`${stock.ticker} saved to your watchlist.`, 'success');
  }

  if (isLoading) {
    return <Skeleton rows={8} />;
  }

  if (!stock) {
    return <EmptyState title="Ticker not found" message="Search again with a valid stock ticker." actionLabel="Back to dashboard" onAction={() => navigate('/')} />;
  }

  return (
    <div className={`page-stack stock-detail-page ${stockToneClass}`}>
      <GlassCard variant="glow">
        <div className="section-title">
          <Button variant="ghost" iconOnly aria-label="Back to dashboard" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </Button>
          <Button className={`star-action ${isInWatchlist ? 'saved' : ''}`} variant="ghost" onClick={toggleWatchlist}>
            <Star size={17} />
            <span style={{ marginLeft: 8 }}>{isInWatchlist ? 'Saved' : isAuthenticated ? 'Watchlist' : 'Save temporarily'}</span>
          </Button>
        </div>
        <div className="content-grid" style={{ alignItems: 'end' }}>
          <div className="span-8">
            <span className="chip ticker-chip-with-logo">
              <StockLogo stock={stock} size={22} />
              {stock.ticker} - Market open
            </span>
            <div className="stock-detail-heading">
              <StockLogo stock={stock} size={58} />
              <h1 className="page-title" style={{ margin: '14px 0 8px' }}>{stock.company}</h1>
            </div>
            <p className="muted">Study price, volume, earnings, news, and order workflows.</p>
          </div>
          <div className="span-4">
            <strong style={{ display: 'block', fontSize: '2.4rem' }}>{formatCurrency(stock.price)}</strong>
            <span className={getChangeClass(stock.change)}>{formatPercent(stock.change)} today</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className={`stock-detail-chart-card${isChartExpanded ? ' expanded' : ''}`}>
        <div className="section-title">
          <h2>Interactive Chart</h2>
          <div className="stock-chart-title-actions">
            <TrendingUp className="positive" />
            <Button
              variant="ghost"
              iconOnly
              aria-label={isChartExpanded ? 'Restore chart' : 'Maximize graph'}
              aria-pressed={isChartExpanded}
              title={isChartExpanded ? 'Restore chart' : 'Maximize graph'}
              onClick={() => setIsChartExpanded((current) => !current)}
            >
              {isChartExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </Button>
          </div>
        </div>
        <StockChart
          data={chart}
          range={range}
          onRangeChange={setRange}
          ticker={chartInfo?.ticker || stock.ticker}
          stock={stock}
          weekRange={weekRange}
          lastUpdatedAt={chartUpdatedAt}
          isLoading={isChartLoading}
        />
      </GlassCard>

      <div
        className="dashboard-grid stock-details-grid"
        style={newsCardHeight ? { '--stock-news-card-height': `${newsCardHeight}px` } : undefined}
      >
        <div className="page-stack stock-details-main">
          <GlassCard className="stock-news-card">
            <div className="section-title">
              <h2>Latest News</h2>
            </div>
            {news.length ? (
              <div className="stock-news-list">
                {news.map((item) => (
                  <NewsCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <EmptyState title="No recent news found" message="Try another ticker or check back later." />
            )}
          </GlassCard>
        </div>

        <aside className="page-stack stock-details-sidebar" ref={sidebarRef}>
          <GlassCard>
            <h2>Volume Insight</h2>
            <p className="muted">{volumeInsight}</p>
            <small>Educational explanation only, not financial advice.</small>
          </GlassCard>

          <GlassCard className="stock-detail-earnings-card">
            <h2>Upcoming Earnings</h2>
            <div className="stock-detail-earnings-list">
              {earnings.length ? earnings.map((item) => <EarningsCard key={item.ticker} item={item} />) : <p className="muted">No upcoming earnings found.</p>}
            </div>
          </GlassCard>

          <TradeTicket
            stock={stock}
            portfolio={portfolio}
            onTradeComplete={setPortfolio}
            requiresLogin={!isAuthenticated}
            onLoginRequired={() => navigate('/login')}
          />

          <GlassCard variant="glow">
            <h2>AI Prompts</h2>
            <p className="muted">Ask for a beginner-friendly explanation of this ticker context.</p>
            <Button onClick={() => openInsight({ screen: 'StockDetails', stock, news, earnings })}>Explain {stock.ticker}</Button>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}
