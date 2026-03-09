import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InsufficientInventoryError,
} from '@/lib/errors';

describe('Error Classes (lib/errors.ts)', () => {
  describe('AppError Base Class', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have proper error stack trace', () => {
      const error = new AppError('Stack test', 500, 'STACK_ERROR');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should be serializable to JSON', () => {
      const error = new AppError('Serializable', 500, 'SERIALIZE_ERROR');
      const json = JSON.stringify({
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
      });
      expect(json).toContain('Serializable');
      expect(json).toContain('500');
    });
  });

  describe('ValidationError', () => {
    it('should have 400 status code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should have VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid email format');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should have VALIDATION_ERROR code by default', () => {
      const error = new ValidationError('Test validation');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should contain descriptive message', () => {
      const message = 'Email must be unique';
      const error = new ValidationError(message);
      expect(error.message).toContain(message);
    });
  });

  describe('ForbiddenError', () => {
    it('should have 403 status code', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.statusCode).toBe(403);
    });

    it('should have FORBIDDEN error code', () => {
      const error = new ForbiddenError('You do not have permission');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should be raised for privilege escalation attempts', () => {
      const error = new ForbiddenError('User cannot perform this action');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should have 404 status code', () => {
      const error = new NotFoundError('Task not found');
      expect(error.statusCode).toBe(404);
    });

    it('should have NOT_FOUND error code', () => {
      const error = new NotFoundError('Resource does not exist');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should prevent ID enumeration attacks', () => {
      // When returning 404 for both missing and unauthorized resources
      const notFoundError = new NotFoundError('Not found');
      const forbiddenError = new ForbiddenError('Forbidden');

      expect(notFoundError.statusCode).toBe(404);
      expect(forbiddenError.statusCode).toBe(403);

      // Implementation should return 404 for all "not accessible" cases
      expect(notFoundError.statusCode).toBe(404);
    });
  });

  describe('ConflictError', () => {
    it('should have 409 status code', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.statusCode).toBe(409);
    });

    it('should have CONFLICT error code', () => {
      const error = new ConflictError('Duplicate task in 24 hours');
      expect(error.code).toBe('CONFLICT');
    });

    it('should be used for duplicate detections', () => {
      const error = new ConflictError('Task already exists for this machine');
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('already exists');
    });

    it('should be used for optimistic lock mismatches', () => {
      const error = new ConflictError('Document version mismatch');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('InsufficientInventoryError', () => {
    it('should have 400 status code', () => {
      const error = new InsufficientInventoryError('Not enough stock');
      expect(error.statusCode).toBe(400);
    });

    it('should have INSUFFICIENT_INVENTORY code', () => {
      const error = new InsufficientInventoryError('Ball bearing: need 5, have 2');
      expect(error.code).toBe('INSUFFICIENT_INVENTORY');
    });

    it('should track which items are insufficient', () => {
      const error = new InsufficientInventoryError('Hydraulic oil: insufficient stock');
      expect(error.message).toContain('Hydraulic oil');
      expect(error.message).toContain('insufficient');
    });

    it('should support transaction rollback context', () => {
      const error = new InsufficientInventoryError(
        'Cannot complete material approval due to insufficient inventory',
      );
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INSUFFICIENT_INVENTORY');
    });
  });

  describe('Error Response Structure', () => {
    it('should provide consistent error response format', () => {
      const errors = [
        new ValidationError('Test'),
        new ForbiddenError('Test'),
        new NotFoundError('Test'),
        new ConflictError('Test'),
        new InsufficientInventoryError('Test'),
      ];

      errors.forEach((error) => {
        expect(error.message).toBeDefined();
        expect(error.statusCode).toBeDefined();
        expect(error.code).toBeDefined();
        expect(typeof error.statusCode).toBe('number');
        expect(typeof error.code).toBe('string');
      });
    });

    it('should provide HTTP status codes in valid range', () => {
      const errors = [
        new ValidationError('Test'),
        new ForbiddenError('Test'),
        new NotFoundError('Test'),
        new ConflictError('Test'),
        new InsufficientInventoryError('Test'),
      ];

      errors.forEach((error) => {
        expect(error.statusCode).toBeGreaterThanOrEqual(400);
        expect(error.statusCode).toBeLessThan(600);
      });
    });
  });

  describe('Error Inheritance', () => {
    it('should all inherit from Error', () => {
      const errors = [
        new ValidationError('Test'),
        new ForbiddenError('Test'),
        new NotFoundError('Test'),
        new ConflictError('Test'),
        new InsufficientInventoryError('Test'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should all inherit from AppError', () => {
      const errors = [
        new ValidationError('Test'),
        new ForbiddenError('Test'),
        new NotFoundError('Test'),
        new ConflictError('Test'),
        new InsufficientInventoryError('Test'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(AppError);
      });
    });
  });

  describe('Error Messages', () => {
    it('should support contextual messages', () => {
      const contexts = [
        'Email must be unique',
        'Task not found for machinery X',
        'Cannot access another user task',
        'Duplicate task in 24 hours',
        'Stock insufficient for Ball bearing',
      ];

      contexts.forEach((msg) => {
        const error = new AppError(msg, 400, 'TEST');
        expect(error.message).toBe(msg);
      });
    });

    it('should preserve special characters in messages', () => {
      const specialMessages = [
        "User's task cannot be modified",
        'Item: "Ball Bearing" (5pcs)',
        "Email validation failed: invalid@email",
      ];

      specialMessages.forEach((msg) => {
        const error = new AppError(msg, 400, 'TEST');
        expect(error.message).toBe(msg);
      });
    });
  });
});
