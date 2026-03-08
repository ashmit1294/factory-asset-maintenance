import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { rejectMaterialRequest } from '@/services/MaterialService';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError, ValidationError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string; mrId: string }>;
}

// ── PATCH /api/tasks/:id/material-request/:mrId/reject ────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id, mrId } = await params;

    // Only MANAGER or SENIOR_MANAGER can reject
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can reject material requests'
      );
    }

    const body = await req.json();
    const { rejectionNote } = body;

    if (!rejectionNote?.trim()) {
      throw new ValidationError(
        'rejectionNote is required when rejecting a material request'
      );
    }

    const result = await rejectMaterialRequest(
      id,
      mrId,
      rejectionNote.trim(),
      {
        _id: actor._id,
        role: actor.role,
        name: actor.name,
      }
    );

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}