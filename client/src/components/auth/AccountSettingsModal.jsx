/**
 * File purpose: Defines the reusable Account Settings Modal React component and its focused user interaction.
 */
import { useEffect, useState } from 'react';
import { ChevronRight, KeyRound, LogOut, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import GlassCard from '../ui/GlassCard';
import Input from '../ui/Input';
import PasswordInput from '../ui/PasswordInput';
import { useToasts } from '../ui/Toast';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '../../utils/validation';

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

// AccountSettingsModal gives signed-in users a focused place to update identity and credentials.
/**
 * Renders the account settings modal React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function AccountSettingsModal({ open, onClose }) {
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const { showToast } = useToasts();
  const [name, setName] = useState(user?.name || '');
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [busyAction, setBusyAction] = useState('');
  const [mobileAction, setMobileAction] = useState('');

  useEffect(() => {
    if (!open) return;

    setName(user?.name || '');
    setPasswordForm(emptyPasswordForm);
    setMobileAction('');
  }, [open, user?.name]);

  useEffect(() => {
    if (!open) return undefined;

    /**
     * Handles the escape interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle escape state changes are applied.
     */
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (mobileAction) {
        setMobileAction('');
        return;
      }
      onClose();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileAction, onClose, open]);

  if (!open || !user) return null;

  /**
   * Closes the mobile-only focused account sheet.
   * Keeping this small helper avoids duplicating modal state updates across buttons and overlays.
   * @returns {void} No value is returned; the mobile sheet state is cleared.
   */
  function closeMobileAction() {
    setMobileAction('');
  }

  /**
   * Handles the profile submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the handle profile submit side effects finish.
   */
  async function handleProfileSubmit(event) {
    event.preventDefault();

    const nextName = name.trim();
    if (nextName.length < 2) {
      showToast('Name must be at least 2 characters.', 'error');
      return;
    }

    setBusyAction('profile');
    try {
      await updateProfile({ name: nextName });
      setMobileAction('');
      showToast('Name updated.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to update your name.', 'error');
    } finally {
      setBusyAction('');
    }
  }

  /**
   * Handles the password submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {Promise<void>} A promise that resolves after the handle password submit side effects finish.
   */
  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!isStrongPassword(passwordForm.newPassword)) {
      showToast(PASSWORD_REQUIREMENT_MESSAGE, 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('New passwords must match.', 'error');
      return;
    }

    setBusyAction('password');
    try {
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordForm);
      setMobileAction('');
      showToast('Password updated.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to update your password.', 'error');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card account-settings-modal" role="dialog" aria-modal="true" aria-labelledby="account-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <GlassCard className="account-settings-card" bodyClassName="account-settings-body account-settings-modern-body" variant="glow">
          <div className="account-settings-hero">
            <div className="account-settings-avatar" aria-hidden="true">
              <UserRound size={28} />
            </div>
            <div className="account-settings-heading">
              <span className="account-settings-eyebrow"><ShieldCheck size={14} /> Account center</span>
              <h2 id="account-settings-title">Account Settings</h2>
              <p className="muted">Keep your profile polished and your StockPulse login secure.</p>
            </div>
            <Button variant="ghost" iconOnly aria-label="Close account settings" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>

          <div className="account-settings-summary" aria-label="Signed-in account summary">
            <span><UserRound size={15} /> {user.name || 'StockPulse learner'}</span>
            <span><Mail size={15} /> {user.email}</span>
          </div>

          <div className="account-settings-mobile-actions" aria-label="Account setting actions">
            <button className="account-settings-action-card" type="button" onClick={() => setMobileAction('profile')}>
              <span className="account-settings-action-icon"><UserRound size={18} /></span>
              <span>
                <strong>Update username</strong>
                <small>{user.name || 'Choose the name shown in StockPulse'}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button className="account-settings-action-card" type="button" onClick={() => setMobileAction('password')}>
              <span className="account-settings-action-icon"><KeyRound size={18} /></span>
              <span>
                <strong>Update password</strong>
                <small>Change your StockPulse sign-in password</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button className="account-settings-action-card danger" type="button" onClick={() => { logout(); onClose(); }}>
              <span className="account-settings-action-icon"><LogOut size={18} /></span>
              <span>
                <strong>Log out</strong>
                <small>End this browser session</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="account-settings-grid">
            <form className="account-settings-form account-settings-profile-form" onSubmit={handleProfileSubmit}>
              <div className="account-settings-form-title">
                <UserRound size={17} />
                <h3>Profile</h3>
              </div>
              <Input label="Display name" name="account-name" value={name} onChange={(event) => setName(event.target.value)} required />
              <Button type="submit" disabled={busyAction === 'profile'}>
                {busyAction === 'profile' ? 'Saving...' : 'Save name'}
              </Button>
            </form>

            <form className="account-settings-form account-settings-password-form" onSubmit={handlePasswordSubmit}>
              <div className="account-settings-form-title">
                <KeyRound size={17} />
                <h3>Password</h3>
              </div>
              <PasswordInput
                label="Current password"
                name="currentPassword"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                required
              />
              <PasswordInput
                label="New password"
                name="newPassword"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                required
              />
              <p className="muted auth-password-rule">Use at least 8 characters, one uppercase letter, and one special character.</p>
              <PasswordInput
                label="Confirm new password"
                name="confirmPassword"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                required
              />
              <Button type="submit" disabled={busyAction === 'password'}>
                {busyAction === 'password' ? 'Updating...' : 'Update password'}
              </Button>
            </form>

            <div className="account-settings-form account-settings-session">
              <div className="account-settings-form-title">
                <LogOut size={17} />
                <h3>Session</h3>
              </div>
              <p className="muted">You are signed in as {user.email}. Logging out only ends this browser session.</p>
              <Button variant="danger" onClick={() => { logout(); onClose(); }}>
                <LogOut size={16} />
                Log out
              </Button>
            </div>
          </div>

          {mobileAction === 'profile' && (
            <div className="account-settings-mobile-sheet" role="presentation" onMouseDown={closeMobileAction}>
              <form className="account-settings-mobile-sheet-card" role="dialog" aria-modal="true" aria-labelledby="mobile-profile-title" onSubmit={handleProfileSubmit} onMouseDown={(event) => event.stopPropagation()}>
                <div className="account-settings-mobile-sheet-header">
                  <div>
                    <span className="account-settings-eyebrow"><UserRound size={14} /> Profile</span>
                    <h3 id="mobile-profile-title">Update username</h3>
                  </div>
                  <Button variant="ghost" iconOnly aria-label="Close username editor" onClick={closeMobileAction}>
                    <X size={17} />
                  </Button>
                </div>
                <Input id="mobile-account-name" label="Display name" name="account-name" value={name} onChange={(event) => setName(event.target.value)} required />
                <div className="account-settings-mobile-sheet-actions">
                  <Button variant="ghost" type="button" onClick={closeMobileAction}>Cancel</Button>
                  <Button type="submit" disabled={busyAction === 'profile'}>
                    {busyAction === 'profile' ? 'Saving...' : 'Save name'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {mobileAction === 'password' && (
            <div className="account-settings-mobile-sheet" role="presentation" onMouseDown={closeMobileAction}>
              <form className="account-settings-mobile-sheet-card" role="dialog" aria-modal="true" aria-labelledby="mobile-password-title" onSubmit={handlePasswordSubmit} onMouseDown={(event) => event.stopPropagation()}>
                <div className="account-settings-mobile-sheet-header">
                  <div>
                    <span className="account-settings-eyebrow"><KeyRound size={14} /> Security</span>
                    <h3 id="mobile-password-title">Update password</h3>
                  </div>
                  <Button variant="ghost" iconOnly aria-label="Close password editor" onClick={closeMobileAction}>
                    <X size={17} />
                  </Button>
                </div>
                <PasswordInput
                  id="mobile-current-password"
                  label="Current password"
                  name="currentPassword"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                  required
                />
                <PasswordInput
                  id="mobile-new-password"
                  label="New password"
                  name="newPassword"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                  required
                />
                <p className="muted auth-password-rule">Use at least 8 characters, one uppercase letter, and one special character.</p>
                <PasswordInput
                  id="mobile-confirm-password"
                  label="Confirm new password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                  required
                />
                <div className="account-settings-mobile-sheet-actions">
                  <Button variant="ghost" type="button" onClick={closeMobileAction}>Cancel</Button>
                  <Button type="submit" disabled={busyAction === 'password'}>
                    {busyAction === 'password' ? 'Updating...' : 'Update password'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
