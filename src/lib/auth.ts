import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { JWTPayload } from '@/types';
import { UnauthorizedError } from '@/lib/errors';
import connectDB from '@/lib/db';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

// Simple in-memory LRU cache for isActive (60s TTL)
interface CacheEntry {
  isActive: boolean;
  ts: number;
}
const activeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached(userId: string): boolean | null {
  const entry = activeCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    activeCache.delete(userId);
    return null;
  }
  return entry.isActive;
}

function setCache(userId: string, isActive: boolean): void {
  activeCache.set(userId, { isActive, ts: Date.now() });
}

export function signToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function getAuthUser(req: NextRequest): Promise<JWTPayload> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No authorization token provided');
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  // Check cache first
  const cachedActive = getCached(payload._id);
  if (cachedActive !== null) {
    if (!cachedActive) throw new UnauthorizedError('Account has been deactivated');
    return payload;
  }

  // DB check
  await connectDB();
  const user = await User.findById(payload._id).select('isActive').lean() as {
    isActive: boolean;
  } | null;

  if (!user) {
    throw new UnauthorizedError('User account not found');
  }

  setCache(payload._id, user.isActive);

  if (!user.isActive) {
    throw new UnauthorizedError('Account has been deactivated');
  }

  return payload;
}

export function requireRoles(...allowedRoles: string[]) {
  return (userRole: string): void => {
    if (!allowedRoles.includes(userRole)) {
      throw new UnauthorizedError(
        `Access denied. Required role(s): ${allowedRoles.join(', ')}`
      );
    }
  };
}