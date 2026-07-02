/**
 * File purpose: Defines the MongoDB document shape and validation rules for Transaction records.
 */
import mongoose from 'mongoose';

// A single ledger records simulated trades and funding activity in chronological order.
const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['TRADE', 'FUNDING'], default: 'TRADE', required: true },
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    ticker: { type: String, uppercase: true, trim: true },
    side: { type: String, enum: ['BUY', 'SELL'] },
    orderType: { type: String, enum: ['MARKET', 'LIMIT'], default: 'MARKET' },
    limitPrice: { type: Number, min: 0 },
    quantity: { type: Number, min: 0 },
    price: { type: Number, min: 0 },
    priceProvider: { type: String, trim: true },
    accountType: { type: String, enum: ['CASH', 'TFSA', 'RRSP', 'FHSA'] },
    institution: { type: String, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 120 },
    total: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Transaction', transactionSchema);
