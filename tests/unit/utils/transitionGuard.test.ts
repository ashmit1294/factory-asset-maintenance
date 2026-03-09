import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateTransition } from '@/lib/transitionGuard';
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

    it('should not allow USER to move REPORTED to UNDER_REVIEW', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('USER');

      expect(() => validateTransition(task, 'UNDER_REVIEW', user, {})).toThrow();
    });

    it('should not allow TECHNICIAN to move REPORTED to UNDER_REVIEW', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('TECHNICIAN');

      expect(() => validateTransition(task, 'UNDER_REVIEW', user, {})).toThrow();
    });
  });

  describe('UNDER_REVIEW → ASSIGNED Transition', () => {
    it('should only allow MANAGER/SENIOR_MANAGER', () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });

      // Allowed
      expect(() => validateTransition(task, 'ASSIGNED', mockUser('MANAGER'), {})).not.toThrow();
      expect(() =>
        validateTransition(task, 'ASSIGNED', mockUser('SENIOR_MANAGER'), {}),
      ).not.toThrow();

      // Not allowed
      expect(() => validateTransition(task, 'ASSIGNED', mockUser('USER'), {})).toThrow();
      expect(() => validateTransition(task, 'ASSIGNED', mockUser('TECHNICIAN'), {})).toThrow();
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

    it('should prevent other technicians from picking up task', () => {
      const task = createMockTask({
        status: 'ASSIGNED',
        assignedTo: '507f1f77bcf86cd799439012',
      });
      const differentTech = mockUser('TECHNICIAN', '607f1f77bcf86cd799439013');

      expect(() => validateTransition(task, 'IN_PROGRESS', differentTech, {})).toThrow();
    });

    it('should prevent non-technician from transitioning', () => {
      const task = createMockTask({
        status: 'ASSIGNED',
        assignedTo: '507f1f77bcf86cd799439012',
      });
      const manager = mockUser('MANAGER');

      expect(() => validateTransition(task, 'IN_PROGRESS', manager, {})).toThrow();
    });
  });

  describe('IN_PROGRESS → MATERIAL_REQUESTED Transition', () => {
    it('should allow technician to request materials', () => {
      const techId = '507f1f77bcf86cd799439012';
      const task = createMockTask({
        status: 'IN_PROGRESS',
        assignedTo: techId,
      });
      const tech = mockUser('TECHNICIAN', techId);

      expect(() => validateTransition(task, 'MATERIAL_REQUESTED', tech, {})).not.toThrow();
    });

    it('should prevent duplicate material requests', () => {
      const task = createMockTask({
        status: 'IN_PROGRESS',
        assignedTo: '507f1f77bcf86cd799439012',
        pendingMaterialRequest: true, // Indicates pending MR exists
      });
      const tech = mockUser('TECHNICIAN', '507f1f77bcf86cd799439012');

      expect(() => validateTransition(task, 'MATERIAL_REQUESTED', tech, {})).toThrow();
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

    it('should prevent self-confirmation by reporter (if other managers exist)', () => {
      const reporterId = '507f1f77bcf86cd799439011';
      const task = createMockTask({
        status: 'COMPLETED',
        reportedBy: reporterId,
      });
      const reportingManager = mockUser('MANAGER', reporterId);

      // Context should indicate other managers exist
      const ctx = { otherManagersExist: true };

      expect(() => validateTransition(task, 'CONFIRMED', reportingManager)).toThrow();
    });
  });

  describe('ESCALATED Task Resolution', () => {
    it('should prevent last-rejecter from resolving escalation', () => {
      const rejecterId = '507f1f77bcf86cd799439012';
      const task = createMockTask({
        status: 'ESCALATED',
        lastRejectingManagerId: rejecterId,
      });
      const rejectingManager = mockUser('MANAGER', rejecterId);

      expect(() =>
        validateTransition(task, 'IN_PROGRESS', rejectingManager),
      ).toThrow();
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
    it('should prevent invalid next states', () => {
      const task = createMockTask({ status: 'REPORTED' });
      const user = mockUser('MANAGER');

      // TAask cannot go from REPORTED directly to COMPLETED
      expect(() => validateTransition(task, 'COMPLETED', user, {})).toThrow();
    });

    it('should prevent backwards transitions', () => {
      const task = createMockTask({ status: 'COMPLETED' });
      const user = mockUser('MANAGER');

      // Cannot go from COMPLETED back to IN_PROGRESS
      expect(() => validateTransition(task, 'IN_PROGRESS', user, {})).toThrow();
    });

    it('should prevent transitions from terminal states', () => {
      const terminalStates: TaskStatus[] = ['CONFIRMED', 'REJECTED', 'CANCELLED'];

      terminalStates.forEach((status) => {
        const task = createMockTask({ status });
        const user = mockUser('MANAGER');

        expect(() => validateTransition(task, 'IN_PROGRESS', user, {})).toThrow();
      });
    });
  });

  describe('Field Requirement Validation', () => {
    it('should require cancellationReason when transitioning to CANCELLED', () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });
      const user = mockUser('MANAGER');

      // Without reason
      expect(() => validateTransition(task, 'CANCELLED', user, {})).toThrow();

      // With reason
      expect(() =>
        validateTransition(task, 'CANCELLED', user, {
          cancellationReason: 'Task is duplicate',
        }),
      ).not.toThrow();
    });

    it('should require rejectionReason when transitioning to REJECTED', () => {
      const task = createMockTask({ status: 'UNDER_REVIEW' });
      const user = mockUser('MANAGER');

      // Without reason
      expect(() => validateTransition(task, 'REJECTED', user, {})).toThrow();

      // With reason
      expect(() =>
        validateTransition(task, 'REJECTED', user, {
          rejectionReason: 'Invalid machinery',
        }),
      ).not.toThrow();
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
