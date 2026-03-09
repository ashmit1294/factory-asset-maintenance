import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { signToken, verifyToken } from '@/lib/auth';
import type { JWTPayload } from '@/types';

describe('JWT Authentication (lib/auth.ts)', () => {
  let validToken: string;
  let payload: Omit<JWTPayload, 'iat' | 'exp'>;

  beforeAll(() => {
    // Setup: Create test payload (without iat and exp, they're auto-generated)
    payload = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@factory.com',
      name: 'Test User',
      role: 'MANAGER',
    };
  });

  describe('signToken()', () => {
    it('should generate a valid JWT token', () => {
      validToken = signToken(payload);
      expect(validToken).toBeDefined();
      expect(typeof validToken).toBe('string');
      expect(validToken.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should encode payload correctly', () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded._id).toBe(payload._id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should create tokens for different roles', () => {
      const roles: Array<'USER' | 'TECHNICIAN' | 'MANAGER' | 'SENIOR_MANAGER'> = [
        'USER',
        'TECHNICIAN',
        'MANAGER',
        'SENIOR_MANAGER',
      ];

      roles.forEach((role) => {
        const testPayload = { ...payload, role };
        const token = signToken(testPayload);
        const decoded = verifyToken(token);
        expect(decoded.role).toBe(role);
      });
    });

    it('should set token expiry to 8 hours', () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      const expiryTime = ((decoded.exp ?? 0) - (decoded.iat ?? 0)) * 1000; // Convert to ms
      expect(expiryTime).toBeCloseTo(8 * 60 * 60 * 1000, -2); // Within 100ms
    });
  });

  describe('verifyToken()', () => {
    beforeAll(() => {
      validToken = signToken(payload);
    });

    it('should verify a valid token', () => {
      const decoded = verifyToken(validToken);
      expect(decoded).toBeDefined();
      expect(decoded._id).toBe(payload._id);
    });

    it('should throw error for invalid token signature', () => {
      const fakeToken = validToken.slice(0, -10) + '1234567890';
      expect(() => verifyToken(fakeToken)).toThrow();
    });

    it('should throw error for expired token', () => {
      // Create an expired token by signing with a past token (or use a tampered token)
      // Since we can't directly control expiry in signToken, we test by using jwt directly
      const jwt = require('jsonwebtoken');
      const expiredPayload = {
        ...payload,
      };
      // Create token that expires immediately (negative expiresIn is not valid, so we use a small positive value)
      // Then we manually create an old token string
      const SECRET = process.env.JWT_SECRET!;
      const expiredToken = jwt.sign(expiredPayload, SECRET, { expiresIn: '-1h' }); // Already expired
      expect(() => verifyToken(expiredToken)).toThrow();
    });

    it('should throw error for malformed token', () => {
      const malformedTokens = [
        'not.a.token',
        'two.parts',
        'only.a.single',
        '',
        null,
      ];

      malformedTokens.forEach((token: any) => {
        expect(() => verifyToken(token)).toThrow();
      });
    });

    it('should return decoded payload with all fields', () => {
      const decoded = verifyToken(validToken);
      expect(decoded._id).toBeDefined();
      expect(decoded.email).toBeDefined();
      expect(decoded.name).toBeDefined();
      expect(decoded.role).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('Token Security', () => {
    it('should not allow token tampering', () => {
      const token = signToken(payload);
      // Split token and tamper with payload
      const [header, payload_b64, signature] = token.split('.');
      const tampered = `${header}.invalid_payload.${signature}`;

      expect(() => verifyToken(tampered)).toThrow();
    });

    it('should preserve all role types in token', () => {
      const testRoles: Array<'USER' | 'TECHNICIAN' | 'MANAGER' | 'SENIOR_MANAGER'> = [
        'USER',
        'TECHNICIAN',
        'MANAGER',
        'SENIOR_MANAGER',
      ];

      testRoles.forEach((role) => {
        const token = signToken({ ...payload, role });
        const decoded = verifyToken(token);
        expect(decoded.role).toBe(role);
      });
    });

    it('should not expose password in token', () => {
      // Normal usage of signToken should never include passwordHash in the payload
      const token = signToken(payload);
      const decoded = verifyToken(token);

      // Password fields should not be in a normally-signed token
      expect(Object.keys(decoded)).not.toContain('passwordHash');
    });
  });

  describe('Token Expiry Edge Cases', () => {
    it('should reject an already-expired token', () => {
      const jwt = require('jsonwebtoken');
      const SECRET = process.env.JWT_SECRET!;
      // Sign directly with an already-past exp to bypass signToken's expiresIn
      const expiredToken = jwt.sign(
        { ...payload, exp: Math.floor(Date.now() / 1000) - 3600 },
        SECRET,
      );
      expect(() => verifyToken(expiredToken)).toThrow();
    });

    it('should accept a freshly signed token as valid', () => {
      const token = signToken(payload);
      expect(() => verifyToken(token)).not.toThrow();
    });
  });
});
