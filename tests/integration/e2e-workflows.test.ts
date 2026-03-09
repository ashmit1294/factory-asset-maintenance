import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Task from '@/models/Task';
import Machinery from '@/models/Machinery';
import MaterialRequest from '@/models/MaterialRequest';
import Inventory from '@/models/Inventory';
import bcryptjs from 'bcryptjs';
import { signToken, verifyToken } from '@/lib/auth';
import { Types } from 'mongoose';

/**
 * Integration Tests: End-to-End Workflows
 * Tests complete real-world scenarios including:
 * - Full task lifecycle (report → assign → complete)
 * - Material approval workflow with inventory
 * - Multi-user collaboration across roles
 * - Escalation scenarios
 */

describe('End-to-End Workflow Integration', () => {
  let reporterUserId: string;
  let managerUserId: string;
  let technicianUserId: string;
  let seniorManagerUserId: string;
  let machineryId: string;

  beforeAll(async () => {
    await connectDB();

    const hashedPassword = await bcryptjs.hash('WorkflowTest123!', 12);

    // Create users
    const reporter = await User.create({
      name: 'Production User',
      email: 'workflow.reporter@factory.com',
      passwordHash: hashedPassword,
      role: 'USER',
      isActive: true,
    });
    reporterUserId = reporter._id.toString();

    const manager = await User.create({
      name: 'Processing Manager',
      email: 'workflow.manager@factory.com',
      passwordHash: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    });
    managerUserId = manager._id.toString();

    const technician = await User.create({
      name: 'Field Technician',
      email: 'workflow.technician@factory.com',
      passwordHash: hashedPassword,
      role: 'TECHNICIAN',
      isActive: true,
    });
    technicianUserId = technician._id.toString();

    const seniorManager = await User.create({
      name: 'Senior Operations Manager',
      email: 'workflow.senior@factory.com',
      passwordHash: hashedPassword,
      role: 'SENIOR_MANAGER',
      isActive: true,
    });
    seniorManagerUserId = seniorManager._id.toString();

    // Create machinery
    const machinery = await Machinery.create({
      name: 'Production Line Conveyor',
      serialNumber: 'CONV-2026-001',
      type: 'Conveyor',
      status: 'ACTIVE',
      location: 'Main Production Hall',
      maintenanceHistory: [],
    });
    machineryId = machinery._id.toString();

    // Create inventory
    await Inventory.create({
      name: 'Motor 2HP Replacement',
      sku: 'MOTOR-2HP-001',
      unit: 'pcs',
      quantity: 8,
      reorderLevel: 2,
      reorderQuantity: 5,
      supplier: 'MotorCorp',
      lastRestockedDate: new Date('2026-01-20'),
      expiryDate: new Date('2027-01-20'),
    });

    await Inventory.create({
      name: 'Bearing Oil Synthetic',
      sku: 'BEARING-OIL',
      unit: 'litres',
      quantity: 50,
      reorderLevel: 10,
      reorderQuantity: 30,
      supplier: 'OilSupply Co',
      lastRestockedDate: new Date('2026-02-01'),
      expiryDate: new Date('2028-02-01'),
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
    await Machinery.deleteMany({});
    await MaterialRequest.deleteMany({});
    await Inventory.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Complete Task Lifecycle Workflow', () => {
    it('should complete full task lifecycle: Report → Assign → Execute → Approve', async () => {
      // STEP 1: Production User Reports Issue
      console.log('[STEP 1] Production User reports machinery issue');
      const reporterToken = signToken({
        _id: reporterUserId,
        role: 'USER',
        name: 'Production User',
        email: 'workflow.reporter@factory.com',
      });

      const task = await Task.create({
        taskCode: 'TSK-WF-001',
        title: 'Conveyor motor bearing noise',
        description: 'Bearing in main drive motor making grinding noise',
        priority: 'HIGH',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [
          {
            action: 'TASK_REPORTED',
            fromStatus: null,
            toStatus: 'REPORTED',
            performedBy: {
              userId: new Types.ObjectId(reporterUserId),
              name: 'Production User',
              role: 'USER',
            },
            timestamp: new Date(),
          },
        ],
      });

      expect(task.status).toBe('REPORTED');
      expect(task.taskCode).toBe('TSK-WF-001');

      // STEP 2: Manager Reviews and Assigns
      console.log('[STEP 2] Manager reviews and assigns to technician');
      const managerToken = signToken({
        _id: managerUserId,
        role: 'MANAGER',
        name: 'Processing Manager',
        email: 'workflow.manager@factory.com',
      });

      const assigned = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'UNDER_REVIEW',
          $push: {
            eventLog: {
              action: 'REVIEWED',
              fromStatus: 'REPORTED',
              toStatus: 'UNDER_REVIEW',
              performedBy: {
                userId: new Types.ObjectId(managerUserId),
                name: 'Processing Manager',
                role: 'MANAGER',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(assigned?.status).toBe('UNDER_REVIEW');

      // Assign to technician
      const assignedToTech = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'ASSIGNED',
          assignedTo: new Types.ObjectId(technicianUserId),
          $push: {
            eventLog: {
              action: 'ASSIGNED',
              fromStatus: 'UNDER_REVIEW',
              toStatus: 'ASSIGNED',
              performedBy: {
                userId: new Types.ObjectId(managerUserId),
                name: 'Processing Manager',
                role: 'MANAGER',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(assignedToTech?.status).toBe('ASSIGNED');
      expect(assignedToTech?.assignedTo?.toString()).toBe(technicianUserId);

      // STEP 3: Technician Requests Materials
      console.log('[STEP 3] Technician requests materials for repair');
      const technicianToken = signToken({
        _id: technicianUserId,
        role: 'TECHNICIAN',
        name: 'Field Technician',
        email: 'workflow.technician@factory.com',
      });

      const materialRequest = await MaterialRequest.create({
        taskId: task._id,
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Motor 2HP Replacement', quantity: 1, unit: 'pcs' },
          { name: 'Bearing Oil Synthetic', quantity: 2, unit: 'litres' },
        ],
        status: 'PENDING',
        createdAt: new Date(),
      });

      expect(materialRequest.items).toHaveLength(2);

      // Check inventory availability
      const motor = await Inventory.findOne({ sku: 'MOTOR-2HP-001' });
      const oil = await Inventory.findOne({ sku: 'BEARING-OIL' });

      expect(motor?.quantity).toBeGreaterThanOrEqual(1);
      expect(oil?.quantity).toBeGreaterThanOrEqual(2);

      // STEP 4: Manager Approves Materials
      console.log('[STEP 4] Manager approves material request');
      const approvedRequest = await MaterialRequest.findByIdAndUpdate(
        materialRequest._id,
        {
          status: 'APPROVED',
          approvedBy: new Types.ObjectId(managerUserId),
          approvedAt: new Date(),
        },
        { new: true }
      );

      expect(approvedRequest?.status).toBe('APPROVED');

      // Deduct from inventory
      await Inventory.findOneAndUpdate(
        { sku: 'MOTOR-2HP-001' },
        { $inc: { quantity: -1 } }
      );

      await Inventory.findOneAndUpdate(
        { sku: 'BEARING-OIL' },
        { $inc: { quantity: -2 } }
      );

      const motorAfter = await Inventory.findOne({ sku: 'MOTOR-2HP-001' });
      const oilAfter = await Inventory.findOne({ sku: 'BEARING-OIL' });

      expect(motorAfter?.quantity).toBe((motor?.quantity ?? 0) - 1);
      expect(oilAfter?.quantity).toBe((oil?.quantity ?? 0) - 2);

      // Technician starts work
      console.log('[STEP 5] Technician starts repair work');
      const inProgress = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'IN_PROGRESS',
          $push: {
            eventLog: {
              action: 'WORK_STARTED',
              fromStatus: 'ASSIGNED',
              toStatus: 'IN_PROGRESS',
              performedBy: {
                userId: new Types.ObjectId(technicianUserId),
                name: 'Field Technician',
                role: 'TECHNICIAN',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(inProgress?.status).toBe('IN_PROGRESS');
      expect(inProgress?.startedAt).toBeDefined();

      // STEP 6: Technician Completes Work
      console.log('[STEP 6] Technician completes repair');
      const completed = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'COMPLETED',
          completedAt: new Date(),
          $push: {
            eventLog: {
              action: 'WORK_COMPLETED',
              fromStatus: 'IN_PROGRESS',
              toStatus: 'COMPLETED',
              performedBy: {
                userId: new Types.ObjectId(technicianUserId),
                name: 'Field Technician',
                role: 'TECHNICIAN',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.completedAt).toBeDefined();
      expect(completed?.notes).toBeTruthy();

      // STEP 7: Manager Confirms Completion
      console.log('[STEP 7] Manager reviews and confirms completion');
      const confirmed = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          $push: {
            eventLog: {
              action: 'CONFIRMED',
              fromStatus: 'COMPLETED',
              toStatus: 'CONFIRMED',
              performedBy: {
                userId: new Types.ObjectId(managerUserId),
                name: 'Processing Manager',
                role: 'MANAGER',
              },
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      expect(confirmed?.status).toBe('CONFIRMED');
      expect(confirmed?.confirmedAt).toBeDefined();

      // FINAL VERIFICATION
      console.log('[COMPLETE] Task lifecycle workflow finished');
      const finalTask = await Task.findById(task._id);

      expect(finalTask?.status).toBe('CONFIRMED');
      expect(finalTask?.eventLog?.length).toBeGreaterThanOrEqual(5);
      expect(finalTask?.completedAt).toBeDefined();
      expect(finalTask?.confirmedAt).toBeDefined();
    });
  });

  describe('Escalation Workflow', () => {
    it('should handle escalation when manager rejects multiple times', async () => {
      console.log('[ESCALATION] Multi-rejection escalation test');

      // Create initial task
      const task = await Task.create({
        taskCode: 'TSK-WF-ESC-001',
        title: 'Escalation test task',
        description: 'Testing escalation workflow',
        priority: 'CRITICAL',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        rejectionCount: 0,
      });

      // CYCLE 1: Manager rejects
      console.log('[REJECTION 1] First rejection');
      const reject1 = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'REJECTED',
          rejectionCount: 1,
          rejectedBy: new Types.ObjectId(managerUserId),
          rejectionReason: 'Insufficient details provided',
        },
        { new: true }
      );

      expect(reject1?.rejectionCount).toBe(1);

      // User resubmits
      const resubmit1 = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'REPORTED', // Resubmitted
          updatedAt: new Date(),
        },
        { new: true }
      );

      // CYCLE 2: Manager rejects again
      console.log('[REJECTION 2] Second rejection');
      const reject2 = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'REJECTED',
          rejectionCount: 2,
          rejectedBy: new Types.ObjectId(managerUserId),
        },
        { new: true }
      );

      expect(reject2?.rejectionCount).toBe(2);

      // CYCLE 3: Manager rejects third time
      console.log('[REJECTION 3] Third rejection - triggers escalation');
      const reject3 = await Task.findByIdAndUpdate(
        task._id,
        {
          status: 'REJECTED',
          rejectionCount: 3,
          rejectedBy: new Types.ObjectId(managerUserId),
          lastRejectingManagerId: managerUserId,
        },
        { new: true }
      );

      // Trigger escalation
      if ((reject3?.rejectionCount ?? 0) >= 3) {
        const escalated = await Task.findByIdAndUpdate(
          task._id,
          {
            status: 'ESCALATED',
            escalatedAt: new Date(),
            escalatedTo: new Types.ObjectId(seniorManagerUserId),
          },
          { new: true }
        );

        expect(escalated?.status).toBe('ESCALATED');
        expect(escalated?.escalatedTo).toBeDefined();

        console.log('[ESCALATED] Task escalated to Senior Manager');
      }
    });
  });

  describe('Multi-User Collaboration', () => {
    it('should track all user interactions in event log', async () => {
      console.log('[COLLAB] Multi-user collaboration tracking');

      const task = await Task.create({
        taskCode: 'TSK-WF-COLLAB-001',
        title: 'Collaborative task',
        description: 'Testing multi-user interactions',
        priority: 'MEDIUM',
        status: 'REPORTED',
        reportedBy: new Types.ObjectId(reporterUserId),
        machineryId: new Types.ObjectId(machineryId),
        eventLog: [
          {
            action: 'CREATED',
            fromStatus: null,
            toStatus: 'REPORTED',
            performedBy: {
              userId: new Types.ObjectId(reporterUserId),
              name: 'Production User',
              role: 'USER',
            },
            timestamp: new Date(),
          },
        ],
      });

      // Manager reviews
      await Task.findByIdAndUpdate(task._id, {
        $push: {
          eventLog: {
            action: 'REVIEWED',
            fromStatus: 'REPORTED',
            toStatus: 'UNDER_REVIEW',
            performedBy: {
              userId: new Types.ObjectId(managerUserId),
              name: 'Processing Manager',
              role: 'MANAGER',
            },
            note: 'Looks good, assigning to tech',
            timestamp: new Date(),
          },
        },
      });

      // Technician accepts
      await Task.findByIdAndUpdate(task._id, {
        $push: {
          eventLog: {
            action: 'ACCEPTED',
            fromStatus: 'UNDER_REVIEW',
            toStatus: 'ASSIGNED',
            performedBy: {
              userId: new Types.ObjectId(technicianUserId),
              name: 'Field Technician',
              role: 'TECHNICIAN',
            },
            note: 'Ready to proceed',
            timestamp: new Date(),
          },
        },
      });

      const finalTask = await Task.findById(task._id);

      expect(finalTask?.eventLog?.length).toBeGreaterThanOrEqual(3);
      expect(finalTask?.eventLog?.[0].performedBy.role).toBe('USER');
      expect(finalTask?.eventLog?.[1].performedBy.role).toBe('MANAGER');
      expect(finalTask?.eventLog?.[2].performedBy.role).toBe('TECHNICIAN');

      console.log('[COLLAB] All interactions tracked');
    });
  });

  describe('Concurrent User Access', () => {
    it('should handle multiple users viewing same task', async () => {
      const task = await Task.create({
        taskCode: 'TSK-WF-CONCURRENT',
        title: 'Concurrent access test',
        description: 'Testing simultaneous user access',
        priority: 'HIGH',
        status: 'ASSIGNED',
        reportedBy: new Types.ObjectId(reporterUserId),
        assignedTo: new Types.ObjectId(technicianUserId),
        machineryId: new Types.ObjectId(machineryId),
      });

      // Simulate multiple users fetching the same task
      const user1View = await Task.findById(task._id);
      const user2View = await Task.findById(task._id);
      const manager1View = await Task.findById(task._id);

      expect(user1View?._id).toEqual(user2View?._id);
      expect(user2View?._id).toEqual(manager1View?._id);

      // All should see same task state
      expect(user1View?.status).toBe('ASSIGNED');
      expect(user2View?.status).toBe('ASSIGNED');
      expect(manager1View?.status).toBe('ASSIGNED');
    });
  });

  describe('Token Validation Throughout Workflow', () => {
    it('should validate tokens at each step', async () => {
      // Create token for reporter
      const reporterToken = signToken({
        _id: reporterUserId,
        role: 'USER',
        name: 'Production User',
        email: 'workflow.reporter@factory.com',
      });

      const decoded1 = verifyToken(reporterToken);
      expect(decoded1.role).toBe('USER');

      // Create token for manager
      const managerToken = signToken({
        _id: managerUserId,
        role: 'MANAGER',
        name: 'Processing Manager',
        email: 'workflow.manager@factory.com',
      });

      const decoded2 = verifyToken(managerToken);
      expect(decoded2.role).toBe('MANAGER');

      // Tokens should have different roles
      expect(decoded1.role).not.toBe(decoded2.role);

      // Both should be valid
      expect(decoded1._id).toBe(reporterUserId);
      expect(decoded2._id).toBe(managerUserId);
    });
  });
});
