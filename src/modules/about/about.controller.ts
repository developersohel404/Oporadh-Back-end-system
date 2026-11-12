import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './about.service.js';
import {
  aboutKeyParamSchema,
  bulkUpdateAboutSchema,
  updateAboutSchema,
} from './about.validation.js';

// ============================================================
// GET /api/about  (Public)
// ============================================================

export const getAll = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getAllAbout();
    return successResponse(res, 'About content fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/about/:key  (Public)
// ============================================================

export const getByKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = aboutKeyParamSchema.parse(req.params);
    const item = await service.getAboutByKey(key);
    return successResponse(res, 'About item fetched', item);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/admin/about  (Admin)
// ============================================================

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    const input = updateAboutSchema.parse(req.body);
    const item = await service.updateAbout(req.user.userId, input);
    return successResponse(res, 'About content updated', item);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/admin/about/bulk  (Admin)
// ============================================================

export const bulkUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    const input = bulkUpdateAboutSchema.parse(req.body);
    const result = await service.bulkUpdateAbout(req.user.userId, input);
    return successResponse(res, result.message, result.items);
  } catch (err) {
    next(err);
  }
};
