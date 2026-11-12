import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as controller from './moderator-application.controller.js';

// User-facing router
export const moderatorApplicationRouter = Router();
moderatorApplicationRouter.use(authenticate);
moderatorApplicationRouter.post('/', controller.apply);
moderatorApplicationRouter.get('/me', controller.getMyApplication);

// Admin-facing router (mounted at /api/admin/moderator-applications)
export const adminModeratorApplicationRouter = Router({ mergeParams: true });
adminModeratorApplicationRouter.get('/', controller.listApplications);
adminModeratorApplicationRouter.get('/:id', controller.getApplication);
adminModeratorApplicationRouter.post('/:id/approve', controller.approveApplication);
adminModeratorApplicationRouter.post('/:id/reject', controller.rejectApplication);
