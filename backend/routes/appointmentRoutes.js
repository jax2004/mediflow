import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { lockSlot } from '../controllers/appointmentController.js';

const router = Router();

router.post('/lock', protect, authorize('patient'), lockSlot);

export default router;