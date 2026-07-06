/**
 * File purpose: Assembles the Login screen from reusable components, API data, and page-specific interactions.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BarChart3, KeyRound, X } from 'lucide-react';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { rememberAccessChoice } from '../utils/accessChoice';
import { isValidEmail } from '../utils/validation';

// Login uses real credentials while guest access remains available for browsing without saved account data.
/**
 * Renders the login React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticating } = useAuth();
  const { showToast } = useToasts();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (!showForgotPassword) return undefined;

    /**
     * Closes the future-update dialog when the user presses Escape.
     * This matches the rest of the app's modal behavior and keeps keyboard users in control.
     * @param {KeyboardEvent} event - Keyboard event fired by the browser.
     * @returns {void} No value is returned; the modal state is updated when needed.
     */
    function handleEscape(event) {
      if (event.key === 'Escape') setShowForgotPassword(false);
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showForgotPassword]);

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

    try {
      await login(form);
      showToast('Welcome back to StockPulse.', 'success');
      navigate('/');
    } catch (error) {
      showToast(error.message || 'Unable to log in. Check your email and password.', 'error');
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

  /**
   * Opens the forgot-password placeholder only after the typed email has a valid shape.
   * The real reset flow is intentionally left as a future feature to avoid unnecessary SMTP setup.
   * @returns {void} No value is returned; the modal or validation toast is shown.
   */
  function handleForgotPassword() {
    if (!isValidEmail(form.email)) {
      showToast('Enter a valid email address first.', 'error');
      return;
    }

    setShowForgotPassword(true);
  }

  return (
    <main className="auth-screen">
      <GlassCard className="auth-card" bodyClassName="auth-card-body" variant="glow">
        <div className="auth-logo-lockup" aria-label="StockPulse">
          <span className="brand-mark"><BarChart3 size={22} /></span>
          <h1>StockPulse</h1>
          <p className="muted">Log in to save watchlists and simulated trades.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input label="Email" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <PasswordInput label="Password" name="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <button className="auth-forgot-password" type="button" onClick={handleForgotPassword}>
            Forgot password?
          </button>
          <Button type="submit" disabled={isAuthenticating}>{isAuthenticating ? 'Logging in...' : 'Log in'}</Button>
        </form>
        <Button className="auth-wide-action google-auth-button" variant="secondary" disabled title="Google sign-in is coming soon">
          <span className="google-auth-mark" aria-hidden="true">G</span>
          Sign in with Google
          <small>Coming soon</small>
        </Button>
        <Button className="auth-wide-action" variant="ghost" onClick={handleGuestAccess} disabled={isAuthenticating}>
          Continue as guest
        </Button>
        <p className="muted">New here? <Link className="positive" to="/register">Create an account</Link></p>
      </GlassCard>
      {showForgotPassword && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForgotPassword(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title" onMouseDown={(event) => event.stopPropagation()}>
            <GlassCard className="confirm-modal-card" bodyClassName="confirm-modal-body" variant="glow">
              <div className="section-title">
                <span className="brand-mark">
                  <KeyRound size={20} />
                </span>
                <Button variant="ghost" iconOnly aria-label="Close forgot password dialog" onClick={() => setShowForgotPassword(false)}>
                  <X size={18} />
                </Button>
              </div>
              <h2 id="forgot-password-title" className="confirm-modal-title">Password reset coming soon</h2>
              <p className="muted confirm-modal-description">
                Password recovery for {form.email.trim()} will be added in a future update.
              </p>
              <div className="confirm-modal-actions">
                <Button onClick={() => setShowForgotPassword(false)}>Got it</Button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </main>
  );
}
