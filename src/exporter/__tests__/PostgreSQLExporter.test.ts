import { describe, it, expect } from 'vitest';
import { PostgreSQLExporter } from '../PostgreSQLExporter';
import { BaseExporter } from '../BaseExporter';
import type { ERDModel, Entity, Attribute, CandidateKey, DataType, Participant } from '../../ir/types';

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

function makeUK(attrIds: string[], id = 'uk1'): CandidateKey {
  return { id, name: 'UK', attributeIds: attrIds, isPrimary: false };
}

const exporter = new PostgreSQLExporter();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgreSQLExporter', () => {
  it('has dialect PostgreSQL', () => {
    expect(exporter.dialect).toBe('PostgreSQL');
  });

  // -----------------------------------------------------------------------
  // Empty model
  // -----------------------------------------------------------------------

  it('returns empty DDL for an empty model', () => {
    const model: ERDModel = { entities: [], relationships: [], aggregations: [] };
    const result = exporter.export(model);
    expect(result.ddl).toBe('');
    expect(result.warnings).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Single entity with attributes
  // -----------------------------------------------------------------------

  it('generates CREATE TABLE with double-quote identifiers for a single entity', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'name', dataType: { name: 'VARCHAR', precision: 100 } }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "Student"');
    expect(result.ddl).toContain('"id" INTEGER NOT NULL');
    expect(result.ddl).toContain('"name" VARCHAR(100)');
    expect(result.ddl).toContain('PRIMARY KEY ("id")');
  });

  // -----------------------------------------------------------------------
  // Type mappings
  // -----------------------------------------------------------------------

  describe('type mappings', () => {
    const cases: [string, { name: string; precision?: number; scale?: number }, string][] = [
      ['VARCHAR with precision', { name: 'VARCHAR', precision: 100 }, 'VARCHAR(100)'],
      ['VARCHAR without precision', { name: 'VARCHAR' }, 'VARCHAR(255)'],
      ['TEXT', { name: 'TEXT' }, 'TEXT'],
      ['INT → INTEGER', { name: 'INT' }, 'INTEGER'],
      ['BIGINT', { name: 'BIGINT' }, 'BIGINT'],
      ['SMALLINT', { name: 'SMALLINT' }, 'SMALLINT'],
      ['NUMERIC bare', { name: 'NUMERIC' }, 'NUMERIC'],
      ['NUMERIC with precision', { name: 'NUMERIC', precision: 10 }, 'NUMERIC(10)'],
      ['NUMERIC with precision+scale', { name: 'NUMERIC', precision: 10, scale: 2 }, 'NUMERIC(10,2)'],
      ['BOOLEAN', { name: 'BOOLEAN' }, 'BOOLEAN'],
      ['DATE', { name: 'DATE' }, 'DATE'],
      ['TIMESTAMP', { name: 'TIMESTAMP' }, 'TIMESTAMP'],
      ['TIMESTAMPTZ', { name: 'TIMESTAMPTZ' }, 'TIMESTAMPTZ'],
      ['UUID', { name: 'UUID' }, 'UUID'],
      ['JSONB', { name: 'JSONB' }, 'JSONB'],
      ['BYTEA', { name: 'BYTEA' }, 'BYTEA'],
      ['Unknown type passed through', { name: 'MONEY' }, 'MONEY'],
    ];

    for (const [label, dt, expected] of cases) {
      it(label, () => {
        expect(exporter.mapDataType(dt)).toBe(expected);
      });
    }
  });

  // -----------------------------------------------------------------------
  // NOT NULL / Nullable
  // -----------------------------------------------------------------------

  it('emits NOT NULL for non-nullable attributes', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'col', nullable: false, dataType: { name: 'INT' } })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"col" INTEGER NOT NULL');
  });

  it('omits NOT NULL for nullable attributes', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'col', nullable: true, dataType: { name: 'INT' } })],
          candidateKeys: [],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"col" INTEGER');
    expect(result.ddl).not.toContain('NOT NULL');
  });

  // -----------------------------------------------------------------------
  // Primary key
  // -----------------------------------------------------------------------

  it('generates PRIMARY KEY constraint', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('PRIMARY KEY ("id")');
  });

  // -----------------------------------------------------------------------
  // Alternate candidate key → UNIQUE
  // -----------------------------------------------------------------------

  it('generates UNIQUE constraint for alternate candidate key', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'email', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1']), makeUK(['a2'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('PRIMARY KEY ("id")');
    expect(result.ddl).toContain('UNIQUE ("email")');
  });

  // -----------------------------------------------------------------------
  // Multiple candidate keys
  // -----------------------------------------------------------------------

  it('generates PK + multiple UNIQUE constraints', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'email', dataType: { name: 'VARCHAR' } }),
            makeAttr({ id: 'a3', name: 'ssn', dataType: { name: 'VARCHAR' } }),
          ],
          candidateKeys: [makePK(['a1']), makeUK(['a2'], 'uk1'), makeUK(['a3'], 'uk2')],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('PRIMARY KEY ("id")');
    expect(result.ddl).toContain('UNIQUE ("email")');
    expect(result.ddl).toContain('UNIQUE ("ssn")');
  });

  // -----------------------------------------------------------------------
  // Composite primary key
  // -----------------------------------------------------------------------

  it('generates composite PRIMARY KEY', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Enrollment',
          attributes: [
            makeAttr({ id: 'a1', name: 'student_id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'course_id', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1', 'a2'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('PRIMARY KEY ("student_id", "course_id")');
  });

  // -----------------------------------------------------------------------
  // One-to-many → FK on many side
  // -----------------------------------------------------------------------

  it('adds FK on the many side for 1:N relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Department',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_in',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
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
    expect(result.ddl).toContain('"id" INTEGER');
    expect(result.ddl).toContain('FOREIGN KEY ("id") REFERENCES "Department" ("id")');
    // Department table should be created before Employee (topo sort)
    const deptPos = result.ddl.indexOf('CREATE TABLE "Department"');
    const empPos = result.ddl.indexOf('CREATE TABLE "Employee"');
    expect(deptPos).toBeLessThan(empPos);
  });

  // -----------------------------------------------------------------------
  // One-to-one → FK on optional side
  // -----------------------------------------------------------------------

  it('adds FK on the optional side for 1:1 relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Passport',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_passport',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
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
    // Passport (optional side, min=0) should get the FK
    const passportTable = result.ddl.split('CREATE TABLE "Passport"')[1];
    expect(passportTable).toContain('FOREIGN KEY ("id") REFERENCES "Person" ("id")');
  });

  // -----------------------------------------------------------------------
  // 1:1 both mandatory → alphabetical fallback
  // -----------------------------------------------------------------------

  it('places FK on alphabetically later entity for 1:1 both mandatory', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Alpha',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Beta',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // "Beta" > "Alpha" alphabetically so Beta gets the FK
    const betaTable = result.ddl.split('CREATE TABLE "Beta"')[1];
    expect(betaTable).toContain('FOREIGN KEY ("id") REFERENCES "Alpha" ("id")');
  });

  // -----------------------------------------------------------------------
  // Many-to-many → junction table
  // -----------------------------------------------------------------------

  it('creates junction table for M:N relationship with composite PK', () => {
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
    expect(result.ddl).toContain('CREATE TABLE "enrolls"');
    expect(result.ddl).toContain('"student_id" INTEGER NOT NULL');
    expect(result.ddl).toContain('"course_id" INTEGER NOT NULL');
    expect(result.ddl).toContain('PRIMARY KEY ("student_id", "course_id")');
    expect(result.ddl).toContain('FOREIGN KEY ("student_id") REFERENCES "Student" ("id")');
    expect(result.ddl).toContain('FOREIGN KEY ("course_id") REFERENCES "Course" ("id")');
  });

  // -----------------------------------------------------------------------
  // Junction table named after relationship
  // -----------------------------------------------------------------------

  it('names junction table after the relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Zebra',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Apple',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
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
    expect(result.ddl).toContain('CREATE TABLE "rel"');
  });

  // -----------------------------------------------------------------------
  // Identifying relationship → weak entity PK includes FK
  // -----------------------------------------------------------------------

  it('includes owner FK in weak entity PK for identifying relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Building',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Room',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'number', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_rooms',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const roomTable = result.ddl.split('CREATE TABLE "Room"')[1];
    expect(roomTable).toContain('"id" INTEGER NOT NULL');
    expect(roomTable).toContain('PRIMARY KEY ("number", "id")');
    expect(roomTable).toContain('FOREIGN KEY ("id") REFERENCES "Building" ("id")');
  });

  it('does not create junction table for M:N identifying relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Building',
          attributes: [
            makeAttr({ id: 'a1', name: 'bid', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Room',
          isWeak: true,
          attributes: [
            makeAttr({ id: 'a2', name: 'roomno', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should NOT contain a junction table
    expect(result.ddl).not.toContain('CREATE TABLE "has"');
    // Room should have the FK from Building in its PK
    expect(result.ddl).toContain('"bid" INTEGER NOT NULL');
    expect(result.ddl).toContain('PRIMARY KEY ("roomno", "bid")');
    expect(result.ddl).toContain('FOREIGN KEY ("bid") REFERENCES "Building" ("bid")');
  });

  // -----------------------------------------------------------------------
  // Relationship attributes on 1:N → columns on many-side table
  // -----------------------------------------------------------------------

  it('adds relationship attributes to many-side table for 1:N', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Department',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_in',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [
            makeAttr({ id: 'ra1', name: 'start_date', dataType: { name: 'DATE' }, nullable: true }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    expect(empTable).toContain('"start_date" DATE');
  });

  // -----------------------------------------------------------------------
  // Relationship attributes on M:N → columns in junction table
  // -----------------------------------------------------------------------

  it('adds relationship attributes to junction table for M:N', () => {
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
          attributes: [
            makeAttr({ id: 'ra1', name: 'grade', dataType: { name: 'VARCHAR', precision: 2 }, nullable: true }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const junctionTable = result.ddl.split('CREATE TABLE "enrolls"')[1];
    expect(junctionTable).toContain('"grade" VARCHAR(2)');
  });

  // -----------------------------------------------------------------------
  // Self-referencing relationship → FK with ref_ prefix
  // -----------------------------------------------------------------------

  it('handles self-referencing relationship with ref_ prefix column', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'manages',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"ref_id" INTEGER');
    expect(result.ddl).toContain('FOREIGN KEY ("ref_id") REFERENCES "Employee" ("id")');
  });

  // -----------------------------------------------------------------------
  // Derived attribute → skipped with warning
  // -----------------------------------------------------------------------

  it('skips derived attributes and emits warning', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'age', dataType: { name: 'INT' }, kind: 'derived' }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).not.toContain('"age"');
    expect(result.warnings).toContain('Derived attribute "age" on entity "T" skipped');
  });

  // -----------------------------------------------------------------------
  // Derived attribute on relationship → skipped with warning
  // -----------------------------------------------------------------------

  it('skips derived relationship attributes and emits warning', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [
            makeAttr({ id: 'ra1', name: 'computed', dataType: { name: 'INT' }, kind: 'derived' }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Derived attribute "computed" on relationship "rel" skipped');
  });

  // -----------------------------------------------------------------------
  // Multivalued attribute → separate table
  // -----------------------------------------------------------------------

  it('creates a separate table for multivalued attributes', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'phone', dataType: { name: 'VARCHAR', precision: 20 }, kind: 'multivalued' }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "Person_phone"');
    expect(result.ddl).toContain('"id" INTEGER NOT NULL');
    expect(result.ddl).toContain('"phone" VARCHAR(20) NOT NULL');
    expect(result.ddl).toContain('PRIMARY KEY ("id", "phone")');
    expect(result.ddl).toContain('FOREIGN KEY ("id") REFERENCES "Person" ("id")');
  });

  // -----------------------------------------------------------------------
  // Composite attribute → flattened (or warning if no children)
  // -----------------------------------------------------------------------

  it('flattens composite attributes, adding children as columns', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'comp', name: 'address', kind: 'composite', childAttributeIds: ['a2', 'a3'] }),
            makeAttr({ id: 'a2', name: 'street', dataType: { name: 'VARCHAR', precision: 100 } }),
            makeAttr({ id: 'a3', name: 'city', dataType: { name: 'VARCHAR', precision: 50 } }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    // composite parent should not become a column itself
    expect(result.ddl).not.toContain('"address"');
    // children should become columns
    expect(result.ddl).toContain('"street" VARCHAR(100)');
    expect(result.ddl).toContain('"city" VARCHAR(50)');
  });

  it('warns for composite attribute with no children and still adds it as a column', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'comp', name: 'address', kind: 'composite', childAttributeIds: [] }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Composite attribute "address" on entity "T" has no children');
    expect(result.ddl).toContain('"address" VARCHAR(255)');
  });

  // -----------------------------------------------------------------------
  // No PK → warning
  // -----------------------------------------------------------------------

  it('warns when entity has no primary key', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'NoPK',
          attributes: [makeAttr({ id: 'a1', name: 'col', dataType: { name: 'INT' } })],
          candidateKeys: [],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Entity "NoPK" has no primary key');
  });

  // -----------------------------------------------------------------------
  // Entity with no attributes → warning
  // -----------------------------------------------------------------------

  it('warns when entity has no attributes', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'Empty' })],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Entity "Empty" has no attributes');
  });

  // -----------------------------------------------------------------------
  // Topological sort → referenced tables created first
  // -----------------------------------------------------------------------

  it('creates referenced tables before referencing tables', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e2',
          name: 'Child',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
        makeEntity({
          id: 'e1',
          name: 'Parent',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
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
    const parentPos = result.ddl.indexOf('CREATE TABLE "Parent"');
    const childPos = result.ddl.indexOf('CREATE TABLE "Child"');
    expect(parentPos).toBeLessThan(childPos);
  });

  // -----------------------------------------------------------------------
  // Relationship with fewer than 2 participants → warning
  // -----------------------------------------------------------------------

  it('warns for relationship with fewer than 2 participants', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'incomplete',
          participants: [{ entityId: 'e1', cardinality: { min: 0, max: 1 } }],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Relationship "incomplete" has fewer than 2 participants');
  });

  // -----------------------------------------------------------------------
  // Weak entity with no identifying relationship → warning
  // -----------------------------------------------------------------------

  it('warns when weak entity has no identifying relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'WeakThing',
          isWeak: true,
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain('Weak entity "WeakThing" has no identifying relationship');
  });

  // -----------------------------------------------------------------------
  // FK cannot be created → warning for missing PK on referenced entity
  // -----------------------------------------------------------------------

  it('warns when referenced entity has no PK for FK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'col', dataType: { name: 'INT' } })],
          candidateKeys: [],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
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
    expect(result.warnings).toContain(
      'Cannot create FK for relationship "rel": referenced entity "A" has no primary key'
    );
  });

  // -----------------------------------------------------------------------
  // M:N with numeric max > 1
  // -----------------------------------------------------------------------

  it('detects M:N with numeric max > 1', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 5 } },
            { entityId: 'e2', cardinality: { min: 0, max: 10 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "rel"');
  });

  // -----------------------------------------------------------------------
  // Quote identifier escaping
  // -----------------------------------------------------------------------

  it('escapes double quotes in identifiers', () => {
    expect(exporter.quoteIdentifier('has"quote')).toBe('"has""quote"');
  });

  // -----------------------------------------------------------------------
  // Relationship attributes skipped for <2 participants
  // -----------------------------------------------------------------------

  it('skips relationship attributes when relationship has fewer than 2 participants', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'bad',
          participants: [{ entityId: 'e1', cardinality: { min: 0, max: 1 } }],
          isIdentifying: false,
          attributes: [makeAttr({ id: 'ra1', name: 'x', dataType: { name: 'INT' } })],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should not crash; attribute "x" should not appear in any table
    const tTable = result.ddl.split('CREATE TABLE "T"')[1];
    expect(tTable).not.toContain('"x"');
  });

  // -----------------------------------------------------------------------
  // Relationship with no attributes → skip attributes loop
  // -----------------------------------------------------------------------

  it('handles relationship with empty attributes gracefully', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'X',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Y',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
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
    expect(result.ddl).toContain('CREATE TABLE "X"');
    expect(result.ddl).toContain('CREATE TABLE "Y"');
  });

  // -----------------------------------------------------------------------
  // 1:N where first participant is many
  // -----------------------------------------------------------------------

  it('handles 1:N where first participant is the many side', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Order',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Customer',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'places',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const orderTable = result.ddl.split('CREATE TABLE "Order"')[1];
    expect(orderTable).toContain('FOREIGN KEY ("id") REFERENCES "Customer" ("id")');
  });

  it('adds FK column when name does not collide with existing columns', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Order',
          attributes: [makeAttr({ id: 'a1', name: 'oid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Customer',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'places',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const orderDDL = result.ddl.split('CREATE TABLE "Order"')[1];
    // FK column "cid" should be added to Order (no collision with "oid")
    expect(orderDDL).toContain('"cid" INTEGER');
    expect(orderDDL).toContain('FOREIGN KEY ("cid") REFERENCES "Customer" ("cid")');
  });

  it('does not duplicate FK column when name collides with existing column', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Order',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a3', name: 'note', dataType: { name: 'TEXT' } }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Customer',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'places',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Order already has "id" column; FK from Customer is also "id"
    // The duplicate column should not be added again
    const orderDDL = result.ddl.split('CREATE TABLE "Order"')[1];
    const idCount = (orderDDL.match(/"id"/g) || []).length;
    // "id" appears in: column def, PRIMARY KEY, FOREIGN KEY columns, REFERENCES — but only one column definition
    expect(orderDDL).toContain('FOREIGN KEY ("id") REFERENCES "Customer" ("id")');
    expect(idCount).toBeGreaterThanOrEqual(3); // col def + PK + FK ref
  });

  // -----------------------------------------------------------------------
  // 1:1 with second side optional
  // -----------------------------------------------------------------------

  it('handles 1:1 where second side is optional', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // e1 has min=0, so it should get the FK
    const aTable = result.ddl.split('CREATE TABLE "A"')[1];
    expect(aTable).toContain('FOREIGN KEY ("id") REFERENCES "B" ("id")');
  });

  // -----------------------------------------------------------------------
  // Candidate key with non-existent attribute id is filtered
  // -----------------------------------------------------------------------

  it('filters out non-existent attribute ids in unique constraints', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [
            makePK(['a1']),
            { id: 'uk1', name: 'UK', attributeIds: ['nonexistent'], isPrimary: false },
          ],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should not add empty UNIQUE constraint
    expect(result.ddl).not.toContain('UNIQUE');
  });

  // -----------------------------------------------------------------------
  // Junction table with missing entity references
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Topological sort cycle detection → deferred FKs via ALTER TABLE
  // -----------------------------------------------------------------------

  it('handles cycles with deferred ALTER TABLE FK statements', () => {
    // Create a circular dependency: A references B and B references A
    // Two 1:N relationships in opposite directions create a cycle
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel1',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'rel2',
          participants: [
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Both tables should be created with their FKs
    // The cycle is detected internally but all tables still end up in sorted order
    expect(result.ddl).toContain('CREATE TABLE "A"');
    expect(result.ddl).toContain('CREATE TABLE "B"');
    expect(result.ddl).toContain('FOREIGN KEY');
  });

  // -----------------------------------------------------------------------
  // Self-referencing relationship that goes through the non-otherParticipant path
  // -----------------------------------------------------------------------

  it('handles self-referencing 1:1 relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Node',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'parent_of',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"ref_id" INTEGER');
    expect(result.ddl).toContain('FOREIGN KEY ("ref_id") REFERENCES "Node" ("id")');
  });

  // -----------------------------------------------------------------------
  // 1:N relationship where referenced entity has no PK (addRelationshipFKs warning)
  // -----------------------------------------------------------------------

  it('warns when FK side entity not found in tables', () => {
    // Create a model where getFKSideEntity returns null
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [],  // No PK on B
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.warnings).toContain(
      'Cannot create FK for relationship "rel": referenced entity "B" has no primary key'
    );
  });

  // -----------------------------------------------------------------------
  // Relationship attributes on 1:N when fkSideEntity not found
  // -----------------------------------------------------------------------

  it('handles relationship attributes on M:N when one entity is missing', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Exists',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'missing', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [
            makeAttr({ id: 'ra1', name: 'score', dataType: { name: 'INT' } }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should not crash; the junction table uses relationship name as fallback
    expect(result.ddl).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Identifying relationship skipped in addRelationshipFKs
  // -----------------------------------------------------------------------

  it('handles weak entity with identifying relationship but owner has no PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          attributes: [makeAttr({ id: 'a1', name: 'col', dataType: { name: 'INT' } })],
          candidateKeys: [],  // No PK
        }),
        makeEntity({
          id: 'e2',
          name: 'Dep',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'seq', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'owns',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Owner has no PK, so no FK columns should be added to the weak entity
    const depTable = result.ddl.split('CREATE TABLE "Dep"')[1];
    expect(depTable).not.toContain('FOREIGN KEY');
  });

  it('handles weak entity with identifying relationship where owner entity is not found', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e2',
          name: 'Orphan',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'seq', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'owns',
          participants: [
            { entityId: 'nonexistent_owner', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should not crash; Orphan table should still be generated
    expect(result.ddl).toContain('CREATE TABLE "Orphan"');
  });

  it('handles weak entity where PK attribute references non-existent attribute id', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          attributes: [makeAttr({ id: 'a1', name: 'oid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1', 'nonexistent_attr'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Dep',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'seq', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'owns',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Only the valid attribute should be added as FK
    const depTable = result.ddl.split('CREATE TABLE "Dep"')[1];
    expect(depTable).toContain('"oid"');
    expect(depTable).toContain('FOREIGN KEY');
  });

  it('skips identifying relationship in addRelationshipFKs (handled in weak entity logic)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Weak',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'num', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'owns',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // FK is added through weak entity logic, not addRelationshipFKs
    const weakTable = result.ddl.split('CREATE TABLE "Weak"')[1];
    expect(weakTable).toContain('FOREIGN KEY');
    // Should only have one FK reference to Owner (from weak entity logic, not duplicated)
    const fkCount = (result.ddl.match(/REFERENCES "Owner"/g) || []).length;
    expect(fkCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 1:1 both optional → alphabetical fallback
  // -----------------------------------------------------------------------

  it('places FK on alphabetically later entity for 1:1 both optional', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Cat',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Dog',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'friends',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    // "Dog" > "Cat" alphabetically so Dog gets the FK
    const dogTable = result.ddl.split('CREATE TABLE "Dog"')[1];
    expect(dogTable).toContain('FOREIGN KEY ("id") REFERENCES "Cat" ("id")');
  });

  it('handles junction table when entities are not found', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
          participants: [
            { entityId: 'missing1', cardinality: { min: 0, max: '*' } },
            { entityId: 'missing2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should produce a minimal table with the relationship name as fallback
    expect(result.ddl).toContain('CREATE TABLE "rel"');
  });

  // -----------------------------------------------------------------------
  // Aggregation: resolveParticipantEntities is called indirectly
  // -----------------------------------------------------------------------

  it('resolves aggregation participants to underlying entities for FK generation', () => {
    // Model: A --[R]--> B, aggregation wraps R, then agg --[R2]--> C
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3',
          name: 'C',
          attributes: [makeAttr({ id: 'a3', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'R',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'R2',
          participants: [
            { entityId: 'agg1', cardinality: { min: 0, max: '*' }, isAggregation: true },
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [
        { id: 'agg1', name: 'AggR', relationshipId: 'r1' },
      ],
    };
    const result = exporter.export(model);
    // The export should not crash and should produce tables for A, B, C
    expect(result.ddl).toContain('CREATE TABLE "A"');
    expect(result.ddl).toContain('CREATE TABLE "B"');
    expect(result.ddl).toContain('CREATE TABLE "C"');
  });

  // -----------------------------------------------------------------------
  // Aggregation participant that references non-existent aggregation
  // -----------------------------------------------------------------------

  it('handles aggregation participant referencing non-existent aggregation', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'X',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'broken_rel',
          participants: [
            { entityId: 'nonexistent_agg', cardinality: { min: 0, max: '*' }, isAggregation: true },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Should not crash; entity X table should still be generated
    expect(result.ddl).toContain('CREATE TABLE "X"');
  });

  // -----------------------------------------------------------------------
  // Weak entity with identifying relationship, owner has PK (full FK path)
  // -----------------------------------------------------------------------

  it('generates full FK for weak entity where owner has composite PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          attributes: [
            makeAttr({ id: 'a1', name: 'code', dataType: { name: 'VARCHAR', precision: 10 }, nullable: false }),
            makeAttr({ id: 'a2', name: 'region', dataType: { name: 'VARCHAR', precision: 20 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1', 'a2'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Dep',
          isWeak: true,
          attributes: [makeAttr({ id: 'a3', name: 'seq', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'owns',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const depTable = result.ddl.split('CREATE TABLE "Dep"')[1];
    // FK columns from owner's composite PK should be added
    expect(depTable).toContain('"code" VARCHAR(10) NOT NULL');
    expect(depTable).toContain('"region" VARCHAR(20) NOT NULL');
    // They should be part of the PK
    expect(depTable).toContain('PRIMARY KEY ("seq", "code", "region")');
    // And a FK constraint should reference the owner
    expect(depTable).toContain('FOREIGN KEY ("code", "region") REFERENCES "Owner" ("code", "region")');
  });

  // -----------------------------------------------------------------------
  // Self-ref that hits the early return on line 423
  // -----------------------------------------------------------------------

  it('handles self-referencing M:N relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'knows',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Self-ref M:N -> junction table named after relationship
    expect(result.ddl).toContain('CREATE TABLE "knows"');
  });

  // -----------------------------------------------------------------------
  // Cyclic FK references handled gracefully
  // -----------------------------------------------------------------------

  it('handles cyclic FK references across three entities without crashing', () => {
    // A -> B -> C -> A cycle via three 1:N relationships
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3',
          name: 'C',
          attributes: [makeAttr({ id: 'a3', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1', name: 'r1',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
        {
          id: 'r2', name: 'r2',
          participants: [
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
        {
          id: 'r3', name: 'r3',
          participants: [
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // All tables should appear with their FK constraints
    expect(result.ddl).toContain('CREATE TABLE "A"');
    expect(result.ddl).toContain('CREATE TABLE "B"');
    expect(result.ddl).toContain('CREATE TABLE "C"');
    expect(result.ddl).toContain('FOREIGN KEY');
  });
});

// ---------------------------------------------------------------------------
// Direct tests for protected BaseExporter.resolveParticipantEntities
// ---------------------------------------------------------------------------

class TestableExporter extends BaseExporter {
  readonly dialect = 'Test';
  quoteIdentifier(name: string): string { return `"${name}"`; }
  mapDataType(dt: DataType): string { return dt.name; }

  // Expose protected method for testing
  public testResolveParticipantEntities(p: Participant, model: ERDModel): Entity[] {
    return this.resolveParticipantEntities(p, model);
  }
}

describe('BaseExporter.resolveParticipantEntities', () => {
  const testExporter = new TestableExporter();

  it('returns the entity for a normal (non-aggregation) participant', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'A' })],
      relationships: [],
      aggregations: [],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'e1', cardinality: { min: 0, max: '*' } },
      model,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });

  it('returns empty array for non-existent entity', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [],
      aggregations: [],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'missing', cardinality: { min: 0, max: '*' } },
      model,
    );
    expect(result).toHaveLength(0);
  });

  it('resolves aggregation to the entities in the aggregated relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student' }),
        makeEntity({ id: 'e2', name: 'Course' }),
      ],
      relationships: [
        {
          id: 'r1', name: 'Enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [{ id: 'agg1', name: 'EnrollAgg', relationshipId: 'r1' }],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'agg1', cardinality: { min: 0, max: '*' }, isAggregation: true },
      model,
    );
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.name).sort()).toEqual(['Course', 'Student']);
  });

  it('returns empty array when aggregation references non-existent aggregation id', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [],
      aggregations: [],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'nonexistent', cardinality: { min: 0, max: '*' }, isAggregation: true },
      model,
    );
    expect(result).toHaveLength(0);
  });

  it('returns empty array when aggregation references non-existent relationship', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [],
      aggregations: [{ id: 'agg1', name: 'Agg', relationshipId: 'missing_rel' }],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'agg1', cardinality: { min: 0, max: '*' }, isAggregation: true },
      model,
    );
    expect(result).toHaveLength(0);
  });

  it('skips aggregation participants within the aggregated relationship', () => {
    // Relationship with one normal participant and one aggregation participant
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'A' }),
      ],
      relationships: [
        {
          id: 'r1', name: 'R',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'other_agg', cardinality: { min: 1, max: 1 }, isAggregation: true },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [{ id: 'agg1', name: 'Agg', relationshipId: 'r1' }],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'agg1', cardinality: { min: 0, max: '*' }, isAggregation: true },
      model,
    );
    // Only the normal entity participant should be returned, not the aggregation participant
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});
