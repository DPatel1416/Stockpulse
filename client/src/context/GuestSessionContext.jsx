/**
 * File purpose: Provides shared Guest Session Context state and actions to React components without passing props through every level.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const GuestSessionContext = createContext(null);

// Guest state intentionally lives only in React memory so a reload always starts with a clean workspace.
/**
 * Renders the guest session provider React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export function GuestSessionProvider({ children }) {
  const { isAuthenticated, isSessionReady } = useAuth();
  const [watchlistTickers, setWatchlistTickers] = useState([]);
  const [hasGuestChanges, setHasGuestChanges] = useState(false);
  const isGuest = isSessionReady && !isAuthenticated;

  useEffect(() => {
    if (!isAuthenticated) return;
    setWatchlistTickers([]);
    setHasGuestChanges(false);
  }, [isAuthenticated]);

  // Browsers show their standard unsaved-changes warning when a guest refreshes after temporary activity.
  useEffect(() => {
    if (!isGuest || !hasGuestChanges) return undefined;

    /**
     * Warns guest users before refreshing a page that contains temporary changes.
     * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the warn before unload state changes are applied.
     */
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasGuestChanges, isGuest]);

  /**
   * Adds a normalized ticker to the temporary guest watchlist.
   * The callback also marks the session as changed so refresh warnings remain accurate.
   * @param {string} ticker - Stock ticker requested by the guest.
   * @returns {void} No value is returned; guest-session state is updated.
   */
  const addGuestTicker = useCallback((ticker) => {
    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    if (!normalizedTicker) return;

    setWatchlistTickers((current) => current.includes(normalizedTicker) ? current : [...current, normalizedTicker]);
    setHasGuestChanges(true);
  }, []);

  /**
   * Removes a normalized ticker from the temporary guest watchlist.
   * Keeping removal in context makes every guest-facing screen share the same rules.
   * @param {string} ticker - Stock ticker to remove.
   * @returns {void} No value is returned; guest-session state is updated.
   */
  const removeGuestTicker = useCallback((ticker) => {
    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    setWatchlistTickers((current) => current.filter((item) => item !== normalizedTicker));
    setHasGuestChanges(true);
  }, []);

  const value = useMemo(() => ({
    isGuest,
    watchlistTickers,
    hasGuestChanges,
    addGuestTicker,
    removeGuestTicker,
  }), [addGuestTicker, hasGuestChanges, isGuest, removeGuestTicker, watchlistTickers]);

  return <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>;
}

/**
 * Returns temporary guest-watchlist state and mutation actions from context.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @returns {object} Temporary guest-session state and watchlist actions.
 */
export function useGuestSession() {
  const context = useContext(GuestSessionContext);
  if (!context) throw new Error('useGuestSession must be used inside GuestSessionProvider');
  return context;
}
