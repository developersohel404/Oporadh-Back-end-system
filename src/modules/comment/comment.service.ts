import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentStatusSchema,
} from './comment.validation.js';

type CreateInput = z.infer<typeof createCommentSchema>;
type UpdateStatusInput = z.infer<typeof updateCommentStatusSchema>;
type ListQuery = z.infer<typeof listCommentsQuerySchema>;

// ============================================================
// NEWS COMMENTS (Section 28, 51)
// ============================================================

export const listNewsComments = async (newsId: string, query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const news = await prisma.news.findUnique({
    where: { id: newsId },
    select: { id: true, status: true },
  });
  if (!news) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }
  if (news.status !== 'PUBLISHED') {
    throw new AppError('News not published', 404, 'NOT_PUBLISHED');
  }

  const where = { newsId, status: 'VISIBLE' as const };

  const [comments, total] = await Promise.all([
    prisma.newsComment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.newsComment.count({ where }),
  ]);

  return { comments, meta: buildMeta(total, page, limit) };
};

export const createNewsComment = async (newsId: string, userId: string, input: CreateInput) => {
  const news = await prisma.news.findUnique({
    where: { id: newsId },
    select: { id: true, status: true },
  });
  if (!news) {
    throw new AppError('News not found', 404, 'NOT_FOUND');
  }
  if (news.status !== 'PUBLISHED') {
    throw new AppError('Cannot comment on unpublished news', 400, 'NOT_PUBLISHED');
  }

  const comment = await prisma.newsComment.create({
    data: {
      newsId,
      userId,
      content: input.content,
      status: 'VISIBLE',
    },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
    },
  });

  return comment;
};

export const deleteNewsComment = async (
  newsId: string,
  commentId: string,
  userId: string,
  userRole: string
) => {
  const comment = await prisma.newsComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.newsId !== newsId) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  const isOwner = comment.userId === userId;
  const canModerate = ['MODERATOR', 'ADMIN'].includes(userRole);

  if (!isOwner && !canModerate) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  await prisma.newsComment.update({
    where: { id: commentId },
    data: { status: 'DELETED' },
  });

  return { message: 'Comment deleted' };
};

// ============================================================
// REPORT COMMENTS (Section 28)
// ============================================================

export const listReportComments = async (reportId: string, query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  const where = { reportId, status: 'VISIBLE' as const };

  const [comments, total] = await Promise.all([
    prisma.reportComment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.reportComment.count({ where }),
  ]);

  return { comments, meta: buildMeta(total, page, limit) };
};

export const createReportComment = async (reportId: string, userId: string, input: CreateInput) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }
  if (report.status !== 'PUBLISHED') {
    throw new AppError('Can only comment on published reports', 400, 'NOT_PUBLISHED');
  }

  const comment = await prisma.reportComment.create({
    data: {
      reportId,
      userId,
      content: input.content,
      status: 'VISIBLE',
    },
    select: {
      id: true,
      content: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
    },
  });

  return comment;
};

export const deleteReportComment = async (
  reportId: string,
  commentId: string,
  userId: string,
  userRole: string
) => {
  const comment = await prisma.reportComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.reportId !== reportId) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  const isOwner = comment.userId === userId;
  const canModerate = ['MODERATOR', 'ADMIN'].includes(userRole);

  if (!isOwner && !canModerate) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  await prisma.reportComment.update({
    where: { id: commentId },
    data: { status: 'DELETED' },
  });

  return { message: 'Comment deleted' };
};
