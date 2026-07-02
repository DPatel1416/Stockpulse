/**
 * File purpose: Defines the reusable Guest Choice Modal React component and its focused user interaction.
 */
import { useEffect, useRef } from 'react';
import { BarChart3, LogIn, UserRound } from 'lucide-react';
import Button from '../ui/Button';
import GlassCard from '../ui/GlassCard';

// GuestChoiceModal gives first-time visitors an explicit choice without restricting public market research.
/**
 * Renders the guest choice modal React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function GuestChoiceModal({ open, onContinueAsGuest, onLogin, onRegister }) {
  const dialogRef = useRef(null);
  const guestButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    guestButtonRef.current?.focus();

    /**
     * Handles the key down interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle key down state changes are applied.
     */
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onContinueAsGuest();
        return;
      }

      if (event.key !== 'Tab') return;

      const buttons = dialogRef.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onContinueAsGuest, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop guest-choice-backdrop" role="presentation">
      <div
        className="modal-card guest-choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-choice-title"
        aria-describedby="guest-choice-description"
        ref={dialogRef}
      >
        <GlassCard variant="glow" bodyClassName="guest-choice-body">
          <div className="guest-choice-heading">
            <span className="brand-mark" aria-hidden="true"><BarChart3 size={20} /></span>
            <div>
              <span className="chip">Welcome to StockPulse</span>
              <h2 id="guest-choice-title">How would you like to continue?</h2>
            </div>
          </div>
          <p className="muted" id="guest-choice-description">Browse live market research as a guest, or log in to save stocks and use the virtual portfolio.</p>
          <div className="guest-choice-actions">
            <Button ref={guestButtonRef} variant="secondary" onClick={onContinueAsGuest}>
              <UserRound size={17} />Continue as guest
            </Button>
            <Button onClick={onLogin}><LogIn size={17} />Log in</Button>
          </div>
          <button className="guest-choice-register" type="button" onClick={onRegister}>New here? Create an account</button>
        </GlassCard>
      </div>
    </div>
  );
}
