import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import { buildMeta, getPagination } from '../../utils/pagination.js';
import type {
  createContactSchema,
  listContactsQuerySchema,
  updateContactStatusSchema,
} from './contact.validation.js';

type CreateInput = z.infer<typeof createContactSchema>;
type UpdateStatusInput = z.infer<typeof updateContactStatusSchema>;
type ListQuery = z.infer<typeof listContactsQuerySchema>;

// ============================================================
// SUBMIT CONTACT (Public — Section 32, 54)
// ============================================================

export const createContact = async (input: CreateInput) => {
  const contact = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
      status: 'NEW',
    },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  });

  return contact;
};

// ============================================================
// LIST — Admin (Section 54)
// ============================================================

export const listContacts = async (query: ListQuery) => {
  const { page, limit, skip } = getPagination(query);

  const where: any = {};
  if (query.status) where.status = query.status;

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return {
    messages,
    meta: buildMeta(total, page, limit),
  };
};

// ============================================================
// GET ONE — Admin (Section 54)
// ============================================================

export const getContact = async (id: string) => {
  const contact = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!contact) {
    throw new AppError('Contact message not found', 404, 'NOT_FOUND');
  }

  return contact;
};

// ============================================================
// UPDATE STATUS — Admin (Section 54)
// ============================================================

export const updateContactStatus = async (id: string, input: UpdateStatusInput) => {
  const existing = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Contact message not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status: input.status },
  });

  return updated;
};
