import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  addNoteSchema,
  escalateSchema,
  listModeratorReportsQuerySchema,
  rejectReportSchema,
  requestInfoSchema,
  restrictUserSchema,
  updatePrioritySchema,
  warnUserSchema,
} from './moderator.validation.js';

type RejectInput = z.infer<typeof rejectReportSchema>;
type RequestInfoInput = z.infer<typeof requestInfoSchema>;
type EscalateInput = z.infer<typeof escalateSchema>;
type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
type AddNoteInput = z.infer<typeof addNoteSchema>;
type WarnUserInput = z.infer<typeof warnUserSchema>;
type RestrictUserInput = z.infer<typeof restrictUserSchema>;
type ListQuery = z.infer<typeof listModeratorReportsQuerySchema>;

// ============================================================
// Section 19 — Jurisdiction check
// Moderator শুধু নিজের level-এর area-র report দেখতে পারবে
// ============================================================

const getModeratorProfile = async (userId: string) => {
  const profile = await prisma.moderatorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      level: true,
      status: true,
      divisionId: true,
      districtId: true,
      upazilaId: true,
    },
  });

  if (!profile) {
    throw new AppError('Moderator profile not found', 403, 'NOT_MODERATOR');
  }
  if (profile.status !== 'ACTIVE') {
    throw new AppError(`Moderator account is ${profile.status}`, 403, 'MODERATOR_INACTIVE');
  }

  return profile;
};

const buildJurisdictionFilter = (profile: {
  level: string;
  divisionId: string | null;
  districtId: string | null;
  upazilaId: string | null;
}) => {
  const filter: any = {};

  if (profile.level === 'DIVISION' && profile.divisionId) {
    filter.divisionId = profile.divisionId;
  } else if (profile.level === 'DISTRICT' && profile.districtId) {
    filter.districtId = profile.districtId;
  } else if (profile.level === 'UPAZILA' && profile.upazilaId) {
    filter.upazilaId = profile.upazilaId;
  } else {
    throw new AppError('Moderator has no valid jurisdiction', 403, 'NO_JURISDICTION');
  }

  return filter;
};

const assertReportInJurisdiction = async (reportId: string, userId: string) => {
  const profile = await getModeratorProfile(userId);
  const filter = buildJurisdictionFilter(profile);

  const report = await prisma.crimeReport.findFirst({
    where: { id: reportId, ...filter },
    include: {
      reporter: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
      category: { select: { id: true, code: true, name: true, nameBn: true } },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
      media: {
        select: {
          id: true,
          originalUrl: true, // moderator দেখতে পারবে
          processedUrl: true,
          mediaType: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              profile: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!report) {
    throw new AppError('Report not found or outside your jurisdiction', 404, 'REPORT_NOT_FOUND');
  }

  return { report, profile };
};

// ============================================================
// LIST MODERATOR REPORTS (Section 45)
// ============================================================

export const listModeratorReports = async (userId: string, query: ListQuery) => {
  const profile = await getModeratorProfile(userId);
  const filter = buildJurisdictionFilter(profile);
  const { page, limit, skip } = getPagination(query);

  const where: any = { ...filter };
  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;

  const [reports, total] = await Promise.all([
    prisma.crimeReport.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        incidentDate: true,
        createdAt: true,
        reporter: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
        category: { select: { id: true, code: true, nameBn: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
        _count: { select: { media: true, comments: true, reviews: true } },
      },
    }),
    prisma.crimeReport.count({ where }),
  ]);

  return {
    reports,
    meta: buildMeta(total, page, limit),
    jurisdiction: {
      level: profile.level,
      divisionId: profile.divisionId,
      districtId: profile.districtId,
      upazilaId: profile.upazilaId,
    },
  };
};

// ============================================================
// GET ONE REPORT (Section 45)
// ============================================================

export const getModeratorReport = async (reportId: string, userId: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);
  return report;
};

// ============================================================
// MARK UNDER REVIEW
// ============================================================

export const markUnderReview = async (reportId: string, userId: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  if (report.status !== 'SUBMITTED') {
    throw new AppError(`Cannot mark ${report.status} report as under review`, 400, 'INVALID_STATE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: { status: 'UNDER_REVIEW' },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'REVIEW',
        note: 'Started review',
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_SUBMITTED', // reuse
        title: 'Report under review',
        message: `Your report "${report.title}" is now under review.`,
        data: { reportId },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// APPROVE REPORT (Section 45)
// ============================================================

export const approveReport = async (reportId: string, userId: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  const allowedStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'NEED_MORE_INFO'];
  if (!allowedStatuses.includes(report.status)) {
    throw new AppError(`Cannot approve ${report.status} report`, 400, 'INVALID_STATE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: {
        status: 'APPROVED',
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'APPROVE',
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_APPROVED',
        title: 'Report approved',
        message: `Your report "${report.title}" has been approved.`,
        data: { reportId },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// REJECT REPORT (Section 45)
// ============================================================

export const rejectReport = async (reportId: string, userId: string, input: RejectInput) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  const allowedStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'NEED_MORE_INFO'];
  if (!allowedStatuses.includes(report.status)) {
    throw new AppError(`Cannot reject ${report.status} report`, 400, 'INVALID_STATE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: {
        status: 'REJECTED',
        rejectionReason: input.reason,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'REJECT',
        note: input.reason,
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_REJECTED',
        title: 'Report rejected',
        message: `Your report "${report.title}" was rejected. Reason: ${input.reason}`,
        data: { reportId, reason: input.reason },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// REQUEST MORE INFO (Section 18, 45)
// ============================================================

export const requestMoreInfo = async (
  reportId: string,
  userId: string,
  input: RequestInfoInput
) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(report.status)) {
    throw new AppError(`Cannot request info for ${report.status} report`, 400, 'INVALID_STATE');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: { status: 'NEED_MORE_INFO' },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'REQUEST_INFO',
        note: input.message,
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_NEED_MORE_INFO',
        title: 'More information needed',
        message: `Moderator needs more info on "${report.title}": ${input.message}`,
        data: { reportId, message: input.message },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// PUBLISH REPORT (Section 45)
// ============================================================

export const publishReport = async (reportId: string, userId: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  if (report.status !== 'APPROVED') {
    throw new AppError(
      `Only APPROVED reports can be published (current: ${report.status})`,
      400,
      'INVALID_STATE'
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'PUBLISH',
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_PUBLISHED',
        title: 'Report published',
        message: `Your report "${report.title}" is now public.`,
        data: { reportId },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// HIDE REPORT (Section 45)
// ============================================================

export const hideReport = async (reportId: string, userId: string, note?: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  if (report.status === 'HIDDEN') {
    throw new AppError('Already hidden', 400, 'ALREADY_HIDDEN');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.crimeReport.update({
      where: { id: reportId },
      data: { status: 'HIDDEN' },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'HIDE',
        note: note ?? null,
      },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: 'REPORT_HIDDEN',
        title: 'Report hidden',
        message: `Your report "${report.title}" has been hidden.`,
        data: { reportId },
      },
    });

    return r;
  });

  return updated;
};

// ============================================================
// ESCALATE TO ADMIN (Section 18, 45)
// ============================================================

export const escalateReport = async (reportId: string, userId: string, input: EscalateInput) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  await prisma.reportReview.create({
    data: {
      reportId,
      reviewerId: userId,
      action: 'ESCALATE',
      note: input.reason,
    },
  });

  // Admin-দের notification
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: 'SYSTEM_NOTIFICATION' as const,
        title: 'Report escalated',
        message: `Report "${report.title}" escalated: ${input.reason}`,
        data: { reportId },
      })),
    });
  }

  return { message: 'Report escalated to admin' };
};

// ============================================================
// UPDATE PRIORITY (Section 18)
// ============================================================

export const updatePriority = async (
  reportId: string,
  userId: string,
  input: UpdatePriorityInput
) => {
  await assertReportInJurisdiction(reportId, userId);

  const updated = await prisma.crimeReport.update({
    where: { id: reportId },
    data: { priority: input.priority },
  });

  return updated;
};

// ============================================================
// ADD NOTE (Section 18 — internal)
// ============================================================

export const addNote = async (reportId: string, userId: string, input: AddNoteInput) => {
  await assertReportInJurisdiction(reportId, userId);

  const review = await prisma.reportReview.create({
    data: {
      reportId,
      reviewerId: userId,
      action: 'REVIEW',
      note: input.note,
      isInternal: input.isInternal,
    },
  });

  return review;
};

// ============================================================
// DELETE REPORT (moderator — soft delete)
// ============================================================

export const deleteReport = async (reportId: string, userId: string) => {
  const { report } = await assertReportInJurisdiction(reportId, userId);

  if (report.status === 'DELETED') {
    throw new AppError('Already deleted', 400, 'ALREADY_DELETED');
  }

  await prisma.$transaction(async (tx) => {
    await tx.crimeReport.update({
      where: { id: reportId },
      data: { status: 'DELETED' },
    });

    await tx.reportReview.create({
      data: {
        reportId,
        reviewerId: userId,
        action: 'DELETE',
      },
    });
  });

  return { message: 'Report deleted' };
};

// ============================================================
// USER MANAGEMENT (Section 46)
// ============================================================

export const listUsersInJurisdiction = async (userId: string, page: number, limit: number) => {
  const profile = await getModeratorProfile(userId);
  const filter = buildJurisdictionFilter(profile);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { ...filter, role: 'USER' },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: { select: { name: true, nickname: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
      },
    }),
    prisma.user.count({ where: { ...filter, role: 'USER' } }),
  ]);

  return { users, meta: buildMeta(total, page, limit) };
};

export const warnUser = async (targetUserId: string, moderatorId: string, input: WarnUserInput) => {
  await assertUserInJurisdiction(targetUserId, moderatorId);

  await prisma.notification.create({
    data: {
      userId: targetUserId,
      type: 'ACCOUNT_WARNING',
      title: 'Warning from moderator',
      message: input.message,
      data: { warnedBy: moderatorId },
    },
  });

  return { message: 'Warning sent' };
};

export const restrictUser = async (
  targetUserId: string,
  moderatorId: string,
  input: RestrictUserInput
) => {
  await assertUserInJurisdiction(targetUserId, moderatorId);

  // Permanent suspension moderator cannot do (Section 17)
  if (input.type === 'PERMANENT_SUSPENSION') {
    throw new AppError('Permanent suspension requires admin approval', 403, 'ADMIN_ONLY');
  }

  const restriction = await prisma.restriction.create({
    data: {
      userId: targetUserId,
      type: input.type,
      reason: input.reason,
      createdById: moderatorId,
      startAt: new Date(),
      endAt: input.endAt ? new Date(input.endAt) : null,
      isActive: true,
    },
  });

  await prisma.restrictionHistory.create({
    data: {
      restrictionId: restriction.id,
      userId: targetUserId,
      action: 'CREATED',
      reason: input.reason,
      performedById: moderatorId,
    },
  });

  await prisma.notification.create({
    data: {
      userId: targetUserId,
      type: 'ACCOUNT_RESTRICTED',
      title: 'Account restricted',
      message: `You have been restricted: ${input.reason}`,
      data: {
        restrictionId: restriction.id,
        type: input.type,
        reason: input.reason,
        startAt: restriction.startAt.toISOString(),
        endAt: restriction.endAt?.toISOString() ?? null,
      },
    },
  });

  return restriction;
};

// Helper: user in same jurisdiction?
const assertUserInJurisdiction = async (targetUserId: string, moderatorId: string) => {
  const profile = await getModeratorProfile(moderatorId);
  const filter = buildJurisdictionFilter(profile);

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, ...filter },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('User not found or outside your jurisdiction', 404, 'USER_NOT_FOUND');
  }

  return user;
};

// ============================================================
// DASHBOARD STATISTICS (Section 57)
// ============================================================

export const getModeratorDashboard = async (userId: string) => {
  const profile = await getModeratorProfile(userId);
  const filter = buildJurisdictionFilter(profile);

  const [
    totalReports,
    submittedCount,
    underReviewCount,
    approvedCount,
    publishedCount,
    rejectedCount,
    categoryStats,
  ] = await Promise.all([
    prisma.crimeReport.count({ where: filter }),
    prisma.crimeReport.count({ where: { ...filter, status: 'SUBMITTED' } }),
    prisma.crimeReport.count({ where: { ...filter, status: 'UNDER_REVIEW' } }),
    prisma.crimeReport.count({ where: { ...filter, status: 'APPROVED' } }),
    prisma.crimeReport.count({ where: { ...filter, status: 'PUBLISHED' } }),
    prisma.crimeReport.count({ where: { ...filter, status: 'REJECTED' } }),
    prisma.crimeReport.groupBy({
      by: ['categoryId'],
      where: filter,
      _count: true,
    }),
  ]);

  // Category names যোগ করো
  const categoryIds = categoryStats.map((c) => c.categoryId);
  const categories = await prisma.crimeCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, code: true, nameBn: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return {
    jurisdiction: {
      level: profile.level,
      divisionId: profile.divisionId,
      districtId: profile.districtId,
      upazilaId: profile.upazilaId,
    },
    reports: {
      total: totalReports,
      submitted: submittedCount,
      underReview: underReviewCount,
      approved: approvedCount,
      published: publishedCount,
      rejected: rejectedCount,
    },
    categories: categoryStats.map((c) => ({
      category: categoryMap.get(c.categoryId),
      count: c._count,
    })),
  };
};
