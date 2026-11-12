import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createConversationSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from './conversation.validation.js';

type CreateInput = z.infer<typeof createConversationSchema>;
type SendMessageInput = z.infer<typeof sendMessageSchema>;
type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

// ============================================================
// CREATE CONVERSATION (Section 25, 49)
//
// Section 25: "User অন্য এলাকার moderator-এর সাথে conversation শুরু করতে পারবে না।"
// ============================================================

export const createConversation = async (userId: string, input: CreateInput) => {
  // 1. User নিজে moderator নয় (Section 25 — শুধু USER ↔ MODERATOR)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, upazilaId: true, districtId: true, divisionId: true },
  });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // 2. Moderator profile valid?
  const moderator = await prisma.moderatorProfile.findUnique({
    where: { userId: input.moderatorId },
    select: {
      id: true,
      status: true,
      level: true,
      divisionId: true,
      districtId: true,
      upazilaId: true,
      user: { select: { id: true, role: true } },
    },
  });
  if (!moderator) {
    throw new AppError('Moderator not found', 404, 'MODERATOR_NOT_FOUND');
  }
  if (moderator.status !== 'ACTIVE') {
    throw new AppError('Moderator is not active', 403, 'MODERATOR_INACTIVE');
  }
  if (moderator.user.id === userId) {
    throw new AppError('Cannot create conversation with yourself', 400, 'SELF_CONVERSATION');
  }

  // 3. Jurisdiction check (Section 25)
  // Moderator-এর area-তে user আছে কি না
  const inJurisdiction =
    (moderator.level === 'UPAZILA' && moderator.upazilaId === user.upazilaId) ||
    (moderator.level === 'DISTRICT' && moderator.districtId === user.districtId) ||
    (moderator.level === 'DIVISION' && moderator.divisionId === user.divisionId);

  if (!inJurisdiction) {
    throw new AppError(
      'You can only talk to moderators in your jurisdiction',
      403,
      'OUT_OF_JURISDICTION'
    );
  }

  // 4. Report validation (optional)
  if (input.reportId) {
    const report = await prisma.crimeReport.findUnique({
      where: { id: input.reportId },
      select: { id: true, reporterId: true, upazilaId: true, districtId: true, divisionId: true },
    });
    if (!report) {
      throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
    }
    if (report.reporterId !== userId) {
      throw new AppError('You can only link your own reports', 403, 'FORBIDDEN');
    }
  }

  // 5. Existing active conversation?
  const existing = await prisma.conversation.findFirst({
    where: {
      userId,
      moderatorId: input.moderatorId,
      reportId: input.reportId ?? null,
      status: 'ACTIVE',
    },
  });
  if (existing) {
    throw new AppError('Conversation already exists', 409, 'CONVERSATION_EXISTS');
  }

  // 6. Create
  const conversation = await prisma.conversation.create({
    data: {
      userId,
      moderatorId: input.moderatorId,
      reportId: input.reportId ?? null,
      status: 'ACTIVE',
    },
    include: {
      report: {
        select: { id: true, title: true, status: true },
      },
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
      moderator: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
    },
  });

  return conversation;
};

// ============================================================
// LIST MY CONVERSATIONS (Section 49)
// ============================================================

export const listMyConversations = async (userId: string, query: ListConversationsQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {
    OR: [{ userId }, { moderatorId: userId }],
  };
  if (query.status) where.status = query.status;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        report: {
          select: { id: true, title: true, status: true },
        },
        user: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
        moderator: {
          select: {
            id: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            message: true,
            senderId: true,
            isRead: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: { isRead: false, senderId: { not: userId } },
            },
          },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  // Format — add lastMessage + unreadCount
  const formatted = conversations.map((c) => {
    const { messages, _count, ...rest } = c;
    return {
      ...rest,
      lastMessage: messages[0] ?? null,
      unreadCount: _count.messages,
    };
  });

  return {
    conversations: formatted,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET ONE CONVERSATION (Section 49)
// ============================================================

export const getConversation = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      report: {
        select: { id: true, title: true, status: true, category: { select: { nameBn: true } } },
      },
      user: {
        select: {
          id: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
      moderator: {
        select: {
          id: true,
          profile: { select: { name: true, nickname: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }

  // Authorization — user বা moderator হতে হবে
  if (conversation.userId !== userId && conversation.moderatorId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  return conversation;
};

// ============================================================
// LIST MESSAGES (Section 49)
// ============================================================

export const listMessages = async (
  conversationId: string,
  userId: string,
  query: ListMessagesQuery
) => {
  // Authorization
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, moderatorId: true },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  if (conversation.userId !== userId && conversation.moderatorId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const { page, limit, skip } = getPagination(query);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        senderId: true,
        message: true,
        attachment: true,
        isRead: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            role: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
      },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    messages,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// SEND MESSAGE (Section 49)
// ============================================================

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  input: SendMessageInput
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userId: true,
      moderatorId: true,
      status: true,
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  if (conversation.userId !== senderId && conversation.moderatorId !== senderId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }
  if (conversation.status !== 'ACTIVE') {
    throw new AppError(
      `Cannot send to ${conversation.status} conversation`,
      400,
      'CONVERSATION_NOT_ACTIVE'
    );
  }

  // Determine receiver
  const receiverId =
    conversation.userId === senderId ? conversation.moderatorId : conversation.userId;

  // Transaction: create message + update conversation.updatedAt + notification
  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId,
        message: input.message,
        attachment: input.attachment,
      },
      include: {
        sender: {
          select: {
            id: true,
            role: true,
            profile: { select: { name: true, nickname: true } },
          },
        },
      },
    });

    // Update conversation's updatedAt (sort by recent)
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notification for receiver
    await tx.notification.create({
      data: {
        userId: receiverId,
        type: 'NEW_MESSAGE',
        title: 'New message',
        message: input.message.substring(0, 100),
        data: { conversationId, messageId: message.id, senderId },
      },
    });

    return message;
  });

  return result;
};

// ============================================================
// MARK AS READ (Section 49)
// ============================================================

export const markConversationRead = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, moderatorId: true },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  if (conversation.userId !== userId && conversation.moderatorId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  // Mark all messages NOT from me as read
  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return {
    message: `${result.count} message(s) marked as read`,
    count: result.count,
  };
};

// ============================================================
// CLOSE CONVERSATION (bonus — Section 25)
// ============================================================

export const closeConversation = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, moderatorId: true, status: true },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  if (conversation.userId !== userId && conversation.moderatorId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }
  if (conversation.status === 'CLOSED') {
    throw new AppError('Already closed', 400, 'ALREADY_CLOSED');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'CLOSED' },
  });

  return updated;
};
