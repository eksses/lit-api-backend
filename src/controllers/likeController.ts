import { Request, Response } from 'express';
import { db } from '../db.js';
import { isUuid } from '../utils/helpers.js';

export async function toggleLike(req: Request, res: Response): Promise<void> {
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

    const litId = literature.id;
    let is_liked = false;

    if (req.user) {
      const existingLike = await db.like.findFirst({
        where: { literatureId: litId, userId: req.user.id }
      });

      if (existingLike) {
        await db.like.delete({
          where: { id: existingLike.id }
        });
        is_liked = false;
      } else {
        await db.like.create({
          data: {
            literatureId: litId,
            userId: req.user.id,
            deviceHash: req.deviceHash || null
          }
        });
        is_liked = true;
      }
    } else {
      const deviceHash = req.deviceHash;
      if (!deviceHash) {
        res.status(400).json({ error: 'Device fingerprint header is missing' });
        return;
      }

      const existingLike = await db.like.findFirst({
        where: { literatureId: litId, userId: null, deviceHash }
      });

      if (existingLike) {
        await db.like.delete({
          where: { id: existingLike.id }
        });
        is_liked = false;
      } else {
        await db.like.create({
          data: {
            literatureId: litId,
            userId: null,
            deviceHash
          }
        });
        is_liked = true;
      }
    }

    const likes_count = await db.like.count({
      where: { literatureId: litId }
    });

    res.status(200).json({
      is_liked,
      likes_count
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Internal server error while toggling like' });
  }
}
