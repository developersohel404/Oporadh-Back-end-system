import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './news.service.js';
import {
  createNewsSchema,
  listNewsQuerySchema,
  newsIdParamSchema,
  newsSlugParamSchema,
  updateNewsSchema,
} from './news.validation.js';

// ============================================================
// Helper
// ============================================================

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// CREATE (Admin)
// ============================================================

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createNewsSchema.parse(req.body);
    const news = await service.createNews(user.userId, input);
    return successResponse(res, 'News created', news, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UPDATE (Admin)
// ============================================================

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = newsIdParamSchema.parse(req.params);
    const input = updateNewsSchema.parse(req.body);
    const news = await service.updateNews(user.userId, id, input);
    return successResponse(res, 'News updated', news);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PUBLISH (Admin)
// ============================================================

export const publish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = newsIdParamSchema.parse(req.params);
    const news = await service.publishNews(user.userId, id);
    return successResponse(res, 'News published', news);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ARCHIVE (Admin)
// ============================================================

export const archive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = newsIdParamSchema.parse(req.params);
    const news = await service.archiveNews(user.userId, id);
    return successResponse(res, 'News archived', news);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE (Admin)
// ============================================================

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = newsIdParamSchema.parse(req.params);
    const result = await service.deleteNews(user.userId, id);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// LIST (Public)
// ============================================================

export const listPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listNewsQuerySchema.parse(req.query);
    const result = await service.listNews(query, { isAdmin: false });
    return successResponse(res, 'News list', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// LIST (Admin — includes drafts)
// ============================================================

export const listAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listNewsQuerySchema.parse(req.query);
    const result = await service.listNews(query, { isAdmin: true });
    return successResponse(res, 'News list (admin)', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET BY SLUG (Public)
// ============================================================

export const getBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = newsSlugParamSchema.parse(req.params);
    const news = await service.getNewsBySlug(slug);
    return successResponse(res, 'News detail', news);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET BY ID (Admin)
// ============================================================

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = newsIdParamSchema.parse(req.params);
    const news = await service.getNewsById(id);
    return successResponse(res, 'News detail', news);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// UPLOAD COVER (Admin)
// POST /api/admin/news/upload-cover
// Body: form-data → file: [image]
// ============================================================

export const uploadCover = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);

    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const result = await service.uploadCoverImage(user.userId, req.file);

    return successResponse(res, 'Cover image uploaded', result, 201);
  } catch (err) {
    next(err);
  }
};
