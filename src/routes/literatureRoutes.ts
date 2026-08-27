import { Router } from 'express';
import {
  getLiteratureList,
  getLiteratureBySlug,
  createLiterature
} from '../controllers/literatureController.js';
import { toggleLike } from '../controllers/likeController.js';
import { getComments, createComment } from '../controllers/commentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', getLiteratureList);
router.post('/', requireAuth, createLiterature);

router.post('/:id/like', toggleLike);
router.get('/:id/comments', getComments);
router.post('/:id/comment', createComment);

router.get('/:slug', getLiteratureBySlug);

export default router;
