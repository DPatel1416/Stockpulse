/**
 * File purpose: Defines the reusable Portfolio Returns Chart React component and its focused user interaction.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { formatCurrency, getChangeClass } from '../../utils/format';
import { formatMarketDate, formatMarketDateTime, formatMarketTime, getMarketSessionBounds, normalizeMarketTimestamp } from '../../utils/marketTime';
import GlassCard from '../ui/GlassCard';

const ranges = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'YTD'];

/**
 * Formats the axis currency for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
function formatAxisCurrency(value) {
  const numericValue = Number(value);
  const absoluteValue = Math.abs(numericValue);

  if (!Number.isFinite(numericValue)) return '$0';
  if (absoluteValue >= 1_000_000) return `$${(numericValue / 1_000_000).toFixed(1)}M`;
  if (absoluteValue >= 10_000) return `$${(numericValue / 1_000).toFixed(0)}k`;
  if (absoluteValue >= 1_000) return `$${(numericValue / 1_000).toFixed(1)}k`;
  return `$${numericValue.toFixed(0)}`;
}

/**
 * Formats the time label for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {string|Date|number} timestamp - Time value to normalize or display.
 * @param {*} range - Requested chart or performance time range.
 * @returns {string} The formatted value ready for display.
 */
function formatTimeLabel(timestamp, range) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';

  if (range === '1D') {
    return formatMarketTime(date);
  }

  if (['5D', '1M', '3M', '6M'].includes(range)) {
    return formatMarketDate(date);
  }

  return formatMarketDate(date, { month: 'short', year: '2-digit' });
}

/**
 * Renders the returns tooltip React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function ReturnsTooltip({ active, payload, range }) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip returns-tooltip">
      <strong>{range === '1D'
        ? formatMarketDateTime(point.timestamp, { dateStyle: 'medium' }, { timeStyle: 'short' })
        : formatMarketDate(point.timestamp, { dateStyle: 'medium' })}</strong>
      <div className="chart-tooltip-row">
        <span>Portfolio value</span>
        <b>{formatCurrency(point.totalValue)}</b>
      </div>
      <div className="chart-tooltip-row">
        <span>Change</span>
        <b className={getChangeClass(point.returnValue)}>{point.returnValue >= 0 ? '+' : ''}{formatCurrency(point.returnValue)}</b>
      </div>
    </div>
  );
}

// The chart renders market-repriced account history, including periods when the app was not open.
/**
 * Renders the portfolio returns chart React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function PortfolioReturnsChart({ portfolio, locked = false }) {
  const { resolvedTheme } = useTheme();
  const [range, setRange] = useState('1D');
  const [performance, setPerformance] = useState({ points: [], updatedAt: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    /**
     * Loads the performance and prepares it for the current workflow.
     * Separating loading from rendering keeps asynchronous state easier to follow.
     * @returns {Promise<*>} A promise resolving to the loaded performance result.
     */
    async function loadPerformance() {
      if (locked) {
        setPerformance({ points: [], updatedAt: null });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await api.getPortfolioPerformance(range);
        if (isActive) setPerformance(result);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    if (portfolio) loadPerformance();

    return () => {
      isActive = false;
    };
  }, [locked, range, portfolio]);

  // The intraday domain mirrors the regular North American market session.
  const oneDayAxis = useMemo(() => {
    const lastPointTime = performance.points?.at(-1)?.timestamp;
    const session = getMarketSessionBounds(performance.marketUpdatedAt || lastPointTime || performance.updatedAt || Date.now());

    return {
      domain: [session.start, session.end],
      ticks: session.ticks,
      endTime: session.end,
    };
  }, [performance.marketUpdatedAt, performance.points, performance.updatedAt]);

  const chartData = useMemo(() => {
    const portfolioValue = Number(portfolio?.totalValue);
    const portfolioCash = Number(portfolio?.virtualCash);
    const portfolioInvestedValue = Number(portfolio?.investedValue);
    const liveTimestamp = normalizeMarketTimestamp(performance.marketUpdatedAt || performance.updatedAt || Date.now());
    const points = (performance.points || [])
      .map((point) => ({
        ...point,
        totalValue: Number(point.totalValue || 0),
        cash: Number(point.cash || 0),
        investedValue: Number(point.investedValue || 0),
        chartTimestamp: normalizeMarketTimestamp(point.timestamp),
      }))
      .filter((point) => Number.isFinite(point.chartTimestamp) && Number.isFinite(point.totalValue));
    const livePoint = Number.isFinite(portfolioValue)
      ? {
          timestamp: new Date(liveTimestamp).toISOString(),
          chartTimestamp: liveTimestamp,
          totalValue: portfolioValue,
          cash: Number.isFinite(portfolioCash) ? portfolioCash : 0,
          investedValue: Number.isFinite(portfolioInvestedValue) ? portfolioInvestedValue : 0,
        }
      : null;
    const dedupedByTime = new Map();

    [...points, livePoint].filter(Boolean).forEach((point) => {
      dedupedByTime.set(point.chartTimestamp, point);
    });

    const normalizedPoints = [...dedupedByTime.values()].sort((first, second) => first.chartTimestamp - second.chartTimestamp);

    if (range !== '1D' || !normalizedPoints.length) {
      const baseline = Number(normalizedPoints[0]?.totalValue || 0);
      return normalizedPoints.map((point, index) => ({
        ...point,
        chartIndex: index,
        returnValue: Number(point.totalValue || 0) - baseline,
      }));
    }

    const [dayStart, dayEnd] = oneDayAxis.domain;
    const baselinePoint = [...normalizedPoints].reverse().find((point) => point.chartTimestamp <= dayStart) || normalizedPoints[0];
    const baselineValue = Number(baselinePoint.totalValue || 0);
    const intradayPoints = normalizedPoints.filter((point) => point.chartTimestamp > dayStart && point.chartTimestamp <= dayEnd);
    const startPoint = {
      ...baselinePoint,
      timestamp: new Date(dayStart).toISOString(),
      chartTimestamp: dayStart,
      totalValue: baselineValue,
      returnValue: 0,
    };

    return [startPoint, ...intradayPoints.map((point) => {
      const returnValue = Number(point.totalValue || 0) - baselineValue;
      return {
        ...point,
        returnValue,
      };
    })].map((point, index) => ({ ...point, chartIndex: index }));
  }, [oneDayAxis.domain, performance.marketUpdatedAt, performance.points, performance.updatedAt, portfolio?.investedValue, portfolio?.totalValue, portfolio?.virtualCash, range]);

  const stats = useMemo(() => {
    const values = chartData.map((point) => Number(point.totalValue)).filter(Number.isFinite);
    const firstValue = values[0] ?? Number(portfolio?.totalValue || 0);
    const latest = chartData.at(-1);
    const latestValue = Number(latest?.totalValue ?? portfolio?.totalValue ?? 0);
    const returnValue = latestValue - firstValue;
    const lowValue = values.length ? Math.min(...values) : latestValue;
    const highValue = values.length ? Math.max(...values) : latestValue;
    const valuePadding = Math.max((highValue - lowValue) * 0.18, Math.abs(latestValue) * 0.004, 10);

    return {
      latest,
      firstValue,
      returnValue,
      domain: [lowValue - valuePadding, highValue + valuePadding],
    };
  }, [chartData, portfolio?.totalValue]);

  const isPositive = stats.returnValue >= 0;
  const lineColor = isPositive
    ? resolvedTheme === 'dark' ? '#34d399' : '#059669'
    : resolvedTheme === 'dark' ? '#fb7185' : '#dc2626';
  const axisColor = resolvedTheme === 'dark' ? '#9aa8bd' : '#53657c';
  const gridColor = resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(83, 101, 124, 0.16)';
  const gradientId = `portfolio-return-${resolvedTheme}`;

  return (
    <GlassCard className="portfolio-returns-card">
      <div className="returns-chart-header">
        <div>
          <span className="returns-chart-kicker"><TrendingUp size={16} /> Account performance</span>
          <h2>Portfolio Value</h2>
          <p className="muted">Track your virtual account value during market sessions.</p>
        </div>
        <div className="returns-chart-summary">
          <span className="muted">Portfolio value</span>
          <strong>{locked ? '--' : formatCurrency(stats.latest?.totalValue ?? portfolio?.totalValue ?? 0)}</strong>
          {locked ? (
            <span className="muted">Login to track returns</span>
          ) : (
            <span className={getChangeClass(stats.returnValue)}>
              {stats.returnValue >= 0 ? '+' : ''}{formatCurrency(stats.returnValue)}
            </span>
          )}
        </div>
      </div>

      <div className="chart-range-row returns-range-row" aria-label="Portfolio return range">
        {ranges.map((item) => (
          <button
            className={`chart-range-button${range === item ? ' active' : ''}`}
            type="button"
            key={item}
            aria-pressed={range === item}
            onClick={() => setRange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className={`returns-chart-canvas${isLoading ? ' loading' : ''}`}>
        {locked ? (
          <div className="guest-chart-placeholder">
            <TrendingUp size={22} aria-hidden="true" />
            <strong>Portfolio history starts after login</strong>
            <span className="muted">No virtual cash or performance data is created for guest sessions.</span>
          </div>
        ) : <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 14, right: 14, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 7" vertical={false} />
            <XAxis
              dataKey={range === '1D' ? 'chartTimestamp' : 'chartIndex'}
              type="number"
              scale={range === '1D' ? 'time' : 'linear'}
              domain={range === '1D' ? oneDayAxis.domain : ['dataMin', 'dataMax']}
              ticks={range === '1D' ? oneDayAxis.ticks : undefined}
              allowDataOverflow={range === '1D'}
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
              tickFormatter={(value) => {
                if (range === '1D') return formatTimeLabel(value, range);
                return formatTimeLabel(chartData[Math.round(value)]?.timestamp, range);
              }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              minTickGap={36}
            />
            <YAxis
              orientation="right"
              domain={stats.domain}
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
              tickFormatter={formatAxisCurrency}
              tickLine={false}
              axisLine={false}
              width={68}
            />
            <Tooltip
              cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4' }}
              content={<ReturnsTooltip range={range} />}
            />
            <ReferenceLine y={stats.firstValue} stroke={gridColor} strokeDasharray="6 6" />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={lineColor}
              fill={`url(#${gradientId})`}
              strokeWidth={2.4}
              dot={false}
              activeDot={{ r: 4.5, stroke: lineColor, strokeWidth: 2, fill: 'var(--surface-strong)' }}
              animationDuration={450}
            />
          </AreaChart>
        </ResponsiveContainer>}
      </div>

      <div className="returns-chart-footer">
        <span>{locked ? 'Guest preview' : portfolio?.investedValue ? `${formatCurrency(portfolio.investedValue)} invested` : 'No open positions'}</span>
        <span>{locked ? 'Account required for tracking' : (performance.marketUpdatedAt || performance.updatedAt) ? `Updated ${formatMarketTime(performance.marketUpdatedAt || performance.updatedAt)}` : 'Updating'}</span>
      </div>
    </GlassCard>
  );
}
