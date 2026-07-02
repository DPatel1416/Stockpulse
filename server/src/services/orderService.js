/**
 * File purpose: Validates, stores, fills, updates, and cancels market and limit orders for paper trading.
 */
import { randomUUID } from 'crypto';
import { isDatabaseConnected } from '../config/db.js';
import Holding from '../models/Holding.js';
import Order from '../models/Order.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { searchStock } from './stockDataService.js';
import { demoStore, findDemoUserById } from '../utils/demoStore.js';

const executionQuoteCache = new Map();
const EXECUTION_QUOTE_TTL_MS = 10_000;

/**
 * Converts a database or demo user identifier into a consistent string key.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {string} A stable string identifier for database and demo users.
 */
function toUserId(user) {
  return String(user._id || user.id);
}

/**
 * Creates an order-validation error with an HTTP status code.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} message - Human-readable text shown to the user.
 * @param {number} statusCode - HTTP status attached to a validation error.
 * @returns {*} The order error result.
 */
function orderError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Converts the order input into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {*} payload - Validated data supplied by the caller.
 * @returns {*} The normalized order input result.
 */
function normalizeOrderInput(payload) {
  return {
    ticker: String(payload.ticker || '').trim().toUpperCase(),
    side: String(payload.side || '').trim().toUpperCase(),
    orderType: String(payload.orderType || 'MARKET').trim().toUpperCase(),
    quantity: Number(payload.quantity),
    limitPrice: payload.limitPrice === undefined || payload.limitPrice === null || payload.limitPrice === ''
      ? null
      : Number(payload.limitPrice),
  };
}

/**
 * Validates the order input before any state or persistence is changed.
 * Central validation prevents different callers from accepting conflicting inputs.
 * @param {object} order - Normalized market or limit order being processed.
 * @returns {*} The validate order input result.
 */
function validateOrderInput(order) {
  if (!order.ticker) return 'Choose a ticker before placing an order.';
  if (!['BUY', 'SELL'].includes(order.side)) return 'Side must be BUY or SELL.';
  if (!['MARKET', 'LIMIT'].includes(order.orderType)) return 'Order type must be MARKET or LIMIT.';
  if (!Number.isInteger(order.quantity) || order.quantity <= 0) return 'Quantity must be a positive whole number.';
  if (order.orderType === 'LIMIT' && (!Number.isFinite(order.limitPrice) || order.limitPrice <= 0)) return 'Enter a valid limit price greater than zero.';
  return null;
}

/**
 * Converts the limit price input into the consistent shape expected by later code.
 * Normalization at one boundary prevents later code from handling many input shapes.
 * @param {*} payload - Validated data supplied by the caller.
 * @returns {*} The normalized limit price input result.
 */
function normalizeLimitPriceInput(payload) {
  const limitPrice = Number(payload.limitPrice);
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
    throw orderError('Enter a valid limit price greater than zero.');
  }
  return limitPrice;
}

/**
 * Returns the execution quote needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} ticker - Stock ticker symbol used to identify a company.
 * @param {*} options1 - Input value for options1.
 * @returns {Promise<*>} A promise resolving to the requested execution quote result.
 */
async function getExecutionQuote(ticker, { forceFresh = false } = {}) {
  const cachedQuote = executionQuoteCache.get(ticker);
  if (!forceFresh && cachedQuote && Date.now() - cachedQuote.createdAt < EXECUTION_QUOTE_TTL_MS) return cachedQuote.quote;

  const result = await searchStock(ticker, { freshQuote: true });
  const price = Number(result.stock?.price);

  if (!result.stock || !Number.isFinite(price) || price <= 0) {
    throw orderError('A current quote is unavailable for this ticker.', 503);
  }

  const quote = {
    stock: { ...result.stock, price },
    provider: result.provider || (result.demo ? 'demo' : 'live'),
    demo: Boolean(result.demo),
  };
  executionQuoteCache.set(ticker, { createdAt: Date.now(), quote });
  return quote;
}

/**
 * Checks whether the current quote satisfies a buy or sell limit price.
 * Keeping the condition in one predicate makes branching rules consistent and self-contained.
 * @param {'BUY'|'SELL'} side - Order side that determines cash and share movement.
 * @param {number} marketPrice - Current executable stock price.
 * @param {number} limitPrice - Requested maximum buy price or minimum sell price.
 * @returns {Promise<object>} A promise resolving to the serialized cancelled order.
 */
export function shouldFillLimitOrder(side, marketPrice, limitPrice) {
  return side === 'BUY' ? marketPrice <= limitPrice : marketPrice >= limitPrice;
}

/**
 * Calculates cash and shares reserved by currently pending limit orders.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {Array<object>} orders - Pending orders to inspect or summarize.
 * @param {string|null} tickerToExclude - Ticker omitted from reservation totals.
 * @returns {*} The summarize reservations result.
 */
function summarizeReservations(orders, tickerToExclude = null) {
  return orders.reduce((summary, order) => {
    if (tickerToExclude && String(order.id || order._id) === tickerToExclude) return summary;
    if (order.side === 'BUY') summary.cash += Number(order.limitPrice) * Number(order.quantity);
    if (order.side === 'SELL') {
      summary.shares[order.ticker] = (summary.shares[order.ticker] || 0) + Number(order.quantity);
    }
    return summary;
  }, { cash: 0, shares: {} });
}

/**
 * Converts the order into a stable response-safe object.
 * A serializer exposes a stable shape without leaking database-specific details.
 * @param {object} order - Normalized market or limit order being processed.
 * @returns {*} The response-safe order result.
 */
function serializeOrder(order) {
  return {
    id: String(order._id || order.id),
    ticker: order.ticker,
    companyName: order.companyName,
    logo: order.logo || null,
    side: order.side,
    orderType: order.orderType || 'LIMIT',
    quantity: Number(order.quantity),
    limitPrice: Number(order.limitPrice),
    submittedPrice: Number(order.submittedPrice),
    status: order.status,
    filledPrice: order.filledPrice === undefined ? null : Number(order.filledPrice),
    total: order.total === undefined ? null : Number(order.total),
    priceProvider: order.priceProvider || null,
    rejectionReason: order.rejectionReason || null,
    createdAt: order.createdAt,
    filledAt: order.filledAt || null,
    cancelledAt: order.cancelledAt || null,
  };
}

/**
 * Returns the mongo pending orders needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} userId - Stable identifier of the account owner.
 * @returns {Promise<*>} A promise resolving to the requested mongo pending orders result.
 */
async function getMongoPendingOrders(userId) {
  return Order.find({ userId, status: 'PENDING' }).sort({ createdAt: -1 });
}

/**
 * Returns the demo orders needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {string} userId - Stable identifier of the account owner.
 * @returns {*} The requested demo orders result.
 */
function getDemoOrders(userId) {
  return demoStore.orders.get(userId) || [];
}

/**
 * Validates the available resources before any state or persistence is changed.
 * Central validation prevents different callers from accepting conflicting inputs.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {number} quotePrice - Current quote used to test a pending limit.
 * @param {string|null} excludedOrderId - Order omitted while recalculating reservations.
 * @returns {Promise<*>} A promise resolving to the validate available resources result.
 */
async function validateAvailableResources(userId, order, quotePrice, excludedOrderId = null) {
  const fillsAtQuote = order.orderType === 'MARKET' || shouldFillLimitOrder(order.side, quotePrice, order.limitPrice);
  const buyPriceForValidation = order.orderType === 'LIMIT' && !fillsAtQuote ? order.limitPrice : quotePrice;

  if (isDatabaseConnected()) {
    const [user, holding, pendingOrders] = await Promise.all([
      User.findById(userId),
      Holding.findOne({ userId, ticker: order.ticker }),
      getMongoPendingOrders(userId),
    ]);
    const reservations = summarizeReservations(pendingOrders, excludedOrderId);
    const requiredCash = buyPriceForValidation * order.quantity;

    if (order.side === 'BUY' && requiredCash > Number(user.virtualCash) - reservations.cash + 0.001) {
      throw orderError('This order exceeds your available virtual cash after open orders are reserved.');
    }

    const availableShares = Number(holding?.shares || 0) - Number(reservations.shares[order.ticker] || 0);
    if (order.side === 'SELL' && order.quantity > availableShares + 0.0001) {
      throw orderError('This order exceeds the shares available after open sell orders are reserved.');
    }

    return;
  }

  const user = findDemoUserById(userId);
  const holding = (demoStore.holdings.get(userId) || []).find((item) => item.ticker === order.ticker);
  const pendingOrders = getDemoOrders(userId).filter((item) => item.status === 'PENDING');
  const reservations = summarizeReservations(pendingOrders, excludedOrderId);
  const requiredCash = buyPriceForValidation * order.quantity;

  if (order.side === 'BUY' && requiredCash > Number(user.virtualCash) - reservations.cash + 0.001) {
    throw orderError('This order exceeds your available virtual cash after open orders are reserved.');
  }

  const availableShares = Number(holding?.shares || 0) - Number(reservations.shares[order.ticker] || 0);
  if (order.side === 'SELL' && order.quantity > availableShares + 0.0001) {
    throw orderError('This order exceeds the shares available after open sell orders are reserved.');
  }
}

/**
 * Applies a filled order atomically to MongoDB-backed cash, holdings, and transactions.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {object} quote - Current provider quote and its source metadata.
 * @param {object} orderDocument - MongoDB order document being serialized or filled.
 * @returns {Promise<*>} A promise resolving to the execute mongo fill result.
 */
async function executeMongoFill(userId, order, quote, orderDocument = null) {
  const user = await User.findById(userId);
  const holding = await Holding.findOne({ userId, ticker: order.ticker });
  const total = Number((quote.stock.price * order.quantity).toFixed(2));

  if (order.side === 'BUY' && total > Number(user.virtualCash) + 0.001) {
    throw orderError('Insufficient virtual cash when the order reached its execution price.');
  }

  if (order.side === 'SELL' && (!holding || holding.shares < order.quantity)) {
    throw orderError('Insufficient shares when the order reached its execution price.');
  }

  if (order.side === 'BUY') {
    user.virtualCash = Number((user.virtualCash - total).toFixed(2));
    if (holding) {
      const newShares = holding.shares + order.quantity;
      holding.averageCost = Number((((holding.averageCost * holding.shares) + total) / newShares).toFixed(4));
      holding.shares = newShares;
      await holding.save();
    } else {
      await Holding.create({
        userId,
        ticker: order.ticker,
        companyName: quote.stock.company,
        shares: order.quantity,
        averageCost: quote.stock.price,
      });
    }
  } else {
    user.virtualCash = Number((user.virtualCash + total).toFixed(2));
    holding.shares = Number((holding.shares - order.quantity).toFixed(4));
    if (holding.shares <= 0) await holding.deleteOne();
    else await holding.save();
  }

  await user.save();
  const trade = await Transaction.create({
    userId,
    type: 'TRADE',
    direction: order.side === 'BUY' ? 'OUT' : 'IN',
    ticker: order.ticker,
    side: order.side,
    orderType: order.orderType,
    limitPrice: order.orderType === 'LIMIT' ? order.limitPrice : undefined,
    quantity: order.quantity,
    price: quote.stock.price,
    priceProvider: quote.provider,
    total,
  });

  if (orderDocument) {
    orderDocument.status = 'FILLED';
    orderDocument.filledPrice = quote.stock.price;
    orderDocument.total = total;
    orderDocument.priceProvider = quote.provider;
    orderDocument.filledAt = new Date();
    await orderDocument.save();
  }

  return {
    ...trade.toObject(),
    id: String(trade._id),
  };
}

/**
 * Applies a filled order to the in-memory demo portfolio.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {object} quote - Current provider quote and its source metadata.
 * @param {object|null} storedOrder - Existing pending order being filled.
 * @returns {*} The execute demo fill result.
 */
function executeDemoFill(userId, order, quote, storedOrder = null) {
  const user = findDemoUserById(userId);
  const holdings = demoStore.holdings.get(userId) || [];
  const holding = holdings.find((item) => item.ticker === order.ticker);
  const total = Number((quote.stock.price * order.quantity).toFixed(2));

  if (order.side === 'BUY' && total > Number(user.virtualCash) + 0.001) {
    throw orderError('Insufficient virtual cash when the order reached its execution price.');
  }

  if (order.side === 'SELL' && (!holding || holding.shares < order.quantity)) {
    throw orderError('Insufficient shares when the order reached its execution price.');
  }

  if (order.side === 'BUY') {
    user.virtualCash = Number((user.virtualCash - total).toFixed(2));
    if (holding) {
      const newShares = holding.shares + order.quantity;
      holding.averageCost = Number((((holding.averageCost * holding.shares) + total) / newShares).toFixed(4));
      holding.shares = newShares;
    } else {
      holdings.push({ ticker: order.ticker, companyName: quote.stock.company, shares: order.quantity, averageCost: quote.stock.price });
    }
  } else {
    user.virtualCash = Number((user.virtualCash + total).toFixed(2));
    holding.shares = Number((holding.shares - order.quantity).toFixed(4));
    demoStore.holdings.set(userId, holdings.filter((item) => item.shares > 0));
  }

  const trade = {
    id: randomUUID(),
    type: 'TRADE',
    direction: order.side === 'BUY' ? 'OUT' : 'IN',
    ticker: order.ticker,
    side: order.side,
    orderType: order.orderType,
    limitPrice: order.orderType === 'LIMIT' ? order.limitPrice : undefined,
    quantity: order.quantity,
    price: quote.stock.price,
    priceProvider: quote.provider,
    total,
    createdAt: new Date().toISOString(),
  };
  demoStore.transactions.set(userId, [trade, ...(demoStore.transactions.get(userId) || [])]);

  if (storedOrder) {
    storedOrder.status = 'FILLED';
    storedOrder.filledPrice = quote.stock.price;
    storedOrder.total = total;
    storedOrder.priceProvider = quote.provider;
    storedOrder.filledAt = new Date().toISOString();
  }

  return trade;
}

/**
 * Validates and stores a MongoDB-backed market or limit order.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {object} quote - Current provider quote and its source metadata.
 * @returns {Promise<*>} A promise resolving to the place mongo order result.
 */
async function placeMongoOrder(userId, order, quote) {
  await validateAvailableResources(userId, order, quote.stock.price);

  if (order.orderType === 'MARKET') {
    const trade = await executeMongoFill(userId, order, quote);
    return { trade, order: { ...order, id: trade.id, status: 'FILLED', filledPrice: trade.price, total: trade.total, priceProvider: quote.provider } };
  }

  const orderDocument = await Order.create({
    userId,
    ticker: order.ticker,
    companyName: quote.stock.company,
    logo: quote.stock.logo || null,
    side: order.side,
    quantity: order.quantity,
    limitPrice: order.limitPrice,
    submittedPrice: quote.stock.price,
    status: 'PENDING',
  });

  if (!shouldFillLimitOrder(order.side, quote.stock.price, order.limitPrice)) {
    return { trade: null, order: serializeOrder(orderDocument) };
  }

  orderDocument.status = 'PROCESSING';
  await orderDocument.save();
  const trade = await executeMongoFill(userId, order, quote, orderDocument);
  return { trade, order: serializeOrder(orderDocument) };
}

/**
 * Validates and stores an in-memory market or limit order.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {object} order - Normalized market or limit order being processed.
 * @param {object} quote - Current provider quote and its source metadata.
 * @returns {Promise<*>} A promise resolving to the place demo order result.
 */
async function placeDemoOrder(userId, order, quote) {
  await validateAvailableResources(userId, order, quote.stock.price);

  if (order.orderType === 'MARKET') {
    const trade = executeDemoFill(userId, order, quote);
    return { trade, order: { ...order, id: trade.id, status: 'FILLED', filledPrice: trade.price, total: trade.total, priceProvider: quote.provider } };
  }

  const storedOrder = {
    id: randomUUID(),
    ticker: order.ticker,
    companyName: quote.stock.company,
    logo: quote.stock.logo || null,
    side: order.side,
    orderType: 'LIMIT',
    quantity: order.quantity,
    limitPrice: order.limitPrice,
    submittedPrice: quote.stock.price,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  demoStore.orders.set(userId, [storedOrder, ...getDemoOrders(userId)]);

  if (!shouldFillLimitOrder(order.side, quote.stock.price, order.limitPrice)) {
    return { trade: null, order: serializeOrder(storedOrder) };
  }

  storedOrder.status = 'PROCESSING';
  const trade = executeDemoFill(userId, order, quote, storedOrder);
  return { trade, order: serializeOrder(storedOrder) };
}

/**
 * Routes an order to MongoDB or demo storage after normalizing its input.
 * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {*} payload - Validated data supplied by the caller.
 * @returns {Promise<*>} A promise resolving to the place order for user result.
 */
export async function placeOrderForUser(user, payload) {
  const order = normalizeOrderInput(payload);
  const validationError = validateOrderInput(order);
  if (validationError) throw orderError(validationError);

  const quote = await getExecutionQuote(order.ticker, { forceFresh: true });
  order.companyName = quote.stock.company;
  order.logo = quote.stock.logo || null;
  const userId = toUserId(user);

  return isDatabaseConnected()
    ? placeMongoOrder(userId, order, quote)
    : placeDemoOrder(userId, order, quote);
}

/**
 * Processes the mongo pending orders through the required business-rule sequence.
 * A named workflow makes the sequence of business rules explicit.
 * @param {string} userId - Stable identifier of the account owner.
 * @returns {Promise<*>} A promise resolving to the process mongo pending orders result.
 */
async function processMongoPendingOrders(userId) {
  const pendingOrders = await getMongoPendingOrders(userId);
  const quotes = new Map();

  for (const pendingOrder of pendingOrders) {
    let quote;
    try {
      if (!quotes.has(pendingOrder.ticker)) quotes.set(pendingOrder.ticker, await getExecutionQuote(pendingOrder.ticker));
      quote = quotes.get(pendingOrder.ticker);
    } catch {
      continue;
    }

    if (!shouldFillLimitOrder(pendingOrder.side, quote.stock.price, pendingOrder.limitPrice)) continue;

    const claimedOrder = await Order.findOneAndUpdate(
      { _id: pendingOrder._id, userId, status: 'PENDING' },
      { $set: { status: 'PROCESSING' } },
      { new: true },
    );
    if (!claimedOrder) continue;

    try {
      await executeMongoFill(userId, claimedOrder.toObject(), quote, claimedOrder);
    } catch (error) {
      claimedOrder.status = 'REJECTED';
      claimedOrder.rejectionReason = error.message;
      await claimedOrder.save();
    }
  }
}

/**
 * Processes the demo pending orders through the required business-rule sequence.
 * A named workflow makes the sequence of business rules explicit.
 * @param {string} userId - Stable identifier of the account owner.
 * @returns {Promise<*>} A promise resolving to the process demo pending orders result.
 */
async function processDemoPendingOrders(userId) {
  const pendingOrders = getDemoOrders(userId).filter((order) => order.status === 'PENDING');
  const quotes = new Map();

  for (const pendingOrder of pendingOrders) {
    let quote;
    try {
      if (!quotes.has(pendingOrder.ticker)) quotes.set(pendingOrder.ticker, await getExecutionQuote(pendingOrder.ticker));
      quote = quotes.get(pendingOrder.ticker);
    } catch {
      continue;
    }

    if (!shouldFillLimitOrder(pendingOrder.side, quote.stock.price, pendingOrder.limitPrice)) continue;
    if (pendingOrder.status !== 'PENDING') continue;

    pendingOrder.status = 'PROCESSING';
    try {
      executeDemoFill(userId, pendingOrder, quote, pendingOrder);
    } catch (error) {
      pendingOrder.status = 'REJECTED';
      pendingOrder.rejectionReason = error.message;
    }
  }
}

/**
 * Processes the pending orders for user through the required business-rule sequence.
 * A named workflow makes the sequence of business rules explicit.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {Promise<*>} A promise resolving to the process pending orders for user result.
 */
export async function processPendingOrdersForUser(user) {
  const userId = toUserId(user);
  if (isDatabaseConnected()) await processMongoPendingOrders(userId);
  else await processDemoPendingOrders(userId);
}

/**
 * Updates the mongo limit order while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {string} orderId - Identifier of the pending order.
 * @param {number} limitPrice - Requested maximum buy price or minimum sell price.
 * @returns {Promise<object>} A promise resolving to the updated order and any immediate fill.
 */
async function updateMongoLimitOrder(userId, orderId, limitPrice) {
  if (!/^[a-f\d]{24}$/i.test(String(orderId || ''))) {
    throw orderError('This order is no longer open and cannot be updated.', 409);
  }

  const orderDocument = await Order.findOne({ _id: orderId, userId, status: 'PENDING' });
  if (!orderDocument) throw orderError('This order is no longer open and cannot be updated.', 409);

  const quote = await getExecutionQuote(orderDocument.ticker, { forceFresh: true });
  const updatedOrder = {
    ticker: orderDocument.ticker,
    companyName: orderDocument.companyName,
    side: orderDocument.side,
    orderType: 'LIMIT',
    quantity: Number(orderDocument.quantity),
    limitPrice,
  };

  // Updating a limit may instantly make it marketable, so validation and filling use the live quote.
  await validateAvailableResources(userId, updatedOrder, quote.stock.price, orderId);
  orderDocument.limitPrice = limitPrice;

  if (!shouldFillLimitOrder(orderDocument.side, quote.stock.price, limitPrice)) {
    await orderDocument.save();
    return { trade: null, order: serializeOrder(orderDocument) };
  }

  orderDocument.status = 'PROCESSING';
  await orderDocument.save();
  const trade = await executeMongoFill(userId, updatedOrder, quote, orderDocument);
  return { trade, order: serializeOrder(orderDocument) };
}

/**
 * Updates the demo limit order while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {string} userId - Stable identifier of the account owner.
 * @param {string} orderId - Identifier of the pending order.
 * @param {number} limitPrice - Requested maximum buy price or minimum sell price.
 * @returns {Promise<object>} A promise resolving to the updated demo order and any immediate fill.
 */
async function updateDemoLimitOrder(userId, orderId, limitPrice) {
  const order = getDemoOrders(userId).find((item) => item.id === orderId && item.status === 'PENDING');
  if (!order) throw orderError('This order is no longer open and cannot be updated.', 409);

  const quote = await getExecutionQuote(order.ticker, { forceFresh: true });
  const updatedOrder = {
    ...order,
    orderType: 'LIMIT',
    quantity: Number(order.quantity),
    limitPrice,
  };

  await validateAvailableResources(userId, updatedOrder, quote.stock.price, orderId);
  order.limitPrice = limitPrice;
  order.updatedAt = new Date().toISOString();

  if (!shouldFillLimitOrder(order.side, quote.stock.price, limitPrice)) {
    return { trade: null, order: serializeOrder(order) };
  }

  order.status = 'PROCESSING';
  const trade = executeDemoFill(userId, updatedOrder, quote, order);
  return { trade, order: serializeOrder(order) };
}

/**
 * Updates the limit order for user while preserving related state invariants.
 * Keeping mutation rules together protects related state from drifting out of sync.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {string} orderId - Identifier of the pending order.
 * @param {*} payload - Validated data supplied by the caller.
 * @returns {Promise<object>} A promise resolving to the updated order and any immediate fill.
 */
export async function updateLimitOrderForUser(user, orderId, payload) {
  const userId = toUserId(user);
  const limitPrice = normalizeLimitPriceInput(payload);

  return isDatabaseConnected()
    ? updateMongoLimitOrder(userId, orderId, limitPrice)
    : updateDemoLimitOrder(userId, orderId, limitPrice);
}

// The API runs this lightweight sweep in the background so limits do not depend on an open portfolio page.
/**
 * Processes the all pending orders through the required business-rule sequence.
 * A named workflow makes the sequence of business rules explicit.
 * @returns {Promise<void>} A promise that resolves after every pending-order group is checked.
 */
export async function processAllPendingOrders() {
  if (isDatabaseConnected()) {
    const userIds = await Order.distinct('userId', { status: 'PENDING' });
    for (const userId of userIds) await processMongoPendingOrders(String(userId));
    return;
  }

  for (const [userId, orders] of demoStore.orders.entries()) {
    if (orders.some((order) => order.status === 'PENDING')) await processDemoPendingOrders(userId);
  }
}

/**
 * Returns the open orders for user needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @returns {Promise<*>} A promise resolving to the requested open orders for user result.
 */
export async function getOpenOrdersForUser(user) {
  const userId = toUserId(user);
  const orders = isDatabaseConnected()
    ? await getMongoPendingOrders(userId)
    : getDemoOrders(userId).filter((order) => order.status === 'PENDING');
  return orders.map(serializeOrder);
}

/**
 * Cancels one pending order owned by the authenticated user.
 * Ownership is checked inside the service so callers cannot cancel another user's order.
 * @param {*} user - Authenticated user whose data is being read or changed.
 * @param {string} orderId - Identifier of the pending order.
 * @returns {boolean} True when the condition is satisfied; otherwise false.
 */
export async function cancelOrderForUser(user, orderId) {
  const userId = toUserId(user);

  if (isDatabaseConnected()) {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, userId, status: 'PENDING' },
      { $set: { status: 'CANCELLED', cancelledAt: new Date() } },
      { new: true },
    );
    if (!order) throw orderError('This order is no longer open and cannot be cancelled.', 409);
    return serializeOrder(order);
  }

  const order = getDemoOrders(userId).find((item) => item.id === orderId && item.status === 'PENDING');
  if (!order) throw orderError('This order is no longer open and cannot be cancelled.', 409);
  order.status = 'CANCELLED';
  order.cancelledAt = new Date().toISOString();
  return serializeOrder(order);
}

/**
 * Returns the order reservations needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {Array<object>} openOrders - Pending limit orders that reserve cash or shares.
 * @returns {*} The requested order reservations result.
 */
export function getOrderReservations(openOrders) {
  const reservations = summarizeReservations(openOrders);
  return {
    reservedCash: Number(reservations.cash.toFixed(2)),
    reservedShares: reservations.shares,
  };
}
