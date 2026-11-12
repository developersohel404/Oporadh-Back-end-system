import { z } from 'zod';

export const createRestrictionSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum([
    'COMMENT_RESTRICTED',
    'REPORT_RESTRICTED',
    'MESSAGE_RESTRICTED',
    'TEMPORARY_SUSPENSION',
    'PERMANENT_SUSPENSION',
  ]),
  reason: z.string().min(5).max(500),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

export const removeRestrictionSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

export const restrictionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listRestrictionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  userId: z.string().uuid().optional(),
  type: z
    .enum([
      'COMMENT_RESTRICTED',
      'REPORT_RESTRICTED',
      'MESSAGE_RESTRICTED',
      'TEMPORARY_SUSPENSION',
      'PERMANENT_SUSPENSION',
    ])
    .optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
