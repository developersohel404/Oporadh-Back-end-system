import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = 'ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Zod validation error
  if (err instanceof ZodError) {
    return errorResponse(
      res,
      'Validation failed',
      'VALIDATION_ERROR',
      422,
      err.flatten().fieldErrors
    );
  }

  // Custom AppError
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.code, err.statusCode, err.details);
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Duplicate entry', 'DUPLICATE', 409, err.meta);
    }
    if (err.code === 'P2025') {
      return errorResponse(res, 'Record not found', 'NOT_FOUND', 404);
    }
    return errorResponse(res, 'Database error', 'DB_ERROR', 400);
  }

  // Unknown error
  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled error'
  );

  return errorResponse(
    res,
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err as Error)?.message || 'Unknown error',
    'INTERNAL_SERVER_ERROR',
    500
  );
};
