import { z } from 'zod';

// ============================================================
// URL params
// ============================================================

export const reportIdParamSchema = z.object({
  id: z.string().uuid('Invalid report ID'),
});

export const mediaIdParamSchema = z.object({
  id: z.string().uuid('Invalid report ID'),
  mediaId: z.string().uuid('Invalid media ID'),
});

export const singleMediaIdParamSchema = z.object({
  mediaId: z.string().uuid('Invalid media ID'),
});
