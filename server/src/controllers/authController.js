/**
 * File purpose: Translates Auth HTTP requests into service calls and JSON responses.
 */
import bcrypt from 'bcryptjs';
import { isDatabaseConnected } from '../config/db.js';
import User from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';
import { createDemoUser, findDemoUserByEmail, getOrCreateDemoUser } from '../utils/demoStore.js';
import { signToken } from '../utils/tokens.js';

/**
 * Converts the user into a stable response-safe object.
 * A serializer exposes a stable shape without leaking database-specific details.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {object} Public user fields safe to include in an API response.
 */
function serializeUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    virtualCash: user.virtualCash,
  };
}

/**
 * Returns the user id needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {*} The requested user id result.
 */
function getUserId(user) {
  return String(user._id || user.id);
}

/**
 * Creates a user account and starts its authenticated session.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the register result.
 */
export const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;

  if (isDatabaseConnected()) {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email is already registered.' });
    user = await User.create({ name, email, passwordHash, virtualCash: 10000 });
  } else {
    if (findDemoUserByEmail(email)) return res.status(409).json({ message: 'Email is already registered.' });
    user = createDemoUser({ name, email, passwordHash });
  }

  res.status(201).json({ token: signToken(String(user._id || user.id)), user: serializeUser(user) });
});

/**
 * Authenticates supplied credentials and stores the resulting session where appropriate.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the login result.
 */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  let user = isDatabaseConnected() ? await User.findOne({ email }) : findDemoUserByEmail(email);

  // Offline demo mode creates a user on first login so reviewers can start immediately.
  if (!user && !isDatabaseConnected()) {
    user = createDemoUser({ name: 'Demo Student', email, passwordHash: await bcrypt.hash(password, 12) });
  }

  const isValidPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.json({ token: signToken(String(user._id || user.id)), user: serializeUser(user) });
});

/**
 * Returns the currently authenticated user profile.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the me result.
 */
export const me = catchAsync(async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

/**
 * Updates the profile while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<void>} A promise that resolves after the update profile side effects finish.
 */
export const updateProfile = catchAsync(async (req, res) => {
  const name = String(req.body.name || '').trim();

  if (name.length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters.' });
  }

  let user;

  if (isDatabaseConnected()) {
    user = await User.findByIdAndUpdate(getUserId(req.user), { name }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
  } else {
    req.user.name = name;
    user = req.user;
  }

  res.json({ user: serializeUser(user) });
});

/**
 * Verifies the current password and stores a newly hashed replacement.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the change password result.
 */
export const changePassword = catchAsync(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  const user = isDatabaseConnected() ? await User.findById(getUserId(req.user)) : req.user;
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);

  if (isDatabaseConnected()) {
    await user.save();
  }

  res.json({ user: serializeUser(user), message: 'Password updated.' });
});

/**
 * Creates or reuses the demonstration user and returns an authentication token.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the demo session result.
 */
export const demoSession = catchAsync(async (req, res) => {
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = isDatabaseConnected()
    ? await User.findOneAndUpdate(
        { email: 'demo@stockpulse.test' },
        { $setOnInsert: { name: 'Demo Student', email: 'demo@stockpulse.test', passwordHash, virtualCash: 10000 } },
        { upsert: true, new: true },
      )
    : getOrCreateDemoUser({ passwordHash });

  res.json({ token: signToken(String(user._id || user.id)), user: serializeUser(user) });
});
