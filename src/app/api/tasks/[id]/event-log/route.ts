import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getEventLog } from '@/services/TaskService';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/tasks/:id/event-log ──────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    // Only MANAGER and SENIOR_MANAGER can view the full audit trail
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can view the event log'
      );
    }

    const eventLog = await getEventLog(id, {
      _id: actor._id,
      role: actor.role,
      name: actor.name,
    });

    return successResponse(eventLog);
  } catch (error) {
    return errorResponse(error);
  }
}