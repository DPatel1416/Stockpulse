/**
 * File purpose: Defines the reusable Confirm Modal React component and its focused user interaction.
 */
import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';
import GlassCard from './GlassCard';

// ConfirmModal protects users from accidental simulated trades or destructive actions.
/**
 * Renders the confirm modal React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    /**
     * Handles the escape interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle escape state changes are applied.
     */
    function handleEscape(event) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <GlassCard className="confirm-modal-card" bodyClassName="confirm-modal-body" variant="glow">
          <div className="section-title">
            <span className="brand-mark">
              <AlertTriangle size={20} />
            </span>
            <Button variant="ghost" iconOnly aria-label="Close dialog" onClick={onCancel}>
              <X size={18} />
            </Button>
          </div>
          <h2 id="confirm-title" className="confirm-modal-title">{title}</h2>
          {description && <p className="muted confirm-modal-description">{description}</p>}
          {children}
          <div className="confirm-modal-actions">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
