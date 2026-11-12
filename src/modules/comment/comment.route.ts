import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as controller from './comment.controller.js';

// News comments — /api/news/:id/comments
export const newsCommentRouter = Router({ mergeParams: true });
newsCommentRouter.get('/', controller.listNewsComments);
newsCommentRouter.post('/', authenticate, controller.createNewsComment);
newsCommentRouter.delete('/:commentId', authenticate, controller.deleteNewsComment);

// Report comments — /api/reports/:id/comments
export const reportCommentRouter = Router({ mergeParams: true });
reportCommentRouter.get('/', controller.listReportComments);
reportCommentRouter.post('/', authenticate, controller.createReportComment);
reportCommentRouter.delete('/:commentId', authenticate, controller.deleteReportComment);
