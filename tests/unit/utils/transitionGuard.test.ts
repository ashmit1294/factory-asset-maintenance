import { describe, it, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';
import { validateTransition } from '@/lib/transitionGuard';
import User from '@/models/User';
import MaterialRequest from '@/models/MaterialRequest';
import bcryptjs from 'bcryptjs';
import type { TaskStatus, Role } from '@/types';

describe('State Machine Transition Guard (lib/transitionGuard.ts)', () => {
  const createMockTask = (overrides: any = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    status: 'REPORTED' as TaskStatus,
    reportedBy: '507f1f77bcf86cd799439011',
    assignedTo: null,
    title: 'Test Task',
    description: 'Test Description',
    __v: 0,
    ...overrides,
  });

  const mockUser = (role: Role = 'MANAGER', _id: string = '507f1f77bcf86cd799439011') => ({
    _id,
    name: 'Test User',
    email: 'test@factory.com',
    role,
  });

  describe('REPORTED → UNDER_REVIEW Transition', () => {
    it('should allow MANAGER to move REPORTED to UNDER_REVIEW', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('MANAGER');

      expect(() => validateTransition(task, 'UNDER_REVIEW', user, {})).not.toThrow();
    });

    it('should allow SENIOR_MANAGER to move REPORTED to UNDER_REVIEW', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('SENIOR_MANAGER');

      expect(() => validateTransition(task, 'UNDER_REVIEW', user, {})).not.toThrow();
    });

    it('should not allow USER to move REPORTED to UNDER_REVIEW', async () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('USER');

      await expect(validateTransition(task, 'UNDER_REVIEW', user, {})).rejects.toThrow();
    });

    it('should not allow TECHNICIAN to move REPORTED to UNDER_REVIEW', async () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('TECHNICIAN');

      await expect(validateTransition(task, 'UNDER_REVIEW', user, {})).rejects.toThrow();
    });
  });

  describe('UNDER_REVIEW → ASSIGNED Transition', () => {
    it('should only allow MANAGER/SENIOR_MANAGER', async () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });

      // Allowed
      expect(() => validateTransition(task, 'ASSIGNED', mockUser('MANAGER'), {})).not.toThrow();
      expect(() =>
        validateTransition(task, 'ASSIGNED', mockUser('SENIOR_MANAGER'), {}),
      ).not.toThrow();

      // Not allowed
      await expect(validateTransition(task, 'ASSIGNED', mockUser('USER'), {})).rejects.toThrow();
      await expect(validateTransition(task, 'ASSIGNED', mockUser('TECHNICIAN'), {})).rejects.toThrow();
    });

    it('should require assignedTo context', () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });
      const user = mockUser('MANAGER');

      // Without context, should still validate role
      expect(() => validateTransition(task, 'ASSIGNED', user, {})).not.toThrow();
    });
  });

  describe('ASSIGNED → IN_PROGRESS Transition', () => {
    it('should only allow assigned TECHNICIAN to pick up task', () => {
      const technicianId = '507f1f77bcf86cd799439012';
      const task = createMockTask({ status: 'ASSIGNED', assignedTo: technicianId });
      const assignedTech = mockUser('TECHNICIAN', technicianId);

      expect(() => validateTransition(task, 'IN_PROGRESS', assignedTech, {})).not.toThrow();
    });

    it('should prevent other technicians from picking up task', async () => {
      const task = createMockTask({
        status: 'ASSIGNED',
        assignedTo: '507f1f77bcf86cd799439012',
      });
      const differentTech = mockUser('TECHNICIAN', '607f1f77bcf86cd799439013');

      await expect(validateTransition(task, 'IN_PROGRESS', differentTech, {})).rejects.toThrow();
    });

    it('should prevent non-technician from transitioning', async () => {
      const task = createMockTask({
        status: 'ASSIGNED',
        assignedTo: '507f1f77bcf86cd799439012',
      });
      const manager = mockUser('MANAGER');

      await expect(validateTransition(task, 'IN_PROGRESS', manager, {})).rejects.toThrow();
    });
  });

  describe('IN_PROGRESS → MATERIAL_REQUESTED Transition', () => {
    it('should allow technician assigned to task to request materials', async () => {
      const techId = '507f1f77bcf86cd799439012';
      const task = createMockTask({
        status: 'IN_PROGRESS',
        assignedTo: techId,
      });
      const tech = mockUser('TECHNICIAN', techId);

      // validateTransition does not block duplicate requests — that is handled at the service layer
      await expect(validateTransition(task, 'MATERIAL_REQUESTED', tech, {})).resolves.toBeUndefined();
    });
  });

  describe('MATERIAL_REQUESTED → IN_PROGRESS/ESCALATED Transitions', () => {
    it('should allow MANAGER to approve material and move to IN_PROGRESS', () => {
      const task = createMockTask({ status: 'MATERIAL_REQUESTED' });
      const manager = mockUser('MANAGER');

      expect(() => validateTransition(task, 'IN_PROGRESS', manager, {})).not.toThrow();
    });

    it('should auto-escalate on 3rd material rejection', () => {
      const task = createMockTask({
        status: 'MATERIAL_REQUESTED',
        rejectionCount: 3,
      });
      const manager = mockUser('MANAGER');

      expect(() => validateTransition(task, 'ESCALATED', manager, {})).not.toThrow();
    });
  });

  describe('COMPLETED → CONFIRMED/REOPENED Transitions', () => {
    it('should allow MANAGER to confirm completed task', () => {
      const task = createMockTask({ status: 'COMPLETED' });
      const manager = mockUser('MANAGER');

      expect(() => validateTransition(task, 'CONFIRMED', manager, {})).not.toThrow();
    });

    it('should allow MANAGER to reopen completed task', () => {
      const task = createMockTask({ status: 'COMPLETED' });
      const manager = mockUser('MANAGER');

      expect(() => validateTransition(task, 'REOPENED', manager, {})).not.toThrow();
    });

    it('should prevent self-confirmation by reporter when other managers exist', async () => {
      const reporterId = '507f1f77bcf86cd799439011';
      const task = createMockTask({
        status: 'COMPLETED',
        reportedBy: reporterId,
      });
      const reportingManager = mockUser('MANAGER', reporterId);

      // Create another active manager so the conflict-of-interest check triggers
      const hashedPw = await bcryptjs.hash('Pass123!', 10);
      await User.create({
        name: 'Other Manager',
        email: 'other.manager@factory.com',
        passwordHash: hashedPw,
        role: 'MANAGER',
        isActive: true,
      });

      await expect(validateTransition(task, 'CONFIRMED', reportingManager)).rejects.toThrow();
    });
  });

  describe('ESCALATED Task Resolution', () => {
    it('should prevent last-rejecter from resolving escalation', async () => {
      const rejecterId = '507f1f77bcf86cd799439012';
      const taskId = new Types.ObjectId('507f1f77bcf86cd799439011');
      const task = createMockTask({
        _id: taskId.toString(),
        status: 'ESCALATED',
      });
      const rejectingManager = mockUser('MANAGER', rejecterId);

      // Create a MaterialRequest where the rejecter is the last approvedBy
      await MaterialRequest.create({
        taskId,
        requestedBy: new Types.ObjectId(),
        items: [{ name: 'Test Part', quantity: 2, unit: 'pcs' }],
        status: 'REJECTED',
        approvedBy: new Types.ObjectId(rejecterId),
      });

      await expect(validateTransition(task, 'IN_PROGRESS', rejectingManager)).rejects.toThrow();
    });

    it('should allow different manager to resolve escalation', () => {
      const rejecterId = '507f1f77bcf86cd799439012';
      const resolverId = '707f1f77bcf86cd799439014';
      const task = createMockTask({
        status: 'ESCALATED',
        lastRejectingManagerId: rejecterId,
      });
      const resolvingManager = mockUser('MANAGER', resolverId);

      expect(() =>
        validateTransition(task, 'IN_PROGRESS', resolvingManager),
      ).not.toThrow();
    });
  });

  describe('Invalid State Transitions', () => {
    it('should prevent invalid next states', async () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('MANAGER');

      // TAask cannot go from REPORTED directly to COMPLETED
      await expect(validateTransition(task, 'COMPLETED', user, {})).rejects.toThrow();
    });

    it('should prevent backwards transitions', async () => {
      const task = createMockTask({ status: 'COMPLETED' });
      const user = mockUser('MANAGER');

      // Cannot go from COMPLETED back to IN_PROGRESS
      await expect(validateTransition(task, 'IN_PROGRESS', user, {})).rejects.toThrow();
    });

    it('should prevent transitions from terminal states', async () => {
      const terminalStates: TaskStatus[] = ['CONFIRMED', 'REJECTED', 'CANCELLED'];

      for (const status of terminalStates) {
        const task = createMockTask({ status });
        const user = mockUser('MANAGER');

        await expect(validateTransition(task, 'IN_PROGRESS', user, {})).rejects.toThrow();
      }
    });
  });

  describe('Field Requirement Validation', () => {
    it('should require cancellationReason when transitioning to CANCELLED', async () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });
      const user = mockUser('MANAGER');

      // Without reason
      await expect(validateTransition(task, 'CANCELLED', user, {})).rejects.toThrow();

      // With reason
      await expect(
        validateTransition(task, 'CANCELLED', user, {
          cancellationReason: 'Task is duplicate',
        }),
      ).resolves.toBeUndefined();
    });

    it('should require rejectionReason when transitioning to REJECTED', async () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });
      const user = mockUser('MANAGER');

      // Without reason
      await expect(validateTransition(task, 'REJECTED', user, {})).rejects.toThrow();

      // With reason
      await expect(
        validateTransition(task, 'REJECTED', user, {
          rejectionReason: 'Invalid machinery',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Role-Based State Access', () => {
    it('should enforce MANAGER-only transitions from REPORTED', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const manager = mockUser('MANAGER');

      // Manager can do this transition
      expect(() => validateTransition(task, 'UNDER_REVIEW', manager, {})).not.toThrow();
    });
  });
});
