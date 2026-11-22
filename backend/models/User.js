import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
    phone: { type: String, trim: true },

    // patients optional details 
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dateOfBirth: { type: Date },

    // Admin can deactivate accounts
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// password save hone se pehle hash ho jaata hai
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);