/**
 * File purpose: Connects StockPulse to MongoDB and provides a safe in-memory fallback when it is unavailable.
 */
import mongoose from 'mongoose';
import dns from 'node:dns/promises';

const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

// Some Windows DNS configurations resolve normal hostnames but reject the SRV
// lookup required by mongodb+srv URLs. Fall back only when that lookup fails.
/**
 * Verifies MongoDB Atlas DNS discovery and retries recoverable Windows DNS failures.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} uri - MongoDB connection string.
 * @returns {Promise<void>} A promise that resolves after DNS is ready or rejects for an unrecoverable error.
 */
async function ensureAtlasSrvResolution(uri) {
  if (!uri.startsWith('mongodb+srv://')) return;

  const srvRecord = `_mongodb._tcp.${new URL(uri).hostname}`;

  try {
    await dns.resolveSrv(srvRecord);
  } catch (error) {
    const recoverableDnsErrors = new Set(['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL']);
    if (!recoverableDnsErrors.has(error.code)) throw error;

    dns.setServers(PUBLIC_DNS_SERVERS);
    await dns.resolveSrv(srvRecord);
    console.info('MongoDB SRV lookup is using a public DNS resolver.');
  }
}

// Database connection is optional for portfolio demos, but enabled when MONGO_URI is valid.
/**
 * Connects to MongoDB when a URI is configured and otherwise enables demo storage.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @returns {Promise<*>} A promise resolving to the connect database result.
 */
export async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI is not configured. Using in-memory demo storage.');
    return false;
  }

  try {
    await ensureAtlasSrvResolution(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for StockPulse.');
    return true;
  } catch (error) {
    console.warn(`MongoDB unavailable. Using in-memory demo storage. ${error.message}`);
    return false;
  }
}

/**
 * Checks whether Mongoose currently has an active MongoDB connection.
 * Keeping the condition in one predicate makes branching rules consistent and self-contained.
 * @returns {boolean} True when the condition is satisfied; otherwise false.
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
