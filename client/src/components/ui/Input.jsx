/**
 * File purpose: Defines the reusable Input React component and its focused user interaction.
 */
// A labeled input component gives every form control an accessible name.
/**
 * Renders the input React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Input({ id, label, helper, className = '', ...props }) {
  const inputId = id || props.name;

  return (
    <label className={`input-shell ${className}`} htmlFor={inputId}>
      {label && <span className="input-label">{label}</span>}
      <input id={inputId} className="input" {...props} />
      {helper && <small className="muted">{helper}</small>}
    </label>
  );
}
