import type { Response } from 'express';

export const successResponse = <T>(
  res: Response,
  message: string,
  data: T = {} as T,
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  code = 'ERROR',
  status = 400,
  details?: unknown
) => {
  return res.status(status).json({
    success: false,
    message,
    error: {
      code,
      ...(details ? { details } : {}),
    },
  });
};
