/**
 * File purpose: Defines the MongoDB document shape and validation rules for Watchlist Item records.
 */
import mongoose from 'mongoose';

// One document per saved ticker keeps watchlist updates simple and indexable.
const watchlistItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true },
  },
  { timestamps: true },
);

watchlistItemSchema.index({ userId: 1, ticker: 1 }, { unique: true });

export default mongoose.model('WatchlistItem', watchlistItemSchema);
