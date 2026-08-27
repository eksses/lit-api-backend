import { Router } from 'express';
import { getAuthorProfile, toggleFollow } from '../controllers/authorController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:id', getAuthorProfile);
router.post('/:id/follow', requireAuth, toggleFollow);

export default router;
