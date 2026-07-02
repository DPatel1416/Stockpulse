/**
 * File purpose: Defines the reusable Empty State React component and its focused user interaction.
 */
import { Search } from 'lucide-react';
import Button from './Button';
import GlassCard from './GlassCard';

// EmptyState turns missing data into a clear next action for beginner users.
/**
 * Renders the empty state React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function EmptyState({ title, message, actionLabel, onAction, icon: Icon = Search, className = '' }) {
  return (
    <GlassCard className={className} variant="compact">
      <div style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
        <span className="brand-mark">
          <Icon size={20} />
        </span>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="muted" style={{ margin: '8px 0 0' }}>{message}</p>
        </div>
        {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </GlassCard>
  );
}
