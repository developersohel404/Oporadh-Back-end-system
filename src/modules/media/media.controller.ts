import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as mediaService from './media.service.js';
import { mediaIdParamSchema, reportIdParamSchema } from './media.validation.js';

// ============================================================
// POST /api/reports/:id/media
// ============================================================

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const { id: reportId } = reportIdParamSchema.parse(req.params);

    const media = await mediaService.uploadMedia({
      reportId,
      userId: req.user.userId,
      file: req.file,
    });

    return successResponse(res, 'Media uploaded successfully', media, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/reports/:id/media
// ============================================================

export const listMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id: reportId } = reportIdParamSchema.parse(req.params);
    const media = await mediaService.listReportMedia(reportId, req.user.userId);

    return successResponse(res, 'Media list', media);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/media/:mediaId/original — privileged only
// ============================================================

export const getOriginalMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mediaId = String(req.params.mediaId);
    const media = await mediaService.getOriginalMediaUrl(mediaId);
    return successResponse(res, 'Original media', media);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/reports/:id/media/:mediaId
// ============================================================

export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id: reportId, mediaId } = mediaIdParamSchema.parse(req.params);
    const result = await mediaService.deleteMedia(reportId, mediaId, req.user.userId);

    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};
