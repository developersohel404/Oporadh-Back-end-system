import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const auditLogIdParamSchema = z.object({
  id: z.string().uuid(),
});
