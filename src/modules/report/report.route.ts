import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { reportCreateLimiter } from '../../middleware/rate-limit.js';
import { reportCommentRouter } from '../comment/comment.route.js';
import { reportMediaRouter } from '../media/media.route.js';
import * as reportController from './report.controller.js';

const router = Router();

// ============================================================
// 1. PUBLIC ROUTES — login লাগে না
// (authenticate middleware-এর আগে)
// ============================================================

router.get('/public', reportController.listPublicReports);
router.get('/public/:id', reportController.getPublicReport);

// ============================================================
// 2. AUTHENTICATED ROUTES — login লাগবে
// ============================================================

router.use(authenticate);

// Create + List own
router.post('/', reportCreateLimiter, reportController.createReport);
router.get('/', reportController.listMyReports);

// Nested routers — :id routes-এর আগে
router.use('/:id/media', reportMediaRouter);
router.use('/:id/comments', reportCommentRouter);

// :id routes — শেষে
router.get('/:id', reportController.getMyReport);
router.patch('/:id', reportController.updateMyReport);
router.delete('/:id', reportController.deleteMyReport);

export const reportRouter = router;
