/**
 * File purpose: Defines the reusable Bottom Nav React component and its focused user interaction.
 */
import { BookOpen, BriefcaseBusiness, LayoutDashboard, Search, Star } from 'lucide-react';
import { NavLink } from 'react-router-dom';

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
  return (
    <nav className="bottom-nav" aria-label="Mobile primary navigation">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}>
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
