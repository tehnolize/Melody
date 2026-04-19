import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMyProfile, getPublicProfile } from '../controllers/profileController.js';

const router = Router();

router.get('/api/profile/me', requireAuth, getMyProfile);
router.get('/api/users/:userId/profile', getPublicProfile);

export default router;
