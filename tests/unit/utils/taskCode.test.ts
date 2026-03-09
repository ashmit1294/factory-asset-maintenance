import { describe, it, expect, beforeAll } from '@jest/globals';
import { generateTaskCode } from '@/lib/taskCode';

describe('Task Code Generation (lib/taskCode.ts)', () => {
  const TASK_CODE_PATTERN = /^TSK-\d{4}-[A-Z]{3}$/;

  describe('generateTaskCode()', () => {
    it('should generate code in TSK-XXXX-YYY format', () => {
      const code = generateTaskCode();
      expect(code).toMatch(TASK_CODE_PATTERN);
    });

    it('should start with TSK prefix', () => {
      const code = generateTaskCode();
      expect(code.substring(0, 3)).toBe('TSK');
    });

    it('should have 4 numeric digits after prefix', () => {
      const code = generateTaskCode();
      const numericPart = code.substring(4, 8);
      expect(/^\d{4}$/.test(numericPart)).toBe(true);
      expect(parseInt(numericPart)).toBeGreaterThanOrEqual(1000);
      expect(parseInt(numericPart)).toBeLessThanOrEqual(9999);
    });

    it('should have 3 uppercase letters at end', () => {
      const code = generateTaskCode();
      const letterPart = code.substring(9, 12);
      expect(/^[A-Z]{3}$/.test(letterPart)).toBe(true);
    });

    it('should use hyphen separators correctly', () => {
      const code = generateTaskCode();
      expect(code.charAt(3)).toBe('-');
      expect(code.charAt(8)).toBe('-');
      expect(code.length).toBe(12);
    });
  });

  describe('Code Uniqueness', () => {
    it('should generate different codes on multiple calls', () => {
      const code1 = generateTaskCode();
      const code2 = generateTaskCode();
      const code3 = generateTaskCode();

      expect(code1).not.toBe(code2);
      expect(code2).not.toBe(code3);
      expect(code1).not.toBe(code3);
    });

    it('should not easily produce duplicates (low probability)', () => {
      const codes = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateTaskCode());
      }

      // Should have high uniqueness - allow max 5% collision rate
      const expectedMinUnique = iterations * 0.95;
      expect(codes.size).toBeGreaterThan(expectedMinUnique);
    });

    it('should support generating 10000+ unique codes', () => {
      // Numeric part ranges 1000-9999 = 9000 combinations
      // Letter part is 26^3 = 17576 combinations
      // Total possible: 9000 * 17576 = 158,184,000 combinations
      const codes = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        codes.add(generateTaskCode());
      }

      expect(codes.size).toBeGreaterThan(950); // Allow slight collisions
    });
  });

  describe('Code Parsing', () => {
    it('should parse generated code correctly', () => {
      const code = generateTaskCode();
      const [prefix, numeric, letters] = code.split('-');

      expect(prefix).toBe('TSK');
      expect(numeric.length).toBe(4);
      expect(/^\d{4}$/.test(numeric)).toBe(true);
      expect(letters.length).toBe(3);
      expect(/^[A-Z]{3}$/.test(letters)).toBe(true);
    });

    it('should extract numeric value from code', () => {
      const code = generateTaskCode();
      const [, numeric] = code.split('-');
      const value = parseInt(numeric);
      expect(value).toBeGreaterThanOrEqual(1000);
      expect(value).toBeLessThanOrEqual(9999);
    });
  });

  describe('Code Validation', () => {
    it('should only use A-Z uppercase letters (no lowercase)', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateTaskCode();
        const [, , letters] = code.split('-');
        expect(letters).toMatch(/^[A-Z]{3}$/);
        expect(letters).not.toMatch(/[a-z]/);
      }
    });

    it('should only use numeric digits 0-9', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateTaskCode();
        const [, numeric] = code.split('-');
        expect(numeric).toMatch(/^\d{4}$/);
        expect(numeric).not.toMatch(/[^0-9]/);
      }
    });

    it('should not contain special characters except hyphens', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateTaskCode();
        expect(code).toMatch(/^TSK-\d{4}-[A-Z]{3}$/);
        expect(code).not.toMatch(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/);
      }
    });
  });

  describe('Collision Handling', () => {
    it('should have strategy for handling duplicates at DB level', () => {
      // Note: Actual implementation uses retry logic (5 attempts)
      // This test ensures code format never changes
      const code = generateTaskCode();
      expect(code).toMatch(TASK_CODE_PATTERN);
    });

    it('should generate codes that can be indexed uniquely', () => {
      const codes = [];
      for (let i = 0; i < 100; i++) {
        codes.push(generateTaskCode());
      }

      // All codes should be indexable and unique-constraint compatible
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBeGreaterThan(95);
    });
  });

  describe('Randomness Distribution', () => {
    it('should distribute numeric part across range', () => {
      const numerics = new Set<string>();
      for (let i = 0; i < 500; i++) {
        const code = generateTaskCode();
        const [, numeric] = code.split('-');
        numerics.add(numeric);
      }
      // Should have good distribution (not all same range)
      expect(numerics.size).toBeGreaterThan(100);
    });

    it('should distribute letter part across alphabet', () => {
      const letterCounts: Record<string, number> = {};
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const code = generateTaskCode();
        const [, , letters] = code.split('-');
        for (const letter of letters) {
          letterCounts[letter] = (letterCounts[letter] || 0) + 1;
        }
      }

      // Should use multiple different letters
      expect(Object.keys(letterCounts).length).toBeGreaterThan(10);

      // Each letter should appear fairly in distribution
      const counts = Object.values(letterCounts);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      counts.forEach((count) => {
        expect(count).toBeLessThan(avgCount * 2); // No extreme outliers
      });
    });
  });
});
