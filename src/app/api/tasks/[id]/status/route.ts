import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { transitionTaskStatus } from '@/services/TaskService';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ValidationError } from '@/lib/errors';
import { TaskStatus } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: TaskStatus[] = [
  'REPORTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'MATERIAL_REQUESTED',
  'PAUSED',
  'ESCALATED',
  'COMPLETED',
  'REOPENED',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
];

// ── PATCH /api/tasks/:id/status ───────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;
    const body = await req.json();

    const {
      nextStatus,
      __v,
      cancellationReason,
      rejectionReason,
      pauseReason,
      reopenReason,
      assignedTo,
      note,
    } = body;

    // Validate nextStatus
    if (!nextStatus) {
      throw new ValidationError('nextStatus is required');
    }
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw new ValidationError(
        `nextStatus must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }

    // Validate __v is present (required for optimistic locking)
    if (__v === undefined || __v === null) {
      throw new ValidationError(
        '__v (version) is required for state transitions'
      );
    }

    const updated = await transitionTaskStatus(
      id,
      nextStatus as TaskStatus,
      parseInt(__v, 10),
      {
        _id: actor._id,
        role: actor.role,
        name: actor.name,
      },
      {
        cancellationReason,
        rejectionReason,
        pauseReason,
        reopenReason,
        assignedTo,
        note,
      }
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}