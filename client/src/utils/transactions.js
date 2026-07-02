/**
 * File purpose: Provides focused Transactions helper functions that keep repeated logic out of larger modules.
 */
// Ledger helpers keep trade and funding labels consistent across account pages.
/**
 * Returns the transaction direction needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @returns {'IN'|'OUT'} The normalized direction of money movement.
 */
export function getTransactionDirection(transaction) {
  if (transaction.direction) return transaction.direction;
  return transaction.side === 'BUY' ? 'OUT' : 'IN';
}

/**
 * Returns the transaction label needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @returns {*} The requested transaction label result.
 */
export function getTransactionLabel(transaction) {
  if (transaction.type === 'FUNDING') {
    return transaction.description || `${transaction.accountType || 'Virtual'} funding`;
  }

  return `${transaction.side || 'Trade'} ${transaction.ticker || ''}`.trim();
}

/**
 * Returns the transaction type label needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @returns {*} The requested transaction type label result.
 */
export function getTransactionTypeLabel(transaction) {
  if (transaction.type === 'FUNDING') {
    return getTransactionDirection(transaction) === 'IN' ? 'Deposit' : 'Withdrawal';
  }

  return transaction.side === 'BUY' ? 'Purchase' : 'Sale';
}

/**
 * Returns the transaction detail needed by the calling screen or service.
 * Centralizing this lookup keeps callers independent from where the data comes from.
 * @param {object} transaction - Trade or funding ledger record being interpreted.
 * @returns {*} The requested transaction detail result.
 */
export function getTransactionDetail(transaction) {
  if (transaction.type === 'FUNDING') {
    return transaction.institution || transaction.accountType || 'Simulated funding';
  }

  const quantity = Number(transaction.quantity || 0);
  const price = Number(transaction.price || 0).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
  });

  const orderType = transaction.orderType === 'LIMIT' ? ` · Limit ${Number(transaction.limitPrice || 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}` : '';
  return `${quantity} share${quantity === 1 ? '' : 's'} at ${price}${orderType}`;
}
