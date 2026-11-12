import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { errorResponse } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';

// ============================================================
// Common handler for rate limit exceeded
// ============================================================

const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn(
    {
      ip: req.ip,
      url: req.originalUrl,
      method: req.method,
    },
    'Rate limit exceeded'
  );

  return errorResponse(
    res,
    'Too many requests. Please try again later.',
    'RATE_LIMIT_EXCEEDED',
    429
  );
};

// ============================================================
// Helper — Safe IP key generator (IPv6 compatible)
// ============================================================

const safeIpKey = (req: Request): string => {
  return ipKeyGenerator(req.ip ?? '');
};

// ============================================================
// Auth limiters (Section 66)
// ============================================================

// Login — 10 attempts / 15 min
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const email = (req.body?.email as string)?.toLowerCase?.() ?? '';
    return `${safeIpKey(req)}:${email}`;
  },
});

// Register — 5 / hour
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => safeIpKey(req),
});

// Verify email / forgot password — 10 / hour
export const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => safeIpKey(req),
});

// ============================================================
// Content creation limiters
// ============================================================

// Report create — 30 / hour
export const reportCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.userId ?? safeIpKey(req),
});

// Comment create — 60 / hour
export const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.userId ?? safeIpKey(req),
});

// Message create — 100 / hour
export const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.userId ?? safeIpKey(req),
});

// Media upload — 20 / hour
export const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.userId ?? safeIpKey(req),
});

// Contact form — 5 / hour
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => safeIpKey(req),
});

// Support ticket create — 10 / hour
export const supportTicketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.userId ?? safeIpKey(req),
});

// ============================================================
// Global fallback limiter
// ============================================================

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => safeIpKey(req),
});
