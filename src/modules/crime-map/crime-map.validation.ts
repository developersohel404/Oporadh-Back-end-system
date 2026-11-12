import { z } from 'zod';

// ============================================================
// Query filters (Section 53)
// ============================================================

export const crimeMapQuerySchema = z.object({
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const heatmapQuerySchema = crimeMapQuerySchema.extend({
  // Heatmap-specific
  precision: z.enum(['upazila', 'district', 'division']).default('upazila'),
});

export const locationIdParamSchema = z.object({
  id: z.string().uuid(),
});
