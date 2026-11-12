import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

export const listNotificationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  isRead: z.enum(['true', 'false']).optional(),
  type: z
    .enum([
      'REPORT_SUBMITTED',
      'REPORT_APPROVED',
      'REPORT_REJECTED',
      'REPORT_NEED_MORE_INFO',
      'REPORT_PUBLISHED',
      'REPORT_HIDDEN',
      'ACCOUNT_WARNING',
      'ACCOUNT_RESTRICTED',
      'ACCOUNT_SUSPENDED',
      'ACCOUNT_RESTORED',
      'MODERATOR_APPLICATION_APPROVED',
      'MODERATOR_APPLICATION_REJECTED',
      'MODERATOR_SUSPENDED',
      'MODERATOR_REMOVED',
      'NEW_MESSAGE',
      'SUPPORT_REPLY',
      'NEWS_PUBLISHED',
      'SYSTEM_NOTIFICATION',
    ])
    .optional(),
});
