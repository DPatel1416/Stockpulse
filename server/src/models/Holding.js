/**
 * File purpose: Defines the MongoDB document shape and validation rules for Holding records.
 */
import mongoose from 'mongoose';

// Holding stores average cost so P/L can be recalculated with fresh quote prices.
const holdingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true },
    shares: { type: Number, required: true, min: 0 },
    averageCost: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

holdingSchema.index({ userId: 1, ticker: 1 }, { unique: true });

export default mongoose.model('Holding', holdingSchema);
