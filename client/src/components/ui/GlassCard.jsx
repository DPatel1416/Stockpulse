/**
 * File purpose: Defines the reusable Glass Card React component and its focused user interaction.
 */
import { forwardRef } from 'react';

// GlassCard is the main liquid-glass surface used for cards, modals, widgets, and panels.
/**
 * Renders the glass card React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @param {object} ref - Forwarded React reference for the rendered element.
 * @returns {JSX.Element} The rendered component interface.
 */
const GlassCard = forwardRef(function GlassCard({ children, variant = 'default', className = '', bodyClassName = '', ...props }, ref) {
  const cardClass = ['glass-card', variant, className].filter(Boolean).join(' ');

  return (
    <section className={cardClass} ref={ref} {...props}>
      <div className={`card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
});

export default GlassCard;
