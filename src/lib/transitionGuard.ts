import { TaskStatus, Role } from '@/types';
import {
  ForbiddenError,
  ValidationError,
  InvalidTransitionError,
  NotFoundError,
} from '@/lib/errors';
import User from '../models/User';
import MaterialRequest from '../models/MaterialRequest';

export interface TransitionContext {
  assignedTo?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  pauseReason?: string;
  reopenReason?: string;
  note?: string;
}

export interface TaskSnapshot {
  _id: string;
  status: TaskStatus;
  assignedTo?: { toString(): string } | null;
  reportedBy: { toString(): string };
  __v: number;
}

export interface ActorUser {
  _id: string;
  role: Role;
  name: string;
}

const MANAGER_ROLES: Role[] = ['MANAGER', 'SENIOR_MANAGER'];

// All valid transitions and who can perform them
const VALID_TRANSITIONS: Record<string, Role[]> = {
  'REPORTED→UNDER_REVIEW':           MANAGER_ROLES,
  'REPORTED→CANCELLED':              MANAGER_ROLES,
  'UNDER_REVIEW→ASSIGNED':           MANAGER_ROLES,
  'UNDER_REVIEW→REJECTED':           MANAGER_ROLES,
  'UNDER_REVIEW→CANCELLED':          MANAGER_ROLES,
  'ASSIGNED→IN_PROGRESS':            ['TECHNICIAN'],
  'ASSIGNED→CANCELLED':              MANAGER_ROLES,
  'IN_PROGRESS→MATERIAL_REQUESTED':  ['TECHNICIAN'],
  'IN_PROGRESS→PAUSED':              MANAGER_ROLES,
  'IN_PROGRESS→COMPLETED':           ['TECHNICIAN'],
  'MATERIAL_REQUESTED→IN_PROGRESS':  MANAGER_ROLES,
  'MATERIAL_REQUESTED→CANCELLED':    MANAGER_ROLES,
  'ESCALATED→IN_PROGRESS':           MANAGER_ROLES,
  'ESCALATED→CANCELLED':             MANAGER_ROLES,
  'PAUSED→IN_PROGRESS':              MANAGER_ROLES,
  'PAUSED→CANCELLED':                MANAGER_ROLES,
  'COMPLETED→CONFIRMED':             MANAGER_ROLES,
  'COMPLETED→REOPENED':              MANAGER_ROLES,
  'REOPENED→IN_PROGRESS':            ['TECHNICIAN'],
  'REOPENED→ASSIGNED':               MANAGER_ROLES,
};

// Transitions that require a cancellationReason
const REQUIRES_CANCELLATION_REASON = new Set([
  'REPORTED→CANCELLED',
  'UNDER_REVIEW→CANCELLED',
  'ASSIGNED→CANCELLED',
  'MATERIAL_REQUESTED→CANCELLED',
  'ESCALATED→CANCELLED',
  'PAUSED→CANCELLED',
]);

export async function validateTransition(
  task: TaskSnapshot,
  nextStatus: TaskStatus,
  actor: ActorUser,
  ctx: TransitionContext = {}
): Promise<void> {
  const key = `${task.status}→${nextStatus}`;

  // ── 1. Check transition exists ──────────────────────────────────────────
  const allowedRoles = VALID_TRANSITIONS[key];
  if (!allowedRoles) {
    throw new InvalidTransitionError(task.status, nextStatus);
  }

  // ── 2. Check actor role is allowed ──────────────────────────────────────
  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenError(
      `Role '${actor.role}' cannot perform transition: ${key}`
    );
  }

  // ── 3. Technician must be the assignedTo user ───────────────────────────
  if (actor.role === 'TECHNICIAN') {
    const assignedId = task.assignedTo?.toString();
    if (!assignedId || assignedId !== actor._id) {
      throw new ForbiddenError(
        'Only the assigned technician can perform this action'
      );
    }
  }

  // ── 4. Required reason fields ────────────────────────────────────────────
  if (REQUIRES_CANCELLATION_REASON.has(key)) {
    if (!ctx.cancellationReason?.trim()) {
      throw new ValidationError('cancellationReason is required for cancellation');
    }
  }

  if (key === 'UNDER_REVIEW→REJECTED') {
    if (!ctx.rejectionReason?.trim()) {
      throw new ValidationError('rejectionReason is required to reject a task');
    }
  }

  if (key === 'IN_PROGRESS→PAUSED') {
    if (!ctx.pauseReason?.trim()) {
      throw new ValidationError('pauseReason is required to pause a task');
    }
  }

  if (key === 'COMPLETED→REOPENED') {
    if (!ctx.reopenReason?.trim()) {
      throw new ValidationError('reopenReason is required to reopen a task');
    }
  }

  // ── 5. Assign transition: validate technician ────────────────────────────
  if (key === 'UNDER_REVIEW→ASSIGNED' || key === 'REOPENED→ASSIGNED') {
    if (!ctx.assignedTo?.trim()) {
      throw new ValidationError('assignedTo is required for task assignment');
    }

    const tech = await User.findById(ctx.assignedTo)
      .select('role isActive')
      .lean() as { role: string; isActive: boolean } | null;

    if (!tech) {
      throw new NotFoundError('Technician not found');
    }
    if (tech.role !== 'TECHNICIAN') {
      throw new ValidationError('The assigned user must have the TECHNICIAN role');
    }
    if (!tech.isActive) {
      throw new ValidationError('Cannot assign to a deactivated technician');
    }
  }

  // ── 6. Conflict of interest: manager cannot confirm own reported task ────
  if (key === 'COMPLETED→CONFIRMED') {
    const reportedById = task.reportedBy.toString();

    if (reportedById === actor._id) {
      const otherActiveManagers = await User.countDocuments({
        role: { $in: MANAGER_ROLES },
        isActive: true,
        _id: { $ne: actor._id },
      });

      if (otherActiveManagers > 0) {
        throw new ForbiddenError(
          'You cannot confirm a task that you reported. Another manager must confirm it.'
        );
      }
      // Sole manager in system — allow but caller should log a warning note in eventLog
    }
  }

  // ── 7. Escalation: last rejecter cannot resolve ──────────────────────────
  if (key === 'ESCALATED→IN_PROGRESS') {
    const lastMR = await MaterialRequest.findOne(
      { taskId: task._id },
      { approvedBy: 1 },
      { sort: { createdAt: -1 } }
    ).lean() as { approvedBy?: { toString(): string } } | null;

    if (lastMR?.approvedBy?.toString() === actor._id) {
      throw new ForbiddenError(
        'The manager who last rejected the material request cannot resolve this escalation'
      );
    }
  }
}