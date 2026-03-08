import { Types } from 'mongoose';

export type Role = 'USER' | 'MANAGER' | 'SENIOR_MANAGER' | 'TECHNICIAN';

export type TaskStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'MATERIAL_REQUESTED'
  | 'PAUSED'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaterialRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MachineryStatus = 'ACTIVE' | 'DECOMMISSIONED';
export type Unit = 'pcs' | 'kg' | 'litres' | 'metres' | 'boxes';

export interface IMaterialItem {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface EventLogEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  performedBy: {
    userId: Types.ObjectId;
    name: string;
    role: string;
  };
  note?: string;
  timestamp: Date;
}

export interface JWTPayload {
  _id: string;
  role: Role;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest {
  user: {
    _id: string;
    role: Role;
    name: string;
    email: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const SLA_HOURS: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export const TERMINAL_STATES: TaskStatus[] = [
  'CONFIRMED',
  'CANCELLED',
  'REJECTED',
];

export const ESCALATION_EXEMPT_STATES: TaskStatus[] = [
  'CONFIRMED',
  'CANCELLED',
  'REJECTED',
  'PAUSED',
  'ESCALATED',
];