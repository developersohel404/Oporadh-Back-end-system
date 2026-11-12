import { z } from 'zod';

export const createNewsSchema = z.object({
  title: z.string().min(5).max(300),
  slug: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, numbers, hyphens only')
    .optional(),
  content: z.string().min(20).max(50000),
  coverImage: z.string().url().optional(),
  category: z.string().max(100).optional(),
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
});

export const updateNewsSchema = z.object({
  title: z.string().min(5).max(300).optional(),
  content: z.string().min(20).max(50000).optional(),
  coverImage: z.string().url().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  divisionId: z.string().uuid().nullable().optional(),
  districtId: z.string().uuid().nullable().optional(),
});

export const listNewsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  search: z.string().optional(),
});

export const newsIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const newsSlugParamSchema = z.object({
  slug: z.string().min(1).max(300),
});
