import mongoose from 'mongoose';
import { Role } from '@/types';

export function applyVisibilityFilter(
  role: Role,
  userId: string
): Record<string, unknown> {
  const id = new mongoose.Types.ObjectId(userId);

  switch (role) {
    case 'USER':
      return { reportedBy: id };

    case 'TECHNICIAN':
      return { assignedTo: id };

    case 'MANAGER':
    case 'SENIOR_MANAGER':
      return {};

    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

export function applyMaterialVisibilityFilter(
  role: Role,
  userId: string
): Record<string, unknown> {
  if (role === 'TECHNICIAN') {
    return { requestedBy: new mongoose.Types.ObjectId(userId) };
  }
  return {};
}