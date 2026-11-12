import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';

// Sub-routers
import { adminAboutRouter } from '../about/about.route.js';
import { adminAuditLogRouter } from '../audit-log/audit-log.route.js';
import { adminContactRouter } from '../contact/contact.route.js';
import { adminModeratorApplicationRouter } from '../moderator-application/moderator-application.route.js';
import { adminNewsRouter } from '../news/news.route.js';
import { adminRestrictionRouter } from '../restriction/restriction.route.js';
import { adminSupportRouter } from '../support/support.route.js';

import * as controller from './admin.controller.js';

const router = Router();

// সব admin route protected
router.use(authenticate);
router.use(requireRole('ADMIN'));

// ============================================================
// Moderator Applications (Section 47)
// ============================================================
router.use('/moderator-applications', adminModeratorApplicationRouter);

// ============================================================
// Moderators (Section 48)
// ============================================================
router.get('/moderators', controller.listModerators);
router.post('/moderators', controller.createModerator);
router.get('/moderators/:id', controller.getModerator);
router.patch('/moderators/:id/jurisdiction', controller.updateJurisdiction);
router.post('/moderators/:id/suspend', controller.suspendModerator);
router.post('/moderators/:id/restore', controller.restoreModerator);
router.post('/moderators/:id/remove', controller.removeModerator);

// ============================================================
// Users (Section 5)
// ============================================================
router.get('/users', controller.listUsers);
router.get('/users/:id', controller.getUser);
router.post('/users/:id/suspend', controller.suspendUser);
router.post('/users/:id/restore', controller.restoreUser);
router.post('/users/:id/ban', controller.banUser);
router.post('/users/:id/restrict', controller.restrictUser);

// ============================================================
// Crime Categories (Section 43)
// ============================================================
router.post('/crime-categories', controller.createCategory);
router.patch('/crime-categories/:id', controller.updateCategory);
router.delete('/crime-categories/:id', controller.deleteCategory);

// ============================================================
// News (Section 27) ← ⚠️ এই mount দরকার
// ============================================================
router.use('/news', adminNewsRouter);

// ============================================================
// About (Section 55)
// ============================================================
router.use('/about', adminAboutRouter);

// ============================================================
// Contact Messages (Section 54)
// ============================================================
router.use('/contact-messages', adminContactRouter);

// ============================================================
// Support (Section 52)
// ============================================================
router.use('/support', adminSupportRouter);

// ============================================================
// Audit Logs (Section 35)
// ============================================================
router.use('/audit-logs', adminAuditLogRouter);

// ============================================================
// Restrictions (Section 33-34)
// ============================================================
router.use('/restrictions', adminRestrictionRouter);

// ============================================================
// Dashboard (Section 56)
// ============================================================
router.get('/dashboard', controller.getDashboard);

export const adminRouter = router;
