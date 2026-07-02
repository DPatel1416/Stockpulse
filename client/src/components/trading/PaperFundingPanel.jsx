/**
 * File purpose: Defines the reusable Paper Funding Panel React component and its focused user interaction.
 */
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Info, Landmark, PlusCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import GlassCard from '../ui/GlassCard';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useToasts } from '../ui/Toast';

const accountTypes = [
  { value: 'TFSA', label: 'TFSA' },
  { value: 'RRSP', label: 'RRSP' },
  { value: 'FHSA', label: 'FHSA' },
];

// These controls preview future funding flows without changing balances or contacting a bank.
/**
 * Renders the paper funding panel React component.
 * Keeping this interface in a focused component makes its behavior easier to reuse and understand.
 * @param {*} props - Properties used to configure the component and its displayed content.
 * @returns {JSX.Element} The rendered component interface.
 */
export default function PaperFundingPanel({ portfolio, isGuest = false }) {
  const { showToast } = useToasts();
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [transferAmount, setTransferAmount] = useState(2500);
  const [accountType, setAccountType] = useState('TFSA');
  const [institution, setInstitution] = useState('Demo Bank');
  const [transferDirection, setTransferDirection] = useState('DEPOSIT');
  const [isReviewingTopUp, setIsReviewingTopUp] = useState(false);
  const [isReviewingTransfer, setIsReviewingTransfer] = useState(false);
  const balanceLabel = isGuest ? 'Login required' : formatCurrency(portfolio?.virtualCash || 0);

  /**
   * Handles the top up interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle top up state changes are applied.
   */
  function handleTopUp(event) {
    event.preventDefault();
    setIsReviewingTopUp(true);
  }

  /**
   * Handles the transfer interaction and coordinates its related state changes.
   * A dedicated handler keeps event side effects separate from presentation code.
   * @param {*} event - Browser event that triggered the interaction.
   * @returns {void|*} No value is required; the handle transfer state changes are applied.
   */
  function handleTransfer(event) {
    event.preventDefault();
    setIsReviewingTransfer(true);
  }

  /**
   * Closes the virtual-cash preview and clears its temporary amount.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {void|*} No value is required; the close top up demo state changes are applied.
   */
  function closeTopUpDemo() {
    setIsReviewingTopUp(false);
    showToast('Demo only. Your available virtual cash was not changed.');
  }

  /**
   * Closes the bank-transfer preview and clears its temporary form values.
   * Keeping this step in a named helper makes the surrounding workflow easier to read and test.
   * @returns {void|*} No value is required; the close transfer demo state changes are applied.
   */
  function closeTransferDemo() {
    setIsReviewingTransfer(false);
    showToast(`Future feature preview only. No ${transferDirection.toLowerCase()} was made and your balance was not changed.`);
  }

  return (
    <>
      <div className="paper-funding-grid">
        <GlassCard className="paper-funding-card">
          <div className="section-title">
            <div>
              <h2>Virtual Cash Top-Up</h2>
              <p className="muted paper-card-copy">Preview a future practice-funds flow.</p>
            </div>
            <PlusCircle className="positive" aria-hidden="true" />
          </div>
          <form className="paper-funding-form" onSubmit={handleTopUp}>
            <Input
              label="Preview amount"
              name="paper-top-up"
              type="number"
              min="100"
              max="1000000"
              step="100"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
            />
            <p className="paper-balance-line">
              <span>Available virtual cash</span>
              <strong>{balanceLabel}</strong>
            </p>
            <Button className="full-width-button" type="submit">Preview top-up</Button>
            <small className="muted paper-funding-notice"><Info size={15} />Demo only. This will not add money to your account.</small>
          </form>
        </GlassCard>

        <GlassCard className="paper-funding-card">
          <div className="section-title">
            <div>
              <h2>Bank Transfer Preview</h2>
              <p className="muted paper-card-copy">Explore a possible future account flow.</p>
            </div>
            <Landmark className="positive" aria-hidden="true" />
          </div>
          <form className="paper-funding-form" onSubmit={handleTransfer}>
            <div className="transfer-mode" aria-label="Transfer direction">
              <button
                className={transferDirection === 'DEPOSIT' ? 'active' : ''}
                type="button"
                aria-pressed={transferDirection === 'DEPOSIT'}
                onClick={() => setTransferDirection('DEPOSIT')}
              >
                <ArrowDownToLine size={16} />
                Deposit
              </button>
              <button
                className={transferDirection === 'WITHDRAWAL' ? 'active' : ''}
                type="button"
                aria-pressed={transferDirection === 'WITHDRAWAL'}
                onClick={() => setTransferDirection('WITHDRAWAL')}
              >
                <ArrowUpFromLine size={16} />
                Withdraw
              </button>
            </div>
            <Select
              id="paper-account-type"
              label="Account type"
              value={accountType}
              options={accountTypes}
              onValueChange={setAccountType}
            />
            <Input
              label="Bank nickname"
              name="paper-bank-name"
              maxLength="80"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
            />
            <Input
              label="Preview amount"
              name="paper-transfer-amount"
              type="number"
              min="100"
              max="1000000"
              step="100"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
            />
            <Button className="full-width-button" type="submit">
              Preview {transferDirection === 'DEPOSIT' ? 'deposit' : 'withdrawal'}
            </Button>
            <small className="muted paper-funding-notice"><Info size={15} />Future feature only. No bank connection or balance change occurs.</small>
          </form>
        </GlassCard>
      </div>

      <ConfirmModal
        open={isReviewingTopUp}
        title="Virtual cash top-up demo"
        description="This is a front-end demonstration only. No real or virtual money will be added to your current account, and no payment details are collected."
        confirmLabel="Understood"
        onCancel={() => setIsReviewingTopUp(false)}
        onConfirm={closeTopUpDemo}
      >
        <div className="glass-card compact" style={{ boxShadow: 'none' }}>
          <div className="card-body funding-review-summary">
            <span className="muted">Preview amount</span>
            <strong>{formatCurrency(topUpAmount)}</strong>
            <span className="muted">Balance remains</span>
            <strong>{balanceLabel}</strong>
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={isReviewingTransfer}
        title={`Bank ${transferDirection.toLowerCase()} feature preview`}
        description={`This screen only previews a possible future ${transferDirection.toLowerCase()} feature. No bank is contacted and no money is ${transferDirection === 'DEPOSIT' ? 'added to' : 'removed from'} your balance.`}
        confirmLabel="Understood"
        onCancel={() => setIsReviewingTransfer(false)}
        onConfirm={closeTransferDemo}
      >
        <div className="glass-card compact" style={{ boxShadow: 'none' }}>
          <div className="card-body funding-review-summary">
            <span className="muted">Transfer type</span>
            <strong>{transferDirection === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</strong>
            <span className="muted">Account preview</span>
            <strong>{accountType}</strong>
            <span className="muted">Bank nickname</span>
            <strong>{institution || 'Demo Bank'}</strong>
            <span className="muted">Preview amount</span>
            <strong>{formatCurrency(transferAmount)}</strong>
            <span className="muted">Balance remains</span>
            <strong>{balanceLabel}</strong>
          </div>
        </div>
      </ConfirmModal>
    </>
  );
}
