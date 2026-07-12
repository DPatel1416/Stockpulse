/**
 * File purpose: Defines the MongoDB document shape and validation rules for User records.
 */
import mongoose from 'mongoose';

// User owns authentication data, email verification state, and the virtual cash balance for paper trading.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    virtualCash: { type: Number, default: 10000 },
    isVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, default: undefined, index: true },
    verificationTokenExpires: { type: Date, default: undefined },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);