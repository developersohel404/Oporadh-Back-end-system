export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const getPagination = (query: {
  page?: string | number;
  limit?: string | number;
}): PaginationParams => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

export const buildMeta = (total: number, page: number, limit: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
