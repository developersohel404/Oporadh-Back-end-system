import { z } from 'zod';

// ============================================================
// Submit contact form (Public)
// ============================================================

export const createContactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(20).optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

// ============================================================
// Admin update status
// ============================================================

export const updateContactStatusSchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']),
});

export const contactIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listContactsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']).optional(),
});
