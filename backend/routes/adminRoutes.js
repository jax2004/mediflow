import { Router } from 'express';
import { listDoctors, verifyDoctor } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// is file ke saare routes sirf admin ke liye
router.use(protect, authorize('admin'));

router.get('/doctors', listDoctors);
router.patch('/doctors/:id/verify', verifyDoctor);

export default router;