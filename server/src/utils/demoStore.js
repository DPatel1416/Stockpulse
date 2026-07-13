/**
 * File purpose: Provides focused Demo Store helper functions that keep repeated logic out of larger modules.
 */
import { randomUUID } from 'crypto';
import { findStock } from './demoData.js';

// In-memory storage lets reviewers run the API without MongoDB while preserving route behavior.
export const demoStore = {
  users: new Map(),
  watchlists: new Map(),
  holdings: new Map(),
  transactions: new Map(),
  orders: new Map(),
  paperAccounts: new Map(),
  portfolioSnapshots: new Map(),
};

/**
 * Creates the demo user with the defaults required by the rest of the app.
 * Centralizing creation ensures every new value follows the same defaults and validation.
 * @param {*} options - Named settings that adjust the operation.
 * @returns {object} The newly created in-memory demo user.
 */
export function createDemoUser({
  name,
  email,
  passwordHash,
  isVerified = true,
  verificationTokenHash,
  verificationTokenExpires,
  passwordResetTokenHash,
  passwordResetTokenExpires,
  failedLoginAttempts = 0,
  loginLockUntil,
  loginLockLevel = 0,
  sessionVersion = 0,
}) {
  const id = randomUUID();
  const user = {
    id,
    name,
    email,
    passwordHash,
    virtualCash: 10000,
    isVerified,
    verificationTokenHash,
    verificationTokenExpires,
    passwordResetTokenHash,
    passwordResetTokenExpires,
    failedLoginAttempts,
    loginLockUntil,
    loginLockLevel,
    sessionVersion,
    createdAt: new Date().toISOString(),
  };
  demoStore.users.set(id, user);
  demoStore.watchlists.set(id, []);
  demoStore.holdings.set(id, []);
  demoStore.transactions.set(id, []);
  demoStore.orders.set(id, []);
  demoStore.paperAccounts.set(id, []);
  demoStore.portfolioSnapshots.set(id, []);
  return user;
}

/**
 * Returns the or create demo user needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} options - Named settings that adjust the operation.
 * @returns {*} The requested or create demo user result.
 */
export function getOrCreateDemoUser({ name = 'Demo Student', email = 'demo@stockpulse.test', passwordHash, isVerified = true, verificationTokenHash, verificationTokenExpires }) {
  const existingUser = findDemoUserByEmail(email);
  return existingUser || createDemoUser({ name, email, passwordHash, isVerified, verificationTokenHash, verificationTokenExpires });
}

/**
 * Finds the demo user by email that matches the caller's criteria.
 * A dedicated lookup keeps matching rules consistent for every caller.
 * @param {string} email - Normalized account email address.
 * @returns {*} The matching demo user by email result.
 */
export function findDemoUserByEmail(email) {
  return Array.from(demoStore.users.values()).find((user) => user.email === email);
}

/**
 * Finds an in-memory user by the stored verification token hash.
 * The plain email-verification token is never stored, so matching must happen against the hash.
 * @param {string} tokenHash - SHA-256 hash of the verification token sent by email.
 * @returns {*} The matching demo user, or undefined when no user has that token hash.
 */
export function findDemoUserByVerificationTokenHash(tokenHash) {
  return Array.from(demoStore.users.values()).find((user) => user.verificationTokenHash === tokenHash);
}

/**
 * Finds an in-memory user by the stored password-reset token hash.
 * @param {string} tokenHash - SHA-256 hash of the token received from the reset link.
 * @returns {object|undefined} Matching demo user when the reset token is valid.
 */
export function findDemoUserByPasswordResetTokenHash(tokenHash) {
  return Array.from(demoStore.users.values()).find((user) => user.passwordResetTokenHash === tokenHash);
}

/**
 * Finds the demo user by id that matches the caller's criteria.
 * A dedicated lookup keeps matching rules consistent for every caller.
 * @param {string} id - Record identifier.
 * @returns {*} The matching demo user by id result.
 */
export function findDemoUserById(id) {
  return demoStore.users.get(id);
}

/**
 * Returns the demo portfolio needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} userId - Stable identifier of the account owner.
 * @returns {*} The requested demo portfolio result.
 */
export function getDemoPortfolio(userId) {
  const user = findDemoUserById(userId);
  const holdings = (demoStore.holdings.get(userId) || []).map((holding) => {
    const stock = findStock(holding.ticker);
    const marketValue = stock.price * holding.shares;
    const costBasis = holding.averageCost * holding.shares;
    return {
      ...holding,
      currentPrice: stock.price,
      marketValue,
      profitLoss: marketValue - costBasis,
      profitLossPercent: costBasis ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      sector: stock.sector,
    };
  });
  const investedValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const costBasis = holdings.reduce((sum, holding) => sum + holding.averageCost * holding.shares, 0);

  return {
    demo: true,
    virtualCash: Number(user?.virtualCash ?? 10000),
    investedValue,
    totalValue: Number(user?.virtualCash ?? 10000) + investedValue,
    totalProfitLoss: investedValue - costBasis,
    totalProfitLossPercent: costBasis ? ((investedValue - costBasis) / costBasis) * 100 : 0,
    holdings,
    transactions: demoStore.transactions.get(userId) || [],
    accounts: demoStore.paperAccounts.get(userId) || [],
  };
}
