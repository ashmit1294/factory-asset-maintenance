import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError } from '@/lib/errors';

// ── GET /api/users/technicians ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthUser(req);

    // Only MANAGER and SENIOR_MANAGER can list technicians
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can view the technician list'
      );
    }

    await connectDB();

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search');

    const filter: Record<string, unknown> = {
      role:     'TECHNICIAN',
      isActive: true,
    };

    if (search?.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const technicians = await User.find(filter)
      .select('name email isActive createdAt')
      .sort({ name: 1 })
      .lean();

    return successResponse(technicians);
  } catch (error) {
    return errorResponse(error);
  }
}