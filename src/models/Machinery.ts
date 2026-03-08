import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { MachineryStatus } from '@/types';

export interface IMaintenanceHistoryEntry {
  taskId: Types.ObjectId;
  taskCode: string;
  resolvedAt: Date;
  summary: string;
}

export interface IMachinery extends Document {
  name: string;
  serialNumber: string;
  location: string;
  type: string;
  status: MachineryStatus;
  maintenanceHistory: IMaintenanceHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceHistorySchema = new Schema<IMaintenanceHistoryEntry>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    taskCode: {
      type: String,
      required: true,
      trim: true,
    },
    resolvedAt: {
      type: Date,
      required: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const MachinerySchema = new Schema<IMachinery>(
  {
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
      minlength: [2, 'Machine name must be at least 2 characters'],
      maxlength: [150, 'Machine name cannot exceed 150 characters'],
    },
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Serial number must be at least 2 characters'],
      maxlength: [50, 'Serial number cannot exceed 50 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      minlength: [2, 'Location must be at least 2 characters'],
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Machine type is required'],
      trim: true,
      minlength: [2, 'Machine type must be at least 2 characters'],
      maxlength: [100, 'Machine type cannot exceed 100 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'DECOMMISSIONED'],
        message: 'Status must be ACTIVE or DECOMMISSIONED',
      },
      default: 'ACTIVE',
    },
    maintenanceHistory: {
      type: [MaintenanceHistorySchema],
      default: [],
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
MachinerySchema.index({ status: 1 });

const Machinery: Model<IMachinery> =
  mongoose.models.Machinery ||
  mongoose.model<IMachinery>('Machinery', MachinerySchema);

export default Machinery;