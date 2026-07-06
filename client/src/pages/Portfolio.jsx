/**
 * File purpose: Assembles the Portfolio screen from reusable components, API data, and page-specific interactions.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Area, AreaChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeftRight, Brain, ChartPie, ChartSpline, Clock3, ListChecks, Save, Trash2, WalletCards, X } from 'lucide-react';
import PaperFundingPanel from '../components/trading/PaperFundingPanel';
import PortfolioReturnsChart from '../components/trading/PortfolioReturnsChart';
import TradeTicket from '../components/trading/TradeTicket';
import StockLogo, { StockIdentity } from '../components/stock/StockLogo';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency, formatPercent, getChangeClass } from '../utils/format';
import {
  getTransactionDetail,
  getTransactionDirection,
  getTransactionLabel,
  getTransactionTypeLabel,
} from '../utils/transactions';

const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
const allocationLogoMinPercent = 0.045;
const recentTransactionLimit = 10;
const guestPortfolio = {
  virtualCash: null,
  availableBuyingPower: null,
  reservedCash: 0,
  reservedShares: {},
  investedValue: 0,
  totalValue: null,
  totalProfitLoss: 0,
  totalProfitLossPercent: 0,
  holdings: [],
  transactions: [],
  openOrders: [],
  accounts: [],
};

/**
 * Renders the stock sparkline tooltip React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function StockSparklineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip portfolio-sparkline-tooltip">
      <strong>{point.label || 'Intraday price'}</strong>
      <span>{formatCurrency(point.price)}</span>
    </div>
  );
}

/**
 * Renders the selected stock chart React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function SelectedStockChart({ stock, points }) {
  const normalizedPoints = points
    .map((point) => ({
      ...point,
      price: Number(point.close ?? point.price),
      chartTimestamp: point.timestamp ? new Date(point.timestamp).getTime() : null,
    }))
    .filter((point) => Number.isFinite(point.price) && point.price > 0);
  const referenceDate = new Date(normalizedPoints.at(-1)?.chartTimestamp || Date.now());
  const marketStartDate = new Date(referenceDate);
  marketStartDate.setHours(9, 30, 0, 0);
  const marketEndDate = new Date(referenceDate);
  marketEndDate.setHours(16, 0, 0, 0);
  const marketStart = marketStartDate.getTime();
  const marketEnd = marketEndDate.getTime();
  const intradayPoints = normalizedPoints.filter((point) => Number.isFinite(point.chartTimestamp) && point.chartTimestamp >= marketStart && point.chartTimestamp <= marketEnd);
  const firstPoint = intradayPoints[0] || normalizedPoints[0];
  const anchorPrice = Number(firstPoint?.open ?? firstPoint?.price ?? stock?.price ?? 0);
  const chartPoints = firstPoint ? [{
    ...firstPoint,
    label: '9:30 AM',
    timestamp: marketStartDate.toISOString(),
    chartTimestamp: marketStart,
    price: anchorPrice,
    volume: 0,
  }, ...intradayPoints.filter((point) => point.chartTimestamp > marketStart)] : [];
  const prices = normalizedPoints.map((point) => point.price);
  const latestPrice = prices.at(-1) ?? Number(stock?.price || 0);
  const lowPrice = prices.length ? Math.min(...prices) : latestPrice;
  const highPrice = prices.length ? Math.max(...prices) : latestPrice;
  const pricePadding = Math.max((highPrice - lowPrice) * 0.18, latestPrice * 0.0015);
  const previousClose = Number(stock?.previousClose);
  const comparisonPrice = Number.isFinite(previousClose) && previousClose > 0
    ? previousClose
    : (prices.at(0) ?? Number(stock?.price || 0));
  const isPositive = latestPrice >= comparisonPrice;
  const chartColor = isPositive ? 'var(--green)' : 'var(--red)';
  const gradientId = `portfolio-stock-${stock?.ticker || 'selected'}`;

  return (
    <div className="portfolio-mini-chart">
      <div className="portfolio-mini-chart-header">
        <span>
          <small className="muted">Intraday movement</small>
          <StockIdentity stock={stock} size={28} compact />
        </span>
        <span className={`portfolio-mini-chart-range ${isPositive ? 'positive' : 'negative'}`}>1D</span>
      </div>
      <div className="portfolio-mini-chart-canvas">
        {chartPoints.length ? (
          <ResponsiveContainer>
            <AreaChart data={chartPoints} margin={{ top: 8, right: 22, bottom: 4, left: 22 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="chartTimestamp"
                type="number"
                scale="time"
                domain={[marketStart, marketEnd]}
                ticks={[marketStart, marketStart + 2 * 60 * 60 * 1000, marketStart + 4 * 60 * 60 * 1000, marketEnd]}
                tick={{ fill: 'var(--muted)', fontSize: 9, fontWeight: 650 }}
                tickFormatter={(value) => new Date(value).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
              />
              <YAxis hide domain={[lowPrice - pricePadding, highPrice + pricePadding]} />
              {Number.isFinite(previousClose) && previousClose > 0 && (
                <ReferenceLine y={previousClose} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.58} />
              )}
              <Tooltip cursor={{ stroke: chartColor, strokeWidth: 1 }} content={<StockSparklineTooltip />} />
              <Area
                type="linear"
                dataKey="price"
                stroke={chartColor}
                fill={`url(#${gradientId})`}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--surface-strong)', stroke: chartColor, strokeWidth: 2 }}
                animationDuration={350}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : <span className="muted">Chart data is updating.</span>}
      </div>
      <div className="portfolio-mini-chart-footer">
        <span>Low <b>{prices.length ? formatCurrency(lowPrice) : '--'}</b></span>
        <span>Prev close <b>{Number.isFinite(previousClose) ? formatCurrency(previousClose) : '--'}</b></span>
        <span>High <b>{prices.length ? formatCurrency(highPrice) : '--'}</b></span>
      </div>
    </div>
  );
}

/**
 * Converts a transaction date into the yyyy-mm-dd value used by date inputs.
 * Matching against the input value keeps the filter simple and independent from browser locale text.
 * @param {*} value - Transaction date value from the portfolio ledger.
 * @returns {string} Local date string in yyyy-mm-dd format, or empty string when invalid.
 */
function getTransactionDateInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Orders transactions from newest to oldest before the table limits or filters them.
 * Sorting here keeps the backend free from presentation-only filtering rules.
 * @param {Array<object>} transactions - Portfolio transaction records.
 * @returns {Array<object>} Newest-first transaction records.
 */
function sortTransactionsNewestFirst(transactions) {
  return [...transactions].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
}
/**
 * Renders the transaction table React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function TransactionTable({ transactions }) {
  const [selectedDate, setSelectedDate] = useState('');
  const sortedTransactions = sortTransactionsNewestFirst(transactions);
  const shouldShowDateFilter = sortedTransactions.length > recentTransactionLimit;
  const filteredTransactions = selectedDate
    ? sortedTransactions.filter((transaction) => getTransactionDateInputValue(transaction.createdAt) === selectedDate)
    : sortedTransactions.slice(0, recentTransactionLimit);
  const emptyMessage = selectedDate ? 'No transactions found for that date.' : 'No orders yet.';

  return (
    <>
      {shouldShowDateFilter && (
        <div className="transaction-filter-bar" aria-label="Transaction date filter">
          <label className="transaction-date-filter">
            <span className="input-label">Filter by date</span>
            <input
              className="input transaction-filter-input"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <div className="transaction-filter-summary">
            <span className="muted">
              {selectedDate
                ? `${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'} found`
                : `Showing latest ${Math.min(recentTransactionLimit, sortedTransactions.length)} of ${sortedTransactions.length}`}
            </span>
            {selectedDate && <Button variant="ghost" onClick={() => setSelectedDate('')}>Clear</Button>}
          </div>
        </div>
      )}
      <div className="table-wrap scroll-panel portfolio-six-row-scroll">
        <table className="data-table transaction-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length ? filteredTransactions.map((transaction) => {
              const direction = getTransactionDirection(transaction);

              return (
                <tr key={transaction.id || transaction.createdAt}>
                  <td data-label="Date">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                  <td className="transaction-activity" data-label="Activity">
                    <strong>{getTransactionLabel(transaction)}</strong>
                    <small className="muted">{getTransactionDetail(transaction)}</small>
                  </td>
                  <td data-label="Type"><span className="transaction-type">{getTransactionTypeLabel(transaction)}</span></td>
                  <td className={`transaction-amount ${direction === 'IN' ? 'positive' : 'negative'}`} data-label="Amount">
                    {direction === 'IN' ? '+' : '-'}{formatCurrency(transaction.total)}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="muted" colSpan="4">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Renders the holdings card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function HoldingsCard({ portfolio, onOpenHolding, onOpenTrade }) {
  if (!portfolio.holdings.length) {
    return (
      <EmptyState
        className="portfolio-records-card portfolio-empty-holdings-card"
        title="No holdings yet"
        message="Open the Trade view to build your first position."
        actionLabel="Place your order"
        onAction={onOpenTrade}
      />
    );
  }

  return (
    <GlassCard className="portfolio-holdings-card portfolio-records-card">
      <div className="section-title">
        <h2>Holdings</h2>
        <ListChecks className="muted" />
      </div>
      <div className="table-wrap scroll-panel portfolio-six-row-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg cost</th>
              <th>Price</th>
              <th>Market value</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.map((holding) => (
              <tr key={holding.ticker} onClick={() => onOpenHolding(holding.ticker)} style={{ cursor: 'pointer' }}>
                <td className="holding-identity"><StockIdentity stock={holding} company={holding.companyName} size={30} compact /></td>
                <td className="holding-shares" data-label="Shares">{holding.shares}</td>
                <td className="holding-average" data-label="Avg cost">{formatCurrency(holding.averageCost)}</td>
                <td className="holding-price" data-label="Price">{formatCurrency(holding.currentPrice)}</td>
                <td className="holding-value" data-label="Value">{formatCurrency(holding.marketValue)}</td>
                <td className={`holding-profit ${getChangeClass(holding.profitLoss)}`} data-label="Profit / loss">{formatCurrency(holding.profitLoss)} ({formatPercent(holding.profitLossPercent)})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

/**
 * Renders the pending limit orders React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function PendingLimitOrders({ orders, onPortfolioChange }) {
  const { showToast } = useToasts();
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);

  /**
   * Opens the inline editor for a pending limit order and copies its current price.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} order - Normalized market or limit order being processed.
   * @returns {void|*} No value is required; the start editing state changes are applied.
   */
  function startEditing(order) {
    setEditingOrderId(order.id);
    setDraftPrice(String(order.limitPrice || ''));
  }

  /**
   * Closes the pending-order price editor and clears temporary input.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {void|*} No value is required; the stop editing state changes are applied.
   */
  function stopEditing() {
    setEditingOrderId(null);
    setDraftPrice('');
  }

  /**
   * Handles the update interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {object} order - Normalized market or limit order being processed.
   * @returns {Promise<void>} A promise that resolves after the handle update side effects finish.
   */
  async function handleUpdate(order) {
    const nextLimitPrice = Number(draftPrice);

    if (!Number.isFinite(nextLimitPrice) || nextLimitPrice <= 0) {
      showToast('Enter a valid limit price greater than zero.', 'error');
      return;
    }

    setBusyOrderId(order.id);
    try {
      const result = await api.updateTradeOrder(order.id, { limitPrice: nextLimitPrice });
      onPortfolioChange?.(result.portfolio);
      stopEditing();

      if (result.order?.status === 'FILLED') {
        showToast(`${order.side} limit filled at ${formatCurrency(result.trade?.price)}.`, 'success');
      } else {
        showToast(`${order.ticker} limit updated to ${formatCurrency(nextLimitPrice)}.`, 'success');
      }
    } catch (error) {
      showToast(error.message || 'Limit order could not be updated.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  }

  /**
   * Handles the cancel interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {object} order - Normalized market or limit order being processed.
   * @returns {Promise<void>} A promise that resolves after the handle cancel side effects finish.
   */
  async function handleCancel(order) {
    setBusyOrderId(order.id);
    try {
      const result = await api.cancelTradeOrder(order.id);
      onPortfolioChange?.(result.portfolio);
      showToast(`${order.ticker} limit order cancelled.`, 'success');
    } catch (error) {
      showToast(error.message || 'The order could not be cancelled.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <GlassCard className="portfolio-pending-limit-card portfolio-records-card" aria-labelledby="portfolio-pending-limits-title">
      <div className="section-title">
        <div>
          <h2 id="portfolio-pending-limits-title">Pending Limit Orders</h2>
          <p className="muted">Open targets and reserved positions.</p>
        </div>
        <Clock3 className="muted" aria-hidden="true" />
      </div>

      {orders.length ? (
        <div className="pending-limit-list scroll-panel">
          {orders.map((order) => {
            const isEditing = editingOrderId === order.id;
            const isBusy = busyOrderId === order.id;
            const quantityLabel = `${order.quantity} share${Number(order.quantity) === 1 ? '' : 's'}`;

            return (
              <article className="pending-limit-row" key={order.id}>
                <span className={`pending-limit-side ${order.side.toLowerCase()}`}>{order.side}</span>
                <div className="pending-limit-details">
                  <StockIdentity stock={order} company={order.companyName} size={30} compact />
                  <small>{quantityLabel} pending</small>
                  <small>Placed near {formatCurrency(order.submittedPrice)}</small>
                </div>
                <div className={`pending-limit-controls ${isEditing ? 'editing' : ''}`}>
                  {isEditing ? (
                    <>
                      <input
                        className="pending-limit-price-input"
                        aria-label={`New limit price for ${order.ticker}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draftPrice}
                        onChange={(event) => setDraftPrice(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleUpdate(order);
                          if (event.key === 'Escape') stopEditing();
                        }}
                      />
                      <Button iconOnly aria-label={`Save ${order.ticker} limit price`} disabled={isBusy} onClick={() => handleUpdate(order)}>
                        <Save size={15} aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" iconOnly aria-label="Cancel price edit" disabled={isBusy} onClick={stopEditing}>
                        <X size={15} aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button className="pending-limit-price-button" type="button" onClick={() => startEditing(order)}>
                        <strong>{formatCurrency(order.limitPrice)}</strong>
                        <small>Edit limit</small>
                      </button>
                      <Button
                        variant="danger"
                        iconOnly
                        aria-label={`Cancel ${order.side.toLowerCase()} limit order for ${order.ticker}`}
                        disabled={isBusy}
                        onClick={() => handleCancel(order)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pending-limit-empty">
          <Clock3 size={30} aria-hidden="true" />
          <strong>No pending limits</strong>
          <span className="muted">Open buy or sell limits will appear here.</span>
        </div>
      )}
    </GlassCard>
  );
}

/**
 * Renders the allocation logo label React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function AllocationLogoLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) {
  if (!payload || percent < allocationLogoMinPercent) return null;

  // Recharts labels are SVG-based, so this foreignObject lets the existing StockLogo fallback logic work inside each slice.
  const radians = Math.PI / 180;
  const logoSize = percent < 0.08 ? 24 : 30;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.56;
  const x = cx + radius * Math.cos(-midAngle * radians) - logoSize / 2;
  const y = cy + radius * Math.sin(-midAngle * radians) - logoSize / 2;

  return (
    <foreignObject className="allocation-logo-foreign" x={x} y={y} width={logoSize} height={logoSize}>
      <div xmlns="http://www.w3.org/1999/xhtml" className="allocation-logo-marker">
        <StockLogo stock={payload} company={payload.companyName} size={logoSize - 4} />
      </div>
    </foreignObject>
  );
}

/**
 * Formats the allocation tooltip for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @param {string} name - Human-readable user or company name.
 * @param {*} item - Current item being rendered or transformed.
 * @returns {string} The formatted value ready for display.
 */
function formatAllocationTooltip(value, name, item) {
  const numericValue = Number(value);
  const ticker = item?.payload?.ticker || name;
  return [Number.isFinite(numericValue) ? formatCurrency(numericValue) : value, ticker];
}

/**
 * Renders the allocation card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function AllocationCard({ holdings }) {
  return (
    <GlassCard className="portfolio-allocation-card portfolio-records-card">
      <div className="section-title">
        <h2>Allocation</h2>
        <ChartPie className="muted" />
      </div>
      {holdings.length ? (
        <div className="portfolio-allocation-chart">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={holdings}
                dataKey="marketValue"
                nameKey="ticker"
                innerRadius={64}
                outerRadius={112}
                paddingAngle={0}
                stroke="none"
                label={AllocationLogoLabel}
                labelLine={false}
              >
                {holdings.map((holding, index) => <Cell key={holding.ticker} fill={colors[index % colors.length]} stroke="none" />)}
              </Pie>
              <Tooltip
                formatter={formatAllocationTooltip}
                contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="allocation-empty-state">
          <ChartPie size={30} aria-hidden="true" />
          <strong>No allocation yet</strong>
          <span className="muted">Your holdings mix will appear after your first filled order.</span>
        </div>
      )}
    </GlassCard>
  );
}

// Portfolio keeps account funding and order entry in one workspace with in-place view changes.
/**
 * Renders the portfolio React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Portfolio() {
  const navigate = useNavigate();
  const { openInsight } = useOutletContext();
  const { isAuthenticated, isSessionReady } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [stock, setStock] = useState(null);
  const [stockChartPoints, setStockChartPoints] = useState([]);
  const [ticker, setTicker] = useState('AAPL');
  const [activeView, setActiveView] = useState('account');

  useEffect(() => {
    if (!isSessionReady) return;
    if (isAuthenticated) api.getPortfolio().then(setPortfolio);
    else setPortfolio(guestPortfolio);
  }, [isAuthenticated, isSessionReady]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Refreshing the portfolio checks whether any pending limit has reached its trigger price.
    const intervalId = window.setInterval(() => {
      api.getPortfolio().then(setPortfolio).catch(() => undefined);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated]);

  useEffect(() => {
    let isActive = true;

    Promise.all([
      api.searchStock(ticker),
      api.getChart(ticker, '1D'),
    ]).then(([stockResult, chartResult]) => {
      if (!isActive) return;
      setStock(stockResult.stock);
      setStockChartPoints(chartResult.points || []);
    });

    return () => {
      isActive = false;
    };
  }, [ticker]);

  /**
   * Handles the ticker submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle ticker submit state changes are applied.
   */
  function handleTickerSubmit(event) {
    event.preventDefault();
    setTicker(event.currentTarget.elements['portfolio-ticker'].value.trim().toUpperCase() || 'AAPL');
  }

  if (!portfolio) return <Skeleton rows={8} />;

  return (
    <div className="page-stack portfolio-page">
      <GlassCard className="portfolio-hero-card" variant="glow">
        <div className="section-title">
          <div>
            <span className="chip">{isAuthenticated ? 'Virtual account' : 'Guest portfolio preview'}</span>
            <h1 className="page-title">Portfolio</h1>
            <p className="muted">Track performance, manage holdings, place orders, and review account activity.</p>
          </div>
          <Button className="portfolio-hero-action" aria-label="Summarize portfolio" onClick={() => openInsight({ screen: 'Portfolio', portfolio })}>
            <Brain size={18} />
            <span style={{ marginLeft: 8 }}>Summarize</span>
          </Button>
        </div>
      </GlassCard>

      <div className="content-grid equal-card-grid kpi-grid portfolio-kpi-grid">
        <div className="span-4"><StatCard label="Total value" value={isAuthenticated ? formatCurrency(portfolio.totalValue) : '--'} change={isAuthenticated ? portfolio.totalProfitLossPercent : undefined} /></div>
        <div className="span-4"><StatCard label="Available virtual cash" value={isAuthenticated ? formatCurrency(portfolio.availableBuyingPower ?? portfolio.virtualCash) : 'Login required'} /></div>
        <div className="span-4"><StatCard label="Invested value" value={isAuthenticated ? formatCurrency(portfolio.investedValue) : '--'} /></div>
      </div>

      <PortfolioReturnsChart portfolio={portfolio} locked={!isAuthenticated} />

      <section className={`portfolio-workspace-shell ${activeView}`}>
        <div className="portfolio-workspace-toolbar">
          <div className="portfolio-view-tabs" data-view={activeView} role="tablist" aria-label="Portfolio workspace">
            <button type="button" role="tab" aria-selected={activeView === 'account'} className={activeView === 'account' ? 'active' : ''} onClick={() => setActiveView('account')}>
              <span className="portfolio-tab-icon"><WalletCards size={18} /></span>
              <span>Account</span>
            </button>
            <button type="button" role="tab" aria-selected={activeView === 'trade'} className={activeView === 'trade' ? 'active' : ''} onClick={() => setActiveView('trade')}>
              <span className="portfolio-tab-icon"><ArrowLeftRight size={18} /></span>
              <span>Trade</span>
            </button>
          </div>
        </div>

        <div className="portfolio-workspace-stage">
          {activeView === 'account' ? (
            <div key="account" className="portfolio-workspace-content portfolio-workspace-panel" role="tabpanel" aria-label="Portfolio account">
              <div className="portfolio-overview-funding">
                <PaperFundingPanel portfolio={portfolio} isGuest={!isAuthenticated} />
              </div>
            </div>
          ) : (
            <div key="trade" className="portfolio-workspace-content portfolio-workspace-panel" role="tabpanel" aria-label="Portfolio trading">
              <div className="portfolio-order-row">
                <GlassCard className="portfolio-select-stock-card">
                  <div className="section-title">
                    <h2>Select Stock</h2>
                    <ChartSpline className="positive" />
                  </div>
                  <form className="portfolio-symbol-form" onSubmit={handleTickerSubmit}>
                    <Input key={ticker} label="Ticker" name="portfolio-ticker" defaultValue={ticker} />
                    <button className="button primary" type="submit">Load</button>
                  </form>
                  {stock && <SelectedStockChart stock={stock} points={stockChartPoints} />}
                  {stock && (
                    <div className="selected-stock-summary">
                      <span>
                        <small className="muted">Selected</small>
                        <StockIdentity stock={stock} size={34} />
                      </span>
                      <span>
                        <small className="muted">Market price</small>
                        <strong>{formatCurrency(stock.price)}</strong>
                        <small className={getChangeClass(stock.change)}>{formatPercent(stock.change)} today</small>
                      </span>
                    </div>
                  )}
                </GlassCard>
                {stock && (
                  <TradeTicket
                    stock={stock}
                    portfolio={portfolio}
                    onTradeComplete={setPortfolio}
                    onTickerChange={setTicker}
                    requiresLogin={!isAuthenticated}
                    onLoginRequired={() => navigate('/login')}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="portfolio-records-grid">
        <HoldingsCard
          portfolio={portfolio}
          onOpenHolding={(symbol) => navigate(`/stock/${symbol}`)}
          onOpenTrade={() => setActiveView('trade')}
        />
        <PendingLimitOrders orders={portfolio.openOrders || []} onPortfolioChange={setPortfolio} />
      </div>

      <div className="portfolio-records-grid">
        <AllocationCard holdings={portfolio.holdings || []} />
        <GlassCard className="portfolio-transactions-card portfolio-records-card">
          <div className="section-title"><h2>Recent Transactions</h2></div>
          <TransactionTable transactions={portfolio.transactions} />
        </GlassCard>
      </div>
    </div>
  );
}
