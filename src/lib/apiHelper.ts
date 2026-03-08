import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';

export function successResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function paginatedResponse(
  data: unknown[],
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
): NextResponse {
  return NextResponse.json({ data, meta }, { status: 200 });
}

export function errorResponse(error: unknown): NextResponse {
  const { message, code, statusCode } = handleApiError(error);
  return NextResponse.json({ error: message, code }, { status: statusCode });
}

export function getPaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

export function getSortParams(searchParams: URLSearchParams): Record<string, 1 | -1> {
  const sortBy    = searchParams.get('sortBy')    || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
  const allowed   = ['createdAt', 'updatedAt', 'priority', 'slaDeadline', 'status'];
  const field     = allowed.includes(sortBy) ? sortBy : 'createdAt';
  return { [field]: sortOrder };
}