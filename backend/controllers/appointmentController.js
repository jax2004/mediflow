import Doctor from '../models/Doctor.js';
import SlotLock from '../models/SlotLock.js';
import Appointment from '../models/Appointment.js';
import {
  generateSlots, isValidDateString, todayIST, addDaysToDateString, MAX_ADVANCE_DAYS,
} from '../utils/slotUtils.js';

const LOCK_MINUTES = 5;
const MODES = ['online', 'offline'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const formatLock = (lock, slot) => ({
  id: lock._id,
  doctorId: lock.doctor,
  date: lock.date,
  startTime: slot.startTime,
  endTime: slot.endTime,
  startAt: lock.startAt,
  endAt: lock.endAt,
  mode: lock.mode,
  status: lock.status,
  expiresAt: lock.expiresAt,
});

// POST /api/appointments/lock  (patient only)
export const lockSlot = async (req, res) => {
  try {
    const { doctorId, date, startTime, mode } = req.body ?? {};

    // typeof string check: {"$ne": null} jaise object se NoSQL injection nahi chalega
    if (typeof doctorId !== 'string' || !OBJECT_ID_RE.test(doctorId)) {
      return res.status(400).json({ message: 'Valid doctorId required' });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({ message: 'date required in YYYY-MM-DD format' });
    }
    if (typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
      return res.status(400).json({ message: 'startTime required in HH:MM format' });
    }
    if (!MODES.includes(mode)) {
      return res.status(400).json({ message: 'mode must be online or offline' });
    }

    const today = todayIST();
    if (date < today) {
      return res.status(400).json({ message: 'Past date not allowed' });
    }
    if (date > addDaysToDateString(today, MAX_ADVANCE_DAYS)) {
      return res
        .status(400)
        .json({ message: `Date can be at most ${MAX_ADVANCE_DAYS} days ahead` });
    }

    const doctor = await Doctor.findOne({ _id: doctorId, verificationStatus: 'approved' }).select(
      'availability slotDurationMins consultationModes'
    );
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    if (!doctor.consultationModes.includes(mode)) {
      return res.status(400).json({ message: `Doctor does not offer ${mode} consultation` });
    }

    // slot sach mein doctor ki availability se bana hona chahiye (guzra hua bhi hat jata hai)
    const slot = generateSlots(doctor, date).find((s) => s.startTime === startTime);
    if (!slot) {
      return res.status(400).json({ message: 'Slot not available' });
    }
    const startAt = new Date(slot.startAt);
    const endAt = new Date(startAt.getTime() + doctor.slotDurationMins * 60000);

    // pehle se confirmed appointment?
    const booked = await Appointment.exists({ doctor: doctor._id, startAt, status: 'confirmed' });
    if (booked) {
      return res.status(409).json({ message: 'Slot already booked' });
    }

    // purane expire ho chuke locks ko "expired" karo. Unique index status:'active' par hai,
    // isliye expire hua par active likha lock naye lock ko rok dega.
    const now = new Date();
    await SlotLock.updateMany(
      { doctor: doctor._id, startAt, status: 'active', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    let lock;
    try {
      lock = await SlotLock.create({
        doctor: doctor._id,
        patient: req.user._id,
        date,
        startAt,
        endAt,
        mode,
        expiresAt: new Date(now.getTime() + LOCK_MINUTES * 60000),
      });
    } catch (err) {
      if (err.code === 11000) {
        const existing = await SlotLock.findOne({ doctor: doctor._id, startAt, status: 'active' });
        if (existing && existing.patient.equals(req.user._id)) {
          return res
            .status(200)
            .json({ message: 'You already hold this slot', lock: formatLock(existing, slot) });
        }
        return res
          .status(409)
          .json({ message: 'Slot is being booked by another patient. Try again later.' });
      }
      throw err;
    }

    // ek patient ek time par ek hi slot hold kare (lock hoarding rokne ke liye)
    await SlotLock.updateMany(
      { patient: req.user._id, status: 'active', _id: { $ne: lock._id } },
      { $set: { status: 'released' } }
    );

    res.status(201).json({
      message: `Slot locked for ${LOCK_MINUTES} minutes`,
      lock: formatLock(lock, slot),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};