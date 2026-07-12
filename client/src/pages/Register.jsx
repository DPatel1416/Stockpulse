/**
 * File purpose: Opens the shared cinematic authentication screen in create-user mode.
 */
import Login from './Login';

// Register reuses the same premium auth card so account creation never feels like a separate page.
/**
 * Renders the register React component.
 * Keeping this route allows direct /register links while preserving the same flipping auth experience.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function Register() {
  return <Login initialMode="register" />;
}