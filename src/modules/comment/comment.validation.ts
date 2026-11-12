import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const updateCommentStatusSchema = z.object({
  status: z.enum(['VISIBLE', 'HIDDEN', 'DELETED']),
});

export const newsIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const reportIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const commentIdParamSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

export const listCommentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
