/**
 * File purpose: Defines the reusable Toast React component and its focused user interaction.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

// ToastProvider supplies lightweight success/error/info messages without pulling in a UI library.
/**
 * Renders the toast provider React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Adds a temporary notification and removes it after the display period.
   * Centralizing the timer here gives every screen identical notification behavior.
   * @param {string} message - Human-readable notification text.
   * @param {'info'|'success'|'warning'|'error'} tone - Visual importance of the notification.
   * @returns {void} No value is returned; toast state and a cleanup timer are created.
   */
  const showToast = useCallback((message, tone = 'info') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} key={toast.id}>
            <strong style={{ textTransform: 'capitalize' }}>{toast.tone}</strong>
            <p style={{ margin: '4px 0 0' }}>{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns the shared function used to show temporary notifications.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @returns {object} The toast notification actions from context.
 */
export function useToasts() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToasts must be used inside ToastProvider');
  }
  return context;
}
