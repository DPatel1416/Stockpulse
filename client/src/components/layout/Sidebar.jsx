/**
 * File purpose: Defines the reusable Sidebar React component and its focused user interaction.
 */
import { useState } from 'react';
import { BarChart3, BookOpen, BriefcaseBusiness, LayoutDashboard, LogOut, Search, Settings, Star, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccountSettingsModal from '../auth/AccountSettingsModal';
import Button from '../ui/Button';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/stock/AAPL', label: 'Stock Search', icon: Search },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
  { to: '/learn', label: 'Learn', icon: BookOpen },
];

// Sidebar provides the desktop navigation rail requested in the PRD.
/**
 * Renders the sidebar React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <aside className="sidebar" aria-label="Primary">
        <NavLink className="brand" to="/">
          <span className="brand-mark"><BarChart3 size={21} /></span>
          <span>StockPulse</span>
        </NavLink>
        <nav className="nav-list">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} className="nav-link" to={to}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }} className="glass-card compact">
          <div className="card-body sidebar-account-card">
            <UserRound size={18} className="muted" />
            {user ? (
              <>
                <p style={{ margin: '10px 0 6px' }}>{user.name}</p>
                <small className="muted">{user.email}</small>
                <div className="sidebar-account-actions">
                  <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                    <Settings size={16} />
                    <span>Account settings</span>
                  </Button>
                  <Button variant="secondary" onClick={logout}>
                    <LogOut size={16} />
                    <span>Log out</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 6 }}>Virtual trading for education.</p>
                <small className="muted">Log in to save watchlists and virtual trades.</small>
                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  <Link className="button primary" to="/login">Log in</Link>
                  <Link className="button secondary" to="/register">Register</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
      <AccountSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
