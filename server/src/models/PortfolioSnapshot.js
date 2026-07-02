/**
 * File purpose: Defines the MongoDB document shape and validation rules for Portfolio Snapshot records.
 */
import mongoose from 'mongoose';

// Optional snapshots support future performance history charts.
const portfolioSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    totalValue: { type: Number, required: true },
    cash: { type: Number, required: true },
    investedValue: { type: Number, required: true },
  },
  { timestamps: true },
);

export default mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);
