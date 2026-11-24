import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { lockSlot, bookAppointment } from '../controllers/appointmentController.js';

const router = Router();

router.post('/lock', protect, authorize('patient'), lockSlot);
router.post('/book', protect, authorize('patient'), bookAppointment);

export default router;