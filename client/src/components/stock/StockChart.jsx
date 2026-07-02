/**
 * File purpose: Defines the reusable Stock Chart React component and its focused user interaction.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCandlestick, ChartSpline, LoaderCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { formatCompactNumber, formatCurrency, formatPercent, getChangeClass } from '../../utils/format';
import StockLogo from './StockLogo';

const ranges = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y'];

/**
 * Converts a chart value to a finite number or returns null when it is unusable.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {number|null} A finite number, or null when conversion is unsafe.
 */
const asNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

/**
 * Formats the chart currency for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
const formatChartCurrency = (value) => {
  const numericValue = asNumber(value);
  return numericValue === null ? '--' : formatCurrency(numericValue);
};

/**
 * Formats the chart percent for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
const formatChartPercent = (value) => {
  const numericValue = asNumber(value);
  return numericValue === null ? '--' : formatPercent(numericValue);
};

/**
 * Formats the chart number for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
const formatChartNumber = (value) => {
  const numericValue = asNumber(value);
  return numericValue === null ? '--' : formatCompactNumber(numericValue);
};

/**
 * Formats the ratio for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
const formatRatio = (value) => {
  const numericValue = asNumber(value);
  return numericValue === null ? '--' : numericValue.toFixed(1);
};

/**
 * Formats the updated at for display or transport.
 * A shared formatter keeps user-facing values consistent across screens.
 * @param {*} value - Value to inspect, transform, or display.
 * @returns {string} The formatted value ready for display.
 */
const formatUpdatedAt = (value) => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 'Last update unavailable';
  }

  return `Last updated ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

/**
 * Renders the chart tooltip React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function ChartTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip">
      <strong>{point?.label || label}</strong>
      {mode === 'candles' ? (
        <div className="chart-tooltip-ohlc">
          <span>Open <b>{formatChartCurrency(point?.open)}</b></span>
          <span>High <b>{formatChartCurrency(point?.high)}</b></span>
          <span>Low <b>{formatChartCurrency(point?.low)}</b></span>
          <span>Close <b>{formatChartCurrency(point?.close)}</b></span>
        </div>
      ) : (
        <div className="chart-tooltip-row">
          <span>Price</span>
          <b>{formatChartCurrency(point?.price)}</b>
        </div>
      )}
      <div className="chart-tooltip-row">
        <span>Volume</span>
        <b>{formatChartNumber(point?.volume)}</b>
      </div>
    </div>
  );
}

/**
 * Renders the candlestick shape React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
function CandlestickShape({ x, y, width, height, payload, upColor, downColor }) {
  const open = Number(payload?.open);
  const close = Number(payload?.close);
  const high = Number(payload?.high);
  const low = Number(payload?.low);

  if (payload?.isDayAnchor || ![open, close, high, low, x, y, width, height].every(Number.isFinite) || high <= low) return null;

  const color = close >= open ? upColor : downColor;
  const scale = height / (high - low);
  const bodyTop = y + (high - Math.max(open, close)) * scale;
  const calculatedHeight = Math.abs(open - close) * scale;
  const bodyHeight = Math.max(1.5, calculatedHeight);
  const bodyWidth = Math.max(2, width * 0.72);
  const centerX = x + width / 2;

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth="1" />
      <rect
        x={centerX - bodyWidth / 2}
        y={bodyTop - Math.max(0, bodyHeight - calculatedHeight) / 2}
        width={bodyWidth}
        height={bodyHeight}
        rx="1"
        fill={color}
      />
    </g>
  );
}

// StockChart keeps provider/API details out of the UI while presenting richer market context.
/**
 * Renders the stock chart React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function StockChart({ data = [], range, onRangeChange, showVolume = true, ticker, stock, weekRange, lastUpdatedAt, isLoading = false }) {
  const { resolvedTheme } = useTheme();
  const [chartMode, setChartMode] = useState('line');
  const axisColor = resolvedTheme === 'dark' ? '#9aa8bd' : '#53657c';
  const gridColor = resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(83, 101, 124, 0.18)';
  const upColor = resolvedTheme === 'dark' ? '#34d399' : '#059669';
  const downColor = resolvedTheme === 'dark' ? '#fb7185' : '#dc2626';

  const normalizedData = useMemo(() => data.map((point, index) => {
    const close = asNumber(point.close ?? point.price) ?? 0;
    const previousClose = asNumber(data[index - 1]?.close ?? data[index - 1]?.price);
    const open = asNumber(point.open) ?? previousClose ?? close;
    const high = asNumber(point.high) ?? Math.max(open, close);
    const low = asNumber(point.low) ?? Math.min(open, close);
    const fallbackTimestamp = new Date(lastUpdatedAt || Date.now()).getTime() - (data.length - index - 1) * 15 * 60 * 1000;
    const chartTimestamp = point.timestamp ? new Date(point.timestamp).getTime() : fallbackTimestamp;

    return {
      ...point,
      chartTimestamp,
      open,
      high,
      low,
      close,
      price: close,
      candleRange: [low, high],
    };
  })
    .filter((point) => Number.isFinite(point.chartTimestamp) && Number.isFinite(point.price) && point.price > 0)
    .map((point, index) => ({ ...point, chartIndex: index })), [data, lastUpdatedAt]);

  const oneDayAxis = useMemo(() => {
    const latestTimestamp = normalizedData.at(-1)?.chartTimestamp;
    const referenceDate = new Date(latestTimestamp || lastUpdatedAt || Date.now());
    const start = new Date(referenceDate);
    start.setHours(9, 30, 0, 0);
    const end = new Date(referenceDate);
    end.setHours(16, 0, 0, 0);
    const startTime = start.getTime();
    const endTime = end.getTime();

    return {
      domain: [startTime, endTime],
      ticks: [0, 90, 180, 270, 330, 390].map((minutes) => startTime + minutes * 60 * 1000),
    };
  }, [lastUpdatedAt, normalizedData]);

  // Keep the complete day visible and let real intraday data advance into the empty future space.
  const chartData = useMemo(() => {
    if (range !== '1D' || !normalizedData.length) return normalizedData;

    const [dayStart, dayEnd] = oneDayAxis.domain;
    const intradayData = normalizedData.filter((point) => point.chartTimestamp >= dayStart && point.chartTimestamp <= dayEnd);
    const firstPoint = intradayData[0] || normalizedData[0];
    const anchorPrice = Number(firstPoint.open ?? firstPoint.price);
    const dayAnchor = {
      ...firstPoint,
      isDayAnchor: true,
      label: '9:30 AM',
      timestamp: new Date(dayStart).toISOString(),
      chartTimestamp: dayStart,
      open: anchorPrice,
      high: anchorPrice,
      low: anchorPrice,
      close: anchorPrice,
      price: anchorPrice,
      volume: 0,
      candleRange: [anchorPrice, anchorPrice],
    };

    if (intradayData[0]?.chartTimestamp <= dayStart + 60 * 1000) {
      return intradayData;
    }

    return [dayAnchor, ...intradayData];
  }, [normalizedData, oneDayAxis.domain, range]);

  // Five-day charts use a compressed session index so closed-market hours do not become long flat gaps.
  const fiveDayTicks = useMemo(() => {
    if (range !== '5D') return undefined;

    const sessions = new Map();
    chartData.forEach((point) => {
      const sessionKey = new Date(point.chartTimestamp).toDateString();
      const sessionPoints = sessions.get(sessionKey) || [];
      sessionPoints.push(point);
      sessions.set(sessionKey, sessionPoints);
    });

    return [...sessions.values()].map((sessionPoints) => (
      sessionPoints[Math.floor(sessionPoints.length / 2)].chartIndex
    ));
  }, [chartData, range]);

  const stats = useMemo(() => {
    const prices = normalizedData.map((point) => asNumber(point.price)).filter((value) => value !== null);
    const volumes = normalizedData.map((point) => asNumber(point.volume)).filter((value) => value !== null && value > 0);
    const firstPrice = prices.at(0) ?? null;
    const lastPrice = prices.at(-1) ?? null;
    const change = firstPrice !== null && lastPrice !== null ? lastPrice - firstPrice : null;
    const changePercent = firstPrice ? (change / firstPrice) * 100 : null;

    return {
      firstPrice,
      lastPrice,
      change,
      changePercent,
      low: prices.length ? Math.min(...prices) : null,
      high: prices.length ? Math.max(...prices) : null,
      volume: volumes.at(-1) ?? null,
      maxVolume: volumes.length ? Math.max(...volumes) : 1,
    };
  }, [normalizedData]);

  const chartMetricItems = useMemo(() => [
    { label: 'Last chart price', value: formatChartCurrency(stats.lastPrice ?? stock?.price) },
    { label: 'Range move', value: formatChartPercent(stats.changePercent), className: getChangeClass(stats.changePercent) },
    { label: 'Latest chart volume', value: formatChartNumber(stats.volume) },
    {
      label: "Today's range",
      value: stock?.dayRange || `${formatChartCurrency(stats.low)} / ${formatChartCurrency(stats.high)}`,
    },
    { label: '52W moving average', value: formatChartCurrency(weekRange?.average) },
  ], [stats, stock, weekRange]);

  const marketMetricItems = useMemo(() => [
    { label: 'Today volume', value: formatChartNumber(stock?.volume) },
    { label: 'Average volume', value: formatChartNumber(stock?.avgVolume) },
    { label: 'Market cap', value: stock?.marketCap || '--' },
    { label: 'P/E ratio', value: formatRatio(stock?.pe) },
    { label: 'Open', value: formatChartCurrency(stock?.open) },
    { label: 'Previous close', value: formatChartCurrency(stock?.previousClose) },
  ], [stock]);

  const previousClose = asNumber(stock?.previousClose);
  const comparisonPrice = range === '1D' && previousClose !== null ? previousClose : stats.firstPrice;
  const isPositive = stats.lastPrice !== null && comparisonPrice !== null
    ? stats.lastPrice >= comparisonPrice
    : (stats.change ?? 0) >= 0;
  const lineColor = isPositive
    ? resolvedTheme === 'dark'
      ? '#34d399'
      : '#059669'
    : resolvedTheme === 'dark'
      ? '#fb7185'
      : '#dc2626';
  const volumeColor = resolvedTheme === 'dark' ? 'rgba(56, 189, 248, 0.26)' : 'rgba(14, 116, 144, 0.22)';
  const volumeScaleMax = Math.max(Number(stats.maxVolume || 1) * 4, 1);
  const candleWidth = Math.max(2, Math.min(9, Math.floor(620 / Math.max(chartData.length, 1))));
  const gradientId = `price-fill-${String(ticker || 'stock').replace(/[^a-z0-9]/gi, '').toLowerCase()}-${resolvedTheme}`;
  const usesTimeAxis = range === '1D';
  const usesIndexedIntradayAxis = range === '5D';

  return (
    <div className="stock-chart-shell">
      <div className="stock-chart-toolbar">
        <div className="chart-range-row" aria-label="Chart range filters">
          {ranges.map((item) => (
            <button
              key={item}
              className={`chart-range-button${item === range ? ' active' : ''}`}
              type="button"
              aria-pressed={item === range}
              onClick={() => onRangeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="chart-toolbar-meta">
          <div className="chart-mode-toggle" aria-label="Chart style">
            <button type="button" className={chartMode === 'line' ? 'active' : ''} aria-pressed={chartMode === 'line'} onClick={() => setChartMode('line')}>
              <ChartSpline size={15} />
              Line
            </button>
            <button type="button" className={chartMode === 'candles' ? 'active' : ''} aria-pressed={chartMode === 'candles'} onClick={() => setChartMode('candles')}>
              <ChartCandlestick size={15} />
              Candles
            </button>
          </div>
          {ticker && (
            <span className="chip chart-symbol-chip ticker-chip-with-logo">
              <StockLogo stock={stock} ticker={ticker} size={22} />
              {ticker} chart
            </span>
          )}
          <span className="chart-update-chip">{formatUpdatedAt(lastUpdatedAt)}</span>
        </div>
      </div>

      <div className={`stock-chart-canvas${isLoading ? ' is-loading' : ''}`} aria-busy={isLoading}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="52%" stopColor={lineColor} stopOpacity={0.1} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 7" vertical={false} />
            <XAxis
              dataKey={usesTimeAxis ? 'chartTimestamp' : usesIndexedIntradayAxis ? 'chartIndex' : 'label'}
              type={usesTimeAxis || usesIndexedIntradayAxis ? 'number' : 'category'}
              scale={usesTimeAxis ? 'time' : usesIndexedIntradayAxis ? 'linear' : 'auto'}
              domain={range === '1D' ? oneDayAxis.domain : usesIndexedIntradayAxis ? ['dataMin', 'dataMax'] : undefined}
              ticks={range === '1D' ? oneDayAxis.ticks : fiveDayTicks}
              interval={range === '1D' ? 0 : 'preserveEnd'}
              padding={range === '1D' ? { left: 42, right: 42 } : undefined}
              allowDataOverflow={range === '1D'}
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
              tickFormatter={range === '1D'
                ? (value) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : range === '5D'
                  ? (value) => {
                    const point = chartData[Math.round(Number(value))];
                    return point
                      ? new Date(point.chartTimestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : '';
                  }
                : undefined}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              minTickGap={range === '5D' ? 46 : 28}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
              tickLine={false}
              axisLine={false}
              width={54}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <YAxis yAxisId="volume" hide domain={[0, volumeScaleMax]} />
            <Tooltip
              cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4' }}
              content={<ChartTooltip mode={chartMode} />}
            />
            {showVolume && <Bar yAxisId="volume" dataKey="volume" fill={volumeColor} radius={[2, 2, 0, 0]} barSize={6} />}
            {Number.isFinite(stats.firstPrice) && (
              <ReferenceLine yAxisId="price" y={stats.firstPrice} stroke={gridColor} strokeDasharray="6 6" />
            )}
            {chartMode === 'line' ? (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                fill={`url(#${gradientId})`}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4.5, stroke: lineColor, strokeWidth: 2, fill: 'var(--surface-strong)' }}
              />
            ) : (
              <Bar
                yAxisId="price"
                dataKey="candleRange"
                barSize={candleWidth}
                shape={<CandlestickShape upColor={upColor} downColor={downColor} />}
                isAnimationActive={false}
              />
            )}
            {range !== '1D' && normalizedData.length > 16 && (
              <Brush
                dataKey={usesTimeAxis ? 'chartTimestamp' : usesIndexedIntradayAxis ? 'chartIndex' : 'label'}
                height={24}
                stroke={lineColor}
                travellerWidth={8}
                fill={resolvedTheme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(226, 232, 240, 0.72)'}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        {isLoading && (
          <div className="chart-refresh-overlay" role="status" aria-live="polite">
            <span><LoaderCircle size={18} />Updating {range} chart</span>
          </div>
        )}
      </div>

      <div className="chart-meta-grid" aria-label="Chart summary">
        <div className="chart-meta-column">
          <h3>Chart range</h3>
          {chartMetricItems.map((item) => (
            <div className="chart-meta-row" key={item.label}>
              <span>{item.label}</span>
              <strong className={item.className}>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="chart-meta-column">
          <h3>Market snapshot</h3>
          {marketMetricItems.map((item) => (
            <div className="chart-meta-row" key={item.label}>
              <span>{item.label}</span>
              <strong className={item.className}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
