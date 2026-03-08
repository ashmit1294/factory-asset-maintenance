import mongoose from 'mongoose';
import Task, { ITask } from '@/models/Task';
import Machinery from '@/models/Machinery';
import User from '@/models/User';
import connectDB from '@/lib/db';
import { generateUniqueTaskCode } from '@/lib/taskCode';
import { applyVisibilityFilter } from '@/lib/visibility';
import { validateTransition, TransitionContext } from '@/lib/transitionGuard';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/errors';
import {
  Priority,
  TaskStatus,
  Role,
  SLA_HOURS,
  TERMINAL_STATES,
} from '@/types';

interface ActorUser {
  _id: string;
  role: Role;
  name: string;
}

interface CreateTaskInput {
  title: string;
  description: string;
  machineryId: string;
  priority: Priority;
}

interface ListTasksInput {
  role: Role;
  userId: string;
  searchParams: URLSearchParams;
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function createTask(
  input: CreateTaskInput,
  actor: ActorUser
): Promise<ITask> {
  await connectDB();

  // 1. Validate machinery exists and is ACTIVE
  const machine = await Machinery.findById(input.machineryId).lean();
  if (!machine) throw new NotFoundError('Machinery not found');
  if ((machine as { status: string }).status === 'DECOMMISSIONED') {
    throw new ValidationError('Cannot report a task for a decommissioned machine');
  }

  // 2. Soft duplicate detection (same user + same machine + open task in last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await Task.findOne({
    reportedBy: new mongoose.Types.ObjectId(actor._id),
    machineryId: new mongoose.Types.ObjectId(input.machineryId),
    status: { $nin: TERMINAL_STATES },
    createdAt: { $gte: oneDayAgo },
  })
    .select('taskCode _id')
    .lean();

  if (duplicate) {
    throw new ConflictError(
      JSON.stringify({
        warning: 'A similar task was recently reported.',
        existingTask: {
          taskCode: (duplicate as { taskCode: string }).taskCode,
          _id: (duplicate as { _id: unknown })._id,
        },
      })
    );
  }

  // 3. Calculate SLA deadline based on priority
  const slaHours = SLA_HOURS[input.priority];
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  // 4. Generate unique task code
  const taskCode = await generateUniqueTaskCode();

  // 5. Create task
  const task = await Task.create({
    taskCode,
    title: input.title,
    description: input.description,
    machineryId: input.machineryId,
    priority: input.priority,
    slaDeadline,
    status: 'REPORTED',
    reportedBy: actor._id,
    eventLog: [
      {
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'REPORTED',
        performedBy: {
          userId: actor._id,
          name: actor.name,
          role: actor.role,
        },
        note: 'Task reported',
        timestamp: new Date(),
      },
    ],
  });

  return task;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function listTasks(input: ListTasksInput) {
  await connectDB();

  const { role, userId, searchParams, page, limit, skip, sort } = input;

  // Role-based visibility filter
  const scopeFilter = applyVisibilityFilter(role, userId);

  // Build additional filters from query params
  const extraFilter: Record<string, unknown> = {};

  const status     = searchParams.get('status');
  const priority   = searchParams.get('priority');
  const machineId  = searchParams.get('machineryId');
  const assignedTo = searchParams.get('assignedTo');
  const reportedBy = searchParams.get('reportedBy');
  const breached   = searchParams.get('slaBreached');
  const search     = searchParams.get('search');

  if (status)     extraFilter.status      = status;
  if (priority)   extraFilter.priority    = priority;
  if (machineId)  extraFilter.machineryId = new mongoose.Types.ObjectId(machineId);
  if (assignedTo) extraFilter.assignedTo  = new mongoose.Types.ObjectId(assignedTo);
  if (reportedBy) extraFilter.reportedBy  = new mongoose.Types.ObjectId(reportedBy);
  if (breached)   extraFilter.slaBreached = breached === 'true';
  if (search)     extraFilter.$text       = { $search: search };

  const filter = { ...scopeFilter, ...extraFilter };

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('machineryId', 'name serialNumber location')
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  return {
    tasks,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export async function getTaskById(taskId: string, actor: ActorUser) {
  await connectDB();

  const scopeFilter = applyVisibilityFilter(actor.role, actor._id);

  const task = await Task.findOne({
    _id: taskId,
    ...scopeFilter,
  })
    .populate('machineryId', 'name serialNumber location type status')
    .populate('reportedBy', 'name email role')
    .populate('assignedTo', 'name email role');

  // Return 404 (not 403) to prevent task ID enumeration
  if (!task) throw new NotFoundError('Task not found');

  return task;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function assignTask(
  taskId: string,
  assignedTo: string,
  currentVersion: number,
  actor: ActorUser
) {
  await connectDB();

  // Validate technician
  const tech = await User.findById(assignedTo).select('role isActive name').lean() as {
    role: string; isActive: boolean; name: string;
  } | null;

  if (!tech) throw new NotFoundError('Technician not found');
  if (tech.role !== 'TECHNICIAN') throw new ValidationError('Assigned user must be a TECHNICIAN');
  if (!tech.isActive) throw new ValidationError('Cannot assign to a deactivated technician');

  // Atomic update with optimistic locking
  const updated = await Task.findOneAndUpdate(
    {
      _id: taskId,
      status: 'UNDER_REVIEW',
      __v: currentVersion,
    },
    {
      $set: { assignedTo, status: 'ASSIGNED' },
      $inc: { __v: 1 },
      $push: {
        eventLog: {
          action: 'ASSIGNED',
          fromStatus: 'UNDER_REVIEW',
          toStatus: 'ASSIGNED',
          performedBy: {
            userId: actor._id,
            name: actor.name,
            role: actor.role,
          },
          note: `Assigned to technician`,
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  )
    .populate('assignedTo', 'name email')
    .populate('machineryId', 'name serialNumber');

  if (!updated) {
    // Could be wrong version or wrong status — both treated as conflict
    const exists = await Task.exists({ _id: taskId });
    if (!exists) throw new NotFoundError('Task not found');
    throw new ConflictError(
      'Task was modified by another user. Please refresh and try again.'
    );
  }

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function transitionTaskStatus(
  taskId: string,
  nextStatus: TaskStatus,
  currentVersion: number,
  actor: ActorUser,
  ctx: TransitionContext = {}
) {
  await connectDB();

  const scopeFilter = applyVisibilityFilter(actor.role, actor._id);

  const task = await Task.findOne({ _id: taskId, ...scopeFilter });
  if (!task) throw new NotFoundError('Task not found');

  // Run all transition guards
  await validateTransition(task, nextStatus, actor, ctx);

  // Build update object
  const update: Record<string, unknown> = {
    status: nextStatus,
  };

  // Set required reason fields
  if (ctx.cancellationReason) update.cancellationReason = ctx.cancellationReason;
  if (ctx.rejectionReason)    update.rejectionReason    = ctx.rejectionReason;
  if (ctx.pauseReason)        update.pauseReason        = ctx.pauseReason;
  if (ctx.reopenReason)       update.reopenReason       = ctx.reopenReason;

  // Server-set timestamps — NEVER from client
  if (nextStatus === 'COMPLETED')  update.completedAt  = new Date();
  if (nextStatus === 'CONFIRMED')  update.confirmedAt  = new Date();
  if (nextStatus === 'ESCALATED')  update.escalatedAt  = new Date();

  // Clear assignedTo when reopened and reassigned
  if (nextStatus === 'ASSIGNED' && ctx.assignedTo) {
    update.assignedTo = ctx.assignedTo;
  }

  // Optimistic lock + status transition
  const updated = await Task.findOneAndUpdate(
    { _id: taskId, __v: currentVersion },
    {
      $set: update,
      $inc: { __v: 1 },
      $push: {
        eventLog: {
          action: 'STATUS_CHANGED',
          fromStatus: task.status,
          toStatus: nextStatus,
          performedBy: {
            userId: actor._id,
            name: actor.name,
            role: actor.role,
          },
          note: ctx.note || ctx.cancellationReason || ctx.rejectionReason || ctx.pauseReason || ctx.reopenReason || '',
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new ConflictError(
      'Task was modified by another user. Please refresh and try again.'
    );
  }

  // Auto-append to machinery maintenance history on CONFIRMED
  if (nextStatus === 'CONFIRMED') {
    await Machinery.findByIdAndUpdate(task.machineryId, {
      $push: {
        maintenanceHistory: {
          taskId: task._id,
          taskCode: task.taskCode,
          resolvedAt: new Date(),
          summary: task.title,
        },
      },
    });
  }

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function getEventLog(taskId: string, actor: ActorUser) {
  await connectDB();

  const task = await Task.findById(taskId).select('eventLog reportedBy').lean();
  if (!task) throw new NotFoundError('Task not found');

  return (task as { eventLog: unknown[] }).eventLog;
}