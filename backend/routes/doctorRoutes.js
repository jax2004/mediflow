import { Router } from 'express';
import {
  createMyProfile,
  updateMyProfile,
  getMyProfile,
  searchDoctors,
  getDoctorById,
  getDoctorSlots,
} from '../controllers/doctorController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// /me routes sirf doctor role ke liye
router.post('/me', protect, authorize('doctor'), createMyProfile);
router.put('/me', protect, authorize('doctor'), updateMyProfile);
router.get('/me', protect, authorize('doctor'), getMyProfile);

// public routes: '/me' ke NEECHE hi rehne chahiye
// (warna "me" ko :id samajh liya jayega)
router.get('/', searchDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorSlots);

export default router;