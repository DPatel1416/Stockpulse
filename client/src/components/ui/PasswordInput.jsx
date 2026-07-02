/**
 * File purpose: Defines the reusable Password Input React component and its focused user interaction.
 */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// PasswordInput keeps credentials masked by default while offering an accessible visibility toggle.
/**
 * Renders the password input React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function PasswordInput({ id, label, name, ...props }) {
  const [visible, setVisible] = useState(false);
  const inputId = id || name;

  return (
    <div className="input-shell">
      <label className="input-label" htmlFor={inputId}>{label}</label>
      <div className="password-input-control">
        <input id={inputId} className="input" name={name} type={visible ? 'text' : 'password'} {...props} />
        <button
          className="password-visibility-toggle"
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
