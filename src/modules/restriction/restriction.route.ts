import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import * as controller from './restriction.controller.js';

// User router — /api/restrictions
export const restrictionRouter = Router();
restrictionRouter.use(authenticate);
restrictionRouter.get('/me', controller.getMine);

// Admin router — /api/admin/restrictions
export const adminRestrictionRouter = Router();
adminRestrictionRouter.use(authenticate);
adminRestrictionRouter.use(requireRole('ADMIN', 'MODERATOR'));
adminRestrictionRouter.get('/', controller.list);
adminRestrictionRouter.post('/', controller.create);
adminRestrictionRouter.delete('/:id', controller.remove);
adminRestrictionRouter.get('/:id/history', controller.history);
