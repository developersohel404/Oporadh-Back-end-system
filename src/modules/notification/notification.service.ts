import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type { listNotificationsQuerySchema } from './notification.validation.js';

type ListQuery = z.infer<typeof listNotificationsQuerySchema>;

// ============================================================
// LIST MY NOTIFICATIONS (Section 50)
// ============================================================

export const listMyNotifications = async (userId: string, query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = { userId };
  if (query.isRead !== undefined) {
    where.isRead = query.isRead === 'true';
  }
  if (query.type) {
    where.type = query.type;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        data: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// UNREAD COUNT (Section 50)
// ============================================================

export const getUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
};

// ============================================================
// MARK ONE AS READ (Section 50)
// ============================================================

export const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, isRead: true },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }
  if (notification.userId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  if (notification.isRead) {
    return { message: 'Already marked as read' };
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return {
    id: updated.id,
    isRead: updated.isRead,
  };
};

// ============================================================
// MARK ALL AS READ (Section 50)
// ============================================================

export const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return {
    message: `${result.count} notification(s) marked as read`,
    count: result.count,
  };
};

// ============================================================
// DELETE NOTIFICATION (Section 50)
// ============================================================

export const deleteNotification = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }
  if (notification.userId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  await prisma.notification.delete({ where: { id: notificationId } });

  return { message: 'Notification deleted' };
};

// ============================================================
// DELETE ALL READ (bonus)
// ============================================================

export const deleteAllRead = async (userId: string) => {
  const result = await prisma.notification.deleteMany({
    where: { userId, isRead: true },
  });

  return {
    message: `${result.count} read notification(s) deleted`,
    count: result.count,
  };
};
