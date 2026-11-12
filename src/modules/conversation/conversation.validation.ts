import { z } from 'zod';

// ============================================================
// Path params
// ============================================================

export const conversationIdParamSchema = z.object({
  id: z.string().uuid('Invalid conversation ID'),
});

// ============================================================
// Create conversation
// ============================================================

export const createConversationSchema = z.object({
  reportId: z.string().uuid().optional(),
  moderatorId: z.string().uuid(),
});

// ============================================================
// Send message
// ============================================================

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  attachment: z.string().url().optional(),
});

// ============================================================
// List query
// ============================================================

export const listConversationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
});

export const listMessagesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
