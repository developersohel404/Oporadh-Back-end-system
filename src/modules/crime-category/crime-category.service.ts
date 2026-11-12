import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';

// ============================================================
// GET ALL CATEGORIES (Public — শুধু active)
// ============================================================

export const getAllCategories = async () => {
  const categories = await prisma.crimeCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      nameBn: true,
    },
  });
  return categories;
};

// ============================================================
// GET ONE CATEGORY
// ============================================================

export const getCategoryById = async (id: string) => {
  const category = await prisma.crimeCategory.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      nameBn: true,
      isActive: true,
    },
  });

  if (!category) {
    throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
  }

  if (!category.isActive) {
    throw new AppError('Category is disabled', 404, 'CATEGORY_DISABLED');
  }

  return category;
};
