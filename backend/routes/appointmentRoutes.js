import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { lockSlot, bookAppointment, getMyAppointments } from '../controllers/appointmentController.js';
const router = Router();

router.post('/lock', protect, authorize('patient'), lockSlot);
router.post('/book', protect, authorize('patient'), bookAppointment);
router.get('/my', protect, authorize('patient'), getMyAppointments);

export default router;