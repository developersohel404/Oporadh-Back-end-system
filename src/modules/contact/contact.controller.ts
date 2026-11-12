import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '../../utils/api-response.js';
import * as service from './contact.service.js';
import {
  contactIdParamSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactStatusSchema,
} from './contact.validation.js';

// ============================================================
// POST /api/contact  (Public)
// ============================================================

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await service.createContact(input);
    return successResponse(
      res,
      'Thank you for contacting us. We will get back to you soon.',
      contact,
      201
    );
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/admin/contact-messages
// ============================================================

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listContactsQuerySchema.parse(req.query);
    const result = await service.listContacts(query);
    return successResponse(res, 'Contact messages fetched', result);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/admin/contact-messages/:id
// ============================================================

export const getOne = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = contactIdParamSchema.parse(req.params);
    const contact = await service.getContact(id);
    return successResponse(res, 'Contact message fetched', contact);
  } catch (err) {
    next(err);
  }
};

// ============================================================
// PATCH /api/admin/contact-messages/:id/status
// ============================================================

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = contactIdParamSchema.parse(req.params);
    const input = updateContactStatusSchema.parse(req.body);
    const updated = await service.updateContactStatus(id, input);
    return successResponse(res, 'Status updated', updated);
  } catch (err) {
    next(err);
  }
};
