/**
 * File purpose: Assembles the Learn screen from reusable components, API data, and page-specific interactions.
 */
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, Calculator, CheckCircle2, Compass, Search, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import { learningTerms } from '../data/mockData';
import { formatCurrency } from '../utils/format';

const starterSteps = [
  ['Learn the language', 'Understand stocks, ETFs, indexes, orders, returns, and risk before placing a trade.'],
  ['Define the goal', 'Choose a time horizon and keep near-term spending money separate from investing practice.'],
  ['Build a simple mix', 'Compare diversified funds with individual companies instead of relying on one ticker.'],
  ['Practice the process', 'Use the virtual portfolio to record a reason, place an order, and review the result.'],
];

const beginnerChecks = [
  'I can explain what I am buying in one sentence.',
  'I understand that price can fall and returns are not guaranteed.',
  'I checked the order type, quantity, and estimated total.',
  'I am comparing costs, diversification, and time horizon, not only recent performance.',
];

// Learn provides offline-friendly finance definitions for students using the app.
/**
 * Renders the learn React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Learn() {
  const { openInsight } = useOutletContext();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState('Stock');
  const [monthlyContribution, setMonthlyContribution] = useState(100);
  const [years, setYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(6);
  const terms = learningTerms.filter((item) => item.term.toLowerCase().includes(query.toLowerCase()) || item.topic.toLowerCase().includes(query.toLowerCase()));
  const projection = useMemo(() => {
    const contribution = Math.max(0, Number(monthlyContribution) || 0);
    const monthCount = Math.max(0, Number(years) || 0) * 12;
    const monthlyRate = (Number(annualReturn) || 0) / 100 / 12;
    const contributed = contribution * monthCount;
    const futureValue = monthlyRate === 0
      ? contributed
      : contribution * (((1 + monthlyRate) ** monthCount - 1) / monthlyRate);

    return { contributed, futureValue, growth: futureValue - contributed };
  }, [annualReturn, monthlyContribution, years]);

  return (
    <div className="page-stack">
      <GlassCard variant="glow">
        <span className="chip">Beginner-friendly finance</span>
        <h1 className="page-title" style={{ margin: '14px 0 8px' }}>Learn the Market</h1>
        <p className="muted">Understand the terms used in charts, earnings, watchlists, and paper trading.</p>
        <div style={{ maxWidth: 520 }}>
          <Input label="Filter terms" name="learn-search" placeholder="Search volume, P/E, earnings..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </GlassCard>

      <div className="learn-foundations-grid">
        <GlassCard className="learn-path-card">
          <div className="section-title">
            <div><span className="chip">Start here</span><h2>Your first four steps</h2></div>
            <Compass className="positive" />
          </div>
          <ol className="learn-path-list">
            {starterSteps.map(([title, description], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div><strong>{title}</strong><p className="muted">{description}</p></div>
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard className="learn-calculator-card">
          <div className="section-title">
            <div><span className="chip">Try the math</span><h2>Compounding explorer</h2></div>
            <Calculator className="positive" />
          </div>
          <p className="muted">See how regular contributions and time interact. The return is an illustration, not a forecast.</p>
          <div className="learn-calculator-controls">
            <Input label="Monthly amount" name="learn-monthly" type="number" min="0" step="25" value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value)} />
            <Input label="Years" name="learn-years" type="number" min="1" max="50" value={years} onChange={(event) => setYears(event.target.value)} />
            <Input label="Illustrative return %" name="learn-return" type="number" min="-20" max="30" step="0.5" value={annualReturn} onChange={(event) => setAnnualReturn(event.target.value)} />
          </div>
          <div className="learn-projection-output">
            <span><small>Contributions</small><strong>{formatCurrency(projection.contributed)}</strong></span>
            <span><small>Illustrative growth</small><strong>{formatCurrency(projection.growth)}</strong></span>
            <span className="learn-projection-total"><small>Illustrative total</small><strong>{formatCurrency(projection.futureValue)}</strong></span>
          </div>
        </GlassCard>
      </div>

      <div className="learn-section-heading">
        <div><span className="chip">Reference library</span><h2>Core investing vocabulary</h2></div>
        <span className="muted">{terms.length} concepts</span>
      </div>

      <div className="content-grid equal-card-grid learn-grid">
        {terms.map((term) => (
          <div className="span-4" key={term.term}>
            <GlassCard variant="compact">
              <button type="button" aria-expanded={expanded === term.term} onClick={() => setExpanded(expanded === term.term ? '' : term.term)} style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 10 }}>
                <span className="brand-mark">{term.term === expanded ? <BookOpen size={18} /> : <Search size={18} />}</span>
                <small className="muted">{term.topic}</small>
                <h2 style={{ margin: 0 }}>{term.term}</h2>
                <p className="muted" style={{ margin: 0 }}>{term.short}</p>
                {expanded === term.term && <p style={{ marginBottom: 0 }}>{term.example}</p>}
              </button>
            </GlassCard>
          </div>
        ))}
      </div>

      <GlassCard className="learn-safety-card" variant="glow">
        <div className="learn-safety-grid">
          <div>
            <div className="section-title"><h2>Before placing an order</h2><ShieldCheck className="positive" /></div>
            <div className="learn-checklist">
              {beginnerChecks.map((item) => <span key={item}><CheckCircle2 size={17} />{item}</span>)}
            </div>
          </div>
          <div className="learn-ai-callout">
            <Sparkles className="positive" />
            <h2>Ask for a simpler explanation</h2>
            <p className="muted">Get a plain-language explanation using the concept you are viewing and simple numbers.</p>
            <Button onClick={() => openInsight({ screen: 'Learn', query, terms })}>Ask Learn AI</Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
