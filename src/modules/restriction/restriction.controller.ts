import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './restriction.service.js';
import {
  createRestrictionSchema,
  listRestrictionsQuerySchema,
  removeRestrictionSchema,
  restrictionIdParamSchema,
} from './restriction.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// CREATE (Admin / Moderator)
// ============================================================

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createRestrictionSchema.parse(req.body);
    const restriction = await service.createRestriction(user.userId, input);
    return successResponse(res, 'Restriction created', restriction, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// LIST (Admin)
// ============================================================

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listRestrictionsQuerySchema.parse(req.query);
    const result = await service.listRestrictions(query);
    return successResponse(res, 'Restrictions fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MY RESTRICTIONS (User)
// ============================================================

export const getMine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const result = await service.getMyRestrictions(user.userId);
    return successResponse(res, 'My restrictions', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// REMOVE (Admin)
// ============================================================

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = restrictionIdParamSchema.parse(req.params);
    const input = removeRestrictionSchema.parse(req.body);
    const restriction = await service.removeRestriction(id, user.userId, input);
    return successResponse(res, 'Restriction removed', restriction);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// HISTORY
// ============================================================

export const history = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = restrictionIdParamSchema.parse(req.params);
    const result = await service.getRestrictionHistory(id);
    return successResponse(res, 'Restriction history', result);
  } catch (err) {
    next(err);
  }
};
