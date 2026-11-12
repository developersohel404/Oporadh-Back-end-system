import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as controller from './notification.controller.js';

const router = Router();

router.use(authenticate);

// Specific routes আগে
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.delete('/read', controller.deleteAllRead);

// List
router.get('/', controller.listNotifications);

// :id routes শেষে
router.patch('/:id/read', controller.markAsRead);
router.delete('/:id', controller.deleteNotification);

export const notificationRouter = router;
