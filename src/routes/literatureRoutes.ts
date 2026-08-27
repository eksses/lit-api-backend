import { Router } from 'express';
import {
  getLiteratureList,
  getLiteratureBySlug,
  createLiterature,
  deleteLiterature,
} from '../controllers/literatureController.js';
import { toggleLike } from '../controllers/likeController.js';
import { getComments, createComment, deleteComment } from '../controllers/commentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', getLiteratureList);
router.post('/', requireAuth, createLiterature);
router.delete('/:id', requireAuth, deleteLiterature);

router.post('/:id/like', toggleLike);
router.get('/:id/comments', getComments);
router.post('/:id/comment', createComment);
router.delete('/comments/:commentId', requireAuth, deleteComment);

router.get('/:slug', getLiteratureBySlug);

export default router;
