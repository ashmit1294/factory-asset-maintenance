import mongoose, { Schema, Document, Model } from 'mongoose';
import { Unit } from '@/types';

export interface IInventory extends Document {
  itemName: string;
  quantity: number;
  unit: Unit;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [1, 'Item name cannot be empty'],
      maxlength: [200, 'Item name cannot exceed 200 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    unit: {
      type: String,
      enum: {
        values: ['pcs', 'kg', 'litres', 'metres', 'boxes'],
        message: 'Unit must be one of: pcs, kg, litres, metres, boxes',
      },
      required: [true, 'Unit is required'],
    },
    reorderLevel: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative'],
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
InventorySchema.index({ itemName: 1 }, { unique: true });

const Inventory: Model<IInventory> =
  mongoose.models.Inventory ||
  mongoose.model<IInventory>('Inventory', InventorySchema);

export default Inventory;