import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as locationService from './location.service.js';

// ============================================================
// GET /api/locations/divisions
// ============================================================

export const getDivisions = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const divisions = await locationService.getAllDivisions();
    return successResponse(res, 'Divisions fetched', divisions);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/locations/divisions/:id/districts
// ============================================================

export const getDistricts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const divisionId = String(req.params.id);
    if (!divisionId) {
      throw new AppError('Division ID required', 400, 'ID_REQUIRED');
    }

    const result = await locationService.getDistrictsByDivision(divisionId);
    return successResponse(res, 'Districts fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/locations/districts/:id/upazilas
// ============================================================

export const getUpazilas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const districtId = String(req.params.id);
    if (!districtId) {
      throw new AppError('District ID required', 400, 'ID_REQUIRED');
    }

    const result = await locationService.getUpazilasByDistrict(districtId);
    return successResponse(res, 'Upazilas fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/locations/upazilas/:id/unions
// ============================================================

export const getUnions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upazilaId = String(req.params.id);
    if (!upazilaId) {
      throw new AppError('Upazila ID required', 400, 'ID_REQUIRED');
    }

    const result = await locationService.getUnionsByUpazila(upazilaId);
    return successResponse(res, 'Unions fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/locations/upazilas/:id/pourashavas
// ============================================================

export const getPourashavas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upazilaId = String(req.params.id);
    if (!upazilaId) {
      throw new AppError('Upazila ID required', 400, 'ID_REQUIRED');
    }

    const result = await locationService.getPourashavasByUpazila(upazilaId);
    return successResponse(res, 'Pourashavas fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/locations/upazilas/:id
// ============================================================

export const getUpazila = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upazilaId = String(req.params.id);
    if (!upazilaId) {
      throw new AppError('Upazila ID required', 400, 'ID_REQUIRED');
    }

    const result = await locationService.getUpazilaDetails(upazilaId);
    return successResponse(res, 'Upazila details fetched', result);
  } catch (err) {
    next(err);
  }
};
