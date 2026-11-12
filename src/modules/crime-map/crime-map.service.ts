import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error.js';
import type { crimeMapQuerySchema, heatmapQuerySchema } from './crime-map.validation.js';

type MapQuery = z.infer<typeof crimeMapQuerySchema>;
type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

// ============================================================
// Helpers
// ============================================================

const buildWhere = (query: MapQuery) => {
  const where: any = {
    status: 'PUBLISHED', // Public map — only published reports
  };

  if (query.divisionId) where.divisionId = query.divisionId;
  if (query.districtId) where.districtId = query.districtId;
  if (query.upazilaId) where.upazilaId = query.upazilaId;
  if (query.categoryId) where.categoryId = query.categoryId;

  if (query.dateFrom || query.dateTo) {
    where.incidentDate = {};
    if (query.dateFrom) where.incidentDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.incidentDate.lte = new Date(query.dateTo);
  }

  return where;
};

const computeHeatLevel = (count: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  if (count >= 30) return 'CRITICAL';
  if (count >= 15) return 'HIGH';
  if (count >= 5) return 'MEDIUM';
  return 'LOW';
};

// ============================================================
// UPAZILA-WISE CRIME MAP (Section 29-30, 53)
//
// Aggregate by upazila, with lat/long from reports
// ============================================================

export const getCrimeMap = async (query: MapQuery) => {
  const where = buildWhere(query);

  // Group by upazila + category
  const grouped = await prisma.crimeReport.groupBy({
    by: ['upazilaId', 'categoryId'],
    where,
    _count: { id: true },
  });

  // Get unique upazilas
  const upazilaIds = [...new Set(grouped.map((g) => g.upazilaId))];

  // Get upazila info + parent district + division
  const upazilas = await prisma.upazila.findMany({
    where: { id: { in: upazilaIds } },
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
    },
  });

  // Get category names
  const categoryIds = [...new Set(grouped.map((g) => g.categoryId))];
  const categories = await prisma.crimeCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, code: true, name: true, nameBn: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Get average lat/long per upazila from reports (approximate center)
  const coords = await prisma.crimeReport.groupBy({
    by: ['upazilaId'],
    where: {
      ...where,
      latitude: { not: null },
      longitude: { not: null },
    },
    _avg: {
      latitude: true,
      longitude: true,
    },
  });
  const coordMap = new Map(coords.map((c) => [c.upazilaId, c._avg]));

  // Build result
  const upazilaMap = new Map(upazilas.map((u) => [u.id, u]));

  const locationMap = new Map<
    string,
    {
      id: string;
      locationName: string;
      locationNameBn: string;
      district: any;
      division: any;
      latitude: number | null;
      longitude: number | null;
      crimeCount: number;
      categories: Record<string, number>;
      heatLevel: string;
    }
  >();

  for (const g of grouped) {
    const upazila = upazilaMap.get(g.upazilaId);
    if (!upazila) continue;

    if (!locationMap.has(g.upazilaId)) {
      const avg = coordMap.get(g.upazilaId);
      locationMap.set(g.upazilaId, {
        id: upazila.id,
        locationName: upazila.name,
        locationNameBn: upazila.nameBn ?? upazila.name,
        district: upazila.district,
        division: upazila.district.division,
        latitude: avg?.latitude ?? null,
        longitude: avg?.longitude ?? null,
        crimeCount: 0,
        categories: {},
        heatLevel: 'LOW',
      });
    }

    const entry = locationMap.get(g.upazilaId)!;
    const cat = categoryMap.get(g.categoryId);
    if (cat) {
      entry.categories[cat.code] = g._count.id;
    }
    entry.crimeCount += g._count.id;
  }

  // Compute heat levels
  const locations = Array.from(locationMap.values()).map((loc) => ({
    ...loc,
    heatLevel: computeHeatLevel(loc.crimeCount),
  }));

  // Sort by crimeCount desc
  locations.sort((a, b) => b.crimeCount - a.crimeCount);

  // Summary
  const totalCrimes = locations.reduce((sum, l) => sum + l.crimeCount, 0);

  return {
    locations,
    summary: {
      totalCrimes,
      totalLocations: locations.length,
      filters: {
        divisionId: query.divisionId ?? null,
        districtId: query.districtId ?? null,
        upazilaId: query.upazilaId ?? null,
        categoryId: query.categoryId ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
    },
  };
};

// ============================================================
// HEATMAP DATA (Section 29-30, 53)
//
// Simple format for heatmap libraries (LatLng + intensity)
// ============================================================

export const getHeatmapData = async (query: HeatmapQuery) => {
  const where = buildWhere(query);

  let groupField: 'upazilaId' | 'districtId' | 'divisionId';
  if (query.precision === 'division') groupField = 'divisionId';
  else if (query.precision === 'district') groupField = 'districtId';
  else groupField = 'upazilaId';

  // Group by level
  const grouped = await prisma.crimeReport.groupBy({
    by: [groupField],
    where,
    _count: { id: true },
  });

  // Get coordinates from reports (average per group)
  const coords = await prisma.crimeReport.groupBy({
    by: [groupField],
    where: {
      ...where,
      latitude: { not: null },
      longitude: { not: null },
    },
    _avg: {
      latitude: true,
      longitude: true,
    },
  });
  const coordMap = new Map(
    coords.map((c) => [c[groupField], { lat: c._avg.latitude, lng: c._avg.longitude }])
  );

  // Get location names
  const ids = grouped.map((g) => g[groupField]).filter(Boolean) as string[];

  let nameMap = new Map<string, { name: string; nameBn: string }>();
  if (groupField === 'upazilaId') {
    const rows = await prisma.upazila.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, nameBn: true },
    });
    nameMap = new Map(rows.map((r) => [r.id, { name: r.name, nameBn: r.nameBn ?? r.name }]));
  } else if (groupField === 'districtId') {
    const rows = await prisma.district.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, nameBn: true },
    });
    nameMap = new Map(rows.map((r) => [r.id, { name: r.name, nameBn: r.nameBn ?? r.name }]));
  } else {
    const rows = await prisma.division.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, nameBn: true },
    });
    nameMap = new Map(rows.map((r) => [r.id, { name: r.name, nameBn: r.nameBn ?? r.name }]));
  }

  // Build heatmap points
  const points = grouped
    .map((g) => {
      const id = g[groupField] as string | null;
      if (!id) return null;
      const coord = coordMap.get(id);
      if (!coord || coord.lat == null || coord.lng == null) return null;

      const names = nameMap.get(id);
      return {
        id,
        name: names?.name ?? 'Unknown',
        nameBn: names?.nameBn ?? 'Unknown',
        latitude: coord.lat,
        longitude: coord.lng,
        intensity: g._count.id,
        heatLevel: computeHeatLevel(g._count.id),
      };
    })
    .filter(Boolean);

  // Sort by intensity
  points.sort((a: any, b: any) => b.intensity - a.intensity);

  return {
    precision: query.precision,
    totalPoints: points.length,
    maxIntensity: points[0]?.intensity ?? 0,
    points,
  };
};

// ============================================================
// STATISTICS (Section 30, 53)
// ============================================================

export const getStatistics = async (query: MapQuery) => {
  const where = buildWhere(query);

  const [totalReports, categoryStats, statusStats, priorityStats, monthlyStats] = await Promise.all(
    [
      // Total
      prisma.crimeReport.count({ where }),

      // By category
      prisma.crimeReport.groupBy({
        by: ['categoryId'],
        where,
        _count: { id: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10,
      }),

      // By status
      prisma.crimeReport.groupBy({
        by: ['status'],
        where: { ...where, status: { not: 'PUBLISHED' } }, // exclude for status? no, keep all
        _count: { id: true },
      }),

      // By priority
      prisma.crimeReport.groupBy({
        by: ['priority'],
        where,
        _count: { id: true },
      }),

      // Last 6 months
      prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
        SELECT
          DATE_TRUNC('month', "incidentDate") as month,
          COUNT(*)::bigint as count
        FROM "CrimeReport"
        WHERE status = 'PUBLISHED'
          AND "incidentDate" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "incidentDate")
        ORDER BY month ASC
      `,
    ]
  );

  // Category names
  const catIds = categoryStats.map((c) => c.categoryId);
  const cats = await prisma.crimeCategory.findMany({
    where: { id: { in: catIds } },
    select: { id: true, code: true, name: true, nameBn: true },
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  return {
    totalReports,
    byCategory: categoryStats.map((c) => ({
      category: catMap.get(c.categoryId),
      count: c._count.id,
    })),
    byStatus: statusStats.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    byPriority: priorityStats.map((p) => ({
      priority: p.priority,
      count: p._count.id,
    })),
    monthly: monthlyStats.map((m) => ({
      month: m.month,
      count: Number(m.count),
    })),
  };
};

// ============================================================
// LOCATION DETAIL (Section 53)
//
// A specific location's crime breakdown
// ============================================================

export const getLocationDetail = async (locationId: string) => {
  // Check what type of location (try upazila, district, division)
  const [upazila, district, division] = await Promise.all([
    prisma.upazila.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        name: true,
        nameBn: true,
        district: {
          select: {
            name: true,
            nameBn: true,
            division: { select: { name: true, nameBn: true } },
          },
        },
      },
    }),
    prisma.district.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        name: true,
        nameBn: true,
        division: { select: { name: true, nameBn: true } },
      },
    }),
    prisma.division.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, nameBn: true },
    }),
  ]);

  let locationType: 'UPAZILA' | 'DISTRICT' | 'DIVISION';
  let locationInfo: any;
  let where: any = { status: 'PUBLISHED' };

  if (upazila) {
    locationType = 'UPAZILA';
    locationInfo = upazila;
    where.upazilaId = upazila.id;
  } else if (district) {
    locationType = 'DISTRICT';
    locationInfo = district;
    where.districtId = district.id;
  } else if (division) {
    locationType = 'DIVISION';
    locationInfo = division;
    where.divisionId = division.id;
  } else {
    throw new AppError('Location not found', 404, 'LOCATION_NOT_FOUND');
  }

  // Crime stats for this location
  const [totalReports, categoryStats, recentReports, coords] = await Promise.all([
    prisma.crimeReport.count({ where }),

    prisma.crimeReport.groupBy({
      by: ['categoryId'],
      where,
      _count: { id: true },
      orderBy: { _count: { categoryId: 'desc' } },
    }),

    prisma.crimeReport.findMany({
      where,
      orderBy: { incidentDate: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        category: { select: { code: true, nameBn: true } },
        incidentDate: true,
        priority: true,
      },
    }),

    prisma.crimeReport.aggregate({
      where: {
        ...where,
        latitude: { not: null },
        longitude: { not: null },
      },
      _avg: { latitude: true, longitude: true },
    }),
  ]);

  // Category names
  const catIds = categoryStats.map((c) => c.categoryId);
  const cats = await prisma.crimeCategory.findMany({
    where: { id: { in: catIds } },
    select: { id: true, code: true, name: true, nameBn: true },
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  return {
    location: {
      id: locationId,
      type: locationType,
      name: locationInfo.name,
      nameBn: locationInfo.nameBn,
      ...(locationInfo.district && { district: locationInfo.district }),
      ...(locationInfo.division && { division: locationInfo.division }),
    },
    coordinates: {
      latitude: coords._avg.latitude,
      longitude: coords._avg.longitude,
    },
    totalReports,
    byCategory: categoryStats.map((c) => ({
      category: catMap.get(c.categoryId),
      count: c._count.id,
    })),
    recentReports,
    heatLevel: computeHeatLevel(totalReports),
  };
};
