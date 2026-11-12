import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as categoryService from './crime-category.service.js';

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.getAllCategories();
    return successResponse(res, 'Categories fetched', categories);
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!id) throw new AppError('Category ID required', 400, 'ID_REQUIRED');

    const category = await categoryService.getCategoryById(id);
    return successResponse(res, 'Category fetched', category);
  } catch (err) {
    next(err);
  }
};
