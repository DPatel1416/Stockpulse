/**
 * File purpose: Defines the reusable Select React component and its focused user interaction.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Select provides one rounded glass dropdown instead of relying on square system menus.
/**
 * Renders the select React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Select({ id, label, value, options, onValueChange, className = '', ariaLabel }) {
  const generatedId = useId();
  const controlId = id || `select-${generatedId}`;
  const labelId = `${controlId}-label`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const normalizedOptions = options.map((option) => (
    typeof option === 'string' ? { value: option, label: option } : option
  ));
  const selectedOption = normalizedOptions.find((option) => option.value === value) || normalizedOptions[0];

  useEffect(() => {
    /**
     * Handles the outside pointer interaction and coordinates its related state changes.
     * A dedicated handler keeps event side effects separate from presentation code.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the handle outside pointer state changes are applied.
     */
    function handleOutsidePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, []);

  /**
   * Selects an item from the custom menu and then closes the menu.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {*} nextValue - New value selected by the user.
   * @returns {void|*} No value is required; the choose option state changes are applied.
   */
  function chooseOption(nextValue) {
    onValueChange(nextValue);
    setOpen(false);
  }

  /**
   * Handles the trigger key down interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle trigger key down state changes are applied.
   */
  function handleTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }

    if (event.key === 'Escape') setOpen(false);
  }

  return (
    <div className={`select-control ${className}`.trim()} ref={rootRef}>
      {label && <span className="input-label" id={labelId}>{label}</span>}
      <button
        className={`select-trigger${open ? ' open' : ''}`}
        id={controlId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedOption?.label || 'Choose'}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="select-menu scroll-panel" role="listbox" aria-label={ariaLabel || label}>
          {normalizedOptions.map((option) => (
            <button
              className={`select-option${option.value === value ? ' selected' : ''}`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => chooseOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
