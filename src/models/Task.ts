import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  TaskStatus,
  Priority,
  EventLogEntry,
  ESCALATION_EXEMPT_STATES,
} from '@/types';

export interface ITask extends Document {
  taskCode: string;
  title: string;
  description: string;
  machineryId: Types.ObjectId;
  priority: Priority;
  slaDeadline: Date;
  slaBreached: boolean;
  status: TaskStatus;
  reportedBy: Types.ObjectId;
  assignedTo: Types.ObjectId | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  pauseReason: string | null;
  reopenReason: string | null;
  escalatedAt: Date | null;
  completedAt: Date | null;
  confirmedAt: Date | null;
  eventLog: EventLogEntry[];
  __v: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventLogEntrySchema = new Schema<EventLogEntry>(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    fromStatus: {
      type: String,
      default: null,
    },
    toStatus: {
      type: String,
      required: true,
    },
    performedBy: {
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      role: {
        type: String,
        required: true,
      },
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: false }
);

const TaskSchema = new Schema<ITask>(
  {
    taskCode: {
      type: String,
      required: [true, 'Task code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [
        /^TSK-\d{4}-[A-Z]{3}$/,
        'Task code must follow format TSK-XXXX-YYY',
      ],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    machineryId: {
      type: Schema.Types.ObjectId,
      ref: 'Machinery',
      required: [true, 'Machinery reference is required'],
    },
    priority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL',
      },
      required: [true, 'Priority is required'],
    },
    slaDeadline: {
      type: Date,
      required: [true, 'SLA deadline is required'],
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: {
        values: [
          'REPORTED',
          'UNDER_REVIEW',
          'ASSIGNED',
          'IN_PROGRESS',
          'MATERIAL_REQUESTED',
          'PAUSED',
          'ESCALATED',
          'COMPLETED',
          'REOPENED',
          'CONFIRMED',
          'REJECTED',
          'CANCELLED',
        ],
        message: 'Invalid task status',
      },
      default: 'REPORTED',
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    pauseReason: {
      type: String,
      default: null,
      trim: true,
    },
    reopenReason: {
      type: String,
      default: null,
      trim: true,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    eventLog: {
      type: [EventLogEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // enables __v-based race condition protection
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
TaskSchema.index({ status: 1 });
TaskSchema.index({ reportedBy: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ priority: 1, slaDeadline: 1 });
TaskSchema.index({ title: 'text', description: 'text' });

// ── Virtual: compute SLA breach status on-the-fly ──────────────────────────
TaskSchema.virtual('isSlaBreached').get(function (this: ITask) {
  if (ESCALATION_EXEMPT_STATES.includes(this.status)) return false;
  if (!this.slaDeadline) return false;
  return new Date() > this.slaDeadline;
});

const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;