import { Router } from 'express';
import { getAuthorProfile, getAuthorsList, toggleFollow, deleteUser } from '../controllers/authorController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', getAuthorsList);
router.get('/:id', getAuthorProfile);
router.post('/:id/follow', requireAuth, toggleFollow);
router.delete('/:id', requireAuth, deleteUser);

export default router;
