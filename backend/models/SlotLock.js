import mongoose from 'mongoose';

const slotLockSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // IST date, YYYY-MM-DD
    startAt: { type: Date, required: true }, // UTC instant (slots API ka startAt)
    endAt: { type: Date, required: true },
    mode: { type: String, enum: ['online', 'offline'], required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'released', 'booked'],
      default: 'active',
    },
    expiresAt: { type: Date, required: true }, // lock banne ke 5 min baad
  },
  { timestamps: true }
);

// Double-booking ka asli guard: ek doctor + ek startAt par sirf EK active lock.
// Do patients ek saath lock maangein to DB ek ko E11000 de dega (4C mein 409 banega).
slotLockSchema.index(
  { doctor: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

// expired locks saaf karne ke liye
slotLockSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('SlotLock', slotLockSchema);