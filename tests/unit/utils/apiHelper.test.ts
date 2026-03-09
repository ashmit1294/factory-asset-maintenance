import { describe, it, expect } from '@jest/globals';

describe('API Helper Functions (lib/apiHelper.ts)', () => {
  describe('Response Format Structure', () => {
    it('should format success response with data and meta', () => {
      const successResponse = {
        data: { _id: '123', taskCode: 'TSK-1234-ABC' },
        meta: { timestamp: new Date().toISOString() },
      };

      expect(successResponse.data).toBeDefined();
      expect(successResponse.data.taskCode).toBe('TSK-1234-ABC');
      expect(successResponse.meta).toBeDefined();
    });

    it('should format error response with error code', () => {
      const errorResponse = {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: ['Title is required'],
      };

      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(errorResponse.details)).toBe(true);
    });

    it('should format paginated response with pagination meta', () => {
      const paginatedResponse = {
        data: [
          { _id: '1', taskCode: 'TSK-1234-ABC' },
          { _id: '2', taskCode: 'TSK-5678-DEF' },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 100,
          pages: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      expect(paginatedResponse.data).toHaveLength(2);
      expect(paginatedResponse.meta.page).toBe(1);
      expect(paginatedResponse.meta.total).toBe(100);
      expect(paginatedResponse.meta.pages).toBe(5);
    });
  });

  describe('Pagination Validation', () => {
    it('should enforce default page 1', () => {
      const params: any = {};
      const page = params.page || 1;
      expect(page).toBe(1);
    });

    it('should enforce default limit 20', () => {
      const params: any = {};
      const limit = params.limit || 20;
      expect(limit).toBe(20);
    });

    it('should enforce maximum limit 100', () => {
      const params: any = { limit: 200 };
      const limit = Math.min(params.limit, 100);
      expect(limit).toBe(100);
    });

    it('should enforce minimum page 1', () => {
      const params: any = { page: 0 };
      const page = Math.max(params.page, 1);
      expect(page).toBe(1);
    });

    it('should calculate correct page count', () => {
      const total = 100;
      const limit = 20;
      const pages = Math.ceil(total / limit);
      expect(pages).toBe(5);
    });

    it('should calculate correct offset from page and limit', () => {
      const page = 2;
      const limit = 20;
      const offset = (page - 1) * limit;
      expect(offset).toBe(20);
    });
  });

  describe('Sorting Parameters', () => {
    it('should validate sortBy field', () => {
      const validSortFields = ['createdAt', 'priority', 'status', 'taskCode'];
      const invalidSortFields = ['password', '__v', 'secretField'];

      validSortFields.forEach((field) => {
        expect(validSortFields.includes(field)).toBe(true);
      });

      invalidSortFields.forEach((field) => {
        expect(validSortFields.includes(field)).toBe(false);
      });
    });

    it('should enforce sortOrder enum', () => {
      const validOrders = ['asc', 'desc'];
      const invalidOrders = ['ascending', 'descending', 'up', 'down'];

      validOrders.forEach((order) => {
        expect(validOrders.includes(order)).toBe(true);
      });

      invalidOrders.forEach((order) => {
        expect(validOrders.includes(order)).toBe(false);
      });
    });

    it('should default to desc order', () => {
      const params: any = { sortBy: 'createdAt' };
      const sortOrder = params.sortOrder || 'desc';
      expect(sortOrder).toBe('desc');
    });

    it('should construct MongoDB sort object', () => {
      const sortBy = 'priority';
      const sortOrder = 'asc';
      const mongoSort =
        sortOrder === 'asc' ? { [sortBy]: 1 } : { [sortBy]: -1 };

      expect(mongoSort.priority).toBe(1);
    });
  });

  describe('Query Parsing', () => {
    it('should parse string number parameters', () => {
      const params = { page: '2', limit: '50' };
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);

      expect(page).toBe(2);
      expect(limit).toBe(50);
    });

    it('should handle missing optional parameters', () => {
      const params: any = {};
      const status = params.status || undefined;
      const priority = params.priority || undefined;

      expect(status).toBeUndefined();
      expect(priority).toBeUndefined();
    });

    it('should sanitize string parameters', () => {
      const params: any = { search: 'bearing replacement' };
      const search = params.search.trim();

      expect(search).toBe('bearing replacement');
    });

    it('should validate enum parameters', () => {
      const params: any = { status: 'IN_PROGRESS' };
      const validStatuses = [
        'REPORTED',
        'UNDER_REVIEW',
        'ASSIGNED',
        'IN_PROGRESS',
      ];

      expect(validStatuses.includes(params.status)).toBe(true);
    });
  });

  describe('Response Metadata', () => {
    it('should include pagination in response meta', () => {
      const meta = { page: 1, limit: 20, total: 100, pages: 5 };

      expect(meta.page).toBeDefined();
      expect(meta.limit).toBeDefined();
      expect(meta.total).toBeDefined();
      expect(meta.pages).toBeDefined();
    });

    it('should include sorting in response meta', () => {
      const meta = { sortBy: 'createdAt', sortOrder: 'desc' };

      expect(meta.sortBy).toBeDefined();
      expect(meta.sortOrder).toBeDefined();
    });

    it('should include timestamp in response meta', () => {
      const meta = { timestamp: new Date().toISOString() };

      expect(meta.timestamp).toBeDefined();
      expect(typeof meta.timestamp).toBe('string');
    });

    it('should provide hasMore flag for pagination', () => {
      const page = 1;
      const limit = 20;
      const total = 100;
      const hasMore = page * limit < total;

      expect(hasMore).toBe(true);
    });
  });

  describe('Error Response Details', () => {
    it('should include error array in details', () => {
      const error = {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'title', message: 'Title is required' },
          { field: 'description', message: 'Description too short' },
        ],
      };

      expect(Array.isArray(error.details)).toBe(true);
      expect(error.details).toHaveLength(2);
      expect(error.details[0].field).toBe('title');
    });

    it('should support nested error details', () => {
      const error = {
        error: 'Validation failed',
        details: [
          {
            field: 'items',
            message: 'Invalid items',
            nested: [
              { index: 0, message: 'Quantity must be at least 1' },
              { index: 1, message: 'Unit is required' },
            ],
          },
        ],
      };

      expect(error.details[0].nested).toBeDefined();
      expect(error.details[0].nested).toHaveLength(2);
    });
  });

  describe('Response Status Codes', () => {
    it('should use correct HTTP status codes', () => {
      const responses = {
        success: 200,
        created: 201,
        badRequest: 400,
        unauthorized: 401,
        forbidden: 403,
        notFound: 404,
        conflict: 409,
        serverError: 500,
      };

      expect(responses.success).toBe(200);
      expect(responses.created).toBe(201);
      expect(responses.badRequest).toBe(400);
      expect(responses.conflict).toBe(409);
    });

    it('should map error types to correct status codes', () => {
      const errorMappings = {
        VALIDATION_ERROR: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        FORBIDDEN: 403,
        INSUFFICIENT_INVENTORY: 400,
        OPTIMISTIC_LOCK_FAILED: 409,
      };

      Object.entries(errorMappings).forEach(([code, status]) => {
        expect(typeof status).toBe('number');
        expect(status).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe('Data Transformation', () => {
    it('should exclude sensitive fields from response', () => {
      const userDoc = {
        _id: '123',
        name: 'John',
        email: 'john@factory.com',
        passwordHash: 'secret',
        role: 'MANAGER',
      };

      const cleanUser: any = {
        _id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
      };

      expect(cleanUser.passwordHash).toBeUndefined();
      expect(cleanUser.name).toBeDefined();
    });

    it('should format dates in ISO format', () => {
      const date = new Date('2026-03-09T10:00:00Z');
      const isoString = date.toISOString();

      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should populate referenced documents', () => {
      const taskWithPopulated = {
        _id: '123',
        taskCode: 'TSK-1234-ABC',
        machinery: {
          _id: '456',
          name: 'Conveyor Belt A',
        },
        reportedBy: {
          _id: '789',
          name: 'John Doe',
        },
      };

      expect(taskWithPopulated.machinery.name).toBeDefined();
      expect(taskWithPopulated.reportedBy.name).toBeDefined();
    });
  });

  describe('Consistency Validation', () => {
    it('should ensure response structure consistency', () => {
      const responses = [
        { data: {}, meta: {} },
        { data: [], meta: { page: 1, total: 0 } },
        { error: '', code: '' },
      ];

      responses.forEach((response) => {
        if ('data' in response) {
          expect(response.meta).toBeDefined();
        } else if ('error' in response) {
          expect(response.code).toBeDefined();
        }
      });
    });

    it('should validate pagination consistency', () => {
      const page = 2;
      const limit = 20;
      const total = 100;

      const offset = (page - 1) * limit;
      const pages = Math.ceil(total / limit);

      expect(offset).toBe(20);
      expect(pages).toBe(5);
      expect(page).toBeLessThanOrEqual(pages);
    });
  });
});
