/**
 * File purpose: Defines the reusable Account Settings Modal React component and its focused user interaction.
 */
import { useEffect, useState } from 'react';
import { KeyRound, LogOut, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import GlassCard from '../ui/GlassCard';
import Input from '../ui/Input';
import PasswordInput from '../ui/PasswordInput';
import { useToasts } from '../ui/Toast';

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

  useEffect(() => {
    if (!open) return undefined;

    setName(user?.name || '');
    setPasswordForm(emptyPasswordForm);

    /**
     * Handles the escape interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle escape state changes are applied.
     */
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open, user?.name]);

  if (!open || !user) return null;

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

    if (passwordForm.newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
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
        <GlassCard className="account-settings-card" bodyClassName="account-settings-body" variant="glow">
          <div className="section-title">
            <span className="brand-mark">
              <UserRound size={20} />
            </span>
            <Button variant="ghost" iconOnly aria-label="Close account settings" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>

          <div className="account-settings-heading">
            <h2 id="account-settings-title">Account Settings</h2>
            <p className="muted">Manage the name shown in StockPulse and update your password.</p>
          </div>

          <form className="account-settings-form" onSubmit={handleProfileSubmit}>
            <div className="account-settings-form-title">
              <UserRound size={17} />
              <h3>Profile</h3>
            </div>
            <Input label="Display name" name="account-name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Button type="submit" disabled={busyAction === 'profile'}>
              {busyAction === 'profile' ? 'Saving...' : 'Save name'}
            </Button>
          </form>

          <form className="account-settings-form" onSubmit={handlePasswordSubmit}>
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
            <p className="muted">Signed in as {user.email}</p>
            <Button variant="danger" onClick={() => { logout(); onClose(); }}>
              <LogOut size={16} />
              Log out
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
