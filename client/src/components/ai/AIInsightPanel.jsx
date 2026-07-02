/**
 * File purpose: Defines the reusable AI Insight panel that explains dashboard data in educational language.
 */
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { insightPrompts } from '../../data/mockData';
import { api } from '../../services/api';
import Button from '../ui/Button';
import GlassCard from '../ui/GlassCard';
import Input from '../ui/Input';

// The assistant is deliberately educational and avoids buy, sell, or hold recommendations.
/**
 * Renders the aiinsight panel React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function AIInsightPanel({ open, onClose, context }) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Requests an AI explanation and stores either the answer or a friendly error.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {string} question - Educational question submitted to the insight panel.
   * @returns {Promise<*>} A promise resolving to the ask result.
   */
  async function ask(question = prompt) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setPrompt(trimmedQuestion);
    setIsLoading(true);
    try {
      const result = await api.askAI({ prompt: trimmedQuestion, context });
      setAnswer(result.answer);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <aside className={`ai-panel ${open ? 'open' : ''}`} aria-label="StockPulse AI insight panel">
      <GlassCard variant="glow">
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-mark">
              <Sparkles size={18} />
            </span>
            <div>
              <h2>Learn AI</h2>
              <p className="muted" style={{ margin: 0 }}>Educational explanations only.</p>
            </div>
          </div>
          <Button variant="ghost" iconOnly aria-label="Close AI panel" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="chip-row">
            {insightPrompts.map((item) => (
              <button key={item} className="chip" type="button" onClick={() => ask(item)}>
                {item}
              </button>
            ))}
          </div>
          <Input
            label="Ask a learning question"
            name="ai-question"
            placeholder="Explain this chart in simple terms"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <Button onClick={() => ask()} disabled={isLoading}>{isLoading ? 'Thinking...' : 'Get insight'}</Button>
          <div className="glass-card compact" style={{ boxShadow: 'none' }}>
            <div className="card-body">
              <p style={{ marginTop: 0 }}>{answer || 'Ask about price movement, volume, earnings, news, or portfolio P/L.'}</p>
              <small className="muted">Educational explanation only, not financial advice.</small>
            </div>
          </div>
        </div>
      </GlassCard>
    </aside>
  );
}
