import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createReportSchema,
  listReportQuerySchema,
  updateReportSchema,
} from './report.validation.js';

type CreateInput = z.infer<typeof createReportSchema>;
type UpdateInput = z.infer<typeof updateReportSchema>;
type ListQuery = z.infer<typeof listReportQuerySchema>;

// ============================================================
// CREATE REPORT (Section 12, 13)
// ============================================================

export const createReport = async (userId: string, input: CreateInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      divisionId: true,
      districtId: true,
      upazilaId: true,
      status: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Account not active', 403, 'ACCOUNT_INACTIVE');
  }
  if (!user.divisionId || !user.districtId || !user.upazilaId) {
    throw new AppError('Please complete your location first', 400, 'LOCATION_MISSING');
  }

  const category = await prisma.crimeCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, isActive: true },
  });
  if (!category || !category.isActive) {
    throw new AppError('Invalid category', 400, 'INVALID_CATEGORY');
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.crimeReport.count({
    where: {
      reporterId: userId,
      createdAt: { gte: todayStart },
    },
  });
  if (todayCount >= 10) {
    throw new AppError('Daily report limit reached (10/day)', 429, 'DAILY_LIMIT_EXCEEDED');
  }

  const report = await prisma.crimeReport.create({
    data: {
      reporterId: userId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      incidentAddress: input.incidentAddress,
      incidentDate: new Date(input.incidentDate),
      incidentTime: input.incidentTime,
      suspectName: input.suspectName,
      latitude: input.latitude,
      longitude: input.longitude,
      priority: input.priority,

      divisionId: user.divisionId,
      districtId: user.districtId,
      upazilaId: user.upazilaId,

      status: 'SUBMITTED',
    },
    include: {
      category: { select: { id: true, code: true, name: true, nameBn: true } },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
    },
  });

  return report;
};

// ============================================================
// LIST MY REPORTS (Section 44, 63)
// ============================================================

export const listMyReports = async (userId: string, query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {
    reporterId: userId,
    status: { not: 'DELETED' },
  };

  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;

  const [reports, total] = await Promise.all([
    prisma.crimeReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        incidentDate: true,
        createdAt: true,
        category: { select: { id: true, code: true, name: true, nameBn: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
        _count: { select: { media: true, comments: true } },
      },
    }),
    prisma.crimeReport.count({ where }),
  ]);

  return {
    reports,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET MY REPORT BY ID (Section 44)
// ============================================================

export const getMyReport = async (userId: string, reportId: string) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    include: {
      category: { select: { id: true, code: true, name: true, nameBn: true } },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
      media: {
        select: {
          id: true,
          processedUrl: true,
          mediaType: true,
          uploadedAt: true,
        },
      },
      _count: { select: { comments: true, reviews: true } },
    },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }
  if (report.reporterId !== userId) {
    throw new AppError('Not authorized to view this report', 403, 'FORBIDDEN');
  }
  if (report.status === 'DELETED') {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  return report;
};

// ============================================================
// UPDATE MY REPORT (Section 44)
// ============================================================

export const updateMyReport = async (userId: string, reportId: string, input: UpdateInput) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, status: true },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }
  if (report.reporterId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const editableStatuses = ['SUBMITTED', 'NEED_MORE_INFO'];
  if (!editableStatuses.includes(report.status)) {
    throw new AppError(`Cannot edit report in ${report.status} state`, 400, 'NOT_EDITABLE');
  }

  if (input.categoryId) {
    const cat = await prisma.crimeCategory.findUnique({
      where: { id: input.categoryId },
      select: { isActive: true },
    });
    if (!cat || !cat.isActive) {
      throw new AppError('Invalid category', 400, 'INVALID_CATEGORY');
    }
  }

  const updated = await prisma.crimeReport.update({
    where: { id: reportId },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.categoryId && { categoryId: input.categoryId }),
      ...(input.description && { description: input.description }),
      ...(input.incidentAddress !== undefined && {
        incidentAddress: input.incidentAddress,
      }),
      ...(input.incidentDate && {
        incidentDate: new Date(input.incidentDate),
      }),
      ...(input.incidentTime !== undefined && {
        incidentTime: input.incidentTime,
      }),
      ...(input.suspectName !== undefined && {
        suspectName: input.suspectName,
      }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
      ...(input.priority && { priority: input.priority }),
    },
    include: {
      category: { select: { id: true, code: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
    },
  });

  return updated;
};

// ============================================================
// DELETE MY REPORT (Section 44)
// ============================================================

export const deleteMyReport = async (userId: string, reportId: string) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, status: true },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }
  if (report.reporterId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }
  if (report.status === 'DELETED') {
    throw new AppError('Already deleted', 400, 'ALREADY_DELETED');
  }
  if (report.status === 'PUBLISHED') {
    throw new AppError('Published reports cannot be deleted by user', 400, 'NOT_DELETABLE');
  }

  await prisma.crimeReport.update({
    where: { id: reportId },
    data: { status: 'DELETED' },
  });

  return { message: 'Report deleted' };
};

// ============================================================
// LIST PUBLIC REPORTS (Section 14, 85)
// সব area, কিন্তু public fields only
// ============================================================

export const listPublicReports = async (query: {
  page?: string;
  limit?: string;
  categoryId?: string;
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  status?: string;
  search?: string;
}) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {
    status: { not: 'DELETED' },
  };

  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.divisionId) where.divisionId = query.divisionId;
  if (query.districtId) where.districtId = query.districtId;
  if (query.upazilaId) where.upazilaId = query.upazilaId;
  if (query.status) where.status = query.status;

  if (query.search?.trim()) {
    where.OR = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { description: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  const [reports, total] = await Promise.all([
    prisma.crimeReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        incidentDate: true,
        createdAt: true,
        category: {
          select: { id: true, code: true, name: true, nameBn: true },
        },
        division: { select: { id: true, name: true, nameBn: true } },
        district: { select: { id: true, name: true, nameBn: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
        media: {
          where: { processedUrl: { not: null } },
          select: { id: true, processedUrl: true, mediaType: true },
          take: 1,
        },
        _count: { select: { comments: true, media: true } },
      },
    }),
    prisma.crimeReport.count({ where }),
  ]);

  return {
    reports,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET PUBLIC REPORT BY ID (Section 14)
// ============================================================

export const getPublicReport = async (reportId: string) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      incidentDate: true,
      incidentTime: true,
      incidentAddress: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,

      category: {
        select: { id: true, code: true, name: true, nameBn: true },
      },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },

      // Reporter-এর শুধু nickname (Section 14)
      reporter: {
        select: {
          id: true,
          profile: { select: { nickname: true, avatarUrl: true } },
        },
      },

      media: {
        where: { processedUrl: { not: null } },
        select: {
          id: true,
          processedUrl: true,
          mediaType: true,
          uploadedAt: true,
        },
      },

      comments: {
        where: { status: 'VISIBLE' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              profile: { select: { nickname: true, avatarUrl: true } },
            },
          },
        },
      },

      _count: { select: { comments: true, media: true } },
    },
  });

  if (!report || report.status === 'DELETED') {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  return report;
};
