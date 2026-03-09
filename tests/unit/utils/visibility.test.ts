import { describe, it, expect } from '@jest/globals';
import mongoose from 'mongoose';
import { applyVisibilityFilter } from '@/lib/visibility';
import type { Role } from '@/types';

describe('Visibility Filter (lib/visibility.ts)', () => {
  const userId = '507f1f77bcf86cd799439011';
  const differentUserId = '607f1f77bcf86cd799439012';
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const differentUserObjectId = new mongoose.Types.ObjectId(differentUserId);

  describe('USER Role Visibility', () => {
    it('should only allow USER to see tasks they reported', () => {
      const filter = applyVisibilityFilter('USER', userId);
      expect(filter).toEqual({ reportedBy: userObjectId });
    });

    it('should generate different filter for different users', () => {
      const filter1 = applyVisibilityFilter('USER', userId);
      const filter2 = applyVisibilityFilter('USER', differentUserId);
      expect(filter1).not.toEqual(filter2);
      expect(filter2).toEqual({ reportedBy: differentUserObjectId });
    });

    it('should not allow USER to override filter', () => {
      // Filter is applied server-side, cannot be overridden by client
      const filter = applyVisibilityFilter('USER', userId);
      expect(filter.reportedBy?.toString()).toBe(userId);
      expect(filter.assignedTo).toBeUndefined(); // USER cannot see assigned-to tasks
    });
  });

  describe('TECHNICIAN Role Visibility', () => {
    it('should only allow TECHNICIAN to see assigned tasks', () => {
      const filter = applyVisibilityFilter('TECHNICIAN', userId);
      expect(filter).toEqual({ assignedTo: userObjectId });
    });

    it('should generate filter specific to technician ID', () => {
      const filter1 = applyVisibilityFilter('TECHNICIAN', userId);
      const filter2 = applyVisibilityFilter('TECHNICIAN', differentUserId);
      expect(filter1).not.toEqual(filter2);
      expect(filter2).toEqual({ assignedTo: differentUserObjectId });
    });

    it('should not allow TECHNICIAN to see reported tasks', () => {
      const filter = applyVisibilityFilter('TECHNICIAN', userId);
      expect(filter.assignedTo?.toString()).toBe(userId);
      expect(filter.reportedBy).toBeUndefined();
    });
  });

  describe('MANAGER Role Visibility', () => {
    it('should allow MANAGER to see all tasks', () => {
      const filter = applyVisibilityFilter('MANAGER', userId);
      expect(filter).toEqual({}); // Empty filter = all tasks
    });

    it('should return same filter regardless of userId for MANAGER', () => {
      const filter1 = applyVisibilityFilter('MANAGER', userId);
      const filter2 = applyVisibilityFilter('MANAGER', differentUserId);
      expect(filter1).toEqual(filter2);
      expect(filter1).toEqual({});
    });
  });

  describe('SENIOR_MANAGER Role Visibility', () => {
    it('should allow SENIOR_MANAGER to see all tasks', () => {
      const filter = applyVisibilityFilter('SENIOR_MANAGER', userId);
      expect(filter).toEqual({});
    });

    it('should return same filter regardless of userId for SENIOR_MANAGER', () => {
      const filter1 = applyVisibilityFilter('SENIOR_MANAGER', userId);
      const filter2 = applyVisibilityFilter('SENIOR_MANAGER', differentUserId);
      expect(filter1).toEqual(filter2);
      expect(filter1).toEqual({});
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('USER cannot escalate to see all tasks by using Manager filter', () => {
      const userFilter = applyVisibilityFilter('USER', userId);
      expect(userFilter).not.toEqual({});
      expect(userFilter.reportedBy?.toString()).toBe(userId);
    });

    it('TECHNICIAN cannot see USER reported tasks', () => {
      const userFilter = applyVisibilityFilter('USER', userId);
      const techFilter = applyVisibilityFilter('TECHNICIAN', userId);
      expect(userFilter).not.toEqual(techFilter);
    });

    it('Filter prevents horizontal privilege escalation', () => {
      const attackerFilter = applyVisibilityFilter('USER', userId);
      const targetFilter = applyVisibilityFilter('USER', differentUserId);
      expect(attackerFilter).not.toEqual(targetFilter);
      expect(attackerFilter.reportedBy?.toString()).toBe(userId);
      expect(targetFilter.reportedBy?.toString()).toBe(differentUserId);
    });
  });

  describe('Filter Structure', () => {
    it('should return MongoDB query compatible object', () => {
      const filter = applyVisibilityFilter('USER', userId);
      expect(typeof filter).toBe('object');
      expect(filter).not.toBeNull();
      Object.keys(filter).forEach((key) => {
        expect(typeof key).toBe('string');
      });
    });

    it('should not include sensitive operators in filter', () => {
      const filter = applyVisibilityFilter('USER', userId);
      const filterStr = JSON.stringify(filter);
      expect(filterStr).not.toMatch(/\$where/);
      expect(filterStr).not.toMatch(/function/);
    });

    it('should be serializable JSON', () => {
      const roles: Role[] = ['USER', 'TECHNICIAN', 'MANAGER', 'SENIOR_MANAGER'];
      roles.forEach((role) => {
        const filter = applyVisibilityFilter(role, userId);
        expect(() => JSON.stringify(filter)).not.toThrow();
      });
    });
  });

  describe('Multi-Role Comparison', () => {
    it('should differentiate between all role visibility scopes', () => {
      const userFilter = applyVisibilityFilter('USER', userId);
      const techFilter = applyVisibilityFilter('TECHNICIAN', userId);
      const managerFilter = applyVisibilityFilter('MANAGER', userId);
      const seniorFilter = applyVisibilityFilter('SENIOR_MANAGER', userId);

      // USER and TECHNICIAN should be different
      expect(userFilter).not.toEqual(techFilter);

      // MANAGER and SENIOR_MANAGER should be the same (both see all)
      expect(managerFilter).toEqual(seniorFilter);

      // USER and MANAGER should be different
      expect(userFilter).not.toEqual(managerFilter);
    });
  });
});
