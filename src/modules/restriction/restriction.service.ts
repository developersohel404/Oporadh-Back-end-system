import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createRestrictionSchema,
  listRestrictionsQuerySchema,
  removeRestrictionSchema,
} from './restriction.validation.js';

type CreateInput = z.infer<typeof createRestrictionSchema>;
type RemoveInput = z.infer<typeof removeRestrictionSchema>;
type ListQuery = z.infer<typeof listRestrictionsQuerySchema>;

// ============================================================
// CREATE RESTRICTION (Section 33, 34)
// ============================================================

export const createRestriction = async (creatorId: string, input: CreateInput) => {
  // User exists?
  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true },
  });
  if (!targetUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  if (targetUser.role === 'ADMIN') {
    throw new AppError('Cannot restrict admin', 403, 'FORBIDDEN');
  }

  // Creator role
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { role: true },
  });
  if (!creator) {
    throw new AppError('Creator not found', 404, 'CREATOR_NOT_FOUND');
  }

  // Only admin can give permanent suspension (Section 17)
  if (input.type === 'PERMANENT_SUSPENSION' && creator.role !== 'ADMIN') {
    throw new AppError('Permanent suspension requires admin approval', 403, 'ADMIN_ONLY');
  }

  // Permanent হলে endAt = null
  const endAt =
    input.type === 'PERMANENT_SUSPENSION' ? null : input.endAt ? new Date(input.endAt) : null;

  const startAt = input.startAt ? new Date(input.startAt) : new Date();

  const restriction = await prisma.$transaction(async (tx) => {
    const r = await tx.restriction.create({
      data: {
        userId: input.userId,
        type: input.type,
        reason: input.reason,
        startAt,
        endAt,
        createdById: creatorId,
        isActive: true,
      },
    });

    // History
    await tx.restrictionHistory.create({
      data: {
        restrictionId: r.id,
        userId: input.userId,
        action: 'CREATED',
        reason: input.reason,
        performedById: creatorId,
      },
    });

    // Notification to user (Section 33)
    await tx.notification.create({
      data: {
        userId: input.userId,
        type: 'ACCOUNT_RESTRICTED',
        title: 'Account restriction',
        message: `You have been restricted: ${input.reason}`,
        data: {
          restrictionId: r.id,
          type: input.type,
          reason: input.reason,
          startAt: startAt.toISOString(),
          endAt: endAt?.toISOString() ?? null,
        },
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: creatorId,
        action: 'RESTRICTION_CREATED',
        targetType: 'USER',
        targetId: input.userId,
        metadata: {
          restrictionId: r.id,
          type: input.type,
          reason: input.reason,
        },
      },
    });

    return r;
  });

  return restriction;
};

// ============================================================
// LIST RESTRICTIONS
// ============================================================

export const listRestrictions = async (query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {};
  if (query.userId) where.userId = query.userId;
  if (query.type) where.type = query.type;
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

  const [restrictions, total] = await Promise.all([
    prisma.restriction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
        createdBy: {
          select: {
            id: true,
            role: true,
            profile: { select: { name: true } },
          },
        },
      },
    }),
    prisma.restriction.count({ where }),
  ]);

  return {
    restrictions,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET MY RESTRICTIONS (User)
// ============================================================

export const getMyRestrictions = async (userId: string) => {
  const restrictions = await prisma.restriction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: {
          id: true,
          role: true,
          profile: { select: { name: true } },
        },
      },
    },
  });

  // Check active restrictions
  const now = new Date();
  const active = restrictions.filter(
    (r) => r.isActive && (!r.endAt || r.endAt > now) && r.startAt <= now
  );

  return {
    all: restrictions,
    active,
    hasActiveRestriction: active.length > 0,
  };
};

// ============================================================
// REMOVE RESTRICTION (Section 34)
// ============================================================

export const removeRestriction = async (
  restrictionId: string,
  removerId: string,
  input: RemoveInput
) => {
  const restriction = await prisma.restriction.findUnique({
    where: { id: restrictionId },
  });
  if (!restriction) {
    throw new AppError('Restriction not found', 404, 'NOT_FOUND');
  }
  if (!restriction.isActive) {
    throw new AppError('Already removed', 400, 'ALREADY_REMOVED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.restriction.update({
      where: { id: restrictionId },
      data: {
        isActive: false,
        removedAt: new Date(),
        removedById: removerId,
      },
    });

    await tx.restrictionHistory.create({
      data: {
        restrictionId,
        userId: restriction.userId,
        action: 'REMOVED',
        reason: input.reason,
        performedById: removerId,
      },
    });

    await tx.notification.create({
      data: {
        userId: restriction.userId,
        type: 'ACCOUNT_RESTORED',
        title: 'Restriction removed',
        message: 'Your restriction has been removed.',
        data: { restrictionId },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: removerId,
        action: 'RESTRICTION_REMOVED',
        targetType: 'USER',
        targetId: restriction.userId,
        metadata: { restrictionId },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// GET RESTRICTION HISTORY (Section 34)
// ============================================================

export const getRestrictionHistory = async (restrictionId: string) => {
  const history = await prisma.restrictionHistory.findMany({
    where: { restrictionId },
    orderBy: { createdAt: 'desc' },
  });
  return history;
};

// ============================================================
// CHECK ACTIVE RESTRICTION (helper for middleware)
// ============================================================

export const hasActiveRestriction = async (userId: string, type: string): Promise<boolean> => {
  const now = new Date();
  const restriction = await prisma.restriction.findFirst({
    where: {
      userId,
      type: type as any,
      isActive: true,
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
  });
  return !!restriction;
};
