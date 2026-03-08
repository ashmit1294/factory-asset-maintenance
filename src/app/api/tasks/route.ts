import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createTask, listTasks } from '@/services/TaskService';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  getPaginationParams,
  getSortParams,
} from '@/lib/apiHelper';
import { ValidationError } from '@/lib/errors';
import { Priority } from '@/types';

// ── GET /api/tasks ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthUser(req);
    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const sort = getSortParams(searchParams);

    const { tasks, meta } = await listTasks({
      role: actor.role,
      userId: actor._id,
      searchParams,
      page,
      limit,
      skip,
      sort,
    });

    return paginatedResponse(tasks, meta);
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthUser(req);
    const body = await req.json();

    const { title, description, machineryId, priority } = body;

    // Input validation
    if (!title?.trim()) {
      throw new ValidationError('title is required');
    }
    if (title.trim().length < 3) {
      throw new ValidationError('title must be at least 3 characters');
    }
    if (!description?.trim()) {
      throw new ValidationError('description is required');
    }
    if (description.trim().length < 10) {
      throw new ValidationError('description must be at least 10 characters');
    }
    if (!machineryId?.trim()) {
      throw new ValidationError('machineryId is required');
    }

    const validPriorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!priority || !validPriorities.includes(priority)) {
      throw new ValidationError(
        'priority must be one of: LOW, MEDIUM, HIGH, CRITICAL'
      );
    }

    const task = await createTask(
      {
        title: title.trim(),
        description: description.trim(),
        machineryId: machineryId.trim(),
        priority,
      },
      {
        _id: actor._id,
        role: actor.role,
        name: actor.name,
      }
    );

    return successResponse(task, 201);
  } catch (error) {
    // Handle soft duplicate — ConflictError with JSON payload
    if (
      error instanceof Error &&
      error.constructor.name === 'ConflictError'
    ) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.warning) {
          return new Response(JSON.stringify(parsed), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // Not a JSON payload, fall through to standard error handler
      }
    }
    return errorResponse(error);
  }
}