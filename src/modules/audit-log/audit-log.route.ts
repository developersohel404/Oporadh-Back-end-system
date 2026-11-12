import { Router } from 'express';
import * as controller from './audit-log.controller.js';

// Admin router — /api/admin/audit-logs
export const adminAuditLogRouter = Router();
adminAuditLogRouter.get('/', controller.list);
adminAuditLogRouter.get('/:id', controller.getOne);
