import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      required: true,
    },
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true },   // "13:00"
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    specialization: { type: String, required: true, trim: true },
    qualification: { type: String, trim: true },
    experienceYears: { type: Number, min: 0, default: 0 },
    about: { type: String, trim: true },

    fees: { type: Number, required: true, min: 0 },
    consultationModes: { type: [String], enum: ['online', 'offline'], default: ['offline'] },

    clinic: {
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
    },

    // weekly schedule, isse slots generate honge (Step 4)
    availability: { type: [availabilitySchema], default: [] },
    slotDurationMins: { type: Number, default: 15, min: 5 },

    // admin verification (blueprint: doctor verification)
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, trim: true },

    // reviews se update hoga (Feature 5)
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Doctor', doctorSchema);