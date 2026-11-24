import Doctor from '../models/Doctor.js';
import mongoose from 'mongoose'; 
import {
  generateSlots, isValidDateString, todayIST, addDaysToDateString, dayKeyOf, MAX_ADVANCE_DAYS,
} from '../utils/slotUtils.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MODES = ['online', 'offline'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// doctor sirf ye fields khud badal sakta hai.
// verificationStatus, rejectionReason, rating, user kabhi body se nahi lenge.
const EDITABLE = [
  'specialization',
  'qualification',
  'experienceYears',
  'about',
  'fees',
  'consultationModes',
  'slotDurationMins',
  'availability',
];

const toMins = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const validateAvailability = (availability) => {
  if (!Array.isArray(availability)) return 'availability must be an array';

  const byDay = {};
  for (const slot of availability) {
    if (!slot || typeof slot !== 'object') return 'Invalid availability entry';
    const { day, startTime, endTime } = slot;

    if (!DAYS.includes(day)) return `Invalid day: ${day}`;
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return 'Time must be in HH:MM 24-hour format (e.g. 09:00)';
    }
    if (toMins(startTime) >= toMins(endTime)) {
      return `${day}: startTime must be before endTime`;
    }
    (byDay[day] ||= []).push([toMins(startTime), toMins(endTime)]);
  }

  // same din ke time ranges overlap nahi hone chahiye
  for (const [day, ranges] of Object.entries(byDay)) {
    ranges.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i][0] < ranges[i - 1][1]) return `${day}: overlapping time ranges`;
    }
  }
  return null;
};

// body se allowed fields nikalta hai aur validate karta hai
const buildUpdates = (body) => {
  const updates = {};
  for (const key of EDITABLE) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (updates.consultationModes !== undefined) {
    const m = updates.consultationModes;
    if (!Array.isArray(m) || m.length === 0 || !m.every((x) => MODES.includes(x))) {
      return { error: 'consultationModes must be a non-empty array of: online, offline' };
    }
  }

  if (updates.availability !== undefined) {
    const error = validateAvailability(updates.availability);
    if (error) return { error };
  }

  if (body.clinic !== undefined) {
    if (typeof body.clinic !== 'object' || body.clinic === null || Array.isArray(body.clinic)) {
      return { error: 'clinic must be an object' };
    }
  }

  return { updates };
};

const applyClinic = (doctor, clinic) => {
  if (!clinic) return;
  for (const key of ['name', 'address', 'city']) {
    if (clinic[key] !== undefined) doctor.set(`clinic.${key}`, clinic[key]);
  }
};

const handleError = (res, err) => {
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Doctor profile already exists' });
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }
  console.error(err);
  res.status(500).json({ message: 'Server error' });
};

// POST /api/doctors/me
export const createMyProfile = async (req, res) => {
  try {
    const existing = await Doctor.findOne({ user: req.user._id });
    if (existing) {
      return res.status(409).json({ message: 'Doctor profile already exists' });
    }

    const { updates, error } = buildUpdates(req.body ?? {});
    if (error) return res.status(400).json({ message: error });

    const doctor = new Doctor({ user: req.user._id, ...updates });
    applyClinic(doctor, req.body?.clinic);
    await doctor.save(); // verificationStatus default: pending

    res.status(201).json(doctor);
  } catch (err) {
    handleError(res, err);
  }
};

// PUT /api/doctors/me
export const updateMyProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found. Create it first.' });
    }

    const { updates, error } = buildUpdates(req.body ?? {});
    if (error) return res.status(400).json({ message: error });

    doctor.set(updates);
    applyClinic(doctor, req.body?.clinic);

    // rejected doctor profile sudhaar kar dobara review ke liye bhej sakta hai
    if (doctor.verificationStatus === 'rejected') {
      doctor.verificationStatus = 'pending';
      doctor.rejectionReason = undefined;
    }

    await doctor.save();
    res.json(doctor);
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/doctors/me
export const getMyProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).populate(
      'user',
      'name email phone'
    );
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }
    res.json(doctor);
  } catch (err) {
    handleError(res, err);
  }
};

// regex special characters escape (user input se regex injection rokne ke liye)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/doctors?specialization=&city=&mode=&maxFees=&page=&limit=
// sirf approved doctors
export const searchDoctors = async (req, res) => {
  try {
    const { specialization, city, mode, maxFees, page, limit } = req.query;
    const filter = { verificationStatus: 'approved' };

    if (specialization !== undefined) {
      if (typeof specialization !== 'string' || !specialization.trim()) {
        return res.status(400).json({ message: 'Invalid specialization' });
      }
      filter.specialization = new RegExp(escapeRegex(specialization.trim()), 'i');
    }

    if (city !== undefined) {
      if (typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({ message: 'Invalid city' });
      }
      filter['clinic.city'] = new RegExp(`^${escapeRegex(city.trim())}$`, 'i');
    }

    if (mode !== undefined) {
      if (!MODES.includes(mode)) {
        return res.status(400).json({ message: 'mode must be online or offline' });
      }
      filter.consultationModes = mode;
    }

    if (maxFees !== undefined) {
      const fees = Number(maxFees);
      if (typeof maxFees !== 'string' || !maxFees.trim() || !Number.isFinite(fees) || fees < 0) {
        return res.status(400).json({ message: 'maxFees must be a non-negative number' });
      }
      filter.fees = { $lte: fees };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const total = await Doctor.countDocuments(filter);
    const doctors = await Doctor.find(filter)
      .sort({ 'rating.average': -1, experienceYears: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('user', 'name')
      .select('-rejectionReason -__v');

    res.json({ total, page: pageNum, limit: limitNum, doctors });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/doctors/:id (sirf approved)
export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const doctor = await Doctor.findOne({ _id: id, verificationStatus: 'approved' })
      .populate('user', 'name')
      .select('-rejectionReason -__v');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (err) {
    handleError(res, err);
  }
};





// GET /api/doctors/:id/slots?date=YYYY-MM-DD (public, sirf approved doctor)
export const getDoctorSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }
    if (!isValidDateString(date)) {
      return res.status(400).json({ message: 'date required in YYYY-MM-DD format' });
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

    const doctor = await Doctor.findOne({ _id: id, verificationStatus: 'approved' }).select(
      'availability slotDurationMins'
    );
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const slots = generateSlots(doctor, date);
    res.json({
      doctorId: id,
      date,
      day: dayKeyOf(date),
      timezone: 'Asia/Kolkata',
      slotDurationMins: doctor.slotDurationMins,
      total: slots.length,
      slots,
    });
  } catch (err) {
    handleError(res, err);
  }
};