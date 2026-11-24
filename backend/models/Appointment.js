import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: String, required: true }, // IST date
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    mode: { type: String, enum: ['online', 'offline'], required: true },
    fees: { type: Number, required: true, min: 0 }, // booking ke waqt doctor profile se copy
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed', 'rescheduled', 'no_show'],
      default: 'confirmed',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'not_required'],
      default: 'pending',
    },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// Ek doctor ke ek slot par sirf ek confirmed appointment.
// Cancel ya reschedule hote hi status badalta hai, to slot dobara free ho jata hai.
appointmentSchema.index(
  { doctor: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

appointmentSchema.index({ patient: 1, startAt: -1 });
appointmentSchema.index({ doctor: 1, date: 1 });

export default mongoose.model('Appointment', appointmentSchema);