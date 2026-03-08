import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Machinery from '@/models/Machinery';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/machinery/:id/history ────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await getAuthUser(req);
    const { id } = await params;

    // Only MANAGER and SENIOR_MANAGER can view maintenance history
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can view maintenance history'
      );
    }

    await connectDB();

    const machine = await Machinery.findById(id)
      .select('name serialNumber location type status maintenanceHistory')
      .lean();

    if (!machine) {
      throw new NotFoundError('Machinery not found');
    }

    return successResponse({
      machinery: {
        _id:          machine._id,
        name:         machine.name,
        serialNumber: machine.serialNumber,
        location:     machine.location,
        type:         machine.type,
        status:       machine.status,
      },
      maintenanceHistory: (machine as {
        maintenanceHistory: unknown[]
      }).maintenanceHistory ?? [],
      totalRecords: ((machine as {
        maintenanceHistory: unknown[]
      }).maintenanceHistory ?? []).length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}