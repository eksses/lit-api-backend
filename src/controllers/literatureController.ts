import { Request, Response } from 'express';
import { db } from '../db.js';
import { isUuid, generateSlug } from '../utils/helpers.js';

export async function getLiteratureList(req: Request, res: Response): Promise<void> {
  try {
    const { category, language, author_id, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (category && typeof category === 'string') {
      whereClause.category = category.trim();
    }

    if (language && typeof language === 'string') {
      whereClause.language = language.trim();
    }

    if (author_id && typeof author_id === 'string' && isUuid(author_id.trim())) {
      whereClause.authorId = author_id.trim();
    }

    const total = await db.literature.count({ where: whereClause });

    let likesIncludeCondition: any = false;
    if (req.user) {
      likesIncludeCondition = { where: { userId: req.user.id } };
    } else if (req.deviceHash) {
      likesIncludeCondition = { where: { userId: null, deviceHash: req.deviceHash } };
    }

    const rawItems = await db.literature.findMany({
      where: whereClause,
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
        likes: likesIncludeCondition
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
    console.error('Error fetching literature list:', error);
    res.status(500).json({ error: 'Internal server error while fetching literature' });
  }
}

export async function getLiteratureBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug parameter is required' });
      return;
    }

    const slugStr = Array.isArray(slug) ? slug[0] : slug;

    const searchCondition: any[] = [{ slug: slugStr }];
    if (isUuid(slugStr)) {
      searchCondition.push({ id: slugStr });
    }

    const item = await db.literature.findFirst({
      where: { OR: searchCondition }
    });

    if (!item) {
      res.status(404).json({ error: 'Literature not found' });
      return;
    }

    // Increment views_count
    const updatedItem = await db.literature.update({
      where: { id: item.id },
      data: { viewsCount: { increment: 1 } },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      }
    });

    // Check if current requester liked it
    let isLiked = false;
    if (req.user) {
      const userLike = await db.like.findFirst({
        where: { literatureId: item.id, userId: req.user.id }
      });
      isLiked = !!userLike;
    } else if (req.deviceHash) {
      const guestLike = await db.like.findFirst({
        where: { literatureId: item.id, userId: null, deviceHash: req.deviceHash }
      });
      isLiked = !!guestLike;
    }

    // Fetch comments
    const rawComments = await db.comment.findMany({
      where: { literatureId: item.id },
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

    res.status(200).json({
      literature: {
        id: updatedItem.id,
        authorId: updatedItem.authorId,
        author: updatedItem.author,
        title: updatedItem.title,
        slug: updatedItem.slug,
        content: updatedItem.content,
        category: updatedItem.category,
        language: updatedItem.language,
        readingTimeMin: updatedItem.readingTimeMin,
        viewsCount: updatedItem.viewsCount,
        createdAt: updatedItem.createdAt,
        likesCount: updatedItem._count.likes,
        commentsCount: updatedItem._count.comments,
        is_liked: isLiked,
        comments
      }
    });
  } catch (error) {
    console.error('Error fetching literature details:', error);
    res.status(500).json({ error: 'Internal server error while fetching literature detail' });
  }
}

export async function createLiterature(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { title, content, category, language, readingTimeMin } = req.body;

    if (!title || !content || !category || !language) {
      res.status(400).json({ error: 'Title, content, category, and language are required' });
      return;
    }

    const validCategories = ['poem', 'story', 'micro_poem'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      return;
    }

    const validLanguages = ['bn', 'en'];
    if (!validLanguages.includes(language)) {
      res.status(400).json({ error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` });
      return;
    }

    let slug = generateSlug(title);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.literature.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug(title);
      attempts++;
    }

    const computedReadingTime = readingTimeMin && typeof readingTimeMin === 'number'
      ? readingTimeMin
      : Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));

    const newLiterature = await db.literature.create({
      data: {
        authorId: req.user.id,
        title: title.trim(),
        slug,
        content: content.trim(),
        category,
        language,
        readingTimeMin: computedReadingTime
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Literature created successfully',
      literature: {
        ...newLiterature,
        likesCount: 0,
        commentsCount: 0,
        is_liked: false
      }
    });
  } catch (error) {
    console.error('Error creating literature:', error);
    res.status(500).json({ error: 'Internal server error while creating literature' });
  }
}
