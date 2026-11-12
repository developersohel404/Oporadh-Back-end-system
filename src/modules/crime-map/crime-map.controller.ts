import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../utils/api-response.js';
import * as service from './crime-map.service.js';
import {
  crimeMapQuerySchema,
  heatmapQuerySchema,
  locationIdParamSchema,
} from './crime-map.validation.js';

// ============================================================
// GET /api/crime-map
// ============================================================

export const getMap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = crimeMapQuerySchema.parse(req.query);
    const data = await service.getCrimeMap(query);
    return successResponse(res, 'Crime map data', data);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/crime-map/heatmap
// ============================================================

export const getHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = heatmapQuerySchema.parse(req.query);
    const data = await service.getHeatmapData(query);
    return successResponse(res, 'Heatmap data', data);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/crime-map/statistics
// ============================================================

export const getStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = crimeMapQuerySchema.parse(req.query);
    const data = await service.getStatistics(query);
    return successResponse(res, 'Crime statistics', data);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/crime-map/locations/:id
// ============================================================

export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = locationIdParamSchema.parse(req.params);
    const data = await service.getLocationDetail(id);
    return successResponse(res, 'Location detail', data);
  } catch (err) {
    next(err);
  }
};
