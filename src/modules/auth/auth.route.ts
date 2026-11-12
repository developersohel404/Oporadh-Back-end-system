import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter, registerLimiter, verifyLimiter } from '../../middleware/rate-limit.js'; // ← নতুন
import * as authController from './auth.controller.js';

const router = Router();

// Public routes — WITH rate limits
router.post('/register', registerLimiter, authController.register);
router.get('/verify-email', verifyLimiter, authController.verifyEmail);
router.post('/resend-verification', verifyLimiter, authController.resendVerification);

router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', verifyLimiter, authController.forgotPassword);
router.post('/reset-password', verifyLimiter, authController.resetPassword);

// Protected
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export const authRouter = router;
