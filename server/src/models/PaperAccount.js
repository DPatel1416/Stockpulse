/**
 * File purpose: Defines the MongoDB document shape and validation rules for Paper Account records.
 */
import mongoose from 'mongoose';

// Paper accounts track simulated deposits by Canadian account label without connecting to a real bank.
const paperAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['CASH', 'TFSA', 'RRSP', 'FHSA'], required: true },
    institution: { type: String, required: true, trim: true, maxlength: 80 },
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

paperAccountSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.model('PaperAccount', paperAccountSchema);
