import { Router } from 'express';
import { register, login, logout, me, updateRole } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.put('/role', requireAuth, updateRole);

export default router;
