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
  email: string;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser {
  user: {
    _id: string;
    role: Role;
    name: string;
    email: string;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
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