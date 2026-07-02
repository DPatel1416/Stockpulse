/**
 * File purpose: Defines the reusable Legal Disclaimer React component and its focused user interaction.
 */
import { useEffect, useRef } from 'react';
import { Scale, X } from 'lucide-react';
import Button from '../ui/Button';
import GlassCard from '../ui/GlassCard';

const DISCLAIMER_TEXT = 'StockPulse Learn is an educational and paper-trading platform designed to help users learn about financial markets. All information, analytics, and simulated trading activities are provided solely for educational purposes and should not be considered financial, investment, legal, or tax advice. StockPulse Learn is independent and is not affiliated with or authorized by the Canadian Investment Regulatory Organization (CIRO) to provide investment advice, brokerage services, or trading recommendations.';

// This reusable dialog keeps the platform's educational limits visible without interrupting normal learning workflows.
/**
 * Renders the legal disclaimer React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function LegalDisclaimer({ open, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Manage keyboard access, focus restoration, and background scrolling while the legal dialog is open.
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    /**
     * Handles the key down interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle key down state changes are applied.
     */
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop legal-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card legal-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-disclaimer-title"
        aria-describedby="legal-disclaimer-description"
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <GlassCard variant="glow" bodyClassName="legal-modal-body">
          <div className="legal-modal-header">
            <span className="brand-mark" aria-hidden="true"><Scale size={20} /></span>
            <Button ref={closeButtonRef} variant="ghost" iconOnly aria-label="Close Legal & Disclaimer" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
          <span className="chip">StockPulse Learn</span>
          <h2 id="legal-disclaimer-title">Legal &amp; Disclaimer</h2>
          <p id="legal-disclaimer-description">{DISCLAIMER_TEXT}</p>
          <div className="legal-modal-actions">
            <Button onClick={onClose}>I understand</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
