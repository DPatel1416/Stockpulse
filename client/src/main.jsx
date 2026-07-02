/**
 * File purpose: Starts the React application and installs the global authentication, guest-session, and theme providers.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// React owns the whole application from this single mount point.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
