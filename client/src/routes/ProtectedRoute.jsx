/**
 * File purpose: Guards account-only React routes until authentication has been checked and confirmed.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Personal account pages wait for session validation and require a verified user.
/**
 * Renders the protected route React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isSessionReady } = useAuth();

  if (!isSessionReady) return null;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
