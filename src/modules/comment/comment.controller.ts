import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './comment.service.js';
import {
  commentIdParamSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  newsIdParamSchema,
  reportIdParamSchema,
} from './comment.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// NEWS COMMENTS
// ============================================================

export const listNewsComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = newsIdParamSchema.parse(req.params);
    const query = listCommentsQuerySchema.parse(req.query);
    const result = await service.listNewsComments(id, query);
    return successResponse(res, 'Comments fetched', result);
  } catch (err) {
    next(err);
  }
};

export const createNewsComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = newsIdParamSchema.parse(req.params);
    const input = createCommentSchema.parse(req.body);
    const comment = await service.createNewsComment(id, user.userId, input);
    return successResponse(res, 'Comment added', comment, 201);
  } catch (err) {
    next(err);
  }
};

export const deleteNewsComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id, commentId } = commentIdParamSchema.parse(req.params);
    const result = await service.deleteNewsComment(id, commentId, user.userId, user.role);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// REPORT COMMENTS
// ============================================================

export const listReportComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const query = listCommentsQuerySchema.parse(req.query);
    const result = await service.listReportComments(id, query);
    return successResponse(res, 'Comments fetched', result);
  } catch (err) {
    next(err);
  }
};

export const createReportComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = reportIdParamSchema.parse(req.params);
    const input = createCommentSchema.parse(req.body);
    const comment = await service.createReportComment(id, user.userId, input);
    return successResponse(res, 'Comment added', comment, 201);
  } catch (err) {
    next(err);
  }
};

export const deleteReportComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id, commentId } = commentIdParamSchema.parse(req.params);
    const result = await service.deleteReportComment(id, commentId, user.userId, user.role);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};
