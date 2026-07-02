/**
 * File purpose: Defines the reusable Trade Ticket React component and its focused user interaction.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { StockIdentity } from '../stock/StockLogo';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import GlassCard from '../ui/GlassCard';
import Input from '../ui/Input';
import { useToasts } from '../ui/Toast';

// TradeTicket supports immediate market fills and new limit orders; open limits are managed in the allocation area.
/**
 * Renders the trade ticket React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function TradeTicket({ stock, portfolio, onTradeComplete, onTickerChange, requiresLogin = false, onLoginRequired }) {
  const { showToast } = useToasts();
  const orderChoiceRef = useRef(null);
  const [side, setSide] = useState('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [orderMenuSide, setOrderMenuSide] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(stock?.price || '');
  const [symbol, setSymbol] = useState(stock?.ticker || '');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const estimatedPrice = orderType === 'LIMIT' ? Number(limitPrice || 0) : Number(stock?.price || 0);
  const total = useMemo(() => Number(quantity || 0) * estimatedPrice, [estimatedPrice, quantity]);
  const currentHolding = portfolio?.holdings?.find((item) => item.ticker === stock?.ticker);
  const reservedShares = Number(portfolio?.reservedShares?.[stock?.ticker] || 0);
  const availableShares = Math.max(0, Number(currentHolding?.shares || 0) - reservedShares);
  const buyingPower = Number(portfolio?.availableBuyingPower ?? portfolio?.virtualCash ?? 0);

  useEffect(() => {
    setSymbol(stock?.ticker || '');
    setLimitPrice(stock?.price || '');
  }, [stock?.price, stock?.ticker]);

  useEffect(() => {
    /**
     * Closes the buy/sell order-type menu when a click occurs outside it.
     * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
     * @param {*} event - Browser event that triggered the interaction.
     * @returns {void|*} No value is required; the close order menu state changes are applied.
     */
    function closeOrderMenu(event) {
      if (!orderChoiceRef.current?.contains(event.target)) setOrderMenuSide(null);
    }

    document.addEventListener('pointerdown', closeOrderMenu);
    return () => document.removeEventListener('pointerdown', closeOrderMenu);
  }, []);

  /**
   * Chooses market or limit execution before opening the confirmation step.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @param {'BUY'|'SELL'} nextSide - Order side selected for the next review step.
   * @param {'MARKET'|'LIMIT'} nextOrderType - Order type selected for the next review step.
   * @returns {void|*} No value is required; the choose order state changes are applied.
   */
  function chooseOrder(nextSide, nextOrderType) {
    setSide(nextSide);
    setOrderType(nextOrderType);
    setOrderMenuSide(null);
  }

  /**
   * Handles the symbol submit interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle symbol submit state changes are applied.
   */
  function handleSymbolSubmit(event) {
    event.preventDefault();
    const nextSymbol = symbol.trim().toUpperCase();

    if (!nextSymbol || !onTickerChange) return;
    setSymbol(nextSymbol);
    onTickerChange(nextSymbol);
  }

  /**
   * Validates the order before any state or persistence is changed.
   * Central validation prevents different callers from accepting conflicting inputs.
   * @returns {*} The validate order result.
   */
  function validateOrder() {
    const shareCount = Number(quantity);
    if (!stock) return 'Choose a stock before reviewing an order.';
    if (!Number.isFinite(shareCount) || shareCount <= 0) return 'Enter a quantity greater than zero.';
    if (!Number.isInteger(shareCount)) return 'Quantity must be a whole number.';
    if (orderType === 'LIMIT' && (!Number.isFinite(Number(limitPrice)) || Number(limitPrice) <= 0)) return 'Enter a valid limit price greater than zero.';
    if (side === 'BUY' && total > buyingPower) return 'This order exceeds your available virtual cash.';
    if (side === 'SELL' && shareCount > availableShares) return 'This order exceeds the shares available after open sell orders.';
    return null;
  }

  /**
   * Handles the review interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @returns {Promise<void>} A promise that resolves after the handle review side effects finish.
   */
  async function handleReview() {
    if (requiresLogin) {
      setIsLoginPromptOpen(true);
      return;
    }

    const error = validateOrder();
    if (error) {
      showToast(error, 'error');
      return;
    }

    setIsReviewing(true);
  }

  /**
   * Handles the confirm interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @returns {Promise<void>} A promise that resolves after the handle confirm side effects finish.
   */
  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      const result = await api.placeTrade({
        ticker: stock.ticker,
        side,
        orderType,
        quantity: Number(quantity),
        limitPrice: orderType === 'LIMIT' ? Number(limitPrice) : undefined,
      });
      if (result.order?.status === 'PENDING') {
        showToast(`${side} limit order placed for ${quantity} ${stock.ticker} share${Number(quantity) === 1 ? '' : 's'} at ${formatCurrency(limitPrice)}.`, 'success');
      } else {
        showToast(`${side} order filled at ${formatCurrency(result.trade?.price)} per share.`, 'success');
      }
      onTradeComplete?.(result.portfolio);
      setIsReviewing(false);
    } catch (error) {
      showToast(error.message || 'Trade could not be completed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <GlassCard className="order-ticket-card" variant="glow">
        <div className="section-title">
          <div>
            <h2>Order Ticket</h2>
            <p className="muted" style={{ margin: '5px 0 0' }}>{requiresLogin ? 'Explore the order form. Login is required to place an order.' : 'Place a market order now or set a limit price.'}</p>
          </div>
          <ShieldCheck className="positive" aria-hidden="true" />
        </div>
        <div className="trade-side-control" aria-label="Order side and type" ref={orderChoiceRef}>
          <div className="trade-side-buttons">
            {['BUY', 'SELL'].map((item) => (
              <button
                key={item}
                type="button"
                className={`trade-side-trigger ${item.toLowerCase()}${side === item ? ' active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={orderMenuSide === item}
                onClick={() => setOrderMenuSide((current) => current === item ? null : item)}
              >
                <span>{item}</span>
                <small>{side === item ? `${orderType === 'MARKET' ? 'Market' : 'Limit'} order` : 'Choose type'}</small>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          {orderMenuSide && (
            <div className={`trade-order-menu ${orderMenuSide.toLowerCase()}`} role="menu" aria-label={`${orderMenuSide.toLowerCase()} order type`}>
              <button type="button" role="menuitem" onClick={() => chooseOrder(orderMenuSide, 'MARKET')}>
                <span><strong>Market order</strong><small>Use the current quote</small></span>
                {side === orderMenuSide && orderType === 'MARKET' && <Check size={16} aria-hidden="true" />}
              </button>
              <button type="button" role="menuitem" onClick={() => chooseOrder(orderMenuSide, 'LIMIT')}>
                <span><strong>Limit order</strong><small>Set a target price</small></span>
                {side === orderMenuSide && orderType === 'LIMIT' && <Check size={16} aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {stock && <StockIdentity className="order-ticket-identity" stock={stock} size={34} />}
          {onTickerChange ? (
            <form className="trade-symbol-row" onSubmit={handleSymbolSubmit}>
              <Input
                label="Symbol"
                name="trade-ticker"
                value={symbol}
                autoComplete="off"
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              />
              <button className="button secondary" type="submit">Load quote</button>
            </form>
          ) : <Input label="Symbol" name="trade-ticker" value={stock?.ticker || ''} readOnly />}
          <div className="trade-order-input-row">
            <Input label="Quantity" name="trade-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <Input
              label={orderType === 'LIMIT' ? 'Limit price' : 'Market price'}
              name="trade-limit-price"
              type="number"
              min="0.01"
              step="0.01"
              value={orderType === 'LIMIT' ? limitPrice : stock?.price || ''}
              readOnly={orderType === 'MARKET'}
              onChange={orderType === 'LIMIT' ? (event) => setLimitPrice(event.target.value) : undefined}
            />
          </div>
          <div className="order-estimate-card">
            <div className="order-estimate-body">
              <div>
                <p className="muted">{orderType === 'LIMIT' ? 'Maximum' : 'Estimated'} {side === 'BUY' ? 'cost' : 'proceeds'}</p>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <div className="order-account-meta">
                <span><small>Market price</small><strong>{formatCurrency(stock?.price || 0)}</strong></span>
                <span><small>Available virtual cash</small><strong>{requiresLogin ? 'Login required' : formatCurrency(buyingPower)}</strong></span>
                <span><small>Available position</small><strong>{requiresLogin ? '--' : `${availableShares} shares`}</strong></span>
              </div>
            </div>
          </div>
          <Button onClick={handleReview}>Review order</Button>
        </div>
      </GlassCard>

      <ConfirmModal
        open={isReviewing}
        title={`Review ${side.toLowerCase()} order`}
        description="Confirm the order details before placing it in your virtual account."
        confirmLabel={isSubmitting ? 'Placing order...' : 'Place order'}
        confirmDisabled={isSubmitting}
        onCancel={() => setIsReviewing(false)}
        onConfirm={handleConfirm}
      >
        <div className="glass-card compact" style={{ boxShadow: 'none' }}>
          <div className="card-body">
            <StockIdentity stock={stock} size={34} />
            <p><strong>{side}</strong> {quantity} share(s) of {stock?.ticker}</p>
            <p className="muted">{orderType === 'LIMIT' ? 'Limit price' : 'Estimated price'}: {formatCurrency(estimatedPrice)} per share</p>
            <p className="muted">{orderType === 'LIMIT' ? 'Maximum total' : 'Estimated total'}: {formatCurrency(total)}</p>
            {orderType === 'LIMIT' && <p className="muted">This order remains open until the market reaches your limit or you cancel it.</p>}
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={isLoginPromptOpen}
        title="Log in to place an order"
        description="Guest mode includes the complete order workflow, but virtual buy and sell orders require an account. No guest cash balance is created."
        confirmLabel="Go to login"
        onCancel={() => setIsLoginPromptOpen(false)}
        onConfirm={() => {
          setIsLoginPromptOpen(false);
          onLoginRequired?.();
        }}
      />
    </>
  );
}
