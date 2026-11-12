import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/error.js';
import { successResponse } from '../../utils/api-response.js';
import * as service from './conversation.service.js';
import {
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from './conversation.validation.js';

const requireAuth = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
};

// ============================================================
// POST /api/conversations
// ============================================================

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const input = createConversationSchema.parse(req.body);
    const conversation = await service.createConversation(user.userId, input);
    return successResponse(res, 'Conversation created', conversation, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/conversations
// ============================================================

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const query = listConversationsQuerySchema.parse(req.query);
    const result = await service.listMyConversations(user.userId, query);
    return successResponse(res, 'Conversations fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/conversations/:id
// ============================================================

export const getOne = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = conversationIdParamSchema.parse(req.params);
    const conversation = await service.getConversation(id, user.userId);
    return successResponse(res, 'Conversation fetched', conversation);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/conversations/:id/messages
// ============================================================

export const listMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = conversationIdParamSchema.parse(req.params);
    const query = listMessagesQuerySchema.parse(req.query);
    const result = await service.listMessages(id, user.userId, query);
    return successResponse(res, 'Messages fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/conversations/:id/messages
// ============================================================

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = conversationIdParamSchema.parse(req.params);
    const input = sendMessageSchema.parse(req.body);
    const message = await service.sendMessage(id, user.userId, input);
    return successResponse(res, 'Message sent', message, 201);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/conversations/:id/read
// ============================================================

export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = conversationIdParamSchema.parse(req.params);
    const result = await service.markConversationRead(id, user.userId);
    return successResponse(res, result.message, { count: result.count });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/conversations/:id/close
// ============================================================

export const close = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireAuth(req);
    const { id } = conversationIdParamSchema.parse(req.params);
    const conversation = await service.closeConversation(id, user.userId);
    return successResponse(res, 'Conversation closed', conversation);
  } catch (err) {
    next(err);
  }
};
