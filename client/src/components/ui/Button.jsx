/**
 * File purpose: Defines the reusable Button React component and its focused user interaction.
 */
import { forwardRef } from 'react';

// Shared button variants keep actions visually consistent across the dashboard.
/**
 * Renders the button React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @param {object} ref - Forwarded React reference for the rendered element.
 * @returns {JSX.Element} The rendered component interface.
 */
const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  iconOnly = false,
  className = '',
  type = 'button',
  ...props
}, ref) {
  const classes = ['button', variant, iconOnly ? 'icon' : '', className].filter(Boolean).join(' ');

  return (
    <button className={classes} type={type} ref={ref} {...props}>
      {children}
    </button>
  );
});

export default Button;
