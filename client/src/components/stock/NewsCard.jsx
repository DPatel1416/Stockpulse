/**
 * File purpose: Defines the reusable News Card React component and its focused user interaction.
 */
import { ExternalLink } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import StockLogo from './StockLogo';

// News cards open external articles in a new tab while keeping the dashboard scan-friendly.
/**
 * Renders the news card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function NewsCard({ item }) {
  const hasArticleUrl = Boolean(item.url);
  const content = (
    <div className="news-card-content">
      <div className="section-title news-card-meta">
        <span className="chip ticker-chip-with-logo">
          <StockLogo ticker={item.ticker || 'MARKET'} logo={item.logo} size={22} />
          {item.ticker || 'MARKET'}
        </span>
        <span className="muted">{item.source}</span>
      </div>
      <h3 className="news-card-title">{item.title}</h3>
      <p className="muted news-card-summary">{item.summary || 'No summary available.'}</p>
      <span className={hasArticleUrl ? 'positive news-card-action' : 'muted news-card-action'}>
        {hasArticleUrl ? 'Open full article' : 'Source link unavailable'}
        {hasArticleUrl && <ExternalLink size={15} />}
      </span>
    </div>
  );

  return (
    <GlassCard variant="compact" className={`news-card ${hasArticleUrl ? 'is-linked' : ''}`}>
      {hasArticleUrl ? (
        <a className="news-card-link" href={item.url} target="_blank" rel="noreferrer" aria-label={`Open full article: ${item.title}`}>
          {content}
        </a>
      ) : content}
    </GlassCard>
  );
}
