import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type { listAuditLogsQuerySchema } from './audit-log.validation.js';

type ListQuery = z.infer<typeof listAuditLogsQuerySchema>;

// ============================================================
// LIST AUDIT LOGS (Admin — Section 35)
// ============================================================

export const listAuditLogs = async (query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {};
  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;
  if (query.targetType) where.targetType = query.targetType;
  if (query.targetId) where.targetId = query.targetId;

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { name: true } },
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET ONE AUDIT LOG
// ============================================================

export const getAuditLog = async (id: string) => {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
          profile: { select: { name: true } },
        },
      },
    },
  });

  if (!log) {
    throw new AppError('Audit log not found', 404, 'NOT_FOUND');
  }

  return log;
};
