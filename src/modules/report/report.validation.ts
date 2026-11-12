import { z } from 'zod';

// ============================================================
// CREATE REPORT (Section 12)
// ============================================================

export const createReportSchema = z.object({
  title: z.string().min(5, 'শিরোনাম কমপক্ষে ৫ অক্ষর').max(200),
  categoryId: z.string().uuid('সঠিক category ID দিন'),
  description: z.string().min(10, 'বিবরণ কমপক্ষে ১০ অক্ষর').max(5000),

  incidentAddress: z.string().min(3).max(500).optional(),
  incidentDate: z.string().datetime('ISO date format দিন'),
  incidentTime: z.string().max(20).optional(),
  suspectName: z.string().max(200).optional(),

  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});

// ============================================================
// UPDATE REPORT (Section 44)
// ============================================================

export const updateReportSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().min(10).max(5000).optional(),
  incidentAddress: z.string().min(3).max(500).optional(),
  incidentDate: z.string().datetime().optional(),
  incidentTime: z.string().max(20).optional(),
  suspectName: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

// ============================================================
// LIST MY REPORTS — Query params (Section 44, 63)
// ============================================================

export const listReportQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'NEED_MORE_INFO',
      'APPROVED',
      'PUBLISHED',
      'REJECTED',
      'HIDDEN',
      'DELETED',
      'CLOSED',
    ])
    .optional(),
  categoryId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

// ============================================================
// LIST PUBLIC REPORTS — Query params (Section 14, 30)
// Login লাগে না
// ============================================================

export const listPublicReportQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
  status: z
    .enum([
      'SUBMITTED',
      'UNDER_REVIEW',
      'NEED_MORE_INFO',
      'APPROVED',
      'PUBLISHED',
      'REJECTED',
      'HIDDEN',
      'CLOSED',
    ])
    .optional(),
  search: z.string().max(200).optional(),
});
