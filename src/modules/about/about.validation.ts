import { z } from 'zod';

export const updateAboutSchema = z.object({
  key: z.string().min(2).max(100),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
});

export const bulkUpdateAboutSchema = z.object({
  items: z.array(updateAboutSchema).min(1).max(20),
});

export const aboutKeyParamSchema = z.object({
  key: z.string().min(2).max(100),
});
