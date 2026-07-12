/**
 * File purpose: Defines the reusable Footer React component and its focused user interaction.
 */
import { useCallback, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import LegalDisclaimer from './LegalDisclaimer';

const FOOTER_TEXT = '© 2026 StockPulse Learn • Educational Purposes Only • Not Financial Advice • Not affiliated with or authorized by CIRO.';

// Footer provides one consistent legal entry point across public and signed-in experiences.
/**
 * Renders the footer React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Footer({ compact = false }) {
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  /**
   * Closes the legal disclaimer dialog.
   * A stable callback lets the modal receive the same function between renders.
   * @returns {void} No value is returned; only dialog state changes.
   */
  const closeDisclaimer = useCallback(() => setDisclaimerOpen(false), []);

  return (
    <>
      <footer className={`site-footer${compact ? ' compact' : ''}`} aria-label="StockPulse Learn legal information">
        <div className="site-footer-inner">
          <span className="site-footer-brand" aria-label="StockPulse Learn">
            <span className="site-footer-logo" aria-hidden="true"><BarChart3 size={18} /></span>
            <span className="site-footer-wordmark"><strong>StockPulse</strong><small>Learn</small></span>
          </span>
          <p className="site-footer-tagline">Practice markets with clarity and confidence.</p>
          <span className="site-footer-divider" aria-hidden="true" />
          <div className="site-footer-legal">
            <button
              className="site-footer-disclaimer"
              type="button"
              title="Open Legal & Disclaimer"
              onClick={() => setDisclaimerOpen(true)}
            >
              {FOOTER_TEXT}
            </button>
            <button className="site-footer-legal-action" type="button" onClick={() => setDisclaimerOpen(true)}>
              <span>Legal &amp; Disclaimer</span>
            </button>
          </div>
        </div>
      </footer>
      <LegalDisclaimer open={disclaimerOpen} onClose={closeDisclaimer} />
    </>
  );
}
