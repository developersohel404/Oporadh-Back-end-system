import { Router } from 'express';
import { uploadMedia } from '../../config/upload.js';
import { newsCommentRouter } from '../comment/comment.route.js';
import * as controller from './news.controller.js';

// ============================================================
// Public Router — /api/news
// ============================================================

export const newsRouter = Router();

newsRouter.get('/', controller.listPublic);
newsRouter.use('/:id/comments', newsCommentRouter);
newsRouter.get('/:slug', controller.getBySlug);

// ============================================================
// Admin Router — /api/admin/news
// ⚠️ Order: specific → general → :id
// ============================================================

export const adminNewsRouter = Router();

// ⚠️ 1. SPECIFIC route আগে
adminNewsRouter.post('/upload-cover', uploadMedia.single('file'), controller.uploadCover);

// 2. General
adminNewsRouter.get('/', controller.listAdmin);
adminNewsRouter.post('/', controller.create);

// 3. :id routes শেষে
adminNewsRouter.get('/:id', controller.getById);
adminNewsRouter.patch('/:id', controller.update);
adminNewsRouter.delete('/:id', controller.remove);
adminNewsRouter.post('/:id/publish', controller.publish);
adminNewsRouter.post('/:id/archive', controller.archive);
