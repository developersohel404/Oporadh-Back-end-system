import { Router } from 'express';
import { aboutRouter } from '../modules/about/about.route.js';
import { adminRouter } from '../modules/admin/admin.route.js';
import { authRouter } from '../modules/auth/auth.route.js';
import { contactRouter } from '../modules/contact/contact.route.js';
import { conversationRouter } from '../modules/conversation/conversation.route.js';
import { crimeCategoryRouter } from '../modules/crime-category/crime-category.route.js';
import { crimeMapRouter } from '../modules/crime-map/crime-map.route.js';
import { locationRouter } from '../modules/location/location.route.js';
import { mediaRouter } from '../modules/media/media.route.js';
import { moderatorApplicationRouter } from '../modules/moderator-application/moderator-application.route.js';
import { moderatorRouter } from '../modules/moderator/moderator.route.js';
import { newsRouter } from '../modules/news/news.route.js';
import { notificationRouter } from '../modules/notification/notification.route.js';
import { reportRouter } from '../modules/report/report.route.js';
import { restrictionRouter } from '../modules/restriction/restriction.route.js';
import { supportRouter } from '../modules/support/support.route.js';

const router = Router();

// Public
router.use('/auth', authRouter);
router.use('/locations', locationRouter);
router.use('/crime-categories', crimeCategoryRouter);
router.use('/reports', reportRouter);
router.use('/media', mediaRouter);
router.use('/moderator', moderatorRouter);
router.use('/moderator-applications', moderatorApplicationRouter);
router.use('/notifications', notificationRouter);
router.use('/conversations', conversationRouter);
router.use('/about', aboutRouter);
router.use('/contact', contactRouter);
router.use('/news', newsRouter);
router.use('/support', supportRouter);
router.use('/crime-map', crimeMapRouter);
router.use('/restrictions', restrictionRouter);

// Admin — সব /admin/* এই router-এ
router.use('/admin', adminRouter);

export const apiRouter = router;
