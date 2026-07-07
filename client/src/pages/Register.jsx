/**
 * File purpose: Assembles the Register screen from reusable components, API data, and page-specific interactions.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BadgePlus, BarChart3, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { rememberAccessChoice } from '../utils/accessChoice';
import { isValidEmail } from '../utils/validation';

// Register creates a virtual portfolio with a $10,000 opening cash balance.
/**
 * Renders the register React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticating } = useAuth();
  const { showToast } = useToasts();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  /**
   * Handles the submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the handle submit side effects finish.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!isValidEmail(form.email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    if (form.password !== form.confirmPassword) {
      showToast('Passwords must match.', 'error');
      return;
    }

    try {
      await register(form);
      showToast('Account created with $10,000 virtual cash.', 'success');
      navigate('/');
    } catch (error) {
      showToast(error.message || 'Unable to register. Try another email.', 'error');
    }
  }

  /**
   * Handles the guest access interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @returns {void|*} No value is required; the handle guest access state changes are applied.
   */
  function handleGuestAccess() {
    rememberAccessChoice('guest');
    navigate('/');
  }

  return (
    <main className="auth-screen">
      <GlassCard className="auth-card auth-card-shell" bodyClassName="auth-card-body auth-card-grid" variant="glow">
        <section className="auth-visual-panel auth-register-visual" aria-hidden="true">
          <div className="auth-visual-top">
            <span className="brand-mark auth-brand-mark"><BarChart3 size={22} /></span>
            <div>
              <strong>StockPulse Learn</strong>
              <small>Build confidence first</small>
            </div>
          </div>
          <div className="auth-market-card">
            <span className="auth-market-kicker"><Sparkles size={14} /> Paper trading starter</span>
            <strong>$10,000</strong>
            <small>Create a saved workspace for practice trades, watchlists, learning progress, and portfolio tracking.</small>
            <div className="auth-mini-chart">
              <span style={{ '--height': '34%' }} />
              <span style={{ '--height': '45%' }} />
              <span style={{ '--height': '62%' }} />
              <span style={{ '--height': '54%' }} />
              <span style={{ '--height': '76%' }} />
              <span style={{ '--height': '68%' }} />
              <span style={{ '--height': '88%' }} />
            </div>
          </div>
          <div className="auth-proof-grid">
            <span><ShieldCheck size={15} /> Private account</span>
            <span><TrendingUp size={15} /> Portfolio history</span>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-logo-lockup" aria-label="StockPulse">
            <span className="brand-mark"><BadgePlus size={20} /></span>
            <h1>Create account</h1>
            <p className="muted">Start with exactly $10,000 in simulated cash.</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <Input label="Name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input label="Email" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            <PasswordInput label="Password" name="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
            <Button type="submit" disabled={isAuthenticating}>{isAuthenticating ? 'Creating...' : 'Create account'}</Button>
          </form>
          <Button className="auth-wide-action google-auth-button" variant="secondary" disabled title="Google sign-in is coming soon">
            <span className="google-auth-mark" aria-hidden="true">G</span>
            Sign in with Google
            <small>Coming soon</small>
          </Button>
          <Button className="auth-wide-action" variant="ghost" onClick={handleGuestAccess} disabled={isAuthenticating}>
            Continue as guest
          </Button>
          <p className="muted">Already have an account? <Link className="positive" to="/login">Log in</Link></p>
        </section>
      </GlassCard>
    </main>
  );
}
