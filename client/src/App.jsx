/**
 * File purpose: Defines the shared application shell, route table, guest notices, and AI insight panel used across StockPulse.
 */
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Clock3, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import AIInsightPanel from './components/ai/AIInsightPanel';
import GuestChoiceModal from './components/auth/GuestChoiceModal';
import BottomNav from './components/layout/BottomNav';
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';
import Footer from './components/legal/Footer';
import Button from './components/ui/Button';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestSessionProvider, useGuestSession } from './context/GuestSessionContext';
import { ThemeProvider } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import Learn from './pages/Learn';
import Login from './pages/Login';
import Portfolio from './pages/Portfolio';
import Register from './pages/Register';
import StockDetails from './pages/StockDetails';
import Watchlist from './pages/Watchlist';
import { ACCESS_CHOICE_KEY, rememberAccessChoice } from './utils/accessChoice';

// AppShell owns navigation and the global AI panel so every page can open it with context.
/**
 * Renders the app shell React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isSessionReady } = useAuth();
  const { isGuest, hasGuestChanges } = useGuestSession();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState({ screen: 'Dashboard' });
  const [guestChoiceOpen, setGuestChoiceOpen] = useState(false);

  useEffect(() => {
    if (!isSessionReady || isAuthenticated) {
      setGuestChoiceOpen(false);
      return;
    }

    setGuestChoiceOpen(!localStorage.getItem(ACCESS_CHOICE_KEY));
  }, [isAuthenticated, isSessionReady]);

  /**
   * Records that the visitor chose temporary guest access and closes the choice dialog.
   * Saving the choice avoids interrupting the visitor with the same question on every route.
   * @returns {void} No value is returned; browser storage and modal state are updated.
   */
  const continueAsGuest = useCallback(() => {
    rememberAccessChoice('guest');
    setGuestChoiceOpen(false);
  }, []);

  /**
   * Records an account-based choice and sends the visitor to an authentication screen.
   * Keeping this navigation in one callback ensures login and registration make the same state updates.
   * @param {string} path - Login or registration route to open.
   * @returns {void} No value is returned; the current route is changed.
   */
  const continueToAccount = useCallback((path) => {
    rememberAccessChoice('account');
    setGuestChoiceOpen(false);
    navigate(path);
  }, [navigate]);

  /**
   * Opens the AI panel with the most relevant page context.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} context - Current page and market data supplied to the AI explanation.
   * @returns {void} No value is returned; the insight panel state is opened.
   */
  function openInsight(context) {
    setAiContext(context || { screen: 'Dashboard' });
    setAiOpen(true);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-stage">
        <TopNav />
        {isGuest && (
          <div className={`guest-session-notice${hasGuestChanges ? ' has-changes' : ''}`} role="status">
            <Clock3 size={15} aria-hidden="true" />
            <span><strong>Guest session</strong> {hasGuestChanges ? 'Unsaved changes will reset when this page refreshes.' : 'Favorites are temporary and reset when this page refreshes.'}</span>
          </div>
        )}
        <Outlet context={{ openInsight }} />
        <Footer compact={location.pathname !== '/learn'} />
      </main>
      <BottomNav />
      <Button className="floating-ai" aria-label="Open AI insight panel" title="Get Insight" onClick={() => openInsight(aiContext)}>
        <Sparkles size={18} />
        <span>Get Insight</span>
      </Button>
      <AIInsightPanel open={aiOpen} onClose={() => setAiOpen(false)} context={aiContext} />
      <GuestChoiceModal
        open={guestChoiceOpen}
        onContinueAsGuest={continueAsGuest}
        onLogin={() => continueToAccount('/login')}
        onRegister={() => continueToAccount('/register')}
      />
    </div>
  );
}

// PublicShell lets authentication pages share the full legal footer without duplicating page markup.
/**
 * Renders the public shell React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
function PublicShell() {
  return (
    <div className="public-shell">
      <Outlet />
      <Footer />
    </div>
  );
}

// Providers are stacked here so auth, theme, and notifications are available everywhere.
/**
 * Renders the app React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GuestSessionProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<PublicShell />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>
                <Route element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="stock/:ticker" element={<StockDetails />} />
                  <Route path="watchlist" element={<Watchlist />} />
                  <Route path="paper-trading" element={<Navigate to="/portfolio" replace />} />
                  <Route path="portfolio" element={<Portfolio />} />
                  <Route path="learn" element={<Learn />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </GuestSessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
