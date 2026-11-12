import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as reportService from './report.service.js';
import {
  createReportSchema,
  listReportQuerySchema,
  updateReportSchema,
} from './report.validation.js';

// ============================================================
// POST /api/reports
// ============================================================

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const input = createReportSchema.parse(req.body);
    const report = await reportService.createReport(req.user.userId, input);

    return successResponse(res, 'Report submitted successfully', report, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/reports
// ============================================================

export const listMyReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const query = listReportQuerySchema.parse(req.query);
    const result = await reportService.listMyReports(req.user.userId, query);

    return successResponse(res, 'Reports fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/reports/:id
// ============================================================

export const getMyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = String(req.params.id);
    const report = await reportService.getMyReport(req.user.userId, id);

    return successResponse(res, 'Report fetched', report);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/reports/:id
// ============================================================

export const updateMyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = String(req.params.id);
    const input = updateReportSchema.parse(req.body);
    const report = await reportService.updateMyReport(req.user.userId, id, input);

    return successResponse(res, 'Report updated', report);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// DELETE /api/reports/:id
// ============================================================

export const deleteMyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = String(req.params.id);
    const result = await reportService.deleteMyReport(req.user.userId, id);

    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/reports/public — Public list (NO AUTH)
// ============================================================

export const listPublicReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.listPublicReports(req.query as any);
    return successResponse(res, 'Public reports fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/reports/public/:id — Public detail (NO AUTH)
// ============================================================

export const getPublicReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const report = await reportService.getPublicReport(id);
    return successResponse(res, 'Public report fetched', report);
  } catch (err) {
    next(err);
  }
};
