import { z } from 'zod';

// ============================================================
// Path params
// ============================================================

export const reportIdParamSchema = z.object({
  id: z.string().uuid('Invalid report ID'),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ============================================================
// Review actions
// ============================================================

export const rejectReportSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const requestInfoSchema = z.object({
  message: z.string().min(5).max(1000),
});

export const escalateSchema = z.object({
  reason: z.string().min(5).max(1000),
});

export const updatePrioritySchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
});

export const addNoteSchema = z.object({
  note: z.string().min(2).max(2000),
  isInternal: z.boolean().default(true),
});

// ============================================================
// User management
// ============================================================

export const warnUserSchema = z.object({
  message: z.string().min(5).max(500),
});

export const restrictUserSchema = z.object({
  type: z.enum([
    'COMMENT_RESTRICTED',
    'REPORT_RESTRICTED',
    'MESSAGE_RESTRICTED',
    'TEMPORARY_SUSPENSION',
    'PERMANENT_SUSPENSION',
  ]),
  reason: z.string().min(5).max(500),
  endAt: z.string().datetime().optional(),
});

// ============================================================
// Query
// ============================================================

export const listModeratorReportsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      'SUBMITTED',
      'UNDER_REVIEW',
      'NEED_MORE_INFO',
      'APPROVED',
      'PUBLISHED',
      'REJECTED',
      'HIDDEN',
    ])
    .optional(),
  categoryId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});
