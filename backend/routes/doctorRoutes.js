import { Router } from 'express';
import {
  createMyProfile,
  updateMyProfile,
  getMyProfile,
} from '../controllers/doctorController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// /me routes sirf doctor role ke liye
router.post('/me', protect, authorize('doctor'), createMyProfile);
router.put('/me', protect, authorize('doctor'), updateMyProfile);
router.get('/me', protect, authorize('doctor'), getMyProfile);

// Step 3C mein GET '/' aur GET '/:id' yahin aayenge, '/me' routes ke NEECHE
// (warna "me" ko :id samajh liya jayega)

export default router;