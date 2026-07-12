/**
 * File purpose: Translates Auth HTTP requests into service calls and JSON responses.
 */
import bcrypt from 'bcryptjs';
import { isDatabaseConnected } from '../config/db.js';
import User from '../models/User.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { catchAsync } from '../utils/catchAsync.js';
import {
  createDemoUser,
  findDemoUserByEmail,
  findDemoUserByVerificationTokenHash,
  getOrCreateDemoUser,
} from '../utils/demoStore.js';
import {
  checkVerificationResendLimit,
  createEmailVerificationToken,
  hashVerificationToken,
  isVerificationTokenExpired,
  recordVerificationResend,
} from '../utils/emailVerification.js';
import { signToken } from '../utils/tokens.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENT_MESSAGE = 'Password must be at least 8 characters and include one uppercase letter and one special character.';
const UNVERIFIED_MESSAGE = 'Your email address has not been verified yet. Please verify your email before logging in.';


/**
 * Normalizes email input before it is compared or stored.
 * Keeping email casing consistent prevents duplicate accounts that differ only by capitalization.
 * @param {*} value - Raw email value supplied by a request body.
 * @returns {string} Trimmed lowercase email text.
 */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Checks whether an email has the basic shape required by StockPulse forms.
 * This avoids over-engineering auth while still rejecting obvious invalid input.
 * @param {*} value - Raw or normalized email value supplied by a request body.
 * @returns {boolean} True when the email shape is valid.
 */
function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

/**
 * Checks whether a password meets StockPulse's minimum account security rule.
 * This runs on the server because frontend validation alone can be bypassed.
 * @param {*} value - Raw password supplied by a request body.
 * @returns {boolean} True when the password is long enough and includes required character types.
 */
function isStrongPassword(value) {
  return PASSWORD_PATTERN.test(String(value || ''));
}

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
    isVerified: user.isVerified !== false,
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
 * Finds a user by email in MongoDB or in the in-memory demo store.
 * Keeping lookup logic in one helper avoids repeatedly branching on database availability.
 * @param {string} email - Normalized account email address.
 * @returns {Promise<object|undefined|null>} Matching user record, if one exists.
 */
async function findUserByEmail(email) {
  return isDatabaseConnected() ? User.findOne({ email }) : findDemoUserByEmail(email);
}

/**
 * Finds a user by stored verification token hash.
 * Matching against the hash means the backend never needs to store the plain emailed token.
 * @param {string} tokenHash - SHA-256 hash of the token supplied by the verification link.
 * @returns {Promise<object|undefined|null>} Matching user record, if one exists.
 */
async function findUserByVerificationHash(tokenHash) {
  return isDatabaseConnected() ? User.findOne({ verificationTokenHash: tokenHash }) : findDemoUserByVerificationTokenHash(tokenHash);
}

/**
 * Persists verification-token fields on an existing user.
 * A shared helper keeps new registration and resend behavior identical.
 * @param {object} user - User receiving a fresh verification token.
 * @param {string} tokenHash - Hashed token to store.
 * @param {Date} expiresAt - Expiration timestamp for the verification token.
 * @returns {Promise<object>} Updated user record.
 */
async function storeVerificationToken(user, tokenHash, expiresAt) {
  user.isVerified = false;
  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpires = expiresAt;

  if (isDatabaseConnected()) {
    await user.save();
  }

  return user;
}

/**
 * Clears verification-token fields after success or expiration.
 * Removing the hash prevents one-time verification links from being reused.
 * @param {object} user - User whose verification token should be removed.
 * @param {boolean} markVerified - Whether the user should be marked as verified.
 * @returns {Promise<object>} Updated user record.
 */
async function clearVerificationToken(user, markVerified = false) {
  if (markVerified) user.isVerified = true;
  user.verificationTokenHash = undefined;
  user.verificationTokenExpires = undefined;

  if (isDatabaseConnected()) {
    await user.save();
  }

  return user;
}

/**
 * Builds the client login URL used after email verification redirects.
 * Redirecting to the frontend keeps the user inside the StockPulse experience after backend validation.
 * @param {string} status - Verification status placed in the login-page query string.
 * @returns {string} Client login URL with a verification status query value.
 */
function buildVerificationRedirect(status) {
  const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
  const url = new URL('/login', clientOrigin);
  url.searchParams.set('verification', status);
  return url.toString();
}

/**
 * Determines whether the caller expects JSON rather than a browser redirect.
 * Tests and API clients can request JSON while real email clicks redirect to the login page.
 * @param {*} req - Express request containing query and headers.
 * @returns {boolean} True when a JSON response should be sent.
 */
function wantsJsonVerificationResponse(req) {
  return req.query?.format === 'json' || String(req.get?.('accept') || '').includes('application/json');
}

/**
 * Creates a user account, stores an unverified state, and sends an email verification link.
 * The user does not receive a JWT until the email address has been verified.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the register result.
 */
export const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: PASSWORD_REQUIREMENT_MESSAGE });
  }

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ message: 'Email is already registered.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const verification = createEmailVerificationToken();
  let user;

  if (isDatabaseConnected()) {
    user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      virtualCash: 10000,
      isVerified: false,
      verificationTokenHash: verification.tokenHash,
      verificationTokenExpires: verification.expiresAt,
    });
  } else {
    user = createDemoUser({
      name,
      email: normalizedEmail,
      passwordHash,
      isVerified: false,
      verificationTokenHash: verification.tokenHash,
      verificationTokenExpires: verification.expiresAt,
    });
  }

  await sendVerificationEmail({ req, user, token: verification.token });

  res.status(201).json({
    message: "We've sent a verification email to your inbox. Please verify your email before logging in.",
    verificationRequired: true,
    email: normalizedEmail,
  });
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
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  let user = await findUserByEmail(normalizedEmail);

  // Offline demo mode creates a verified user on first login so local reviewers can still start immediately.
  if (!user && !isDatabaseConnected()) {
    user = createDemoUser({ name: 'Demo Student', email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), isVerified: true });
  }

  const isValidPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (user.isVerified === false) {
    return res.status(403).json({
      message: UNVERIFIED_MESSAGE,
      code: 'EMAIL_NOT_VERIFIED',
      email: normalizedEmail,
      canResendVerification: true,
    });
  }

  res.json({ token: signToken(String(user._id || user.id)), user: serializeUser(user) });
});


/**
 * Validates the basic format of an email address without creating or reading an account.
 * This endpoint lets clients check obvious input mistakes while keeping account existence private.
 * @param {*} req - Express request containing the email value in the body.
 * @param {*} res - Express response used to send the validation result.
 * @returns {Promise<*>} A promise resolving to the validation response.
 */
export const validateEmail = catchAsync(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  res.json({ email: normalizedEmail, valid: isValidEmail(normalizedEmail) });
});
/**
 * Validates a one-time email verification token and marks the matching account as verified.
 * The stored token hash is removed on success so the same email link cannot be reused.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the verification result or redirect.
 */
export const verifyEmail = catchAsync(async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  const sendJson = wantsJsonVerificationResponse(req);

  if (!token) {
    if (sendJson) return res.status(400).json({ message: 'Verification token is required.' });
    return res.redirect(buildVerificationRedirect('missing'));
  }

  const user = await findUserByVerificationHash(hashVerificationToken(token));
  if (!user) {
    if (sendJson) return res.status(400).json({ message: 'This verification link is invalid or has already been used.' });
    return res.redirect(buildVerificationRedirect('invalid'));
  }

  if (isVerificationTokenExpired(user.verificationTokenExpires)) {
    await clearVerificationToken(user, false);
    if (sendJson) return res.status(410).json({ message: 'This verification link has expired. Please request a new verification email.' });
    return res.redirect(buildVerificationRedirect('expired'));
  }

  await clearVerificationToken(user, true);

  if (sendJson) return res.json({ message: 'Email verified. You can now log in.', email: user.email });
  return res.redirect(buildVerificationRedirect('success'));
});

/**
 * Sends a fresh verification email for an existing unverified account.
 * A new token invalidates the previous link, and a simple limiter reduces accidental resend spam.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the resend result.
 */
export const resendVerification = catchAsync(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    return res.status(404).json({ message: 'No account was found for that email. Please create an account first.' });
  }

  if (user.isVerified !== false) {
    return res.status(409).json({ message: 'This email is already verified. Please log in.' });
  }

  const rateLimit = checkVerificationResendLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      message: `Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another verification email.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const verification = createEmailVerificationToken();
  await storeVerificationToken(user, verification.tokenHash, verification.expiresAt);
  await sendVerificationEmail({ req, user, token: verification.token });
  recordVerificationResend(normalizedEmail);

  res.json({
    message: "We've sent a new verification email. Please check your inbox.",
    verificationRequired: true,
    email: normalizedEmail,
  });
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
 * Stores a newly hashed password for the signed-in user.
 * The route is already protected by auth middleware, so the UI can stay simple and avoid asking for the old password twice.
 * @param {*} req - Express request containing route parameters, query values, body data, and authentication context.
 * @param {*} res - Express response used to send the HTTP result.
 * @returns {Promise<*>} A promise resolving to the change password result.
 */
export const changePassword = catchAsync(async (req, res) => {
  const newPassword = String(req.body.newPassword || '');

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: PASSWORD_REQUIREMENT_MESSAGE });
  }

  const user = isDatabaseConnected() ? await User.findById(getUserId(req.user)) : req.user;
  if (!user) return res.status(404).json({ message: 'User not found.' });

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
        { $setOnInsert: { name: 'Demo Student', email: 'demo@stockpulse.test', passwordHash, virtualCash: 10000, isVerified: true } },
        { upsert: true, new: true },
      )
    : getOrCreateDemoUser({ passwordHash, isVerified: true });

  res.json({ token: signToken(String(user._id || user.id)), user: serializeUser(user) });
});
