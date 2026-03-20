import { describe, it, expect } from 'vitest';
import { generateId } from '../id';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('returns a valid UUID v4 format', () => {
    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('has correct length (36 characters including hyphens)', () => {
    const id = generateId();
    expect(id).toHaveLength(36);
  });

  it('has hyphens at correct positions', () => {
    const id = generateId();
    expect(id[8]).toBe('-');
    expect(id[13]).toBe('-');
    expect(id[18]).toBe('-');
    expect(id[23]).toBe('-');
  });
});
