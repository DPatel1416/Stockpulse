/**
 * File purpose: Defines the reusable Stat Card React component and its focused user interaction.
 */
import GlassCard from './GlassCard';
import { getChangeClass } from '../../utils/format';

// Stat cards are compact KPI surfaces for prices, P/L, volume, and market status.
/**
 * Renders the stat card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function StatCard({ label, value, detail, change, icon: Icon }) {
  return (
    <GlassCard variant="compact">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: '.86rem' }}>{label}</p>
          <strong style={{ display: 'block', marginTop: 8, fontSize: '1.35rem' }}>{value}</strong>
          {detail && <small className="muted">{detail}</small>}
        </div>
        {Icon && (
          <span className="brand-mark" style={{ width: 38, height: 38, borderRadius: 14 }}>
            <Icon size={18} />
          </span>
        )}
      </div>
      {change !== undefined && (
        <p className={getChangeClass(change)} style={{ margin: '12px 0 0', fontWeight: 800 }}>
          {Number(change) >= 0 ? '+' : ''}
          {Number(change).toFixed(2)}% today
        </p>
      )}
    </GlassCard>
  );
}
