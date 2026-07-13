/**
 * File purpose: Provides shared Auth Context state and actions to React components without passing props through every level.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api, STORAGE_KEYS } from '../services/api';

const AuthContext = createContext(null);

/**
 * Reads the stored user from its persistence boundary for the calling workflow.
 * Keeping storage access here prevents persistence details from spreading through the application.
 * @returns {object|null} The saved user profile, or null when no valid profile exists.
 */
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user));
  } catch {
    return null;
  }
}

/**
 * Renders the auth provider React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  /**
   * Clears browser-readable session state after logout or failed cookie validation.
   * The legacy token key is removed once during migration; the active JWT is HttpOnly and inaccessible here.
   * @returns {void} React state, cached profile data, and the CSRF helper are cleared.
   */
  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    api.clearSessionSecurity();
    setUser(null);
  }

  // Ask the API to validate its HttpOnly cookie instead of trusting browser-readable credentials.
  useEffect(() => {
    let isActive = true;
    localStorage.removeItem(STORAGE_KEYS.token);

    api.getCurrentUser()
      .then(({ user: currentUser }) => {
        if (!isActive) return;
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(currentUser));
        setUser(currentUser);
      })
      .catch(() => {
        if (isActive) clearSession();
      })
      .finally(() => {
        if (isActive) setIsSessionReady(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  /**
   * Authenticates supplied credentials and stores the resulting session where appropriate.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} credentials - Email and password submitted for authentication.
   * @returns {Promise<*>} A promise resolving to the login result.
   */
  async function login(credentials) {
    setIsAuthenticating(true);
    try {
      const result = await api.login(credentials);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(result.user));
      setUser(result.user);
      setIsSessionReady(true);
      return result;
    } finally {
      setIsAuthenticating(false);
    }
  }

  /**
   * Creates a user account and waits for email verification before starting a session.
   * Registration no longer stores a JWT because unverified users should not be authenticated yet.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<*>} A promise resolving to the register result.
   */
  async function register(payload) {
    setIsAuthenticating(true);
    try {
      return await api.register(payload);
    } finally {
      setIsAuthenticating(false);
    }
  }

  
  /**
   * Requests another email verification message for an unverified account.
   * Keeping this in context lets login and register screens share one auth action.
   * @param {object} payload - Email address that should receive another verification email.
   * @returns {Promise<object>} A promise resolving to the resend-verification response.
   */
  async function resendVerification(payload) {
    return api.resendVerification(payload);
  }

  /**
   * Requests a password-reset email while keeping account existence private.
   * @param {object} payload - Email address submitted for password recovery.
   * @returns {Promise<object>} Generic reset-request response.
   */
  async function requestPasswordReset(payload) {
    return api.requestPasswordReset(payload);
  }

  /**
   * Submits a one-time reset token and replacement password.
   * @param {object} payload - Reset token and new password.
   * @returns {Promise<object>} Password-reset completion response.
   */
  async function resetPassword(payload) {
    return api.resetPassword(payload);
  }

  /**
   * Starts the legacy demo session used when that explicit flow is requested.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {Promise<object>} A promise resolving to the demo authentication response.
   */
  async function startDemoSession() {
    setIsAuthenticating(true);
    try {
      const result = await api.startDemoSession();
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(result.user));
      setUser(result.user);
      setIsSessionReady(true);
      return result;
    } finally {
      setIsAuthenticating(false);
    }
  }

  /**
   * Updates the saved user profile after an account change.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {object} nextUser - Updated public user profile to store.
   * @returns {*} The store user result.
   */
  function storeUser(nextUser) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }

  /**
   * Updates the profile while preserving related state invariants.
   * Keeping mutation rules together protects related state from drifting out of sync.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the updated public user profile.
   */
  async function updateProfile(payload) {
    const result = await api.updateProfile(payload);
    storeUser(result.user);
    return result;
  }

  /**
   * Updates the password while preserving related state invariants.
   * Keeping mutation rules together protects related state from drifting out of sync.
   * @param {*} payload - Validated data supplied by the caller.
   * @returns {Promise<object>} A promise resolving to the confirmed public user profile.
   */
  async function updatePassword(payload) {
    const result = await api.updatePassword(payload);
    storeUser(result.user);
    return result;
  }

  /**
   * Expires the server-managed cookie and always clears the local profile cache.
   * @returns {Promise<void>} Resolves after the logout request has completed or failed safely.
   */
  async function logout() {
    try {
      await api.logout();
    } finally {
      clearSession();
    }
  }

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isAuthenticating,
    isSessionReady,
    login,
    register,
    resendVerification,
    requestPasswordReset,
    resetPassword,
    startDemoSession,
    updateProfile,
    updatePassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns authentication state and account actions from React context.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @returns {object} Authentication state and account actions from context.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
