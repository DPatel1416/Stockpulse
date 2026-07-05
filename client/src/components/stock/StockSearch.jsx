/**
 * File purpose: Defines the reusable Stock Search React component and its focused user interaction.
 */
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { StockIdentity } from './StockLogo';

// StockSearch supports ticker and company-name lookup with backend-powered suggestions.
/**
 * Renders the stock search React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function StockSearch({ compact = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const result = await api.getStockSuggestions(trimmedQuery);
      setSuggestions(result.suggestions || []);
      setHighlightedIndex(0);
      setIsOpen(Boolean(result.suggestions?.length));
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    /**
     * Handles the outside click interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle outside click state changes are applied.
     */
    function handleOutsideClick(event) {
      if (!searchRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  /**
   * Normalizes a selected symbol and opens its stock-detail route.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {*} ticker - Stock ticker symbol used to identify a company.
   * @returns {void|*} No value is required; the navigate to ticker state changes are applied.
   */
  function navigateToTicker(ticker) {
    navigate(`/stock/${ticker.toUpperCase()}`);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  }

  /**
   * Handles the submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the handle submit side effects finish.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    if (suggestions.length) {
      navigateToTicker(suggestions[highlightedIndex]?.ticker || suggestions[0].ticker);
      return;
    }

    const result = await api.getStockSuggestions(trimmedQuery);
    const bestMatch = result.suggestions?.[0];
    navigateToTicker(bestMatch?.ticker || trimmedQuery);
  }

  /**
   * Handles the key down interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle key down state changes are applied.
   */
  function handleKeyDown(event) {
    if (!isOpen || !suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <form
      ref={searchRef}
      className={`stock-search-form${compact ? ' compact' : ''}`}
      onSubmit={handleSubmit}
      style={{ position: 'relative', alignItems: compact ? 'end' : 'center' }}
    >
      <div style={{ position: 'relative', flex: 1 }}>
        <Input
          label={compact ? 'Search stock' : undefined}
          name="ticker-search"
          placeholder="Search ticker or company, e.g. Apple"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="stock-search-suggestions"
          onFocus={() => setIsOpen(Boolean(suggestions.length))}
          onKeyDown={handleKeyDown}
          onChange={(event) => setQuery(event.target.value)}
        />
        {isOpen && suggestions.length > 0 && (
          <div className="suggestion-menu" id="stock-search-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.ticker}-${suggestion.company}`}
                type="button"
                className={`suggestion-item ${index === highlightedIndex ? 'active' : ''}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigateToTicker(suggestion.ticker)}
              >
                <StockIdentity stock={suggestion} size={30} compact />
                <small>{suggestion.type}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button className="stock-search-submit" type="submit" iconOnly={compact} aria-label="Search stock ticker">
        <Search size={17} />
        {!compact && <span>Search</span>}
      </Button>
    </form>
  );
}
