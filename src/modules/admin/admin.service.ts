import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  banUserSchema,
  createCategorySchema,
  createModeratorSchema,
  removeModeratorSchema,
  restrictUserSchema,
  suspendModeratorSchema,
  suspendUserSchema,
  updateCategorySchema,
  updateJurisdictionSchema,
} from './admin.validation.js';

type CreateModeratorInput = z.infer<typeof createModeratorSchema>;
type UpdateJurisdictionInput = z.infer<typeof updateJurisdictionSchema>;
type SuspendModeratorInput = z.infer<typeof suspendModeratorSchema>;
type RemoveModeratorInput = z.infer<typeof removeModeratorSchema>;
type SuspendUserInput = z.infer<typeof suspendUserSchema>;
type BanUserInput = z.infer<typeof banUserSchema>;
type RestrictUserInput = z.infer<typeof restrictUserSchema>;
type CreateCategoryInput = z.infer<typeof createCategorySchema>;
type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ============================================================
// MODERATORS — List
// ============================================================

export const listModerators = async (query: {
  page?: string;
  limit?: string;
  status?: string;
  level?: string;
}) => {
  const { page, limit, skip } = getPagination(query);
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.level) where.level = query.level;

  const [moderators, total] = await Promise.all([
    prisma.moderatorProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
        division: { select: { id: true, name: true, nameBn: true } },
        district: { select: { id: true, name: true, nameBn: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
      },
    }),
    prisma.moderatorProfile.count({ where }),
  ]);

  return { moderators, meta: buildMeta(total, page, limit) };
};

// ============================================================
// MODERATORS — Get one
// ============================================================

export const getModerator = async (id: string) => {
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          profile: true,
        },
      },
      division: true,
      district: true,
      upazila: true,
    },
  });

  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'NOT_FOUND');
  }

  return moderator;
};

// ============================================================
// MODERATORS — Create directly (by email)
// ============================================================

export const createModerator = async (adminId: string, input: CreateModeratorInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const existing = await prisma.moderatorProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    throw new AppError('User already has moderator profile', 409, 'ALREADY_MODERATOR');
  }

  // Location check
  if (input.level === 'UPAZILA' && !input.upazilaId) {
    throw new AppError('upazilaId required', 400, 'UPAZILA_REQUIRED');
  }
  if (input.level === 'DISTRICT' && !input.districtId) {
    throw new AppError('districtId required', 400, 'DISTRICT_REQUIRED');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { role: 'MODERATOR' },
    });

    const profile = await tx.moderatorProfile.create({
      data: {
        userId: user.id,
        level: input.level,
        status: 'ACTIVE',
        divisionId: input.divisionId,
        districtId: input.districtId ?? null,
        upazilaId: input.upazilaId ?? null,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'MODERATOR_APPLICATION_APPROVED',
        title: 'You are now a moderator',
        message: `You have been assigned as ${input.level} moderator.`,
        data: { level: input.level },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'MODERATOR_CREATED',
        targetType: 'USER',
        targetId: user.id,
        metadata: {
          level: input.level,
          divisionId: input.divisionId,
          districtId: input.districtId,
          upazilaId: input.upazilaId,
        },
      },
    });

    return profile;
  });

  return result;
};

// ============================================================
// MODERATORS — Update jurisdiction
// ============================================================

export const updateJurisdiction = async (
  adminId: string,
  moderatorId: string,
  input: UpdateJurisdictionInput
) => {
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { id: moderatorId },
  });
  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.moderatorProfile.update({
      where: { id: moderatorId },
      data: {
        level: input.level,
        divisionId: input.divisionId,
        districtId: input.districtId ?? null,
        upazilaId: input.upazilaId ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'JURISDICTION_CHANGED',
        targetType: 'MODERATOR',
        targetId: moderatorId,
        metadata: {
          oldLevel: moderator.level,
          newLevel: input.level,
        },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// MODERATORS — Suspend
// ============================================================

export const suspendModerator = async (
  adminId: string,
  moderatorId: string,
  input: SuspendModeratorInput
) => {
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { id: moderatorId },
  });
  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'NOT_FOUND');
  }
  if (moderator.status === 'SUSPENDED') {
    throw new AppError('Already suspended', 400, 'ALREADY_SUSPENDED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.moderatorProfile.update({
      where: { id: moderatorId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    await tx.notification.create({
      data: {
        userId: moderator.userId,
        type: 'MODERATOR_SUSPENDED',
        title: 'Moderator account suspended',
        message: `Your moderator account has been suspended. Reason: ${input.reason}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_SUSPENDED',
        targetType: 'MODERATOR',
        targetId: moderatorId,
        metadata: { reason: input.reason },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// MODERATORS — Restore
// ============================================================

export const restoreModerator = async (adminId: string, moderatorId: string) => {
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { id: moderatorId },
  });
  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.moderatorProfile.update({
      where: { id: moderatorId },
      data: { status: 'ACTIVE', suspendedAt: null, removedAt: null },
    });

    await tx.notification.create({
      data: {
        userId: moderator.userId,
        type: 'ACCOUNT_RESTORED',
        title: 'Moderator account restored',
        message: 'Your moderator account has been restored.',
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// MODERATORS — Remove
// ============================================================

export const removeModerator = async (
  adminId: string,
  moderatorId: string,
  input: RemoveModeratorInput
) => {
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { id: moderatorId },
  });
  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'NOT_FOUND');
  }

  await prisma.$transaction(async (tx) => {
    // Role back to USER
    await tx.user.update({
      where: { id: moderator.userId },
      data: { role: 'USER' },
    });

    // Delete moderator profile
    await tx.moderatorProfile.delete({ where: { id: moderatorId } });

    await tx.notification.create({
      data: {
        userId: moderator.userId,
        type: 'MODERATOR_REMOVED',
        title: 'Moderator removed',
        message: `Your moderator role was removed. Reason: ${input.reason}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'MODERATOR_REMOVED',
        targetType: 'USER',
        targetId: moderator.userId,
        metadata: { reason: input.reason },
      },
    });
  });

  return { message: 'Moderator removed' };
};

// ============================================================
// USERS — List
// ============================================================

export const listUsers = async (query: {
  page?: string;
  limit?: string;
  role?: string;
  status?: string;
  search?: string;
}) => {
  const { page, limit, skip } = getPagination(query);
  const where: any = {};
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { profile: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        profile: { select: { name: true, nickname: true } },
        division: { select: { name: true, nameBn: true } },
        district: { select: { name: true, nameBn: true } },
        upazila: { select: { name: true, nameBn: true } },
        _count: {
          select: { reports: true, restrictions: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildMeta(total, page, limit) };
};

// ============================================================
// USERS — Get one
// ============================================================

export const getUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      division: true,
      district: true,
      upazila: true,
      union: true,
      pourashava: true,
      _count: {
        select: {
          reports: true,
          reportComments: true,
          newsComments: true,
          restrictions: true,
          supportTickets: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return user;
};

// ============================================================
// USERS — Suspend
// ============================================================

export const suspendUser = async (adminId: string, userId: string, input: SuspendUserInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (user.role === 'ADMIN') {
    throw new AppError('Cannot suspend admin', 403, 'FORBIDDEN');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });

    await tx.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account suspended',
        message: `Your account has been suspended. Reason: ${input.reason}`,
        data: { reason: input.reason, endAt: input.endAt ?? null },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: userId,
        metadata: { reason: input.reason },
      },
    });

    return u;
  });

  return updated;
};

// ============================================================
// USERS — Restore
// ============================================================

export const restoreUser = async (adminId: string, userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    await tx.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_RESTORED',
        title: 'Account restored',
        message: 'Your account has been restored.',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_RESTORED',
        targetType: 'USER',
        targetId: userId,
      },
    });

    return u;
  });

  return updated;
};

// ============================================================
// USERS — Ban
// ============================================================

export const banUser = async (adminId: string, userId: string, input: BanUserInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (user.role === 'ADMIN') {
    throw new AppError('Cannot ban admin', 403, 'FORBIDDEN');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { status: 'BANNED' },
    });

    await tx.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account banned',
        message: `Your account has been banned. Reason: ${input.reason}`,
        data: { reason: input.reason },
      },
    });

    return u;
  });

  return updated;
};

// ============================================================
// USERS — Restrict
// ============================================================

export const restrictUser = async (adminId: string, userId: string, input: RestrictUserInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const restriction = await prisma.restriction.create({
    data: {
      userId,
      type: input.type,
      reason: input.reason,
      createdById: adminId,
      startAt: new Date(),
      endAt: input.endAt ? new Date(input.endAt) : null,
      isActive: true,
    },
  });

  await prisma.restrictionHistory.create({
    data: {
      restrictionId: restriction.id,
      userId,
      action: 'CREATED',
      reason: input.reason,
      performedById: adminId,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: 'ACCOUNT_RESTRICTED',
      title: 'Account restricted',
      message: `Restriction: ${input.reason}`,
      data: {
        type: input.type,
        reason: input.reason,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'RESTRICTION_CREATED',
      targetType: 'USER',
      targetId: userId,
      metadata: { type: input.type, reason: input.reason },
    },
  });

  return restriction;
};

// ============================================================
// CRIME CATEGORY — Create
// ============================================================

export const createCategory = async (adminId: string, input: CreateCategoryInput) => {
  const existing = await prisma.crimeCategory.findUnique({
    where: { code: input.code },
  });
  if (existing) {
    throw new AppError('Category code already exists', 409, 'CODE_EXISTS');
  }

  const category = await prisma.crimeCategory.create({ data: input });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'CATEGORY',
      targetId: category.id,
      metadata: { action: 'created', code: input.code },
    },
  });

  return category;
};

// ============================================================
// CRIME CATEGORY — Update
// ============================================================

export const updateCategory = async (
  adminId: string,
  categoryId: string,
  input: UpdateCategoryInput
) => {
  const existing = await prisma.crimeCategory.findUnique({
    where: { id: categoryId },
  });
  if (!existing) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.crimeCategory.update({
    where: { id: categoryId },
    data: input,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'CATEGORY',
      targetId: categoryId,
      metadata: { action: 'updated' },
    },
  });

  return updated;
};

// ============================================================
// CRIME CATEGORY — Delete (soft — isActive = false)
// ============================================================

export const deleteCategory = async (adminId: string, categoryId: string) => {
  const existing = await prisma.crimeCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { reports: true } } },
  });
  if (!existing) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }

  // If used by reports, soft-delete instead
  if (existing._count.reports > 0) {
    await prisma.crimeCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });
    return { message: 'Category deactivated (used by reports)' };
  }

  await prisma.crimeCategory.delete({ where: { id: categoryId } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'CATEGORY',
      targetId: categoryId,
      metadata: { action: 'deleted' },
    },
  });

  return { message: 'Category deleted' };
};

// ============================================================
// DASHBOARD (Section 56)
// ============================================================

export const getDashboard = async () => {
  const [
    totalUsers,
    totalModerators,
    activeModerators,
    totalReports,
    submittedReports,
    publishedReports,
    rejectedReports,
    totalCategories,
    suspendedUsers,
    recentReports,
    recentUsers,
    categoryStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.moderatorProfile.count(),
    prisma.moderatorProfile.count({ where: { status: 'ACTIVE' } }),
    prisma.crimeReport.count(),
    prisma.crimeReport.count({ where: { status: 'SUBMITTED' } }),
    prisma.crimeReport.count({ where: { status: 'PUBLISHED' } }),
    prisma.crimeReport.count({ where: { status: 'REJECTED' } }),
    prisma.crimeCategory.count({ where: { isActive: true } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.crimeReport.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        category: { select: { nameBn: true } },
        upazila: { select: { nameBn: true } },
      },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: { select: { name: true } },
      },
    }),
    prisma.crimeReport.groupBy({
      by: ['categoryId'],
      _count: true,
      orderBy: { _count: { categoryId: 'desc' } },
      take: 10,
    }),
  ]);

  // Category names
  const categoryIds = categoryStats.map((c) => c.categoryId);
  const categories = await prisma.crimeCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, code: true, name: true, nameBn: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return {
    users: {
      total: totalUsers,
      suspended: suspendedUsers,
    },
    moderators: {
      total: totalModerators,
      active: activeModerators,
    },
    reports: {
      total: totalReports,
      submitted: submittedReports,
      published: publishedReports,
      rejected: rejectedReports,
    },
    categories: {
      active: totalCategories,
    },
    recentReports,
    recentUsers,
    topCategories: categoryStats.map((c) => ({
      category: catMap.get(c.categoryId),
      count: c._count,
    })),
  };
};
