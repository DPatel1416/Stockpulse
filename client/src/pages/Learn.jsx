/**
 * File purpose: Assembles the Learn screen from reusable components, educational data, and interactive practice tools.
 */
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  Layers3,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import { learningTerms } from '../data/mockData';
import { formatCurrency } from '../utils/format';

const starterSteps = [
  {
    label: 'Vocabulary',
    title: 'Learn the language',
    description: 'Understand stocks, ETFs, indexes, orders, returns, and risk before placing a trade.',
    practice: 'Start with Stock, ETF, Market Order, and Diversification in the reference library.',
  },
  {
    label: 'Planning',
    title: 'Define the goal',
    description: 'Choose a time horizon and keep near-term spending money separate from investing practice.',
    practice: 'Write down one goal, its target date, and how much uncertainty you can tolerate.',
  },
  {
    label: 'Portfolio',
    title: 'Build a simple mix',
    description: 'Compare diversified funds with individual companies instead of relying on one ticker.',
    practice: 'Compare one broad ETF with two companies and note how each changes the risk of the mix.',
  },
  {
    label: 'Review',
    title: 'Practice the process',
    description: 'Use the virtual portfolio to record a reason, place an order, and review the result.',
    practice: 'Place a small paper trade, record your reason, then revisit it after the market moves.',
  },
];

const beginnerChecks = [
  'I can explain what I am buying in one sentence.',
  'I understand that price can fall and returns are not guaranteed.',
  'I checked the order type, quantity, and estimated total.',
  'I am comparing costs, diversification, and time horizon, not only recent performance.',
];

const topicGroups = [
  { key: 'all', label: 'All concepts', icon: Layers3, topics: [] },
  { key: 'basics', label: 'Basics', icon: BookOpen, topics: ['Getting Started', 'Company Size', 'Price Context'] },
  { key: 'markets', label: 'Markets', icon: Activity, topics: ['Market Activity', 'Company Results', 'Valuation'] },
  { key: 'orders', label: 'Orders', icon: ShoppingCart, topics: ['Placing Orders'] },
  { key: 'risk', label: 'Risk & costs', icon: ShieldCheck, topics: ['Risk', 'Costs'] },
  { key: 'habits', label: 'Habits & returns', icon: TrendingUp, topics: ['Building Habits', 'Investment Returns', 'Portfolio Math'] },
];

const topicGroupByTopic = Object.fromEntries(
  topicGroups.flatMap((group) => group.topics.map((topic) => [topic, group.key])),
);

const topicIconByGroup = {
  basics: BookOpen,
  markets: Activity,
  orders: ShoppingCart,
  risk: ShieldCheck,
  habits: TrendingUp,
};

/**
 * Calculates the future value of equal monthly contributions.
 * The formula is kept outside the component so the chart and summary always use identical math.
 * @param {number} monthlyAmount - Amount contributed at the end of each month.
 * @param {number} monthCount - Number of monthly contributions included in the projection.
 * @param {number} monthlyRate - Illustrative monthly return expressed as a decimal.
 * @returns {number} The projected account value after the requested number of months.
 */
function calculateFutureValue(monthlyAmount, monthCount, monthlyRate) {
  if (monthCount <= 0) return 0;
  if (monthlyRate === 0) return monthlyAmount * monthCount;
  return monthlyAmount * (((1 + monthlyRate) ** monthCount - 1) / monthlyRate);
}

/**
 * Builds both the summary totals and yearly chart points for the compounding explorer.
 * Inputs are clamped to the ranges shown in the form so partially typed values cannot distort the chart.
 * @param {number|string} monthlyContribution - Monthly amount entered by the learner.
 * @param {number|string} years - Number of years entered by the learner.
 * @param {number|string} annualReturn - Illustrative annual return percentage.
 * @returns {{contributed: number, futureValue: number, growth: number, series: Array<object>}} Projection totals and chart data.
 */
function buildProjection(monthlyContribution, years, annualReturn) {
  const contribution = Math.max(0, Number(monthlyContribution) || 0);
  const yearCount = Math.min(50, Math.max(1, Math.round(Number(years) || 1)));
  const returnPercent = Math.min(30, Math.max(-20, Number(annualReturn) || 0));
  const monthlyRate = returnPercent / 100 / 12;
  const series = Array.from({ length: yearCount + 1 }, (_, year) => {
    const monthCount = year * 12;
    const contributed = contribution * monthCount;
    const balance = calculateFutureValue(contribution, monthCount, monthlyRate);
    return { year, contributed, balance };
  });
  const finalPoint = series[series.length - 1];

  return {
    contributed: finalPoint.contributed,
    futureValue: finalPoint.balance,
    growth: finalPoint.balance - finalPoint.contributed,
    series,
  };
}

/**
 * Formats large chart-axis values compactly so labels remain readable at narrow widths.
 * @param {number} value - Currency value displayed on the chart axis.
 * @returns {string} A compact currency label such as "$25K".
 */
function formatCompactCurrency(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a chart year as a short time label.
 * @param {number} value - Year number from the projection series.
 * @returns {string} A concise year label.
 */
function formatYearTick(value) {
  return `${value}y`;
}

/**
 * Renders the chart tooltip with contributions and projected value for one year.
 * @param {object} props - Tooltip state supplied by Recharts.
 * @param {boolean} props.active - Whether the pointer is currently over a chart point.
 * @param {Array<object>} props.payload - Recharts values associated with the active point.
 * @param {number} props.label - Active year on the chart.
 * @returns {JSX.Element|null} Tooltip content when active, otherwise nothing.
 */
function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="learn-chart-tooltip">
      <strong>Year {label}</strong>
      <span><small>Projected value</small>{formatCurrency(point.balance)}</span>
      <span><small>Contributions</small>{formatCurrency(point.contributed)}</span>
    </div>
  );
}

// Learn provides offline-friendly finance definitions and guided practice for students using the app.
/**
 * Renders the interactive Learn page.
 * State stays local because these exercises are exploratory and should respond immediately without API requests.
 * @returns {JSX.Element} The complete learning interface.
 */
export default function Learn() {
  const { openInsight } = useOutletContext();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState('Stock');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [activeStep, setActiveStep] = useState(0);
  const [monthlyContribution, setMonthlyContribution] = useState(100);
  const [years, setYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(6);
  const activePathStep = starterSteps[activeStep];
  const projection = useMemo(
    () => buildProjection(monthlyContribution, years, annualReturn),
    [annualReturn, monthlyContribution, years],
  );
  const terms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const activeGroup = topicGroups.find((group) => group.key === selectedTopic) || topicGroups[0];

    return learningTerms.filter((item) => {
      const matchesTopic = activeGroup.key === 'all' || activeGroup.topics.includes(item.topic);
      const searchableText = `${item.term} ${item.topic} ${item.short} ${item.example}`.toLowerCase();
      return matchesTopic && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [query, selectedTopic]);

  return (
    <div className="page-stack learn-page">
      <GlassCard className="learn-hero-card" variant="glow">
        <span className="chip">Beginner-friendly finance</span>
        <h1 className="page-title">Learn the Market</h1>
        <p className="muted">Build confidence with guided steps, interactive examples, and plain-language investing concepts.</p>
        <div className="learn-filter">
          <Input label="Find a concept" name="learn-search" placeholder="Search volume, P/E, earnings..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </GlassCard>

      <div className="learn-foundations-grid">
        <GlassCard className="learn-path-card">
          <div className="section-title">
            <div><span className="chip">Start here</span><h2>Your first four steps</h2></div>
            <Compass className="positive" />
          </div>

          <div className="learn-path-progress">
            <div><span className="muted">Path position</span><strong>{activeStep + 1} of {starterSteps.length}</strong></div>
            <div className="learn-path-progress-track" role="progressbar" aria-label="Learning path position" aria-valuemin="1" aria-valuemax={starterSteps.length} aria-valuenow={activeStep + 1}>
              <span style={{ width: `${((activeStep + 1) / starterSteps.length) * 100}%` }} />
            </div>
          </div>

          <ol className="learn-path-list">
            {starterSteps.map((step, index) => (
              <li key={step.title} className={activeStep === index ? 'active' : ''}>
                <button type="button" aria-current={activeStep === index ? 'step' : undefined} onClick={() => setActiveStep(index)}>
                  <span className="learn-path-number">{index + 1}</span>
                  <span className="learn-path-copy"><small>{step.label}</small><strong>{step.title}</strong></span>
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ol>

          <div className="learn-path-focus" aria-live="polite">
            <span className="learn-path-focus-label">Current focus</span>
            <strong>{activePathStep.title}</strong>
            <p className="muted">{activePathStep.description}</p>
            <span className="learn-path-practice"><CheckCircle2 size={15} />{activePathStep.practice}</span>
          </div>
        </GlassCard>

        <GlassCard className="learn-calculator-card">
          <div className="section-title">
            <div><span className="chip">Try the math</span><h2>Compounding explorer</h2></div>
            <Calculator className="positive" />
          </div>
          <p className="muted">See how contributions and time interact. The return is an illustration, not a forecast.</p>
          <div className="learn-calculator-controls">
            <Input label="Monthly amount" name="learn-monthly" type="number" min="0" step="25" value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value)} />
            <Input label="Years" name="learn-years" type="number" min="1" max="50" value={years} onChange={(event) => setYears(event.target.value)} />
            <Input label="Illustrative return %" name="learn-return" type="number" min="-20" max="30" step="0.5" value={annualReturn} onChange={(event) => setAnnualReturn(event.target.value)} />
          </div>

          <div className="learn-projection-chart-shell">
            <div className="learn-chart-legend" aria-hidden="true">
              <span><i className="projected" />Projected value</span>
              <span><i className="contributed" />Contributions</span>
            </div>
            <div className="learn-projection-chart" role="img" aria-label="Projected portfolio value and total contributions over time">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="learnProjectionGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.015} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tickFormatter={formatYearTick} minTickGap={28} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} width={44} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                  <Tooltip cursor={{ stroke: 'var(--glass-stroke-strong)', strokeWidth: 1 }} content={<ProjectionTooltip />} />
                  <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2.2} fill="url(#learnProjectionGradient)" />
                  <Area type="monotone" dataKey="contributed" stroke="var(--purple)" strokeWidth={1.4} strokeDasharray="4 4" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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

      <div className="learn-topic-filters" role="group" aria-label="Filter concepts by topic">
        {topicGroups.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className={selectedTopic === key ? 'active' : ''} aria-pressed={selectedTopic === key} onClick={() => setSelectedTopic(key)}>
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="content-grid equal-card-grid learn-grid learn-reference-grid">
        {terms.length > 0 ? terms.map((term) => {
          const topicGroup = topicGroupByTopic[term.topic] || 'basics';
          const TopicIcon = topicIconByGroup[topicGroup] || BookOpen;
          const isExpanded = expanded === term.term;

          return (
            <div className="span-4" key={term.term}>
              <GlassCard className={`learn-reference-card ${isExpanded ? 'expanded' : ''}`} variant="compact" data-topic-group={topicGroup}>
                <button className="learn-reference-button" type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? '' : term.term)}>
                  <span className="learn-reference-header">
                    <span className="learn-reference-icon"><TopicIcon size={17} /></span>
                    <span className="learn-reference-title"><small>{term.topic}</small><strong>{term.term}</strong></span>
                    <span className="learn-reference-action"><small>{isExpanded ? 'Overview' : 'Details'}</small><ChevronDown className="learn-reference-chevron" size={16} /></span>
                  </span>
                  <span className="learn-reference-summary">{term.short}</span>
                  <span className={`learn-reference-details ${isExpanded ? 'detail-view' : 'overview-view'}`}>
                    {isExpanded ? (
                      <>
                        <span className="learn-reference-detail">
                          <small>Practical example</small>
                          <span>{term.example}</span>
                        </span>
                        <span className="learn-reference-detail watch-for">
                          <small>Watch for</small>
                          <span>{term.watchFor || 'Consider how this concept changes with market conditions and your own goals.'}</span>
                        </span>
                      </>
                    ) : (
                      <span className="learn-reference-detail">
                        <small>Why it matters</small>
                        <span>{term.why || term.short}</span>
                      </span>
                    )}
                  </span>
                </button>
              </GlassCard>
            </div>
          );
        }) : (
          <div className="span-12">
            <GlassCard className="learn-empty-state" variant="compact">
              <Search size={20} />
              <div><strong>No matching concepts</strong><p className="muted">Try another search or choose a different topic.</p></div>
            </GlassCard>
          </div>
        )}
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
            <p className="muted">Get a plain-language explanation using the concepts you are viewing and simple numbers.</p>
            <Button onClick={() => openInsight({ screen: 'Learn', query, terms })}>Ask Learn AI</Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}