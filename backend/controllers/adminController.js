import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';

const STATUSES = ['pending', 'approved', 'rejected'];

// GET /api/admin/doctors?status=pending
export const listDoctors = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ message: 'status must be one of: pending, approved, rejected' });
      }
      filter.verificationStatus = status;
    }

    const doctors = await Doctor.find(filter)
      .populate('user', 'name email phone')
      .sort({ createdAt: 1 });

    res.json({ count: doctors.length, doctors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/admin/doctors/:id/verify
// body: { "status": "approved" } ya { "status": "rejected", "rejectionReason": "..." }
export const verifyDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const { status, rejectionReason } = req.body ?? {};

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    if (status === 'rejected' && !reason) {
      return res.status(400).json({ message: 'rejectionReason is required when rejecting' });
    }

    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    doctor.verificationStatus = status;
    doctor.rejectionReason = status === 'rejected' ? reason : undefined;
    await doctor.save();

    await doctor.populate('user', 'name email');
    res.json(doctor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};