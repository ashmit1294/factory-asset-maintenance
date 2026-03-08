import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { MaterialRequestStatus, Unit } from '@/types';

export interface IMaterialItem {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface IMaterialRequest extends Document {
  taskId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  items: IMaterialItem[];
  status: MaterialRequestStatus;
  rejectionCount: number;
  approvedBy: Types.ObjectId | null;
  rejectionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialItemSchema = new Schema<IMaterialItem>(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      minlength: [1, 'Item name cannot be empty'],
      maxlength: [200, 'Item name cannot exceed 200 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: String,
      enum: {
        values: ['pcs', 'kg', 'litres', 'metres', 'boxes'],
        message: 'Unit must be one of: pcs, kg, litres, metres, boxes',
      },
      required: [true, 'Unit is required'],
    },
  },
  { _id: false }
);

const MaterialRequestSchema = new Schema<IMaterialRequest>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task reference is required'],
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required'],
    },
    items: {
      type: [MaterialItemSchema],
      validate: {
        validator: (items: IMaterialItem[]) => Array.isArray(items) && items.length >= 1,
        message: 'At least one item is required in a material request',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'APPROVED', 'REJECTED'],
        message: 'Status must be PENDING, APPROVED, or REJECTED',
      },
      default: 'PENDING',
    },
    rejectionCount: {
      type: Number,
      default: 0,
      min: [0, 'Rejection count cannot be negative'],
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionNote: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Rejection note cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
MaterialRequestSchema.index({ taskId: 1 });
MaterialRequestSchema.index({ requestedBy: 1 });
MaterialRequestSchema.index({ status: 1 });
MaterialRequestSchema.index({ taskId: 1, status: 1 });

const MaterialRequest: Model<IMaterialRequest> =
  mongoose.models.MaterialRequest ||
  mongoose.model<IMaterialRequest>('MaterialRequest', MaterialRequestSchema);

export default MaterialRequest;