import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { assignTask } from '@/services/TaskService';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ValidationError, ForbiddenError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── PATCH /api/tasks/:id/assign ───────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    // Only MANAGER or SENIOR_MANAGER can assign
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError('Only MANAGER or SENIOR_MANAGER can assign tasks');
    }

    const body = await req.json();
    const { assignedTo, __v } = body;

    if (!assignedTo?.trim()) {
      throw new ValidationError('assignedTo (technician userId) is required');
    }

    if (__v === undefined || __v === null) {
      throw new ValidationError(
        '__v (version) is required for assignment to prevent race conditions'
      );
    }

    const updated = await assignTask(
      id,
      assignedTo.trim(),
      parseInt(__v, 10),
      {
        _id: actor._id,
        role: actor.role,
        name: actor.name,
      }
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}