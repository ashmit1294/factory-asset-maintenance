import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getTaskById } from '@/services/TaskService';
import { successResponse, errorResponse } from '@/lib/apiHelper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    const task = await getTaskById(id, {
      _id: actor._id,
      role: actor.role,
      name: actor.name,
    });

    return successResponse(task);
  } catch (error) {
    return errorResponse(error);
  }
}