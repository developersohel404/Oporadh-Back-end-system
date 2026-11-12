import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './moderator-application.service.js';
import {
  applicationIdParamSchema,
  createApplicationSchema,
  rejectApplicationSchema,
} from './moderator-application.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// USER
// ============================================================

export const apply = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createApplicationSchema.parse(req.body);
    const application = await service.createApplication(user.userId, input);
    return successResponse(res, 'Application submitted', application, 201);
  } catch (err) {
    next(err);
  }
};

export const getMyApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const application = await service.getMyApplication(user.userId);
    return successResponse(res, 'My application', application);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ADMIN
// ============================================================

export const listApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listApplications(req.query as any);
    return successResponse(res, 'Applications list', result);
  } catch (err) {
    next(err);
  }
};

export const getApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = applicationIdParamSchema.parse(req.params);
    const application = await service.getApplication(id);
    return successResponse(res, 'Application details', application);
  } catch (err) {
    next(err);
  }
};

export const approveApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = applicationIdParamSchema.parse(req.params);
    const application = await service.approveApplication(id, user.userId);
    return successResponse(res, 'Application approved', application);
  } catch (err) {
    next(err);
  }
};

export const rejectApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = applicationIdParamSchema.parse(req.params);
    const input = rejectApplicationSchema.parse(req.body);
    const application = await service.rejectApplication(id, user.userId, input);
    return successResponse(res, 'Application rejected', application);
  } catch (err) {
    next(err);
  }
};
