/**
 * File purpose: Starts the React application and installs the global authentication, guest-session, and theme providers.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/globals/variables.css';
import './styles/globals/reset.css';
import './styles/layout/dashboard-layout.css';
import './styles/components/footer.css';
import './styles/components/modal.css';
import './styles/pages/dashboard.css';
import './styles/pages/learn.css';
import './styles/globals/utilities.css';
import './styles/components/cards.css';
import './styles/components/charts.css';
import './styles/components/buttons.css';
import './styles/components/forms.css';
import './styles/components/tables.css';
import './styles/components/scroll-panels.css';
import './styles/layout/sidebar.css';
import './styles/layout/navbar.css';
import './styles/pages/search.css';
import './styles/pages/watchlist.css';
import './styles/pages/dashboard-panels.css';
import './styles/pages/portfolio.css';
import './styles/pages/search-details.css';
import './styles/layout/bottom-nav.css';
import './styles/components/feedback.css';
import './styles/components/nested-surfaces.css';
import './styles/pages/login.css';
import './styles/globals/density.css';
import './styles/pages/learn-experience.css';
import './styles/responsive/mobile-dashboard.css';
import './styles/responsive/mobile-workflows.css';
import './styles/responsive/mobile-final.css';
import './styles/responsive/mobile-portfolio.css';
import './styles/pages/account.css';
import './styles/responsive/account-mobile.css';
import './styles/pages/login-cinematic.css';
import './styles/pages/account-actions.css';
import './styles/responsive/login-density.css';
import './styles/responsive/login-desktop.css';
import './styles/pages/login-headline.css';
import './styles/pages/login-register.css';
import './styles/pages/login-light.css';
import './styles/pages/account-simplified.css';
import './styles/components/auth-verification.css';
import './styles/pages/login-theme-lock.css';
import './styles/pages/login-logo.css';
import './styles/pages/login-neutralizer.css';

// React owns the whole application from this single mount point.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

