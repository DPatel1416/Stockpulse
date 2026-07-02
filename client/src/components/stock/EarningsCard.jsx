/**
 * File purpose: Defines the reusable Earnings Card React component and its focused user interaction.
 */
import GlassCard from '../ui/GlassCard';
import StockLogo from './StockLogo';

// Earnings cards make upcoming company reports easy to spot without implying advice.
/**
 * Renders the earnings card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function EarningsCard({ item }) {
  return (
    <GlassCard variant="compact" className="inline-earnings-card" bodyClassName="inline-earnings-body">
      <div className="inline-earnings-content">
        <StockLogo stock={item} size={38} className="inline-earnings-icon" />
        <div>
          <strong>{item.ticker}</strong>
          <p className="muted" style={{ margin: '3px 0' }}>{item.date} - {item.time}</p>
          <small>EPS estimate: {item.epsEstimate ? `$${item.epsEstimate}` : 'Not available'}</small>
        </div>
      </div>
    </GlassCard>
  );
}
