import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import type { bulkUpdateAboutSchema, updateAboutSchema } from './about.validation.js';

type UpdateInput = z.infer<typeof updateAboutSchema>;
type BulkUpdateInput = z.infer<typeof bulkUpdateAboutSchema>;

// ============================================================
// GET ALL ABOUT CONTENT (Public — Section 31, 55)
// ============================================================

export const getAllAbout = async () => {
  const items = await prisma.aboutContent.findMany({
    orderBy: { key: 'asc' },
    select: {
      id: true,
      key: true,
      title: true,
      content: true,
      updatedAt: true,
    },
  });

  // Key-value object-এ format করো (frontend-এর সুবিধা)
  const asObject = items.reduce<Record<string, { title: string | null; content: string }>>(
    (acc, item) => {
      acc[item.key] = { title: item.title, content: item.content };
      return acc;
    },
    {}
  );

  return {
    items,
    data: asObject,
  };
};

// ============================================================
// GET ONE ABOUT BY KEY
// ============================================================

export const getAboutByKey = async (key: string) => {
  const item = await prisma.aboutContent.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      title: true,
      content: true,
      updatedAt: true,
    },
  });

  if (!item) {
    throw new AppError(`About content "${key}" not found`, 404, 'NOT_FOUND');
  }

  return item;
};

// ============================================================
// UPDATE (single key) — Admin (Section 55)
// ============================================================

export const updateAbout = async (adminId: string, input: UpdateInput) => {
  const existing = await prisma.aboutContent.findUnique({
    where: { key: input.key },
  });

  if (!existing) {
    throw new AppError(
      `About key "${input.key}" not found. Create via seed first.`,
      404,
      'NOT_FOUND'
    );
  }

  const updated = await prisma.aboutContent.update({
    where: { key: input.key },
    data: {
      title: input.title,
      content: input.content,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'ABOUT_CONTENT',
      targetId: updated.id,
      metadata: { key: input.key },
    },
  });

  return updated;
};

// ============================================================
// BULK UPDATE — Admin (Section 55)
// ============================================================

export const bulkUpdateAbout = async (adminId: string, input: BulkUpdateInput) => {
  const results = await prisma.$transaction(
    input.items.map((item) =>
      prisma.aboutContent.upsert({
        where: { key: item.key },
        update: {
          title: item.title,
          content: item.content,
        },
        create: {
          key: item.key,
          title: item.title,
          content: item.content,
        },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'SETTINGS_UPDATED',
      targetType: 'ABOUT_CONTENT',
      metadata: {
        keys: input.items.map((i) => i.key),
        count: input.items.length,
      },
    },
  });

  return {
    message: `${results.length} entries updated`,
    items: results,
  };
};
