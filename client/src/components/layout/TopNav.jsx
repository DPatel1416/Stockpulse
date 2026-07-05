/**
 * File purpose: Defines the reusable Top Nav React component and its focused user interaction.
 */
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import StockSearch from '../stock/StockSearch';
import Button from '../ui/Button';

// TopNav holds search, theme, market status, and session controls.
/**
 * Renders the top nav React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function TopNav() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [marketStatus, setMarketStatus] = useState(null);
  const markets = marketStatus?.markets?.length ? marketStatus.markets : marketStatus ? [marketStatus] : [];

  useEffect(() => {
    api.getMarketStatus().then(setMarketStatus);
  }, []);

  return (
    <header className="top-nav">
      <StockSearch />
      <div className="top-actions">
        <div className="market-status-row" aria-label="Market status">
          {markets.length ? (
            markets.map((market) => (
              <span className={`chip ${market.isOpen ? 'status-open' : 'status-closed'}`} key={market.code || market.exchange}>
                {market.code || market.exchange}: {market.isOpen ? 'Open' : 'Closed'}
              </span>
            ))
          ) : (
            <span className="chip status-checking">Checking markets</span>
          )}
        </div>
        <Button className="theme-toggle-button" variant="ghost" iconOnly aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </div>
    </header>
  );
}
