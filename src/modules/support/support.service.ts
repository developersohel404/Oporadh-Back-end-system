import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  assignSchema,
  createTicketSchema,
  escalateSchema,
  listTicketsQuerySchema,
  sendMessageSchema,
  updateStatusSchema,
} from './support.validation.js';

type CreateTicketInput = z.infer<typeof createTicketSchema>;
type SendMessageInput = z.infer<typeof sendMessageSchema>;
type EscalateInput = z.infer<typeof escalateSchema>;
type AssignInput = z.infer<typeof assignSchema>;
type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
type ListQuery = z.infer<typeof listTicketsQuerySchema>;

// ============================================================
// CREATE TICKET (User — Section 26, 52)
// ============================================================

export const createTicket = async (userId: string, input: CreateTicketInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      divisionId: true,
      districtId: true,
      upazilaId: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject: input.subject,
      category: input.category,
      message: input.message,
      attachment: input.attachment,
      status: 'OPEN',

      // Location from user
      divisionId: user.divisionId,
      districtId: user.districtId,
      upazilaId: user.upazilaId,
    },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
    },
  });

  return ticket;
};

// ============================================================
// LIST MY TICKETS (User)
// ============================================================

export const listMyTickets = async (userId: string, query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = { userId };
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, meta: buildMeta(total, page, limit) };
};

// ============================================================
// GET ONE TICKET (User / Moderator / Admin)
// ============================================================

export const getTicket = async (ticketId: string, userId: string, userRole: string) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
      messages: {
        where: userRole === 'USER' ? { isInternal: false } : {}, // Moderator/Admin সব message দেখবে
        orderBy: { createdAt: 'asc' },
        include: {
          // SupportMessage-এ sender relation নেই, তাই separately handle
        },
      },
    },
  });

  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }

  // User শুধু নিজের ticket দেখবে
  if (userRole === 'USER' && ticket.userId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  // Moderator — নিজের jurisdiction-এর ticket দেখবে
  if (userRole === 'MODERATOR') {
    const profile = await prisma.moderatorProfile.findUnique({
      where: { userId },
      select: { level: true, divisionId: true, districtId: true, upazilaId: true },
    });

    if (!profile) {
      throw new AppError('Moderator profile not found', 403, 'NOT_MODERATOR');
    }

    const inJurisdiction =
      (profile.level === 'UPAZILA' && profile.upazilaId === ticket.upazilaId) ||
      (profile.level === 'DISTRICT' && profile.districtId === ticket.districtId) ||
      (profile.level === 'DIVISION' && profile.divisionId === ticket.divisionId);

    if (!inJurisdiction) {
      throw new AppError('Outside your jurisdiction', 403, 'OUT_OF_JURISDICTION');
    }
  }

  // Messages-এর sender info যোগ করো
  const messagesWithSender = await Promise.all(
    ticket.messages.map(async (m) => {
      const sender = await prisma.user.findUnique({
        where: { id: m.senderId },
        select: {
          id: true,
          role: true,
          profile: { select: { name: true, nickname: true } },
        },
      });
      return { ...m, sender };
    })
  );

  return { ...ticket, messages: messagesWithSender };
};

// ============================================================
// SEND MESSAGE (User / Moderator / Admin — Section 26, 52)
// ============================================================

export const sendMessage = async (
  ticketId: string,
  senderId: string,
  senderRole: string,
  input: SendMessageInput
) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      userId: true,
      assignedToId: true,
      status: true,
      divisionId: true,
      districtId: true,
      upazilaId: true,
    },
  });

  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }

  if (ticket.status === 'CLOSED') {
    throw new AppError('Ticket is closed', 400, 'TICKET_CLOSED');
  }

  // Authorization check
  if (senderRole === 'USER' && ticket.userId !== senderId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  // Internal message শুধু moderator/admin
  const isInternal = senderRole === 'USER' ? false : (input.isInternal ?? false);

  // Determine receiver
  let receiverId: string;
  if (senderRole === 'USER') {
    receiverId = ticket.assignedToId ?? ''; // অথবা admin
  } else {
    receiverId = ticket.userId;
  }

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.supportMessage.create({
      data: {
        ticketId,
        senderId,
        message: input.message,
        attachment: input.attachment,
        isInternal,
      },
    });

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        ...(senderRole !== 'USER' && ticket.status === 'OPEN' ? { status: 'IN_PROGRESS' } : {}),
      },
    });

    // Notification for receiver
    if (receiverId) {
      await tx.notification.create({
        data: {
          userId: receiverId,
          type: 'SUPPORT_REPLY',
          title: 'New support message',
          message: input.message.substring(0, 100),
          data: { ticketId, messageId: message.id, senderId },
        },
      });
    }

    return message;
  });

  return result;
};

// ============================================================
// LIST TICKETS — Moderator (Section 52)
// ============================================================

export const listModeratorTickets = async (userId: string, query: ListQuery) => {
  const profile = await prisma.moderatorProfile.findUnique({
    where: { userId },
    select: { level: true, status: true, divisionId: true, districtId: true, upazilaId: true },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    throw new AppError('Moderator profile not active', 403, 'NOT_MODERATOR');
  }

  const { page, limit, skip } = getPagination(query);

  const where: any = {};
  if (profile.level === 'UPAZILA') where.upazilaId = profile.upazilaId;
  else if (profile.level === 'DISTRICT') where.districtId = profile.districtId;
  else if (profile.level === 'DIVISION') where.divisionId = profile.divisionId;

  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        assignedToId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    tickets,
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
// ESCALATE — Moderator (Section 26, 52)
// ============================================================

export const escalateTicket = async (
  ticketId: string,
  moderatorId: string,
  input: EscalateInput
) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }
  if (ticket.status === 'CLOSED') {
    throw new AppError('Ticket is closed', 400, 'TICKET_CLOSED');
  }

  // Verify moderator jurisdiction
  const profile = await prisma.moderatorProfile.findUnique({
    where: { userId: moderatorId },
    select: { level: true, status: true, divisionId: true, districtId: true, upazilaId: true },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    throw new AppError('Moderator not active', 403, 'NOT_MODERATOR');
  }

  const inJurisdiction =
    (profile.level === 'UPAZILA' && profile.upazilaId === ticket.upazilaId) ||
    (profile.level === 'DISTRICT' && profile.districtId === ticket.districtId) ||
    (profile.level === 'DIVISION' && profile.divisionId === ticket.divisionId);

  if (!inJurisdiction) {
    throw new AppError('Outside your jurisdiction', 403, 'OUT_OF_JURISDICTION');
  }

  // Find admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'ESCALATED',
        escalatedToAdminId: admins[0]?.id ?? null,
        escalatedAt: new Date(),
      },
    });

    // Internal note
    await tx.supportMessage.create({
      data: {
        ticketId,
        senderId: moderatorId,
        message: `[ESCALATED to Admin]: ${input.reason}`,
        isInternal: true,
      },
    });

    // Notify admins
    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'SUPPORT_REPLY' as const,
          title: 'Ticket escalated',
          message: `Ticket "${ticket.subject}" escalated: ${input.reason}`,
          data: { ticketId },
        })),
      });
    }
  });

  return { message: 'Ticket escalated to admin' };
};

// ============================================================
// LIST ALL TICKETS — Admin (Section 52)
// ============================================================

export const listAllTickets = async (query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        assignedToId: true,
        escalatedToAdminId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, meta: buildMeta(total, page, limit) };
};

// ============================================================
// ASSIGN — Admin (Section 52)
// ============================================================

export const assignTicket = async (ticketId: string, adminId: string, input: AssignInput) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }

  const moderator = await prisma.moderatorProfile.findUnique({
    where: { userId: input.moderatorId },
    select: { status: true, userId: true },
  });
  if (!moderator || moderator.status !== 'ACTIVE') {
    throw new AppError('Moderator not active', 400, 'INVALID_MODERATOR');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId: input.moderatorId,
        status: 'IN_PROGRESS',
      },
    });

    await tx.notification.create({
      data: {
        userId: input.moderatorId,
        type: 'SUPPORT_REPLY',
        title: 'Ticket assigned',
        message: `You have been assigned ticket: ${ticket.subject}`,
        data: { ticketId },
      },
    });

    return t;
  });

  return updated;
};

// ============================================================
// CLOSE — Admin (Section 52)
// ============================================================

export const closeTicket = async (ticketId: string, adminId: string) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });

    await tx.notification.create({
      data: {
        userId: ticket.userId,
        type: 'SUPPORT_REPLY',
        title: 'Support ticket closed',
        message: `Your ticket "${ticket.subject}" has been closed.`,
        data: { ticketId },
      },
    });

    return t;
  });

  return updated;
};

// ============================================================
// UPDATE STATUS — Admin/Moderator
// ============================================================

export const updateTicketStatus = async (ticketId: string, input: UpdateStatusInput) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new AppError('Ticket not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: input.status },
  });

  return updated;
};
