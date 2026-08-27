import { Request, Response } from 'express';
import { db } from '../db.js';
import { isUuid } from '../utils/helpers.js';

export async function getAuthorsList(req: Request, res: Response): Promise<void> {
  try {
    const { search, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ];
    }

    const total = await db.user.count({ where: whereClause });
    const authors = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        role: true,
        _count: {
          select: {
            literatures: true,
            followers: true,
          },
        },
      },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    });

    const formattedAuthors = authors.map((a) => ({
      id: a.id,
      name: a.name,
      username: a.username,
      bio: a.bio,
      avatarUrl: a.avatarUrl,
      role: a.role,
      worksCount: a._count.literatures,
      followersCount: a._count.followers,
    }));

    res.status(200).json({
      authors: formattedAuthors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching authors list:', error);
    res.status(500).json({ error: 'Internal server error while fetching authors list' });
  }
}

export async function getAuthorProfile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Author ID or username is required' });
      return;
    }

    const idStr = Array.isArray(id) ? id[0] : id;

    const searchCondition: any[] = [{ username: idStr }];
    if (isUuid(idStr)) {
      searchCondition.push({ id: idStr });
    }

    const author = await db.user.findFirst({
      where: { OR: searchCondition },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true
      }
    });

    if (!author) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    const worksCount = await db.literature.count({
      where: { authorId: author.id }
    });

    const followersCount = await db.follow.count({
      where: { followingId: author.id }
    });

    const followingCount = await db.follow.count({
      where: { followerId: author.id }
    });

    let is_following = false;
    if (req.user && req.user.id !== author.id) {
      const followRecord = await db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: author.id
          }
        }
      });
      is_following = !!followRecord;
    }

    res.status(200).json({
      author: {
        ...author,
        worksCount,
        followersCount,
        followingCount,
        is_following
      }
    });
  } catch (error) {
    console.error('Error fetching author profile:', error);
    res.status(500).json({ error: 'Internal server error while fetching author profile' });
  }
}

export async function toggleFollow(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Author ID or username is required' });
      return;
    }

    const idStr = Array.isArray(id) ? id[0] : id;

    const searchCondition: any[] = [{ username: idStr }];
    if (isUuid(idStr)) {
      searchCondition.push({ id: idStr });
    }

    const targetUser = await db.user.findFirst({
      where: { OR: searchCondition }
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Target author not found' });
      return;
    }

    if (req.user.id === targetUser.id) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    const existingFollow = await db.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user.id,
          followingId: targetUser.id
        }
      }
    });

    let is_following = false;

    if (existingFollow) {
      await db.follow.delete({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: targetUser.id
          }
        }
      });
      is_following = false;
    } else {
      await db.follow.create({
        data: {
          followerId: req.user.id,
          followingId: targetUser.id
        }
      });
      is_following = true;
    }

    const followers_count = await db.follow.count({
      where: { followingId: targetUser.id }
    });

    res.status(200).json({
      is_following,
      followers_count
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Internal server error while toggling follow' });
  }
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Get list of users followed by current user
    const follows = await db.follow.findMany({
      where: { followerId: req.user.id },
      select: { followingId: true }
    });

    const followedIds = follows.map((f) => f.followingId);

    if (followedIds.length === 0) {
      res.status(200).json({
        items: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0
        }
      });
      return;
    }

    const total = await db.literature.count({
      where: { authorId: { in: followedIds } }
    });

    const rawItems = await db.literature.findMany({
      where: { authorId: { in: followedIds } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        },
        likes: {
          where: { userId: req.user.id }
        }
      }
    });

    const items = rawItems.map((item) => ({
      id: item.id,
      authorId: item.authorId,
      author: item.author,
      title: item.title,
      slug: item.slug,
      content: item.content,
      category: item.category,
      language: item.language,
      readingTimeMin: item.readingTimeMin,
      viewsCount: item.viewsCount,
      createdAt: item.createdAt,
      likesCount: item._count.likes,
      commentsCount: item._count.comments,
      is_liked: Array.isArray(item.likes) && item.likes.length > 0
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Internal server error while fetching feed' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!idStr) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const targetUser = await db.user.findUnique({
      where: { id: idStr },
      select: { id: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === targetUser.id;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete this user' });
      return;
    }

    await db.user.delete({ where: { id: idStr } });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error while deleting user' });
  }
}
