import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  createMaterialRequest,
  listMaterialRequests,
} from '@/services/MaterialService';
import {
  successResponse,
  errorResponse,
} from '@/lib/apiHelper';
import { ValidationError, ForbiddenError } from '@/lib/errors';
import { Unit } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_UNITS: Unit[] = ['pcs', 'kg', 'litres', 'metres', 'boxes'];

// ── GET /api/tasks/:id/material-requests ──────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    const requests = await listMaterialRequests(id, {
      _id: actor._id,
      role: actor.role,
      name: actor.name,
    });

    return successResponse(requests);
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/tasks/:id/material-request ──────────────────────────────────────
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    // Only TECHNICIAN can create material requests
    if (actor.role !== 'TECHNICIAN') {
      throw new ForbiddenError('Only TECHNICIAN can request materials');
    }

    const body = await req.json();
    const { items } = body;

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError(
        'items must be a non-empty array'
      );
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.name?.trim()) {
        throw new ValidationError(`items[${i}].name is required`);
      }
      if (item.name.trim().length < 1) {
        throw new ValidationError(`items[${i}].name cannot be empty`);
      }
      if (item.quantity === undefined || item.quantity === null) {
        throw new ValidationError(`items[${i}].quantity is required`);
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        throw new ValidationError(
          `items[${i}].quantity must be a number of at least 1`
        );
      }
      if (!item.unit) {
        throw new ValidationError(`items[${i}].unit is required`);
      }
      if (!VALID_UNITS.includes(item.unit)) {
        throw new ValidationError(
          `items[${i}].unit must be one of: ${VALID_UNITS.join(', ')}`
        );
      }
    }

    // Sanitize items
    const sanitizedItems = items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit as Unit,
    }));

    const mr = await createMaterialRequest(id, sanitizedItems, {
      _id: actor._id,
      role: actor.role,
      name: actor.name,
    });

    return successResponse(mr, 201);
  } catch (error) {
    return errorResponse(error);
  }
}