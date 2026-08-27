import { Router } from 'express';
import { getFeed } from '../controllers/authorController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, getFeed);

export default router;
