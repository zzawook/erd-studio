import { describe, it, expect } from 'vitest';
import { isMany, fkColumnName } from '../cardinality';

describe('isMany', () => {
  it('returns true for max = "*"', () => {
    expect(isMany({ min: 0, max: '*' })).toBe(true);
  });

  it('returns true for max = 2', () => {
    expect(isMany({ min: 0, max: 2 })).toBe(true);
  });

  it('returns true for max = 5', () => {
    expect(isMany({ min: 1, max: 5 })).toBe(true);
  });

  it('returns false for max = 1', () => {
    expect(isMany({ min: 0, max: 1 })).toBe(false);
  });

  it('returns false for max = 0', () => {
    expect(isMany({ min: 0, max: 0 })).toBe(false);
  });
});

describe('fkColumnName', () => {
  it('generates correct format with lowercase entity name', () => {
    expect(fkColumnName('Student', 'id')).toBe('student_id');
  });

  it('generates correct format for multi-word entity', () => {
    expect(fkColumnName('CourseSection', 'sectionId')).toBe('coursesection_sectionId');
  });

  it('handles already-lowercase entity name', () => {
    expect(fkColumnName('department', 'name')).toBe('department_name');
  });
});
