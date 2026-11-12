import { Router } from 'express';
import { contactLimiter } from '../../middleware/rate-limit.js'; // ← নতুন
import * as controller from './contact.controller.js';

export const contactRouter = Router();
contactRouter.post('/', contactLimiter, controller.create); // ← limiter

export const adminContactRouter = Router();
adminContactRouter.get('/', controller.list);
adminContactRouter.get('/:id', controller.getOne);
adminContactRouter.patch('/:id/status', controller.updateStatus);
