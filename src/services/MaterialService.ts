import mongoose from 'mongoose';
import Task from '@/models/Task';
import MaterialRequest from '@/models/MaterialRequest';
import Inventory from '@/models/Inventory';
import connectDB from '@/lib/db';
import { applyMaterialVisibilityFilter } from '@/lib/visibility';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  InsufficientInventoryError,
} from '@/lib/errors';
import { Role, IMaterialItem } from '@/types';

interface ActorUser {
  _id: string;
  role: Role;
  name: string;
}

const ESCALATION_THRESHOLD = parseInt(
  process.env.ESCALATION_REJECTION_THRESHOLD || '3',
  10
);

// ─────────────────────────────────────────────────────────────────────────────
export async function createMaterialRequest(
  taskId: string,
  items: IMaterialItem[],
  actor: ActorUser
) {
  await connectDB();

  // Validate task exists and technician is assigned to it
  const task = await Task.findById(taskId).select('status assignedTo');
  if (!task) throw new NotFoundError('Task not found');

  if (task.status !== 'IN_PROGRESS') {
    throw new ValidationError(
      'Material requests can only be created when task is IN_PROGRESS'
    );
  }

  if (!task.assignedTo || task.assignedTo.toString() !== actor._id) {
    throw new ForbiddenError('Only the assigned technician can request materials');
  }

  // Guard: no other PENDING material request on this task
  const activeMR = await MaterialRequest.findOne({
    taskId,
    status: 'PENDING',
  });
  if (activeMR) {
    throw new ConflictError(
      'A material request is already pending for this task. Wait for the manager to respond.'
    );
  }

  // Validate items
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one item is required');
  }

  // Create material request
  const mr = await MaterialRequest.create({
    taskId,
    requestedBy: actor._id,
    items,
    status: 'PENDING',
    rejectionCount: 0,
  });

  // Transition task to MATERIAL_REQUESTED
  await Task.findByIdAndUpdate(
    taskId,
    {
      $set: { status: 'MATERIAL_REQUESTED' },
      $push: {
        eventLog: {
          action: 'MATERIAL_REQUESTED',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'MATERIAL_REQUESTED',
          performedBy: {
            userId: actor._id,
            name: actor.name,
            role: actor.role,
          },
          note: `Requested ${items.length} item(s)`,
          timestamp: new Date(),
        },
      },
    }
  );

  return mr;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function approveMaterialRequest(
  taskId: string,
  mrId: string,
  actor: ActorUser
) {
  await connectDB();

  const mr = await MaterialRequest.findOne({ _id: mrId, taskId, status: 'PENDING' });
  if (!mr) throw new NotFoundError('Pending material request not found');

  const task = await Task.findById(taskId).select('status title taskCode');
  if (!task) throw new NotFoundError('Task not found');

  // ── MongoDB Transaction: approve MR + deduct inventory atomically ──────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Approve the material request
    await MaterialRequest.findByIdAndUpdate(
      mrId,
      {
        $set: {
          status: 'APPROVED',
          approvedBy: actor._id,
        },
      },
      { session }
    );

    // 2. Deduct each item from inventory (guard against negative stock)
    for (const item of mr.items) {
      const updated = await Inventory.findOneAndUpdate(
        {
          itemName: item.name.toLowerCase(),
          quantity: { $gte: item.quantity }, // guard: won't update if insufficient
        },
        {
          $inc: { quantity: -item.quantity },
        },
        { session, new: true }
      );

      if (!updated) {
        // Check if item exists at all or just insufficient
        const exists = await Inventory.findOne(
          { itemName: item.name.toLowerCase() },
          { quantity: 1 },
          { session }
        );
        if (!exists) {
          throw new InsufficientInventoryError(
            `${item.name} (item not found in inventory)`
          );
        }
        throw new InsufficientInventoryError(item.name);
      }
    }

    // 3. Transition task back to IN_PROGRESS
    await Task.findByIdAndUpdate(
      taskId,
      {
        $set: { status: 'IN_PROGRESS' },
        $push: {
          eventLog: {
            action: 'MATERIAL_APPROVED',
            fromStatus: 'MATERIAL_REQUESTED',
            toStatus: 'IN_PROGRESS',
            performedBy: {
              userId: actor._id,
              name: actor.name,
              role: actor.role,
            },
            note: 'Materials approved, inventory deducted',
            timestamp: new Date(),
          },
        },
      },
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }

  return { message: 'Material request approved and inventory updated' };
}

// ─────────────────────────────────────────────────────────────────────────────
export async function rejectMaterialRequest(
  taskId: string,
  mrId: string,
  rejectionNote: string,
  actor: ActorUser
) {
  await connectDB();

  if (!rejectionNote?.trim()) {
    throw new ValidationError('rejectionNote is required when rejecting a material request');
  }

  const mr = await MaterialRequest.findOne({ _id: mrId, taskId, status: 'PENDING' });
  if (!mr) throw new NotFoundError('Pending material request not found');

  const newRejectionCount = mr.rejectionCount + 1;
  const shouldEscalate = newRejectionCount >= ESCALATION_THRESHOLD;

  // Update material request
  await MaterialRequest.findByIdAndUpdate(mrId, {
    $set: {
      status: 'REJECTED',
      rejectionNote: rejectionNote.trim(),
      approvedBy: actor._id, // tracks who rejected (last actor)
    },
    $inc: { rejectionCount: 1 },
  });

  const nextTaskStatus = shouldEscalate ? 'ESCALATED' : 'MATERIAL_REQUESTED';
  const eventAction    = shouldEscalate ? 'ESCALATED' : 'MATERIAL_REJECTED';

  const taskUpdate: Record<string, unknown> = {
    status: nextTaskStatus,
  };
  if (shouldEscalate) {
    taskUpdate.escalatedAt = new Date();
  }

  await Task.findByIdAndUpdate(taskId, {
    $set: taskUpdate,
    $push: {
      eventLog: {
        action: eventAction,
        fromStatus: 'MATERIAL_REQUESTED',
        toStatus: nextTaskStatus,
        performedBy: {
          userId: actor._id,
          name: actor.name,
          role: actor.role,
        },
        note: shouldEscalate
          ? `Auto-escalated after ${newRejectionCount} rejections. Reason: ${rejectionNote}`
          : `Material request rejected. Reason: ${rejectionNote}`,
        timestamp: new Date(),
      },
    },
  });

  return {
    escalated: shouldEscalate,
    rejectionCount: newRejectionCount,
    message: shouldEscalate
      ? `Task escalated after ${newRejectionCount} consecutive rejections`
      : 'Material request rejected',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export async function listMaterialRequests(
  taskId: string,
  actor: ActorUser
) {
  await connectDB();

  const task = await Task.findById(taskId).select('_id').lean();
  if (!task) throw new NotFoundError('Task not found');

  const visibilityFilter = applyMaterialVisibilityFilter(actor.role, actor._id);

  const requests = await MaterialRequest.find({
    taskId,
    ...visibilityFilter,
  })
    .populate('requestedBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return requests;
}