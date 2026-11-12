import type { NextFunction, Request, Response } from 'express';
import { errorResponse } from '../utils/api-response.js';

export const notFound = (req: Request, res: Response, _next: NextFunction) => {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND', 404);
};
