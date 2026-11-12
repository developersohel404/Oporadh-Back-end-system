import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './admin.service.js';
import {
  banUserSchema,
  createCategorySchema,
  createModeratorSchema,
  idParamSchema,
  removeModeratorSchema,
  restrictUserSchema,
  suspendModeratorSchema,
  suspendUserSchema,
  updateCategorySchema,
  updateJurisdictionSchema,
} from './admin.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user;
};

// ============================================================
// MODERATORS
// ============================================================

export const listModerators = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listModerators(req.query as any);
    return successResponse(res, 'Moderators list', result);
  } catch (err) {
    next(err);
  }
};

export const getModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const moderator = await service.getModerator(id);
    return successResponse(res, 'Moderator', moderator);
  } catch (err) {
    next(err);
  }
};

export const createModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createModeratorSchema.parse(req.body);
    const profile = await service.createModerator(user.userId, input);
    return successResponse(res, 'Moderator created', profile, 201);
  } catch (err) {
    next(err);
  }
};

export const updateJurisdiction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateJurisdictionSchema.parse(req.body);
    const r = await service.updateJurisdiction(user.userId, id, input);
    return successResponse(res, 'Jurisdiction updated', r);
  } catch (err) {
    next(err);
  }
};

export const suspendModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = suspendModeratorSchema.parse(req.body);
    const r = await service.suspendModerator(user.userId, id, input);
    return successResponse(res, 'Moderator suspended', r);
  } catch (err) {
    next(err);
  }
};

export const restoreModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const r = await service.restoreModerator(user.userId, id);
    return successResponse(res, 'Moderator restored', r);
  } catch (err) {
    next(err);
  }
};

export const removeModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = removeModeratorSchema.parse(req.body);
    const r = await service.removeModerator(user.userId, id, input);
    return successResponse(res, r.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// USERS
// ============================================================

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listUsers(req.query as any);
    return successResponse(res, 'Users list', result);
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const user = await service.getUser(id);
    return successResponse(res, 'User details', user);
  } catch (err) {
    next(err);
  }
};

export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = suspendUserSchema.parse(req.body);
    const u = await service.suspendUser(admin.userId, id, input);
    return successResponse(res, 'User suspended', u);
  } catch (err) {
    next(err);
  }
};

export const restoreUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const u = await service.restoreUser(admin.userId, id);
    return successResponse(res, 'User restored', u);
  } catch (err) {
    next(err);
  }
};

export const banUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = banUserSchema.parse(req.body);
    const u = await service.banUser(admin.userId, id, input);
    return successResponse(res, 'User banned', u);
  } catch (err) {
    next(err);
  }
};

export const restrictUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = restrictUserSchema.parse(req.body);
    const r = await service.restrictUser(admin.userId, id, input);
    return successResponse(res, 'User restricted', r, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// CRIME CATEGORIES
// ============================================================

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const input = createCategorySchema.parse(req.body);
    const c = await service.createCategory(admin.userId, input);
    return successResponse(res, 'Category created', c, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const input = updateCategorySchema.parse(req.body);
    const c = await service.updateCategory(admin.userId, id, input);
    return successResponse(res, 'Category updated', c);
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = requireAuth(req);
    const { id } = idParamSchema.parse(req.params);
    const r = await service.deleteCategory(admin.userId, id);
    return successResponse(res, r.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DASHBOARD
// ============================================================

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAuth(req);
    const data = await service.getDashboard();
    return successResponse(res, 'Dashboard data', data);
  } catch (err) {
    next(err);
  }
};
