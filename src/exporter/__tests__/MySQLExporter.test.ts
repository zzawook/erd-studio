import { describe, it, expect } from 'vitest';
import { MySQLExporter } from '../MySQLExporter';
import type { ERDModel, Attribute, Entity, CandidateKey } from '../../ir/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttr(overrides: Partial<Attribute> & { id: string; name: string }): Attribute {
  return {
    dataType: { name: 'VARCHAR', precision: 255 },
    nullable: true,
    kind: 'simple',
    isPartialKey: false,
    childAttributeIds: [],
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> & { id: string; name: string }): Entity {
  return {
    isWeak: false,
    attributes: [],
    candidateKeys: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makePK(attrIds: string[], id = 'pk1'): CandidateKey {
  return { id, name: 'PK', attributeIds: attrIds, isPrimary: true };
}

const exporter = new MySQLExporter();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MySQLExporter', () => {
  it('has dialect MySQL', () => {
    expect(exporter.dialect).toBe('MySQL');
  });

  // -----------------------------------------------------------------------
  // Backtick quoting
  // -----------------------------------------------------------------------

  it('uses backtick quoting for identifiers', () => {
    expect(exporter.quoteIdentifier('table')).toBe('`table`');
  });

  it('escapes backticks in identifiers', () => {
    expect(exporter.quoteIdentifier('has`tick')).toBe('`has``tick`');
  });

  it('generates DDL with backtick identifiers', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'User',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE `User`');
    expect(result.ddl).toContain('`id` INT NOT NULL');
    expect(result.ddl).toContain('PRIMARY KEY (`id`)');
  });

  // -----------------------------------------------------------------------
  // MySQL-specific type mappings
  // -----------------------------------------------------------------------

  describe('type mappings (dialect differences)', () => {
    it('maps INT to INT (not INTEGER)', () => {
      expect(exporter.mapDataType({ name: 'INT' })).toBe('INT');
    });

    it('maps BOOLEAN to TINYINT(1)', () => {
      expect(exporter.mapDataType({ name: 'BOOLEAN' })).toBe('TINYINT(1)');
    });

    it('maps UUID to CHAR(36)', () => {
      expect(exporter.mapDataType({ name: 'UUID' })).toBe('CHAR(36)');
    });

    it('maps JSONB to JSON', () => {
      expect(exporter.mapDataType({ name: 'JSONB' })).toBe('JSON');
    });

    it('maps BYTEA to BLOB', () => {
      expect(exporter.mapDataType({ name: 'BYTEA' })).toBe('BLOB');
    });

    it('maps TIMESTAMPTZ to TIMESTAMP', () => {
      expect(exporter.mapDataType({ name: 'TIMESTAMPTZ' })).toBe('TIMESTAMP');
    });

    it('maps NUMERIC to DECIMAL', () => {
      expect(exporter.mapDataType({ name: 'NUMERIC' })).toBe('DECIMAL');
    });

    it('maps NUMERIC with precision to DECIMAL(p)', () => {
      expect(exporter.mapDataType({ name: 'NUMERIC', precision: 10 })).toBe('DECIMAL(10)');
    });

    it('maps NUMERIC with precision+scale to DECIMAL(p,s)', () => {
      expect(exporter.mapDataType({ name: 'NUMERIC', precision: 10, scale: 2 })).toBe('DECIMAL(10,2)');
    });
  });

  // -----------------------------------------------------------------------
  // Types shared with PostgreSQL but same mapping
  // -----------------------------------------------------------------------

  describe('shared type mappings', () => {
    it('maps VARCHAR with precision', () => {
      expect(exporter.mapDataType({ name: 'VARCHAR', precision: 100 })).toBe('VARCHAR(100)');
    });

    it('maps VARCHAR without precision to VARCHAR(255)', () => {
      expect(exporter.mapDataType({ name: 'VARCHAR' })).toBe('VARCHAR(255)');
    });

    it('maps TEXT', () => {
      expect(exporter.mapDataType({ name: 'TEXT' })).toBe('TEXT');
    });

    it('maps BIGINT', () => {
      expect(exporter.mapDataType({ name: 'BIGINT' })).toBe('BIGINT');
    });

    it('maps SMALLINT', () => {
      expect(exporter.mapDataType({ name: 'SMALLINT' })).toBe('SMALLINT');
    });

    it('maps DATE', () => {
      expect(exporter.mapDataType({ name: 'DATE' })).toBe('DATE');
    });

    it('maps TIMESTAMP', () => {
      expect(exporter.mapDataType({ name: 'TIMESTAMP' })).toBe('TIMESTAMP');
    });

    it('passes through unknown type', () => {
      expect(exporter.mapDataType({ name: 'MONEY' })).toBe('MONEY');
    });
  });

  // -----------------------------------------------------------------------
  // Full DDL generation with MySQL dialect
  // -----------------------------------------------------------------------

  it('uses MySQL types in full DDL', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Config',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'UUID' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'active', dataType: { name: 'BOOLEAN' } }),
            makeAttr({ id: 'a3', name: 'data', dataType: { name: 'JSONB' } }),
            makeAttr({ id: 'a4', name: 'blob_data', dataType: { name: 'BYTEA' } }),
            makeAttr({ id: 'a5', name: 'amount', dataType: { name: 'NUMERIC', precision: 10, scale: 2 } }),
            makeAttr({ id: 'a6', name: 'updated_at', dataType: { name: 'TIMESTAMPTZ' } }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('`id` CHAR(36) NOT NULL');
    expect(result.ddl).toContain('`active` TINYINT(1)');
    expect(result.ddl).toContain('`data` JSON');
    expect(result.ddl).toContain('`blob_data` BLOB');
    expect(result.ddl).toContain('`amount` DECIMAL(10,2)');
    expect(result.ddl).toContain('`updated_at` TIMESTAMP');
  });

  // -----------------------------------------------------------------------
  // Verify MySQL exporter inherits base behavior (FK, junction tables, etc.)
  // -----------------------------------------------------------------------

  it('creates junction tables with backtick quoting', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE `enrolls`');
    expect(result.ddl).toContain('`student_id` INT NOT NULL');
    expect(result.ddl).toContain('`course_id` INT NOT NULL');
  });

  it('returns empty DDL for an empty model', () => {
    const model: ERDModel = { entities: [], relationships: [], aggregations: [] };
    const result = exporter.export(model);
    expect(result.ddl).toBe('');
    expect(result.warnings).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Candidate key columns must be NOT NULL (issue #16)
  // -----------------------------------------------------------------------

  it('adds NOT NULL to candidate key column even when attribute is nullable', () => {
    function makeUK(attrIds: string[], id = 'uk1'): CandidateKey {
      return { id, name: 'UK', attributeIds: attrIds, isPrimary: false };
    }
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Students',
          attributes: [
            makeAttr({ id: 'a1', name: 'email', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
            makeAttr({ id: 'a2', name: 'ids', dataType: { name: 'VARCHAR', precision: 255 }, nullable: true }),
          ],
          candidateKeys: [makePK(['a1']), makeUK(['a2'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('`ids` VARCHAR(255) NOT NULL');
    expect(result.ddl).toContain('UNIQUE (`ids`)');
  });

  it('handles 1:N FK with backtick quoting', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Dept',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Emp',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('FOREIGN KEY (`dept_id`) REFERENCES `Dept` (`id`)');
  });
});
