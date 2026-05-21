import { Router } from 'express';
import { register, login, logout, me, deleteAccount } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', logout);
router.get('/api/me', requireAuth, me);
router.delete('/api/users/me', requireAuth, deleteAccount);

export default router;
