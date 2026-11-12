import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './notification.service.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notification.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// GET /api/notifications
// ============================================================

export const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await service.listMyNotifications(user.userId, query);
    return successResponse(res, 'Notifications fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/notifications/unread-count
// ============================================================

export const unreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const result = await service.getUnreadCount(user.userId);
    return successResponse(res, 'Unread count', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/notifications/:id/read
// ============================================================

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = notificationIdParamSchema.parse(req.params);
    const result = await service.markAsRead(user.userId, id);
    return successResponse(res, result.message ?? 'Marked as read', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/notifications/read-all
// ============================================================

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const result = await service.markAllAsRead(user.userId);
    return successResponse(res, result.message, { count: result.count });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/notifications/:id
// ============================================================

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = notificationIdParamSchema.parse(req.params);
    const result = await service.deleteNotification(user.userId, id);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/notifications/read (all read)
// ============================================================

export const deleteAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const result = await service.deleteAllRead(user.userId);
    return successResponse(res, result.message, { count: result.count });
  } catch (err) {
    next(err);
  }
};
