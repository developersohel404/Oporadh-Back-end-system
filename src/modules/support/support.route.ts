import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supportTicketLimiter } from '../../middleware/rate-limit.js'; // ← নতুন
import * as controller from './support.controller.js';

export const supportRouter = Router();
supportRouter.use(authenticate);
supportRouter.post('/tickets', supportTicketLimiter, controller.createTicket);
supportRouter.get('/tickets', controller.listMyTickets);
supportRouter.get('/tickets/:id', controller.getTicket);
supportRouter.post('/tickets/:id/messages', controller.sendMessage);

export const moderatorSupportRouter = Router();
moderatorSupportRouter.use(authenticate);
moderatorSupportRouter.use(requireRole('MODERATOR', 'ADMIN'));
moderatorSupportRouter.get('/tickets', controller.listModeratorTickets);
moderatorSupportRouter.get('/tickets/:id', controller.getTicket);
moderatorSupportRouter.post('/tickets/:id/messages', controller.sendMessage);
moderatorSupportRouter.post('/tickets/:id/escalate', controller.escalateTicket);

export const adminSupportRouter = Router();
adminSupportRouter.use(authenticate);
adminSupportRouter.use(requireRole('ADMIN'));
adminSupportRouter.get('/tickets', controller.listAllTickets);
adminSupportRouter.get('/tickets/:id', controller.getTicket);
adminSupportRouter.post('/tickets/:id/messages', controller.sendMessage);
adminSupportRouter.post('/tickets/:id/assign', controller.assignTicket);
adminSupportRouter.post('/tickets/:id/close', controller.closeTicket);
adminSupportRouter.patch('/tickets/:id/status', controller.updateStatus);
