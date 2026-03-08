import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Machinery from '@/models/Machinery';
import { successResponse, errorResponse } from '@/lib/apiHelper';

// ── GET /api/machinery ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await getAuthUser(req);
    await connectDB();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const filter: Record<string, unknown> = {};

    if (status && ['ACTIVE', 'DECOMMISSIONED'].includes(status)) {
      filter.status = status;
    } else {
      // Default: only return ACTIVE machines in dropdown/list
      filter.status = 'ACTIVE';
    }

    if (search?.trim()) {
      filter.$or = [
        { name:         { $regex: search.trim(), $options: 'i' } },
        { serialNumber: { $regex: search.trim(), $options: 'i' } },
        { location:     { $regex: search.trim(), $options: 'i' } },
        { type:         { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const machines = await Machinery.find(filter)
      .select('name serialNumber location type status createdAt')
      .sort({ name: 1 })
      .lean();

    return successResponse(machines);
  } catch (error) {
    return errorResponse(error);
  }
}