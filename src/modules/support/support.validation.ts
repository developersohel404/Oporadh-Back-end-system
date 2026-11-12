import { z } from 'zod';

// ============================================================
// Create ticket (User)
// ============================================================

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.enum(['ACCOUNT', 'REPORT_ISSUE', 'MODERATOR_ISSUE', 'TECHNICAL', 'OTHER']),
  message: z.string().min(10).max(5000),
  attachment: z.string().url().optional(),
});

// ============================================================
// Send message
// ============================================================

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  attachment: z.string().url().optional(),
  isInternal: z.boolean().default(false),
});

// ============================================================
// Escalate (Moderator)
// ============================================================

export const escalateSchema = z.object({
  reason: z.string().min(5).max(1000),
});

// ============================================================
// Assign (Admin)
// ============================================================

export const assignSchema = z.object({
  moderatorId: z.string().uuid(),
});

// ============================================================
// Update status
// ============================================================

export const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED']),
});

// ============================================================
// Params
// ============================================================

export const ticketIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================
// List query
// ============================================================

export const listTicketsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED']).optional(),
  category: z.enum(['ACCOUNT', 'REPORT_ISSUE', 'MODERATOR_ISSUE', 'TECHNICAL', 'OTHER']).optional(),
});
