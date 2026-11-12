import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';

// ============================================================
// DIVISIONS
// ============================================================

export const getAllDivisions = async () => {
  const divisions = await prisma.division.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameBn: true,
    },
  });
  return divisions;
};

// ============================================================
// DISTRICTS by Division
// ============================================================

export const getDistrictsByDivision = async (divisionId: string) => {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, nameBn: true },
  });

  if (!division) {
    throw new AppError('Division not found', 404, 'DIVISION_NOT_FOUND');
  }

  const districts = await prisma.district.findMany({
    where: { divisionId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameBn: true,
      divisionId: true,
    },
  });

  return { division, districts };
};

// ============================================================
// UPAZILAS by District
// ============================================================

export const getUpazilasByDistrict = async (districtId: string) => {
  const district = await prisma.district.findUnique({
    where: { id: districtId },
    select: { id: true, name: true, nameBn: true, divisionId: true },
  });

  if (!district) {
    throw new AppError('District not found', 404, 'DISTRICT_NOT_FOUND');
  }

  const upazilas = await prisma.upazila.findMany({
    where: { districtId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameBn: true,
      districtId: true,
    },
  });

  return { district, upazilas };
};

// ============================================================
// UNIONS by Upazila
// ============================================================

export const getUnionsByUpazila = async (upazilaId: string) => {
  const upazila = await prisma.upazila.findUnique({
    where: { id: upazilaId },
    select: { id: true, name: true, nameBn: true, districtId: true },
  });

  if (!upazila) {
    throw new AppError('Upazila not found', 404, 'UPAZILA_NOT_FOUND');
  }

  const unions = await prisma.union.findMany({
    where: { upazilaId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameBn: true,
      upazilaId: true,
    },
  });

  return { upazila, unions };
};

// ============================================================
// POURASHAVAS by Upazila
// ============================================================

export const getPourashavasByUpazila = async (upazilaId: string) => {
  const upazila = await prisma.upazila.findUnique({
    where: { id: upazilaId },
    select: { id: true, name: true, nameBn: true, districtId: true },
  });

  if (!upazila) {
    throw new AppError('Upazila not found', 404, 'UPAZILA_NOT_FOUND');
  }

  const pourashavas = await prisma.pourashava.findMany({
    where: { upazilaId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameBn: true,
      upazilaId: true,
    },
  });

  return { upazila, pourashavas };
};

// ============================================================
// UPAZILA DETAILS (union + pourashava সহ)
// ============================================================

export const getUpazilaDetails = async (upazilaId: string) => {
  const upazila = await prisma.upazila.findUnique({
    where: { id: upazilaId },
    select: {
      id: true,
      name: true,
      nameBn: true,
      district: {
        select: {
          id: true,
          name: true,
          nameBn: true,
          division: {
            select: { id: true, name: true, nameBn: true },
          },
        },
      },
      unions: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, nameBn: true },
      },
      pourashavas: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, nameBn: true },
      },
    },
  });

  if (!upazila) {
    throw new AppError('Upazila not found', 404, 'UPAZILA_NOT_FOUND');
  }

  return upazila;
};
