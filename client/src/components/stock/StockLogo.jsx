/**
 * File purpose: Defines the reusable Stock Logo React component and its focused user interaction.
 */
import { useEffect, useMemo, useState } from 'react';

/**
 * Returns the ticker initials needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {string} One or two uppercase letters used as a logo fallback.
 */
function getTickerInitials(ticker) {
  const value = String(ticker || '?').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return value.slice(0, value.length > 1 ? 2 : 1) || '?';
}

const logoSymbolAliases = {
  GOOGL: 'GOOG',
  META: 'FB',
};

/**
 * Returns the static logo url needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @returns {*} The requested static logo url result.
 */
function getStaticLogoUrl(ticker) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase();
  if (!normalizedTicker || normalizedTicker === 'MARKET' || !/^[A-Z0-9.-]{1,12}$/.test(normalizedTicker)) return null;
  const logoSymbol = logoSymbolAliases[normalizedTicker] || normalizedTicker;
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(logoSymbol)}.png`;
}

/**
 * Returns the logo candidates needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {string|null} logo - Provider or stored company logo URL.
 * @returns {*} The requested logo candidates result.
 */
function getLogoCandidates(ticker, logo) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase();
  const candidates = [];
  const staticLogo = getStaticLogoUrl(normalizedTicker);

  if (logoSymbolAliases[normalizedTicker] && staticLogo) candidates.push(staticLogo);
  if (logo) candidates.push(logo);
  if (staticLogo) candidates.push(staticLogo);

  return [...new Set(candidates.filter(Boolean))];
}

// StockLogo shows live company logos when the market-data provider returns one, with a graceful ticker fallback.
/**
 * Renders the stock logo React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function StockLogo({ stock, ticker, logo, company, size = 34, className = '' }) {
  const resolvedTicker = ticker || stock?.ticker;
  const resolvedCompany = company || stock?.company || stock?.companyName || resolvedTicker;
  const resolvedLogo = logo || stock?.logo;
  const logoCandidates = useMemo(() => getLogoCandidates(resolvedTicker, resolvedLogo), [resolvedLogo, resolvedTicker]);
  const [logoIndex, setLogoIndex] = useState(0);
  const style = { '--logo-size': `${size}px` };
  const activeLogo = logoCandidates[logoIndex];

  useEffect(() => {
    setLogoIndex(0);
  }, [logoCandidates]);

  return (
    <span className={`stock-logo ${className}`.trim()} style={style} aria-hidden="true" title={resolvedCompany}>
      {activeLogo ? (
        <img src={activeLogo} alt="" loading="lazy" decoding="async" onError={() => setLogoIndex((current) => current + 1)} />
      ) : (
        <span>{getTickerInitials(resolvedTicker)}</span>
      )}
    </span>
  );
}

/**
 * Renders the stock identity React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export function StockIdentity({ stock, ticker, logo, company, subtitle, size = 34, className = '', compact = false }) {
  const resolvedTicker = ticker || stock?.ticker;
  const resolvedCompany = company || stock?.company || stock?.companyName;
  const secondaryText = subtitle ?? resolvedCompany;

  return (
    <span className={`stock-identity ${compact ? 'compact' : ''} ${className}`.trim()}>
      <StockLogo stock={stock} ticker={resolvedTicker} logo={logo} company={resolvedCompany} size={size} />
      <span className="stock-identity-text">
        <strong>{resolvedTicker}</strong>
        {secondaryText && <small className="muted">{secondaryText}</small>}
      </span>
    </span>
  );
}
