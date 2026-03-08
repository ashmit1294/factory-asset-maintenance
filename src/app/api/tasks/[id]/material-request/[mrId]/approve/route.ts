import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { approveMaterialRequest } from '@/services/MaterialService';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string; mrId: string }>;
}

// ── PATCH /api/tasks/:id/material-request/:mrId/approve ───────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id, mrId } = await params;

    // Only MANAGER or SENIOR_MANAGER can approve
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can approve material requests'
      );
    }

    const result = await approveMaterialRequest(id, mrId, {
      _id: actor._id,
      role: actor.role,
      name: actor.name,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}