/**
 * File purpose: Defines the reusable Bottom Nav React component and its focused user interaction.
 */
import { BookOpen, BriefcaseBusiness, LayoutDashboard, LogIn, Search, Star, UserRound } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccountSettingsModal from '../auth/AccountSettingsModal';

const links = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/stock/AAPL', label: 'Search', icon: Search },
  { to: '/watchlist', label: 'Watch', icon: Star },
  { to: '/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
  { to: '/learn', label: 'Learn', icon: BookOpen },
];

// Bottom navigation keeps core workflows thumb-friendly on mobile screens.
/**
 * Renders the bottom nav React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function BottomNav() {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav" aria-label="Mobile primary navigation">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} aria-label={label} title={label}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
        {user ? (
          <button className={settingsOpen ? 'active' : ''} type="button" aria-label="Open account settings" title="Account" onClick={() => setSettingsOpen(true)}>
            <UserRound size={18} />
            <span>Account</span>
          </button>
        ) : (
          <NavLink to="/login" aria-label="Log in" title="Log in">
            <LogIn size={18} />
            <span>Log in</span>
          </NavLink>
        )}
      </nav>
      <AccountSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
