import { Router } from 'express';
import { getAuthorProfile, getAuthorsList, toggleFollow } from '../controllers/authorController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', getAuthorsList);
router.get('/:id', getAuthorProfile);
router.post('/:id/follow', requireAuth, toggleFollow);

export default router;
