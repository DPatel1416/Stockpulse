/**
 * File purpose: Tests the cinematic login/register page without depending on the real backend.
 */
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login.jsx';
import Register from '../Register.jsx';
import { ACCESS_CHOICE_KEY } from '../../utils/accessChoice.js';

const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
  isAuthenticating: false,
}));

const toastMock = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../components/ui/Toast', () => ({
  useToasts: () => toastMock,
}));

/**
 * Renders auth routes in memory so navigation and query-string behavior remain real.
 * The destination route gives tests a visible marker when guest/login navigation succeeds.
 * @param {React.ReactNode} element - Page element to render at the /login route.
 * @returns {object} React Testing Library render result.
 */
function renderAuth(element = <Login />) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={element} />
        <Route path="/" element={<div>Dashboard destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Returns the visible login form face.
 * Both auth faces stay mounted for the card flip animation, so this keeps queries scoped.
 * @returns {HTMLElement} Login form element.
 */
function loginFace() {
  return document.querySelector('.login-face');
}

/**
 * Returns the register form face.
 * Both auth faces stay mounted for the card flip animation, so this keeps queries scoped.
 * @returns {HTMLElement} Register form element.
 */
function registerFace() {
  return document.querySelector('.register-face');
}


/**
 * Returns a form input by name from a specific auth face.
 * The animated card keeps both faces mounted, so querying by name avoids duplicate-id label ambiguity.
 * @param {HTMLElement} face - Login or register form element.
 * @param {string} name - Input name to locate.
 * @returns {HTMLInputElement} Matching input element.
 */
function field(face, name) {
  return face.querySelector(`[name="${name}"]`);
}
describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    authMock.login = vi.fn();
    authMock.register = vi.fn();
    authMock.resendVerification = vi.fn();
    authMock.isAuthenticating = false;
    toastMock.showToast = vi.fn();
  });

  it('renders the professional login card and validates email before submitting', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.type(field(loginFace(), 'email'), 'person@example');
    await user.type(field(loginFace(), 'password'), 'Password!1');
    await user.click(within(loginFace()).getByRole('button', { name: /^log in/i }));

    expect(authMock.login).not.toHaveBeenCalled();
    expect(toastMock.showToast).toHaveBeenCalledWith('Enter a valid email address.', 'error');
  });

  it('shows the login loading state while authentication is busy', () => {
    authMock.isAuthenticating = true;
    renderAuth();

    expect(within(loginFace()).getByRole('button', { name: /logging in/i })).toBeDisabled();
  });

  it('lets visitors continue as guests with browser-local access choice', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(within(loginFace()).getByRole('button', { name: /continue as guest/i }));

    expect(localStorage.getItem(ACCESS_CHOICE_KEY)).toBe('guest');
    expect(screen.getByText('Dashboard destination')).toBeInTheDocument();
  });

  it('opens and closes the forgot password future-update modal', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.type(field(loginFace(), 'email'), 'person@example.com');
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(screen.getByRole('dialog', { name: /password reset coming soon/i })).toBeInTheDocument();
    expect(screen.getByText(/password recovery for person@example.com/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates register password strength before calling the API', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getAllByRole('button', { name: /create user/i })[0]);
    await user.type(field(registerFace(), 'name'), 'New User');
    await user.type(field(registerFace(), 'email'), 'new@example.com');
    await user.type(field(registerFace(), 'password'), 'weakpass');
    await user.type(field(registerFace(), 'confirmPassword'), 'weakpass');
    await user.click(within(registerFace()).getByRole('button', { name: /^create user/i }));

    expect(authMock.register).not.toHaveBeenCalled();
    expect(toastMock.showToast).toHaveBeenCalledWith(expect.stringMatching(/uppercase/), 'error');
  });

  it('shows the verification success screen after registration', async () => {
    const user = userEvent.setup();
    authMock.register = vi.fn(async () => ({ email: 'new@example.com', message: 'Check your inbox to verify your email.' }));
    renderAuth();

    await user.click(screen.getAllByRole('button', { name: /create user/i })[0]);
    await user.type(field(registerFace(), 'name'), 'New User');
    await user.type(field(registerFace(), 'email'), 'new@example.com');
    await user.type(field(registerFace(), 'password'), 'Password!1');
    await user.type(field(registerFace(), 'confirmPassword'), 'Password!1');
    await user.click(within(registerFace()).getByRole('button', { name: /^create user/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(authMock.register).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
  });

  it('renders the direct Register route in create-user mode', () => {
    renderAuth(<Register />);

    expect(screen.getByRole('heading', { name: /create user/i })).toBeInTheDocument();
  });
});



