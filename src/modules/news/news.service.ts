import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { isImage } from '../../config/upload.js';
import { uploadToImgBB } from '../../lib/storage.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type { createNewsSchema, listNewsQuerySchema, updateNewsSchema } from './news.validation.js';

type CreateInput = z.infer<typeof createNewsSchema>;
type UpdateInput = z.infer<typeof updateNewsSchema>;
type ListQuery = z.infer<typeof listNewsQuerySchema>;

// ============================================================
// Helpers
// ============================================================

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const ensureUniqueSlug = async (slug: string, excludeId?: string) => {
  let finalSlug = slug;
  let counter = 1;

  while (true) {
    const existing = await prisma.news.findUnique({
      where: { slug: finalSlug },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return finalSlug;
    }
    finalSlug = `${slug}-${counter}`;
    counter++;
  }
};

// ============================================================
// CREATE NEWS (Admin — Section 27, 51)
// ============================================================

export const createNews = async (adminId: string, input: CreateInput) => {
  const baseSlug = input.slug ?? slugify(input.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const news = await prisma.news.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      coverImage: input.coverImage,
      category: input.category,
      divisionId: input.divisionId,
      districtId: input.districtId,
      status: 'DRAFT',
      publishedById: adminId,
    },
    include: {
      publishedBy: {
        select: {
          id: true,
          profile: { select: { name: true } },
        },
      },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'NEWS',
      targetId: news.id,
      metadata: { action: 'created', title: input.title },
    },
  });

  return news;
};

// ============================================================
// UPDATE NEWS (Admin — Section 51)
// ============================================================

export const updateNews = async (adminId: string, newsId: string, input: UpdateInput) => {
  const existing = await prisma.news.findUnique({ where: { id: newsId } });
  if (!existing) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.news.update({
    where: { id: newsId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.coverImage !== undefined && { coverImage: input.coverImage }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.divisionId !== undefined && { divisionId: input.divisionId }),
      ...(input.districtId !== undefined && { districtId: input.districtId }),
    },
    include: {
      publishedBy: {
        select: { id: true, profile: { select: { name: true } } },
      },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
    },
  });

  return updated;
};

// ============================================================
// PUBLISH NEWS (Admin — Section 27, 51)
// ============================================================

export const publishNews = async (adminId: string, newsId: string) => {
  const existing = await prisma.news.findUnique({ where: { id: newsId } });
  if (!existing) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }
  if (existing.status === 'PUBLISHED') {
    throw new AppError('Already published', 400, 'ALREADY_PUBLISHED');
  }

  const updated = await prisma.news.update({
    where: { id: newsId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'NEWS_PUBLISHED',
      targetType: 'NEWS',
      targetId: newsId,
      metadata: { title: existing.title },
    },
  });

  return updated;
};

// ============================================================
// ARCHIVE NEWS (Admin — Section 51)
// ============================================================

export const archiveNews = async (adminId: string, newsId: string) => {
  const existing = await prisma.news.findUnique({ where: { id: newsId } });
  if (!existing) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.news.update({
    where: { id: newsId },
    data: { status: 'ARCHIVED' },
  });

  return updated;
};

// ============================================================
// DELETE NEWS (Admin — Section 51)
// ============================================================

export const deleteNews = async (adminId: string, newsId: string) => {
  const existing = await prisma.news.findUnique({ where: { id: newsId } });
  if (!existing) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }

  await prisma.news.delete({ where: { id: newsId } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'NEWS',
      targetId: newsId,
      metadata: { action: 'deleted', title: existing.title },
    },
  });

  return { message: 'News deleted' };
};

// ============================================================
// LIST NEWS (Public — only published, unless admin)
// ============================================================

export const listNews = async (
  query: ListQuery,
  options: { isAdmin: boolean } = { isAdmin: false }
) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {};

  if (!options.isAdmin) {
    where.status = 'PUBLISHED';
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.category) where.category = query.category;
  if (query.divisionId) where.divisionId = query.divisionId;
  if (query.districtId) where.districtId = query.districtId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { content: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [news, total] = await Promise.all([
    prisma.news.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        category: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        viewCount: true,
        likeCount: true,
        publishedBy: {
          select: {
            id: true,
            profile: { select: { name: true } },
          },
        },
        division: { select: { name: true, nameBn: true } },
        district: { select: { name: true, nameBn: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.news.count({ where }),
  ]);

  return {
    news,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET ONE NEWS BY SLUG (Public)
// ============================================================

export const getNewsBySlug = async (slug: string) => {
  const news = await prisma.news.findUnique({
    where: { slug },
    include: {
      publishedBy: {
        select: {
          id: true,
          profile: { select: { name: true } },
        },
      },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      _count: { select: { comments: true } },
    },
  });

  if (!news) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }
  if (news.status !== 'PUBLISHED') {
    throw new AppError('News not published', 404, 'NOT_PUBLISHED');
  }

  // Increment view count
  await prisma.news.update({
    where: { id: news.id },
    data: { viewCount: { increment: 1 } },
  });

  return news;
};

// ============================================================
// GET ONE NEWS BY ID (Admin)
// ============================================================

export const getNewsById = async (newsId: string) => {
  const news = await prisma.news.findUnique({
    where: { id: newsId },
    include: {
      publishedBy: {
        select: { id: true, profile: { select: { name: true } } },
      },
      division: true,
      district: true,
      _count: { select: { comments: true } },
    },
  });

  if (!news) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }

  return news;
};

// ============================================================
// UPLOAD COVER IMAGE (Admin — file → ImgBB → URL)
// ============================================================

export const uploadCoverImage = async (adminId: string, file: Express.Multer.File) => {
  // 1. Validate image
  if (!isImage(file.mimetype)) {
    throw new AppError('Only images allowed (jpg, jpeg, png, webp)', 400, 'INVALID_TYPE');
  }

  // 2. Upload to ImgBB
  const result = await uploadToImgBB(file.buffer, `news_cover_${Date.now()}_${file.originalname}`);

  // 3. Audit log
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'NEWS_COVER',
      metadata: {
        action: 'uploaded',
        url: result.url,
        size: file.size,
        mimeType: file.mimetype,
      },
    },
  });

  return {
    url: result.url,
    displayUrl: result.displayUrl,
    id: result.id,
    size: file.size,
    mimeType: file.mimetype,
  };
};
