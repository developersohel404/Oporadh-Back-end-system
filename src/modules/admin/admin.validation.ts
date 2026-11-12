import { z } from 'zod';

// ============================================================
// Moderator Management
// ============================================================

export const createModeratorSchema = z.object({
  email: z.string().email(), // existing user খোঁজা হবে
  level: z.enum(['UPAZILA', 'DISTRICT', 'DIVISION']),
  divisionId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
});

export const updateJurisdictionSchema = z.object({
  level: z.enum(['UPAZILA', 'DISTRICT', 'DIVISION']),
  divisionId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
});

export const suspendModeratorSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const removeModeratorSchema = z.object({
  reason: z.string().min(5).max(500),
});

// ============================================================
// User Management
// ============================================================

export const suspendUserSchema = z.object({
  reason: z.string().min(5).max(500),
  endAt: z.string().datetime().optional(),
});

export const banUserSchema = z.object({
  reason: z.string().min(5).max(500),
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
// Crime Category
// ============================================================

export const createCategorySchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z_]+$/, 'Use UPPER_SNAKE_CASE'),
  name: z.string().min(2).max(100),
  nameBn: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  nameBn: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Params
// ============================================================

export const idParamSchema = z.object({ id: z.string().uuid() });
