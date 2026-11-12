import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './support.service.js';
import {
  assignSchema,
  createTicketSchema,
  escalateSchema,
  listTicketsQuerySchema,
  sendMessageSchema,
  ticketIdParamSchema,
  updateStatusSchema,
} from './support.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// USER
// ============================================================

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createTicketSchema.parse(req.body);
    const ticket = await service.createTicket(user.userId, input);
    return successResponse(res, 'Support ticket created', ticket, 201);
  } catch (err) {
    next(err);
  }
};

export const listMyTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const query = listTicketsQuerySchema.parse(req.query);
    const result = await service.listMyTickets(user.userId, query);
    return successResponse(res, 'My tickets', result);
  } catch (err) {
    next(err);
  }
};

export const getTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const ticket = await service.getTicket(id, user.userId, user.role);
    return successResponse(res, 'Ticket detail', ticket);
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const input = sendMessageSchema.parse(req.body);
    const message = await service.sendMessage(id, user.userId, user.role, input);
    return successResponse(res, 'Message sent', message, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODERATOR
// ============================================================

export const listModeratorTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const query = listTicketsQuerySchema.parse(req.query);
    const result = await service.listModeratorTickets(user.userId, query);
    return successResponse(res, 'Moderator tickets', result);
  } catch (err) {
    next(err);
  }
};

export const escalateTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const input = escalateSchema.parse(req.body);
    const result = await service.escalateTicket(id, user.userId, input);
    return successResponse(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// ADMIN
// ============================================================

export const listAllTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listTicketsQuerySchema.parse(req.query);
    const result = await service.listAllTickets(query);
    return successResponse(res, 'All tickets', result);
  } catch (err) {
    next(err);
  }
};

export const assignTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const input = assignSchema.parse(req.body);
    const ticket = await service.assignTicket(id, user.userId, input);
    return successResponse(res, 'Ticket assigned', ticket);
  } catch (err) {
    next(err);
  }
};

export const closeTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const ticket = await service.closeTicket(id, user.userId);
    return successResponse(res, 'Ticket closed', ticket);
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAuth(req);
    const { id } = ticketIdParamSchema.parse(req.params);
    const input = updateStatusSchema.parse(req.body);
    const ticket = await service.updateTicketStatus(id, input);
    return successResponse(res, 'Status updated', ticket);
  } catch (err) {
    next(err);
  }
};
