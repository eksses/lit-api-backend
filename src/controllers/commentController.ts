import { Request, Response } from 'express';
import { db } from '../db.js';
import { isUuid } from '../utils/helpers.js';

export async function getComments(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Literature ID is required' });
      return;
    }

    const idStr = Array.isArray(id) ? id[0] : id;

    const searchCondition: any[] = [{ slug: idStr }];
    if (isUuid(idStr)) {
      searchCondition.push({ id: idStr });
    }

    const literature = await db.literature.findFirst({
      where: { OR: searchCondition }
    });

    if (!literature) {
      res.status(404).json({ error: 'Literature not found' });
      return;
    }

    const rawComments = await db.comment.findMany({
      where: { literatureId: literature.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    const comments = rawComments.map((c) => ({
      id: c.id,
      literatureId: c.literatureId,
      content: c.content,
      guestName: c.guestName,
      user: c.user || null,
      createdAt: c.createdAt
    }));

    res.status(200).json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error while fetching comments' });
  }
}

export async function createComment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { content, guest_name, guestName } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Literature ID is required' });
      return;
    }

    const idStr = Array.isArray(id) ? id[0] : id;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    const searchCondition: any[] = [{ slug: idStr }];
    if (isUuid(idStr)) {
      searchCondition.push({ id: idStr });
    }

    const literature = await db.literature.findFirst({
      where: { OR: searchCondition }
    });

    if (!literature) {
      res.status(404).json({ error: 'Literature not found' });
      return;
    }

    const deviceHash = req.deviceHash || 'anon_device';
    let newComment;

    if (req.user) {
      newComment = await db.comment.create({
        data: {
          literatureId: literature.id,
          userId: req.user.id,
          content: content.trim(),
          deviceHash
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true
            }
          }
        }
      });
    } else {
      const providedName = guest_name || guestName;
      const finalGuestName = (providedName && typeof providedName === 'string' && providedName.trim())
        ? providedName.trim()
        : 'Guest';

      newComment = await db.comment.create({
        data: {
          literatureId: literature.id,
          guestName: finalGuestName,
          content: content.trim(),
          deviceHash
        }
      });
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: {
        id: newComment.id,
        literatureId: newComment.literatureId,
        content: newComment.content,
        guestName: newComment.guestName,
        user: (newComment as any).user || null,
        createdAt: newComment.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Internal server error while creating comment' });
  }
}
