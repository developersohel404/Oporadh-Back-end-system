import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as moderatorService from './moderator.service.js';
import {
  addNoteSchema,
  escalateSchema,
  listModeratorReportsQuerySchema,
  rejectReportSchema,
  reportIdParamSchema,
  requestInfoSchema,
  restrictUserSchema,
  updatePrioritySchema,
  userIdParamSchema,
  warnUserSchema,
} from './moderator.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// REPORTS
// ============================================================

export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const query = listModeratorReportsQuerySchema.parse(req.query);
    const result = await moderatorService.listModeratorReports(user.userId, query);
    return successResponse(res, 'Reports fetched', result);
  } catch (err) {
    next(err);
  }
};

export const getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const report = await moderatorService.getModeratorReport(id, user.userId);
    return successResponse(res, 'Report fetched', report);
  } catch (err) {
    next(err);
  }
};

export const markUnderReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const report = await moderatorService.markUnderReview(id, user.userId);
    return successResponse(res, 'Report marked under review', report);
  } catch (err) {
    next(err);
  }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const report = await moderatorService.approveReport(id, user.userId);
    return successResponse(res, 'Report approved', report);
  } catch (err) {
    next(err);
  }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = rejectReportSchema.parse(req.body);
    const report = await moderatorService.rejectReport(id, user.userId, input);
    return successResponse(res, 'Report rejected', report);
  } catch (err) {
    next(err);
  }
};

export const requestInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = requestInfoSchema.parse(req.body);
    const report = await moderatorService.requestMoreInfo(id, user.userId, input);
    return successResponse(res, 'Requested more info', report);
  } catch (err) {
    next(err);
  }
};

export const publish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const report = await moderatorService.publishReport(id, user.userId);
    return successResponse(res, 'Report published', report);
  } catch (err) {
    next(err);
  }
};

export const hide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const report = await moderatorService.hideReport(id, user.userId, note);
    return successResponse(res, 'Report hidden', report);
  } catch (err) {
    next(err);
  }
};

export const escalate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = escalateSchema.parse(req.body);
    const result = await moderatorService.escalateReport(id, user.userId, input);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

export const updatePriority = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = updatePrioritySchema.parse(req.body);
    const report = await moderatorService.updatePriority(id, user.userId, input);
    return successResponse(res, 'Priority updated', report);
  } catch (err) {
    next(err);
  }
};

export const addNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = addNoteSchema.parse(req.body);
    const review = await moderatorService.addNote(id, user.userId, input);
    return successResponse(res, 'Note added', review, 201);
  } catch (err) {
    next(err);
  }
};

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const result = await moderatorService.deleteReport(id, user.userId);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// USERS
// ============================================================

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const result = await moderatorService.listUsersInJurisdiction(user.userId, page, limit);
    return successResponse(res, 'Users fetched', result);
  } catch (err) {
    next(err);
  }
};

export const warnUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = userIdParamSchema.parse(req.params);
    const input = warnUserSchema.parse(req.body);
    const result = await moderatorService.warnUser(id, user.userId, input);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

export const restrictUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = userIdParamSchema.parse(req.params);
    const input = restrictUserSchema.parse(req.body);
    const restriction = await moderatorService.restrictUser(id, user.userId, input);
    return successResponse(res, 'User restricted', restriction, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DASHBOARD
// ============================================================

export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const stats = await moderatorService.getModeratorDashboard(user.userId);
    return successResponse(res, 'Dashboard data', stats);
  } catch (err) {
    next(err);
  }
};
