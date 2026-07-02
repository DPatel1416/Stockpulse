/**
 * File purpose: Defines the MongoDB document shape and validation rules for User records.
 */
import mongoose from 'mongoose';

// User owns authentication data and the virtual cash balance for paper trading.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    virtualCash: { type: Number, default: 10000 },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
