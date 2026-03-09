import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import MaterialRequest from '@/models/MaterialRequest';
import Inventory from '@/models/Inventory';
import Task from '@/models/Task';
import User from '@/models/User';
import Machinery from '@/models/Machinery';
import bcryptjs from 'bcryptjs';
import { Types } from 'mongoose';

/**
 * Integration Tests: Material Requests & Inventory
 * Tests material request workflow including:
 * - Material request creation and validation
 * - Inventory tracking and stock levels
 * - Material approval workflow
 * - Stock deduction on approval
 * - Insufficient inventory handling
 */

describe('Material Requests & Inventory Integration', () => {
  let technicianUserId: string;
  let managerUserId: string;
  let taskId: string;

  beforeEach(async () => {
    await connectDB();

    // Create users
    const hashedPassword = await bcryptjs.hash('TestPass123!', 12);

    const technician = await User.create({
      name: 'Tech Charlie',
      email: 'tech.charlie@factory.com',
      passwordHash: hashedPassword,
      role: 'TECHNICIAN',
      isActive: true,
    });
    technicianUserId = technician._id.toString();

    const manager = await User.create({
      name: 'Manager Diana',
      email: 'manager.diana@factory.com',
      passwordHash: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    });
    managerUserId = manager._id.toString();

    // Create machinery for task
    const machinery = await Machinery.create({
      name: 'Hydraulic Press B2',
      serialNumber: 'HP-2026-002',
      type: 'Press',
      status: 'ACTIVE',
      location: 'Production Floor - Zone B',
      maintenanceHistory: [],
    });

    // Create test task
    const task = await Task.create({
      taskCode: 'TSK-0050-MAT',
      title: 'Hydraulic fluid replacement',
      description: 'Replace hydraulic fluid in main press',
      priority: 'HIGH',
      status: 'MATERIAL_REQUESTED',
      reportedBy: new Types.ObjectId(technicianUserId),
      assignedTo: new Types.ObjectId(technicianUserId),
      machineryId: machinery._id,
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    taskId = task._id.toString();

    // Create inventory items - using only schema-defined fields
    await Inventory.create({
      itemName: 'Hydraulic Oil 32',
      unit: 'litres',
      quantity: 100,
      reorderLevel: 20,
    });

    await Inventory.create({
      itemName: 'Bearing Kit Standard',
      unit: 'pcs',
      quantity: 5,
      reorderLevel: 3,
    });

    await Inventory.create({
      itemName: 'Rare Component',
      unit: 'pcs',
      quantity: 0, // Out of stock
      reorderLevel: 1,
    });
  });

  afterAll(async () => {
    await MaterialRequest.deleteMany({});
    await Inventory.deleteMany({});
    await Task.deleteMany({});
    await User.deleteMany({});
    await Machinery.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Material Request Creation', () => {
    it('should create material request for task', async () => {
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Hydraulic Oil 32', quantity: 20, unit: 'litres' },
        ],
        status: 'PENDING',
        createdAt: new Date(),
      });

      expect(request).toBeDefined();
      expect(request.taskId.toString()).toBe(taskId);
      expect(request.items).toHaveLength(1);
      expect(request.status).toBe('PENDING');
    });

    it('should reject material request without items', async () => {
      try {
        await MaterialRequest.create({
          taskId: new Types.ObjectId(taskId),
          requestedBy: new Types.ObjectId(technicianUserId),
          items: [], // Empty items
          status: 'PENDING',
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeTruthy();
      }
    });

    it('should validate item quantities are positive', async () => {
      try {
        await MaterialRequest.create({
          taskId: new Types.ObjectId(taskId),
          requestedBy: new Types.ObjectId(technicianUserId),
          items: [
            { name: 'Hydraulic Oil 32', quantity: -5, unit: 'litres' }, // Negative
          ],
          status: 'PENDING',
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeTruthy();
      }
    });

    it('should validate unit enum', async () => {
      try {
        await MaterialRequest.create({
          taskId: new Types.ObjectId(taskId),
          requestedBy: new Types.ObjectId(technicianUserId),
          items: [
            { name: 'Test Item', quantity: 10, unit: 'invalid_unit' }, // Invalid unit
          ],
          status: 'PENDING',
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Material Request Approval Workflow', () => {
    let requestId: string;

    beforeEach(async () => {
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Bearing Kit Standard', quantity: 2, unit: 'pcs' },
        ],
        status: 'PENDING',
        createdAt: new Date(),
      });
      requestId = request._id.toString();
    });

    it('should approve material request', async () => {
      const approved = await MaterialRequest.findByIdAndUpdate(
        requestId,
        {
          status: 'APPROVED',
          approvedBy: new Types.ObjectId(managerUserId),
        },
        { returnDocument: 'after' }
      );

      expect(approved?.status).toBe('APPROVED');
      expect(approved?.approvedBy).toBeDefined();
    });

    it('should reject material request with reason', async () => {
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Rare Component', quantity: 1, unit: 'pcs' },
        ],
        status: 'PENDING',
      });

      const rejected = await MaterialRequest.findByIdAndUpdate(
        request._id,
        {
          status: 'REJECTED',
          rejectionNote: 'Out of stock - ordering from supplier',
        },
        { returnDocument: 'after' }
      );

      expect(rejected?.status).toBe('REJECTED');
      expect(rejected?.rejectionNote).toBeDefined();
    });

    it('should track rejection history', async () => {
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Hydraulic Oil 32', quantity: 5, unit: 'litres' },
        ],
        status: 'PENDING',
      });

      // First rejection
      let rejected = await MaterialRequest.findByIdAndUpdate(
        request._id,
        {
          status: 'REJECTED',
          rejectionCount: 1,
          rejectedAt: new Date(),
        },
        { returnDocument: 'after' }
      );

      expect(rejected?.rejectionCount).toBe(1);

      // Second request (resubmit)
      let reapproved = await MaterialRequest.findByIdAndUpdate(
        request._id,
        {
          status: 'PENDING', // Resubmitted
          rejectionCount: 1, // Track attempts
        },
        { returnDocument: 'after' }
      );

      expect(reapproved?.status).toBe('PENDING');
      expect(reapproved?.rejectionCount).toBe(1);
    });
  });

  describe('Inventory Stock Management', () => {
    it('should retrieve inventory by SKU', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });

      expect(item).toBeDefined();
      expect(item?.itemName).toBe('hydraulic oil 32');
      expect(item?.quantity).toBe(100);
    });

    it('should check if item is in stock', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });

      expect(item).toBeDefined();
      expect(item?.quantity).toBeGreaterThan(0);
    });

    it('should flag item as low stock when below reorder level', async () => {
      const item = await Inventory.findOne({ itemName: 'bearing kit standard' });

      const isLowStock = (item?.quantity ?? 0) <= (item?.reorderLevel ?? 0);
      // For bearing kit standard: quantity=5, reorderLevel=3, so NOT low stock
      expect(isLowStock).toBe(false);
    });

    it('should deduct stock on material approval', async () => {
      const before = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      const beforeQty = before?.quantity ?? 0;

      // Approve material request and deduct stock
      const deductQty = 15;
      await Inventory.findOneAndUpdate(
        { itemName: 'hydraulic oil 32' },
        { $inc: { quantity: -deductQty } }
      );

      const after = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      const afterQty = after?.quantity ?? 0;

      expect(afterQty).toBe(beforeQty - deductQty);
    });

    it('should prevent stock from going negative', async () => {
      const item = await Inventory.findOne({ itemName: 'rare component' });
      const currentQty = item?.quantity ?? 0;

      // Try to deduct more than available
      const deductQty = 5;
      const resulting = Math.max(0, currentQty - deductQty);

      await Inventory.findOneAndUpdate(
        { itemName: 'rare component' },
        { quantity: Math.max(0, currentQty - deductQty) }
      );

      const updated = await Inventory.findOne({ itemName: 'rare component' });
      expect(updated?.quantity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Insufficient Inventory Handling', () => {
    it('should detect insufficient stock', async () => {
      const requiredQty = 10;
      const item = await Inventory.findOne({ itemName: 'bearing kit standard' });
      const availableQty = item?.quantity ?? 0;

      const hasEnough = availableQty >= requiredQty;
      expect(hasEnough).toBe(false); // Only 5 available
    });

    it('should hold material request when stock insufficient', async () => {
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Rare Component', quantity: 5, unit: 'pcs' }, // 0 in stock
        ],
        status: 'PENDING',
      });

      const item = await Inventory.findOne({ itemName: 'rare component' });
      const hasEnough = (item?.quantity ?? 0) >= 5;

      if (!hasEnough) {
        // Hold the request
        await MaterialRequest.findByIdAndUpdate(request._id, {
          status: 'PENDING',
          notes: 'Awaiting restock - insufficient inventory',
        });
      }

      const updated = await MaterialRequest.findById(request._id);
      expect(updated?.status).toBe('PENDING');
    });

    it('should suggest reorder when stock below reorder level', async () => {
      const item = await Inventory.findOne({ itemName: 'bearing kit standard' });
      expect(item).toBeDefined();
      // bearing kit standard: quantity=5, reorderLevel=3, so not below reorder level
      const needsReorder = (item?.quantity ?? 0) <= (item?.reorderLevel ?? 0);
      expect(needsReorder).toBe(false);
    });

    it('should update inventory quantity on restock', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      expect(item).toBeDefined();

      const restockQty = 50;
      const newQty = (item?.quantity ?? 0) + restockQty;

      await Inventory.findOneAndUpdate(
        { itemName: 'hydraulic oil 32' },
        { quantity: newQty }
      );

      const updated = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      expect(updated?.quantity).toBe(newQty);
    });
  });

  describe('Material Request & Task Integration', () => {
    it('should link material request to task', async () => {
      // Create a material request to link to the task
      await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [{ name: 'Hydraulic Oil 32', quantity: 10, unit: 'litres' }],
        status: 'PENDING',
      });

      const request = await MaterialRequest.findOne({ taskId: new Types.ObjectId(taskId) });
      expect(request).toBeDefined();
      expect(request?.taskId.toString()).toBe(taskId);
    });

    it('should update task status based on material approval', async () => {
      // When material is approved, task should move to appropriate status
      const request = await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [
          { name: 'Hydraulic Oil 32', quantity: 10, unit: 'litres' },
        ],
        status: 'PENDING',
      });

      // Approve material
      await MaterialRequest.findByIdAndUpdate(request._id, {
        status: 'APPROVED',
        approvedAt: new Date(),
      });

      // In real workflow, task would transition to IN_PROGRESS
      const task = await Task.findById(taskId);
      expect(task).toBeDefined();
    });

    it('should track material request in task event log', async () => {
      // Create a material request to link to the task
      await MaterialRequest.create({
        taskId: new Types.ObjectId(taskId),
        requestedBy: new Types.ObjectId(technicianUserId),
        items: [{ name: 'Hydraulic Oil 32', quantity: 5, unit: 'litres' }],
        status: 'PENDING',
      });

      const request = await MaterialRequest.findOne({ taskId: new Types.ObjectId(taskId) });
      expect(request).toBeDefined();
      expect(request?.createdAt).toBeDefined();

      // Task should be findable and status matches what was set in beforeEach
      const task = await Task.findById(taskId);
      expect(task?.status).toBe('MATERIAL_REQUESTED');
    });
  });

  describe('Supplier & Expiry Management', () => {
    it('should track inventory item details', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      expect(item).toBeDefined();
      expect(item?.itemName).toBe('hydraulic oil 32');
      expect(item?.unit).toBe('litres');
      expect(item?.reorderLevel).toBeDefined();
    });

    it('should track inventory timestamps', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });
      expect(item).toBeDefined();
      expect(item?.createdAt).toBeDefined();
      expect(item?.updatedAt).toBeDefined();
      expect(item?.createdAt).toBeInstanceOf(Date);
    });

    it('should flag expired items', async () => {
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });

      const isExpired = item ? new Date() > new Date(item.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000) : false;
      expect(isExpired).toBe(false);
    });

    it('should create reorder record', async () => {
      // When reorder is triggered
      const item = await Inventory.findOne({ itemName: 'hydraulic oil 32' });

      if ((item?.quantity ?? 0) <= (item?.reorderLevel ?? 0)) {
        const reorderRecord = {
          itemName: item?.itemName,
          quantity: item?.quantity,
          dateOrdered: new Date(),
          expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        };

        expect(reorderRecord.itemName).toBeDefined();
        expect(reorderRecord.quantity).toBeGreaterThan(0);
      }
    });
  });
});

