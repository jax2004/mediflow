import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// sirf role test karne ke liye, Step 2 ke baad delete kar denge
router.get('/test/admin', protect, authorize('admin'), (req, res) =>
  res.json({ message: 'Hello admin' })
);
router.get('/test/doctor', protect, authorize('doctor'), (req, res) =>
  res.json({ message: 'Hello doctor' })
);

export default router;