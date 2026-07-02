/**
 * File purpose: Defines the MongoDB document shape and validation rules for Order records.
 */
import mongoose from 'mongoose';

// Limit orders remain open until a current quote reaches the user's requested price.
const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    logo: { type: String, trim: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    orderType: { type: String, enum: ['LIMIT'], default: 'LIMIT', required: true },
    quantity: { type: Number, required: true, min: 1 },
    limitPrice: { type: Number, required: true, min: 0.01 },
    submittedPrice: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'FILLED', 'CANCELLED', 'REJECTED'], default: 'PENDING', index: true },
    filledPrice: { type: Number, min: 0 },
    total: { type: Number, min: 0 },
    priceProvider: { type: String, trim: true },
    rejectionReason: { type: String, trim: true, maxlength: 180 },
    filledAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, status: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
