/**
 * File purpose: Assembles the cinematic Login/Register screen from reusable components, API data, and page-specific interactions.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, KeyRound, LockKeyhole, Mail, PieChart, ShieldCheck, TrendingUp, UserRound, X } from 'lucide-react';
import Button from '../components/ui/Button';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { useToasts } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { rememberAccessChoice } from '../utils/accessChoice';
import { isStrongPassword, isValidEmail, PASSWORD_REQUIREMENT_MESSAGE } from '../utils/validation';

const ROTATING_WORDS = [
  'Playground',
  'Simulator',
  'Workspace',
  'Dashboard',
  'Portfolio',
  'Watchlist',
  'Strategy Lab',
  'Trading Desk',
  'Command Center',
  'Market Lab',
  'Trading Hub',
  'Analytics Hub',
  'Research Lab',
  'Edge',
  'Advantage',
];

const emptyLoginForm = { email: '', password: '' };
const emptyRegisterForm = { name: '', email: '', password: '', confirmPassword: '' };
const emptyPasswordResetForm = { newPassword: '', confirmPassword: '' };

// GoogleLogo uses Google's official four-color mark so the disabled sign-in button still looks professional.
/**
 * Renders the Google brand mark used in the disabled future sign-in button.
 * Inline SVG keeps the login page self-contained without adding another asset file.
 * @returns {JSX.Element} The rendered Google logo.
 */
function GoogleLogo() {
  return (
    <svg className="google-auth-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

// Login uses real credentials while guest access remains available for browsing without saved account data.
/**
 * Renders the combined login/register React component.
 * One card owns both auth modes so creating a user feels like flipping the same premium surface.
 * @param {object} props - Optional settings for the initial card mode.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Login({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, register, requestPasswordReset, resendVerification, resetPassword, isAuthenticating } = useAuth();
  const { showToast } = useToasts();
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login');
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [passwordResetForm, setPasswordResetForm] = useState(emptyPasswordResetForm);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [verificationNoticeEmail, setVerificationNoticeEmail] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  // Auth routes intentionally ignore the saved app theme so every auth and recovery state renders identically.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('stockpulse_theme') === 'dark' ? 'dark' : 'light';
    const applyDarkTheme = () => {
      if (root.classList.contains('dark') && !root.classList.contains('light')) return;
      root.classList.remove('light');
      root.classList.add('dark');
    };

    applyDarkTheme();
    const themeObserver = new MutationObserver(applyDarkTheme);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      themeObserver.disconnect();
      root.classList.remove('light', 'dark');
      root.classList.add(savedTheme);
    };
  }, []);

  useEffect(() => {
    setMode(initialMode === 'register' ? 'register' : 'login');
  }, [initialMode]);

  useEffect(() => {
    const status = searchParams.get('verification');
    if (!status) return;

    const messages = {
      success: 'Email verified. You can now log in.',
      expired: 'That verification link expired. Request a new one from the login form.',
      invalid: 'That verification link is invalid or has already been used.',
      missing: 'Verification token is missing. Request a new verification email.',
    };

    setMode('login');
    setVerificationStatus(status);
    showToast(messages[status] || 'Verification status updated.', status === 'success' ? 'success' : 'error');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  useEffect(() => {
    const resetToken = String(searchParams.get('resetToken') || '').trim();
    if (!resetToken) return;

    setMode('login');
    setPasswordResetToken(resetToken);
    setPasswordResetForm(emptyPasswordResetForm);
    setForgotStep('reset');
    setShowForgotPassword(true);
  }, [searchParams]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % ROTATING_WORDS.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showForgotPassword) return undefined;

    /**
     * Closes the future-update dialog when the user presses Escape.
     * This matches the rest of the app's modal behavior and keeps keyboard users in control.
     * @param {KeyboardEvent} event - Keyboard event fired by the browser.
     * @returns {void} No value is returned; the modal state is updated when needed.
     */
    function handleEscape(event) {
      if (event.key !== 'Escape') return;

      setShowForgotPassword(false);
      setForgotBusy(false);
      setPasswordResetToken('');
      setPasswordResetForm(emptyPasswordResetForm);
      setForgotStep('request');

      if (searchParams.has('resetToken')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('resetToken');
        setSearchParams(nextParams, { replace: true });
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [searchParams, setSearchParams, showForgotPassword]);

  /**
   * Handles the login submit interaction and coordinates its related state changes.
   * Frontend validation keeps the UI responsive before the API performs the real credential check.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the login side effects finish.
   */
  async function handleLoginSubmit(event) {
    event.preventDefault();

    if (!isValidEmail(loginForm.email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    try {
      await login(loginForm);
      setUnverifiedEmail('');
      showToast('Welcome back to StockPulse.', 'success');
      navigate('/');
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        const nextEmail = error.email || loginForm.email.trim();
        setUnverifiedEmail(nextEmail);
        showToast(error.message, 'error');
        return;
      }

      showToast(error.message || 'Unable to log in. Check your email and password.', 'error');
    }
  }

  /**
   * Handles the create-user submit interaction and coordinates its related state changes.
   * It reuses the existing registration API so account creation remains consistent with the backend.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the register side effects finish.
   */
  async function handleRegisterSubmit(event) {
    event.preventDefault();

    if (registerForm.name.trim().length < 2) {
      showToast('Name must be at least 2 characters.', 'error');
      return;
    }

    if (!isValidEmail(registerForm.email)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    if (!isStrongPassword(registerForm.password)) {
      showToast(PASSWORD_REQUIREMENT_MESSAGE, 'error');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      showToast('Passwords must match.', 'error');
      return;
    }

    try {
      const result = await register({ ...registerForm, name: registerForm.name.trim(), email: registerForm.email.trim() });
      const nextEmail = result.email || registerForm.email.trim();
      setVerificationNoticeEmail(nextEmail);
      setUnverifiedEmail('');
      showToast(result.message || 'Check your inbox to verify your email.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to register. Try another email.', 'error');
    }
  }

  /**
   * Handles the guest access interaction and coordinates its related state changes.
   * Guest mode stays browser-local so visitors can explore without creating saved account data.
   * @returns {void} No value is returned; browser storage and navigation are updated.
   */
  function handleGuestAccess() {
    rememberAccessChoice('guest');
    navigate('/');
  }

  /**
   * Opens the password-recovery dialog after validating the email already entered on the login card.
   * @returns {void} The request step is prepared for the selected email address.
   */
  function handleForgotPassword() {
    if (!isValidEmail(loginForm.email)) {
      showToast('Enter a valid email address first.', 'error');
      return;
    }

    setForgotEmail(loginForm.email.trim().toLowerCase());
    setPasswordResetToken('');
    setPasswordResetForm(emptyPasswordResetForm);
    setForgotStep('request');
    setShowForgotPassword(true);
  }

  /**
   * Closes password recovery and removes an emailed reset token from the browser URL.
   * @returns {void} Modal state and sensitive URL state are cleared.
   */
  function closeForgotPassword() {
    setShowForgotPassword(false);
    setForgotBusy(false);
    setPasswordResetForm(emptyPasswordResetForm);

    if (searchParams.has('resetToken')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('resetToken');
      setSearchParams(nextParams, { replace: true });
    }

    setPasswordResetToken('');
    setForgotStep('request');
  }

  /**
   * Sends a password-reset link through the backend without revealing whether the account exists.
   * @param {SubmitEvent} event - Forgot-password form submission event.
   * @returns {Promise<void>} Resolves after the request response is displayed.
   */
  async function handlePasswordResetRequest(event) {
    event.preventDefault();

    if (!isValidEmail(forgotEmail)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    setForgotBusy(true);
    try {
      const result = await requestPasswordReset({ email: forgotEmail.trim().toLowerCase() });
      setForgotStep('sent');
      showToast(result.message || 'Check your inbox for a password-reset link.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to request a password-reset email.', 'error');
    } finally {
      setForgotBusy(false);
    }
  }

  /**
   * Validates and submits a replacement password with the one-time token from the email.
   * @param {SubmitEvent} event - Reset-password form submission event.
   * @returns {Promise<void>} Resolves after the password is changed or an error is displayed.
   */
  async function handlePasswordResetSubmit(event) {
    event.preventDefault();

    if (!isStrongPassword(passwordResetForm.newPassword)) {
      showToast(PASSWORD_REQUIREMENT_MESSAGE, 'error');
      return;
    }

    if (passwordResetForm.newPassword !== passwordResetForm.confirmPassword) {
      showToast('New passwords must match.', 'error');
      return;
    }

    setForgotBusy(true);
    try {
      const result = await resetPassword({
        token: passwordResetToken,
        newPassword: passwordResetForm.newPassword,
      });
      setLoginForm((current) => ({ ...current, email: result.email || current.email, password: '' }));
      showToast(result.message || 'Password updated. You can now log in.', 'success');
      closeForgotPassword();
    } catch (error) {
      showToast(error.message || 'Unable to reset your password.', 'error');
    } finally {
      setForgotBusy(false);
    }
  }
  /**
   * Requests another verification email for the selected account.
   * This action is shown only for unverified-account states so regular login remains uncluttered.
   * @param {string} email - Email address that should receive the verification email.
   * @returns {Promise<void>} A promise that resolves after the resend attempt finishes.
   */
  async function handleResendVerification(email) {
    const normalizedEmail = String(email || '').trim();
    if (!isValidEmail(normalizedEmail)) {
      showToast('Enter a valid email address first.', 'error');
      return;
    }

    setResendBusy(true);
    try {
      const result = await resendVerification({ email: normalizedEmail });
      setVerificationNoticeEmail(result.email || normalizedEmail);
      showToast(result.message || 'Verification email sent.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to resend verification email.', 'error');
    } finally {
      setResendBusy(false);
    }
  }

  const animatedWord = ROTATING_WORDS[wordIndex];
  const isRegisterMode = mode === 'register';

  return (
    <main className="auth-screen cinematic-auth-screen">
      <div className="cinematic-auth-stage">
        {/* Desktop-only brand and product story, inspired by the uploaded cinematic reference. */}
        <section className="cinematic-hero-panel" aria-label="StockPulse Learn product overview">
          <div className="cinematic-scenery" aria-hidden="true">
            <span className="cinematic-star star-one" />
            <span className="cinematic-star star-two" />
            <span className="cinematic-star star-three" />
            <span className="cinematic-mountain mountain-one" />
            <span className="cinematic-mountain mountain-two" />
            <span className="cinematic-lake" />
          </div>

          <div className="cinematic-brand-lockup" aria-label="StockPulse Learn">
            <span className="cinematic-logo-bars" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>StockPulse</strong><small>Learn</small></span>
          </div>

          <div className="cinematic-hero-copy">
            <h1>
              <span>Your market.</span>
              <span>Your <span key={animatedWord} className="cinematic-rotating-word">{animatedWord}</span>.</span>
            </h1>
            <p>A full-featured trading simulator with real-time data, advanced charts, watchlists, and portfolio tracking.</p>
          </div>

          <div className="cinematic-feature-grid" aria-label="Platform features">
            <article>
              <TrendingUp size={22} />
              <strong>Practice Trading</strong>
              <small>Place virtual market and limit orders without real risk.</small>
            </article>
            <article>
              <PieChart size={22} />
              <strong>Track &amp; Analyze</strong>
              <small>Follow holdings, returns, allocation, and watchlist moves.</small>
            </article>
            <article>
              <BookOpen size={22} />
              <strong>Learn &amp; Improve</strong>
              <small>Use guided concepts to build market confidence.</small>
            </article>
          </div>

          <div className="cinematic-preview-shell" aria-label="Dashboard preview">
            <div className="cinematic-laptop-bar"><span /><span /><span /></div>
            <div className="cinematic-preview-grid">
              <div className="cinematic-preview-main">
                <small>Virtual portfolio</small>
                <strong>$10,000.00</strong>
                <span className="positive">Starting balance</span>
                <div className="cinematic-line-chart" aria-hidden="true">
                  <i style={{ '--x': '0%', '--y': '68%' }} />
                  <i style={{ '--x': '18%', '--y': '55%' }} />
                  <i style={{ '--x': '36%', '--y': '62%' }} />
                  <i style={{ '--x': '55%', '--y': '38%' }} />
                  <i style={{ '--x': '74%', '--y': '44%' }} />
                  <i style={{ '--x': '100%', '--y': '20%' }} />
                </div>
              </div>
              <div className="cinematic-watchlist-mini">
                <small>Watchlist</small>
                <span><b>AAPL</b><em>+1.8%</em></span>
                <span><b>NVDA</b><em>+2.4%</em></span>
                <span><b>MSFT</b><em>-0.3%</em></span>
              </div>
            </div>
          </div>

          <p className="cinematic-bottom-note">Live Demo Project - Virtual Trading Only - Educational Use</p>
        </section>

        {/* Auth card keeps login, create-user, guest, and future Google access in one focused surface. */}
        <section className="cinematic-auth-card" data-mode={mode} aria-label={isRegisterMode ? 'Create StockPulse user' : 'Log in to StockPulse'}>
          <div className="cinematic-auth-orb" aria-hidden="true">
            <span className="orb-ring" />
            <BarChart3 size={36} />
          </div>

          <div className="cinematic-auth-copy">
            <span className="cinematic-card-kicker"><ShieldCheck size={14} /> StockPulse account</span>
            <h2>{isRegisterMode ? 'Create user' : 'Welcome back'}</h2>
            <p>{isRegisterMode ? 'Start a saved simulator workspace with virtual cash and portfolio tracking.' : 'Log in to continue your trading simulator workspace.'}</p>
          </div>

          <div className="cinematic-auth-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" className={!isRegisterMode ? 'active' : ''} onClick={() => setMode('login')} aria-selected={!isRegisterMode}>Log in</button>
            <button type="button" className={isRegisterMode ? 'active' : ''} onClick={() => setMode('register')} aria-selected={isRegisterMode}>Create user</button>
          </div>

          <div className="cinematic-auth-flip" data-mode={mode}>
            <form className="cinematic-auth-face login-face" onSubmit={handleLoginSubmit} aria-hidden={isRegisterMode}>
              <div className="cinematic-field">
                <Mail size={17} aria-hidden="true" />
                <Input label="Email" name="email" type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} required />
              </div>
              <div className="cinematic-field">
                <LockKeyhole size={17} aria-hidden="true" />
                <PasswordInput label="Password" name="password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required />
              </div>
              <button className="auth-forgot-password cinematic-forgot" type="button" onClick={handleForgotPassword}>Forgot password?</button>
              {verificationStatus === 'success' && (
                <div className="auth-verification-inline success" role="status">
                  <strong>Email verified</strong>
                  <span>You can now log in with the same email and password.</span>
                </div>
              )}
              {unverifiedEmail && (
                <div className="auth-verification-inline" role="alert">
                  <strong>Email verification required</strong>
                  <span>Please verify {unverifiedEmail} before logging in.</span>
                  <button type="button" onClick={() => handleResendVerification(unverifiedEmail)} disabled={resendBusy}>
                    {resendBusy ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              )}
              <Button className="cinematic-primary-action" type="submit" disabled={isAuthenticating}>
                {isAuthenticating ? 'Logging in...' : 'Log in'}
                <ArrowRight size={17} />
              </Button>
              <div className="cinematic-divider"><span>or</span></div>
              <Button className="auth-wide-action cinematic-google-button" variant="secondary" disabled title="Google sign-in is coming soon">
                <GoogleLogo />
                Continue with Google
              </Button>
              <Button className="auth-wide-action cinematic-guest-button" variant="ghost" onClick={handleGuestAccess} disabled={isAuthenticating}>Continue as guest</Button>
              <p className="muted cinematic-mode-note">New here? <button type="button" onClick={() => setMode('register')}>Create user instead</button></p>
            </form>

            <form className="cinematic-auth-face register-face" onSubmit={handleRegisterSubmit} aria-hidden={!isRegisterMode}>
              {verificationNoticeEmail ? (
                <div className="auth-verification-state" role="status">
                  <Mail size={22} aria-hidden="true" />
                  <strong>Check your inbox</strong>
                  <span>We've sent a verification email to {verificationNoticeEmail}. Please verify your email before logging in.</span>
                  <Button className="cinematic-primary-action" type="button" onClick={() => { setMode('login'); setLoginForm({ ...loginForm, email: verificationNoticeEmail }); }}>
                    Go to login
                    <ArrowRight size={17} />
                  </Button>
                  <button className="auth-verification-link" type="button" onClick={() => handleResendVerification(verificationNoticeEmail)} disabled={resendBusy}>
                    {resendBusy ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="cinematic-field">
                    <UserRound size={17} aria-hidden="true" />
                    <Input label="Name" name="name" value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} required />
                  </div>
                  <div className="cinematic-field">
                    <Mail size={17} aria-hidden="true" />
                    <Input label="Email" name="email" type="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} required />
                  </div>
                  <div className="cinematic-field">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <PasswordInput label="Password" name="password" autoComplete="new-password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} required />
                  </div>
                  <p className="muted auth-password-rule">Use at least 8 characters, one uppercase letter, and one special character.</p>
                  <div className="cinematic-field">
                    <KeyRound size={17} aria-hidden="true" />
                    <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} required />
                  </div>
                  <Button className="cinematic-primary-action" type="submit" disabled={isAuthenticating}>
                    {isAuthenticating ? 'Creating...' : 'Create user'}
                    <ArrowRight size={17} />
                  </Button>
                  <Button className="auth-wide-action cinematic-guest-button" variant="ghost" onClick={handleGuestAccess} disabled={isAuthenticating}>Continue as guest</Button>
                  <p className="muted cinematic-mode-note">Already have an account? <button type="button" onClick={() => setMode('login')}>Log in instead</button></p>
                </>
              )}
            </form>
          </div>
        </section>
      </div>

      {showForgotPassword && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeForgotPassword}>
          <div className="modal-card password-reset-modal-card" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title" onMouseDown={(event) => event.stopPropagation()}>
            <GlassCard className="confirm-modal-card password-reset-modal-surface" bodyClassName="confirm-modal-body" variant="glow">
              <div className="section-title">
                <span className="brand-mark">
                  <KeyRound size={20} />
                </span>
                <Button variant="ghost" iconOnly aria-label="Close password reset dialog" onClick={closeForgotPassword}>
                  <X size={18} />
                </Button>
              </div>

              {forgotStep === 'request' && (
                <form className="password-reset-form" onSubmit={handlePasswordResetRequest}>
                  <div>
                    <h2 id="forgot-password-title" className="confirm-modal-title">Reset your password</h2>
                    <p className="muted confirm-modal-description">We will email a secure, one-time reset link to your StockPulse account.</p>
                  </div>
                  <Input label="Email" name="forgotEmail" type="email" autoComplete="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} required />
                  <div className="password-reset-actions">
                    <Button type="button" variant="ghost" onClick={closeForgotPassword}>Cancel</Button>
                    <Button type="submit" disabled={forgotBusy}>{forgotBusy ? 'Sending...' : 'Send reset link'}</Button>
                  </div>
                </form>
              )}

              {forgotStep === 'sent' && (
                <div className="password-reset-status">
                  <Mail size={28} aria-hidden="true" />
                  <div>
                    <h2 id="forgot-password-title" className="confirm-modal-title">Check your inbox</h2>
                    <p className="muted confirm-modal-description">If an account exists for {forgotEmail}, a password-reset link is on its way. The link expires in 30 minutes.</p>
                  </div>
                  <Button onClick={closeForgotPassword}>Back to login</Button>
                </div>
              )}

              {forgotStep === 'reset' && (
                <form className="password-reset-form" onSubmit={handlePasswordResetSubmit}>
                  <div>
                    <h2 id="forgot-password-title" className="confirm-modal-title">Choose a new password</h2>
                    <p className="muted confirm-modal-description">Use at least 8 characters, one uppercase letter, and one special character.</p>
                  </div>
                  <div className="password-reset-fields">
                    <PasswordInput label="New password" name="resetNewPassword" autoComplete="new-password" value={passwordResetForm.newPassword} onChange={(event) => setPasswordResetForm({ ...passwordResetForm, newPassword: event.target.value })} required />
                    <PasswordInput label="Confirm new password" name="resetConfirmPassword" autoComplete="new-password" value={passwordResetForm.confirmPassword} onChange={(event) => setPasswordResetForm({ ...passwordResetForm, confirmPassword: event.target.value })} required />
                  </div>
                  <div className="password-reset-actions">
                    <Button type="button" variant="ghost" onClick={closeForgotPassword}>Cancel</Button>
                    <Button type="submit" disabled={forgotBusy}>{forgotBusy ? 'Updating...' : 'Update password'}</Button>
                  </div>
                </form>
              )}
            </GlassCard>
          </div>
        </div>
      )}
    </main>
  );
}