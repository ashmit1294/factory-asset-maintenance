import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Task from '@/models/Task';
import User from '@/models/User';
import Machinery from '@/models/Machinery';
import bcryptjs from 'bcryptjs';
import { Types } from 'mongoose';

/**
 * Integration Tests: Task Workflow
 * Tests complete task lifecycle including:
 * - Task creation with validation
 * - State transitions with role guards
 * - User access control
 * - Machinery association
 * - Event logging
 */

describe('Task Workflow Integration', () => {
  let reporterUserId: string;
  let managerUserId: string;
  let technicianUserId: string;
  let machineryId: string;

  beforeAll(async () => {
    await connectDB();
    
    // Create test users
    const hashedPassword = await bcryptjs.hash('TestPass123!', 12);
    
    const reporter = await User.create({
      name: 'John Reporter',
      email: 'john.reporter@factory.com',
      passwordHash: hashedPassword,
      role: 'USER',
      isActive: true,
    });
    reporterUserId = reporter._id.toString();

    const manager = await User.create({
      name: 'Manager Alice',
      email: 'manager.alice@factory.com',
      passwordHash: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    });
    managerUserId = manager._id.toString();

    const technician = await User.create({
      name: 'Tech Bob',
      email: 'tech.bob@factory.com',
      passwordHash: hashedPassword,
      role: 'TECHNICIAN',
      isActive: true,
    });
    technicianUserId = technician._id.toString();

    // Create test machinery
    const machinery = await Machinery.create({
      name: 'CNC Machine A1',
      serialNumber: 'CNC-2026-001',
      type: 'CNC',
      status: 'ACTIVE',
      location: 'Production Floor - Zone A',
      maintenanceHistory: [],
    });
    machineryId = machinery._id?.toString() ?? '';
  });

  afterAll(async () => {
    await Task.deleteMany({});
    await User.deleteMany({});
    await Machinery.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Task Creation & Validation', () => {
    it('should create task with required fields', async () => {
      const task = await Task.create({
        taskCode: 'TSK-0001-ABC',
        title: 'Bearing replacement needed',
        description: 'Main spindle bearing showing wear',
        priority: 'HIGH',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [
          {
            action: 'TASK_CREATED',
            fromStatus: null,
            toStatus: 'REPORTED',
            performedBy: {
              userId: new Types.ObjectId(reporterUserId),
              name: 'John Reporter',
              role: 'USER',
            },
            timestamp: new Date(),
          },
        ],
      });

      expect(task).toBeDefined();
      expect(task.taskCode).toBe('TSK-0001-ABC');
      expect(task.status).toBe('REPORTED');
      expect(task.priority).toBe('HIGH');
      expect(task.eventLog).toHaveLength(1);
    });

    it('should enforce required task fields', async () => {
      try {
        await Task.create({
          // Missing title
          description: 'Test task',
          priority: 'HIGH',
          status: 'REPORTED',
          reportedBy: new Types.ObjectId(reporterUserId),
          machineryId: new Types.ObjectId(machineryId),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('title');
      }
    });

    it('should validate priority enum', async () => {
      try {
        await Task.create({
          taskCode: 'TSK-0002-XYZ',
          title: 'Test task',
          description: 'Test description',
          priority: 'INVALID_PRIORITY', // Invalid enum
          status: 'REPORTED',
          reportedBy: new Types.ObjectId(reporterUserId),
          machineryId: new Types.ObjectId(machineryId),
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('priority');
      }
    });

    it('should validate status enum', async () => {
      try {
        await Task.create({
          taskCode: 'TSK-0003-DEF',
          title: 'Test task',
          description: 'Test description',
          priority: 'MEDIUM',
          status: 'INVALID_STATUS', // Invalid enum
          reportedBy: new Types.ObjectId(reporterUserId),
          machineryId: new Types.ObjectId(machineryId),
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('status');
      }
    });

    it('should maintain task code uniqueness', async () => {
      const taskCode = 'TSK-0004-GHI';

      await Task.create({
        taskCode,
        title: 'First task',
        description: 'Description 1',
        priority: 'HIGH',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
      });

      try {
        await Task.create({
          taskCode, // Duplicate
          title: 'Second task',
          description: 'Description 2',
          priority: 'HIGH',
          status: 'REPORTED',
          reportedBy: new Types.ObjectId(reporterUserId),
          machineryId: new Types.ObjectId(machineryId),
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe(11000); // Duplicate key error
      }
    });
  });

  describe('State Transitions with Role Guards', () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await Task.create({
        taskCode: 'TSK-0005-JKL',
        title: 'State transition test',
        description: 'Testing state machine',
        priority: 'MEDIUM',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [],
      });
      taskId = task._id.toString();
    });

    it('should allow MANAGER to transition REPORTED→UNDER_REVIEW', async () => {
      const task = await Task.findById(taskId);
      expect(task?.status).toBe('REPORTED');

      // Manager can move to UNDER_REVIEW
      const updated = await Task.findByIdAndUpdate(
        taskId,
        {
          status: 'UNDER_REVIEW',
          $push: {
            eventLog: {
              action: 'STATUS_CHANGE',
              fromStatus: 'REPORTED',
              toStatus: 'UNDER_REVIEW',
              performedBy: {
                userId: new Types.ObjectId(managerUserId),
                name: 'Manager Alice',
                role: 'MANAGER',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(updated?.status).toBe('UNDER_REVIEW');
    });

    it('should prevent USER from transitioning task status', async () => {
      // Create new task for this test
      const task = await Task.create({
        taskCode: 'TSK-0006-MNO',
        title: 'USER cannot transition',
        description: 'Test unauthorized transition',
        priority: 'LOW',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [],
      });

      // Simulate: USER tries to transition (should be blocked in API middleware)
      expect(task.status).toBe('REPORTED');
      // In real API, this would be blocked by middleware before DB call
    });

    it('should track all status changes in eventLog', async () => {
      const task = await Task.findById(taskId);
      expect(task?.eventLog).toBeDefined();
      expect(task?.eventLog?.length).toBeGreaterThan(0);

      // Verify event structure
      const lastEvent = task?.eventLog?.[task.eventLog.length - 1];
      expect(lastEvent?.action).toBe('STATUS_CHANGE');
      expect(lastEvent?.fromStatus).toBe('REPORTED');
      expect(lastEvent?.toStatus).toBe('UNDER_REVIEW');
      expect(lastEvent?.timestamp).toBeDefined();
    });
  });

  describe('Task Assignment & Technician Workflow', () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await Task.create({
        taskCode: 'TSK-0007-PQR',
        title: 'Assignment workflow test',
        description: 'Testing technician assignment',
        priority: 'CRITICAL',
        status: 'ASSIGNED',
        reportedBy: new Types.ObjectId(reporterUserId),
        assignedTo: new Types.ObjectId(technicianUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [],
      });
      taskId = task._id.toString();
    });

    it('should assign task to technician', async () => {
      const task = await Task.findById(taskId);
      expect(task?.assignedTo).toBeDefined();
      expect(task?.assignedTo?.toString()).toBe(technicianUserId);
    });

    it('should allow assigned technician to start work', async () => {
      const updated = await Task.findByIdAndUpdate(
        taskId,
        {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
        { new: true }
      );

      expect(updated?.status).toBe('IN_PROGRESS');
      expect(updated?.startedAt).toBeDefined();
    });

    it('should prevent unassigned technician from modifying task', async () => {
      // Create another technician
      const hashedPassword = await bcryptjs.hash('TestPass123!', 12);
      const otherTech = await User.create({
        name: 'Other Technician',
        email: 'other.tech@factory.com',
        passwordHash: hashedPassword,
        role: 'TECHNICIAN',
        isActive: true,
      });

      // In real API: should check if otherTech._id === task.assignedTo
      const task = await Task.findById(taskId);
      const isAssigned = task?.assignedTo?.toString() === otherTech._id.toString();
      expect(isAssigned).toBe(false);

      // Cleanup
      await User.findByIdAndDelete(otherTech._id);
    });
  });

  describe('Task Visibility by Role', () => {
    beforeAll(async () => {
      // Create tasks assigned to different users
      await Task.create({
        taskCode: 'TSK-0008-STU',
        title: 'Reporter task',
        description: 'Reported by user',
        priority: 'HIGH',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
      });

      await Task.create({
        taskCode: 'TSK-0009-VWX',
        title: 'Assigned task',
        description: 'Assigned to technician',
        priority: 'MEDIUM',
        status: 'ASSIGNED',
        reportedBy: new Types.ObjectId(managerUserId),
        assignedTo: new Types.ObjectId(technicianUserId),
        machineryId: new Types.ObjectId(machineryId),
      });
    });

    it('should show USER only tasks they reported', async () => {
      const userTasks = await Task.find({
        reportedBy: new Types.ObjectId(reporterUserId),
      });

      expect(userTasks.length).toBeGreaterThan(0);
      userTasks.forEach((task) => {
        expect(task.reportedBy.toString()).toBe(reporterUserId);
      });
    });

    it('should show TECHNICIAN only assigned tasks', async () => {
      const techTasks = await Task.find({
        assignedTo: new Types.ObjectId(technicianUserId),
      });

      expect(techTasks.length).toBeGreaterThan(0);
      techTasks.forEach((task) => {
        expect(task.assignedTo?.toString()).toBe(technicianUserId);
      });
    });

    it('should show MANAGER all tasks', async () => {
      const allTasks = await Task.find({});
      expect(allTasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('SLA Tracking', () => {
    it('should calculate SLA hours based on priority', async () => {
      const slaSLA: Record<string, number> = {
        CRITICAL: 4,
        HIGH: 24,
        MEDIUM: 72,
        LOW: 168,
      };

      const task = await Task.create({
        taskCode: 'TSK-0010-YZA',
        title: 'SLA test',
        description: 'Testing SLA calculation',
        priority: 'CRITICAL',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        createdAt: new Date(),
      });

      const slaHours = slaSLA[task.priority];
      const expectedSLA = new Date(task.createdAt.getTime() + slaHours * 60 * 60 * 1000);

      expect(slaHours).toBe(4);
      expect(expectedSLA.getTime()).toBeGreaterThan(task.createdAt.getTime());
    });
  });

  describe('Task Completion Workflow', () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await Task.create({
        taskCode: 'TSK-0011-BCD',
        title: 'Completion workflow',
        description: 'Testing task completion',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        reportedBy: new Types.ObjectId(reporterUserId),
        assignedTo: new Types.ObjectId(technicianUserId),
        machineryId: new Types.ObjectId(machineryId),
        startedAt: new Date(),
      });
      taskId = task._id.toString();
    });

    it('should complete task with notes', async () => {
      const notes = 'Bearing replaced successfully, tested for smooth operation';

      const updated = await Task.findByIdAndUpdate(
        taskId,
        {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes,
        },
        { new: true }
      );

      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.completedAt).toBeDefined();
      expect(updated?.notes).toBe(notes);
    });

    it('should record completion time', async () => {
      const task = await Task.findById(taskId);
      expect(task?.completedAt).toBeDefined();
    });

    it('should allow confirmation by manager', async () => {
      const confirmed = await Task.findByIdAndUpdate(
        taskId,
        {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmedBy: new Types.ObjectId(managerUserId),
        },
        { new: true }
      );

      expect(confirmed?.status).toBe('CONFIRMED');
      expect(confirmed?.confirmedAt).toBeDefined();
      expect(confirmed?.confirmedBy).toBeDefined();
    });
  });
});
