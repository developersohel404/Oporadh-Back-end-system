import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { moderatorSupportRouter } from '../support/support.route.js'; // ← নতুন
import * as moderatorController from './moderator.controller.js';

const router = Router();

// সব moderator route protected + MODERATOR role
router.use(authenticate);
router.use(requireRole('MODERATOR', 'ADMIN'));

// ============================================================
// Reports (Section 45)
// ============================================================

router.get('/reports', moderatorController.listReports);
router.get('/reports/:id', moderatorController.getReport);

router.post('/reports/:id/review', moderatorController.markUnderReview);
router.post('/reports/:id/approve', moderatorController.approve);
router.post('/reports/:id/reject', moderatorController.reject);
router.post('/reports/:id/request-info', moderatorController.requestInfo);
router.post('/reports/:id/publish', moderatorController.publish);
router.post('/reports/:id/hide', moderatorController.hide);
router.post('/reports/:id/escalate', moderatorController.escalate);
router.post('/reports/:id/priority', moderatorController.updatePriority);
router.post('/reports/:id/notes', moderatorController.addNote);

router.delete('/reports/:id', moderatorController.deleteReport);

// ============================================================
// Users (Section 46)
// ============================================================

router.get('/users', moderatorController.listUsers);
router.post('/users/:id/warn', moderatorController.warnUser);
router.post('/users/:id/restrict', moderatorController.restrictUser);

// ============================================================
// Support Tickets (Section 52) — নতুন
// ============================================================

router.use('/support', moderatorSupportRouter);

// ============================================================
// Dashboard (Section 57)
// ============================================================

router.get('/dashboard', moderatorController.dashboard);

export const moderatorRouter = router;
