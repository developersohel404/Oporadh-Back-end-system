import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../utils/api-response.js';
import * as service from './audit-log.service.js';
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from './audit-log.validation.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listAuditLogsQuerySchema.parse(req.query);
    const result = await service.listAuditLogs(query);
    return successResponse(res, 'Audit logs fetched', result);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = auditLogIdParamSchema.parse(req.params);
    const log = await service.getAuditLog(id);
    return successResponse(res, 'Audit log fetched', log);
  } catch (err) {
    next(err);
  }
};
