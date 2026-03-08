import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Inventory from '@/models/Inventory';
import { successResponse, errorResponse } from '@/lib/apiHelper';
import { ForbiddenError } from '@/lib/errors';

// ── GET /api/inventory ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthUser(req);

    // Only MANAGER and SENIOR_MANAGER can view inventory
    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MANAGER') {
      throw new ForbiddenError(
        'Only MANAGER or SENIOR_MANAGER can view inventory'
      );
    }

    await connectDB();

    const { searchParams } = req.nextUrl;
    const search      = searchParams.get('search');
    const lowStock    = searchParams.get('lowStock');

    const filter: Record<string, unknown> = {};

    if (search?.trim()) {
      filter.itemName = { $regex: search.trim(), $options: 'i' };
    }

    // Filter items at or below reorder level
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    }

    const items = await Inventory.find(filter)
      .sort({ itemName: 1 })
      .lean();

    // Annotate each item with lowStock flag
    const annotated = items.map((item) => ({
      ...item,
      isLowStock: item.quantity <= item.reorderLevel,
    }));

    return successResponse(annotated);
  } catch (error) {
    return errorResponse(error);
  }
}