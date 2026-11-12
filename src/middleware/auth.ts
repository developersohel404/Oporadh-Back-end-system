import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';
import { AppError } from './error.js';

// Express Request-এ user যোগ করো
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ============================================================
// AUTHENTICATE — JWT verify middleware
// ============================================================

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
};

// ============================================================
// REQUIRE ROLE — Role-based authorization
// ============================================================

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
};
