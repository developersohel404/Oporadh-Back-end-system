import { z } from 'zod';

export const createApplicationSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email(),
  experience: z.string().max(2000).optional(),
  reason: z.string().min(20).max(2000),
  documents: z.array(z.string().url()).max(5).default([]),

  level: z.enum(['UPAZILA', 'DISTRICT', 'DIVISION']),
  divisionId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
});

export const rejectApplicationSchema = z.object({
  reason: z.string().min(5).max(1000),
});

export const applicationIdParamSchema = z.object({
  id: z.string().uuid(),
});
