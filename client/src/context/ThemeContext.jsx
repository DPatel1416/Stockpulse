/**
 * File purpose: Provides shared Theme Context state and actions to React components without passing props through every level.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const THEME_KEY = 'stockpulse_theme';

/**
 * Returns the system theme needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {'light'|'dark'} The operating system's preferred color scheme.
 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Returns the initial theme needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @returns {*} The requested initial theme result.
 */
function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light';
}

/**
 * Renders the theme provider React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: theme === 'system' ? getSystemTheme() : theme,
      setTheme,
      /**
       * Switches the theme between its supported states.
       * Keeping the state transition named makes interactive behavior easier to trace.
       * @returns {void|*} No value is required; the toggle theme state changes are applied.
       */
      toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Returns the current theme and the action used to switch it.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @returns {object} Current theme information and the theme toggle action.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
