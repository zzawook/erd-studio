import { describe, it, expect } from 'vitest';
import { validateCardinality } from '../validation';

describe('validateCardinality', () => {
  // ---- Valid inputs ----

  describe('valid inputs', () => {
    it('(0, "*") is valid', () => {
      expect(validateCardinality('0', '*')).toBe('');
    });

    it('(1, 1) is valid', () => {
      expect(validateCardinality('1', '1')).toBe('');
    });

    it('(0, 1) is valid', () => {
      expect(validateCardinality('0', '1')).toBe('');
    });

    it('(1, "*") is valid', () => {
      expect(validateCardinality('1', '*')).toBe('');
    });

    it('(2, 5) is valid', () => {
      expect(validateCardinality('2', '5')).toBe('');
    });

    it('(0, 100) is valid', () => {
      expect(validateCardinality('0', '100')).toBe('');
    });

    it('(3, 3) is valid (min equals max)', () => {
      expect(validateCardinality('3', '3')).toBe('');
    });

    it('(0, "*") with whitespace around * is valid', () => {
      expect(validateCardinality('0', ' * ')).toBe('');
    });
  });

  // ---- Invalid min ----

  describe('invalid min', () => {
    it('negative min returns error', () => {
      const result = validateCardinality('-1', '5');
      expect(result).toBe('min must be a non-negative integer');
    });

    it('non-integer min (float) returns error', () => {
      const result = validateCardinality('1.5', '5');
      expect(result).toBe('min must be a non-negative integer');
    });

    it('empty min returns error', () => {
      const result = validateCardinality('', '5');
      expect(result).toBe('min must be a non-negative integer');
    });

    it('NaN min returns error', () => {
      const result = validateCardinality('NaN', '5');
      expect(result).toBe('min must be a non-negative integer');
    });

    it('alphabetic min returns error', () => {
      const result = validateCardinality('abc', '5');
      expect(result).toBe('min must be a non-negative integer');
    });

    it('whitespace-only min returns error', () => {
      const result = validateCardinality('   ', '5');
      expect(result).toBe('min must be a non-negative integer');
    });
  });

  // ---- Invalid max ----

  describe('invalid max', () => {
    it('max of 0 returns error', () => {
      const result = validateCardinality('0', '0');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('negative max returns error', () => {
      const result = validateCardinality('0', '-1');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('non-integer max (float) returns error', () => {
      const result = validateCardinality('0', '2.5');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('non-* string max returns error', () => {
      const result = validateCardinality('0', 'abc');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('empty max returns error', () => {
      const result = validateCardinality('0', '');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('NaN max returns error', () => {
      const result = validateCardinality('0', 'NaN');
      expect(result).toBe('max must be a positive integer or *');
    });

    it('whitespace-only max returns error', () => {
      const result = validateCardinality('0', '   ');
      expect(result).toBe('max must be a positive integer or *');
    });
  });

  // ---- min > max ----

  describe('min > max', () => {
    it('min exceeding max returns error', () => {
      const result = validateCardinality('5', '3');
      expect(result).toBe('min cannot exceed max');
    });

    it('min=10, max=1 returns error', () => {
      const result = validateCardinality('10', '1');
      expect(result).toBe('min cannot exceed max');
    });
  });
});
