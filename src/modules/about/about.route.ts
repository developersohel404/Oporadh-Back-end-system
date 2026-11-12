import { Router } from 'express';
import * as controller from './about.controller.js';

// Public router — /api/about
export const aboutRouter = Router();
aboutRouter.get('/', controller.getAll);
aboutRouter.get('/:key', controller.getByKey);

// Admin router — /api/admin/about
export const adminAboutRouter = Router();
adminAboutRouter.patch('/', controller.update);
adminAboutRouter.patch('/bulk', controller.bulkUpdate);
