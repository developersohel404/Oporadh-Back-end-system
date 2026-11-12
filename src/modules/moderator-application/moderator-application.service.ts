import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createApplicationSchema,
  rejectApplicationSchema,
} from './moderator-application.validation.js';

type CreateInput = z.infer<typeof createApplicationSchema>;
type RejectInput = z.infer<typeof rejectApplicationSchema>;

// Section 22 — capacity limits
const CAPACITY = {
  UPAZILA: 10,
  DISTRICT: 20,
  DIVISION: 50,
} as const;

// ============================================================
// APPLY AS MODERATOR (Section 20)
// ============================================================

export const createApplication = async (userId: string, input: CreateInput) => {
  // Existing pending?
  const existing = await prisma.moderatorApplication.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (existing) {
    throw new AppError('You already have a pending application', 409, 'APPLICATION_PENDING');
  }

  // Location validation
  const division = await prisma.division.findUnique({
    where: { id: input.divisionId },
  });
  if (!division) {
    throw new AppError('Division not found', 400, 'DIVISION_NOT_FOUND');
  }

  let district = null;
  let upazila = null;

  if (input.level === 'DISTRICT' || input.level === 'UPAZILA') {
    if (!input.districtId) {
      throw new AppError(
        'districtId required for DISTRICT/UPAZILA level',
        400,
        'DISTRICT_REQUIRED'
      );
    }
    district = await prisma.district.findFirst({
      where: { id: input.districtId, divisionId: division.id },
    });
    if (!district) {
      throw new AppError('District not found in division', 400, 'INVALID_DISTRICT');
    }
  }

  if (input.level === 'UPAZILA') {
    if (!input.upazilaId) {
      throw new AppError('upazilaId required', 400, 'UPAZILA_REQUIRED');
    }
    upazila = await prisma.upazila.findFirst({
      where: { id: input.upazilaId, districtId: district!.id },
    });
    if (!upazila) {
      throw new AppError('Upazila not found in district', 400, 'INVALID_UPAZILA');
    }
  }

  // Capacity check (Section 22)
  await checkCapacity(input.level, {
    divisionId: input.divisionId,
    districtId: input.districtId,
    upazilaId: input.upazilaId,
  });

  const application = await prisma.moderatorApplication.create({
    data: {
      userId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      experience: input.experience,
      reason: input.reason,
      documents: input.documents,
      level: input.level,
      divisionId: input.divisionId,
      districtId: input.districtId,
      upazilaId: input.upazilaId,
      status: 'PENDING',
    },
    include: {
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
    },
  });

  return application;
};

// ============================================================
// GET MY APPLICATION
// ============================================================

export const getMyApplication = async (userId: string) => {
  const application = await prisma.moderatorApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
    },
  });
  return application;
};

// ============================================================
// CAPACITY CHECK (Section 22)
// ============================================================

const checkCapacity = async (
  level: 'UPAZILA' | 'DISTRICT' | 'DIVISION',
  loc: { divisionId?: string | null; districtId?: string | null; upazilaId?: string | null }
) => {
  const filter: any = { level, status: 'ACTIVE' };

  if (level === 'UPAZILA' && loc.upazilaId) {
    filter.upazilaId = loc.upazilaId;
  } else if (level === 'DISTRICT' && loc.districtId) {
    filter.districtId = loc.districtId;
  } else if (level === 'DIVISION' && loc.divisionId) {
    filter.divisionId = loc.divisionId;
  }

  const count = await prisma.moderatorProfile.count({ where: filter });
  const max = CAPACITY[level];

  if (count >= max) {
    throw new AppError(`${level} moderator capacity full (${count}/${max})`, 409, 'CAPACITY_FULL');
  }

  return { count, max };
};

// ============================================================
// ADMIN — LIST APPLICATIONS (Section 47)
// ============================================================

export const listApplications = async (query: {
  page?: string;
  limit?: string;
  status?: string;
}) => {
  const { page, limit, skip } = getPagination(query);
  const where: any = {};
  if (query.status) where.status = query.status;

  const [applications, total] = await Promise.all([
    prisma.moderatorApplication.findMany({
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
        division: { select: { id: true, name: true, nameBn: true } },
        district: { select: { id: true, name: true, nameBn: true } },
        upazila: { select: { id: true, name: true, nameBn: true } },
      },
    }),
    prisma.moderatorApplication.count({ where }),
  ]);

  return { applications, meta: buildMeta(total, page, limit) };
};

// ============================================================
// ADMIN — GET ONE
// ============================================================

export const getApplication = async (applicationId: string) => {
  const application = await prisma.moderatorApplication.findUnique({
    where: { id: applicationId },
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
  });

  if (!application) {
    throw new AppError('Application not found', 404, 'NOT_FOUND');
  }

  return application;
};

// ============================================================
// ADMIN — APPROVE (Section 21, 22)
// ============================================================

export const approveApplication = async (applicationId: string, adminId: string) => {
  const application = await prisma.moderatorApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError('Application not found', 404, 'NOT_FOUND');
  }
  if (application.status !== 'PENDING') {
    throw new AppError(`Application already ${application.status}`, 400, 'ALREADY_PROCESSED');
  }

  // Capacity check আবার
  await checkCapacity(application.level, {
    divisionId: application.divisionId,
    districtId: application.districtId,
    upazilaId: application.upazilaId,
  });

  // Transaction: approve + create profile + change role + notify
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update application
    const app = await tx.moderatorApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    // 2. Update user role
    await tx.user.update({
      where: { id: application.userId },
      data: { role: 'MODERATOR' },
    });

    // 3. Create ModeratorProfile
    await tx.moderatorProfile.create({
      data: {
        userId: application.userId,
        level: application.level,
        status: 'ACTIVE',
        divisionId: application.divisionId,
        districtId: application.districtId,
        upazilaId: application.upazilaId,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    // 4. Notification
    await tx.notification.create({
      data: {
        userId: application.userId,
        type: 'MODERATOR_APPLICATION_APPROVED',
        title: 'Moderator application approved',
        message: `Congratulations! You are now a ${application.level} moderator.`,
        data: { applicationId, level: application.level },
      },
    });

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'MODERATOR_CREATED',
        targetType: 'USER',
        targetId: application.userId,
        metadata: {
          applicationId,
          level: application.level,
          divisionId: application.divisionId,
          districtId: application.districtId,
          upazilaId: application.upazilaId,
        },
      },
    });

    return app;
  });

  return result;
};

// ============================================================
// ADMIN — REJECT (Section 21)
// ============================================================

export const rejectApplication = async (
  applicationId: string,
  adminId: string,
  input: RejectInput
) => {
  const application = await prisma.moderatorApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError('Application not found', 404, 'NOT_FOUND');
  }
  if (application.status !== 'PENDING') {
    throw new AppError(`Application already ${application.status}`, 400, 'ALREADY_PROCESSED');
  }

  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.moderatorApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        rejectionReason: input.reason,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: application.userId,
        type: 'MODERATOR_APPLICATION_REJECTED',
        title: 'Moderator application rejected',
        message: `Your application was rejected. Reason: ${input.reason}`,
        data: { applicationId, reason: input.reason },
      },
    });

    return app;
  });

  return result;
};
