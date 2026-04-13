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
  // One-to-many → FK on max-1 side
  // -----------------------------------------------------------------------

  it('adds FK on the max-1 side for 1:N relationship', () => {
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
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    expect(empTable).toContain('"department_id" INTEGER');
    expect(empTable).toContain('FOREIGN KEY ("department_id") REFERENCES "Department" ("id")');
    // Department table should be created before Employee (topo sort)
    const deptPos = result.ddl.indexOf('CREATE TABLE "Department"');
    const empPos = result.ddl.indexOf('CREATE TABLE "Employee"');
    expect(deptPos).toBeLessThan(empPos);
  });

  // -----------------------------------------------------------------------
  // One-to-one → FK on max-1 side
  // -----------------------------------------------------------------------

  it('adds FK on the max-1 side for 1:1 relationship and merges with total participation', () => {
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
    // Passport has max=1 → FK side; Passport min=1 → total participation → merge
    const passportTable = result.ddl.split('CREATE TABLE "Passport_has_passport"')[1];
    expect(passportTable).toContain('FOREIGN KEY ("person_id") REFERENCES "Person" ("id")');
    expect(passportTable).toContain('"person_id" INTEGER NOT NULL');
  });

  // -----------------------------------------------------------------------
  // 1:1 both optional → alphabetical fallback
  // -----------------------------------------------------------------------

  it('places FK on alphabetically later entity for 1:1 both optional', () => {
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
    // "Beta" > "Alpha" alphabetically so Beta gets the FK
    const betaTable = result.ddl.split('CREATE TABLE "Beta"')[1];
    expect(betaTable).toContain('"alpha_id" INTEGER');
    expect(betaTable).toContain('FOREIGN KEY ("alpha_id") REFERENCES "Alpha" ("id")');
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
  // Relationship attributes on 1:N → columns on max-1 side table
  // -----------------------------------------------------------------------

  it('adds relationship attributes to max-1 side table for 1:N', () => {
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
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
    expect(result.ddl).toContain('CREATE TABLE "X"');
    expect(result.ddl).toContain('CREATE TABLE "Y"');
  });

  // -----------------------------------------------------------------------
  // 1:N where first participant is the max-1 side
  // -----------------------------------------------------------------------

  it('handles 1:N where first participant is the max-1 side', () => {
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
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    const orderTable = result.ddl.split('CREATE TABLE "Order"')[1];
    expect(orderTable).toContain('"customer_id" INTEGER');
    expect(orderTable).toContain('FOREIGN KEY ("customer_id") REFERENCES "Customer" ("id")');
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
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    // Order already has "id" column; FK from Customer's "id" should be prefixed
    const orderDDL = result.ddl.split('CREATE TABLE "Order"')[1];
    expect(orderDDL).toContain('"customer_id" INTEGER');
    expect(orderDDL).toContain('FOREIGN KEY ("customer_id") REFERENCES "Customer" ("id")');
    expect(orderDDL).toContain('PRIMARY KEY ("id")');
  });

  // -----------------------------------------------------------------------
  // FK column name collision — comprehensive tests (issue #22)
  // -----------------------------------------------------------------------

  it('prefixes FK column for 1:1 with same PK name (issue #22 scenario)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Tutor',
          attributes: [makeAttr({ id: 'a1', name: 'name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Student',
          attributes: [makeAttr({ id: 'a2', name: 'name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'Coaches',
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
    // "Tutor" > "Student" alphabetically, so Tutor gets the FK
    const tutorTable = result.ddl.split('CREATE TABLE "Tutor"')[1];
    expect(tutorTable).toContain('"student_name" VARCHAR(255)');
    expect(tutorTable).toContain('PRIMARY KEY ("name")');
    expect(tutorTable).toContain('FOREIGN KEY ("student_name") REFERENCES "Student" ("name")');
  });

  it('prefixes FK column for 1:N with same PK name', () => {
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
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    // Employee keeps its own "id" as PK and gets a separate "department_id" FK column
    expect(empTable).toContain('PRIMARY KEY ("id")');
    expect(empTable).toContain('"department_id" INTEGER');
    expect(empTable).toContain('FOREIGN KEY ("department_id") REFERENCES "Department" ("id")');
  });

  it('does not prefix FK column when PK names differ (no collision)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [makeAttr({ id: 'a1', name: 'pid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Passport',
          attributes: [makeAttr({ id: 'a2', name: 'passport_no', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'holds',
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
    // "Person" > "Passport" → Person gets the FK; no collision since "passport_no" != "pid"
    const personTable = result.ddl.split('CREATE TABLE "Person"')[1];
    expect(personTable).toContain('"passport_no" INTEGER');
    expect(personTable).toContain('FOREIGN KEY ("passport_no") REFERENCES "Passport" ("passport_no")');
    // Should NOT have a prefixed column
    expect(personTable).not.toContain('"passport_passport_no"');
  });

  it('prefixes only colliding attributes in composite PK (partial collision)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'code', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1', 'a2'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [
            makeAttr({ id: 'a3', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a4', name: 'bname', dataType: { name: 'VARCHAR', precision: 100 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a3', 'a4'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
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
    // B > A alphabetically → B gets FK. "id" collides → "a_id"; "code" doesn't → "code"
    const bTable = result.ddl.split('CREATE TABLE "B"')[1];
    expect(bTable).toContain('"a_id" INTEGER');
    expect(bTable).toContain('"code" INTEGER');
    expect(bTable).toContain('FOREIGN KEY ("a_id", "code") REFERENCES "A" ("id", "code")');
  });

  it('prefixes all attributes in composite PK when all collide (full collision)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'name', dataType: { name: 'VARCHAR', precision: 100 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1', 'a2'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [
            makeAttr({ id: 'a3', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a4', name: 'name', dataType: { name: 'VARCHAR', precision: 100 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a3', 'a4'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'rel',
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
    // B > A → B gets FK. Both "id" and "name" collide → "a_id", "a_name"
    const bTable = result.ddl.split('CREATE TABLE "B"')[1];
    expect(bTable).toContain('"a_id" INTEGER');
    expect(bTable).toContain('"a_name" VARCHAR(100)');
    expect(bTable).toContain('FOREIGN KEY ("a_id", "a_name") REFERENCES "A" ("id", "name")');
  });

  it('prefixes FK column correctly with total participation and table merge', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Badge',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_badge',
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
    // Badge has min=1 → total participation → merge to Badge_has_badge
    expect(result.ddl).toContain('CREATE TABLE "Badge_has_badge"');
    const badgeTable = result.ddl.split('CREATE TABLE "Badge_has_badge"')[1];
    expect(badgeTable).toContain('PRIMARY KEY ("id")');
    expect(badgeTable).toContain('"employee_id" INTEGER NOT NULL');
    expect(badgeTable).toContain('FOREIGN KEY ("employee_id") REFERENCES "Employee" ("id")');
  });

  it('self-referencing 1:1 still uses ref_ prefix (not affected by collision fix)', () => {
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
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    expect(empTable).toContain('"ref_id" INTEGER');
    expect(empTable).toContain('FOREIGN KEY ("ref_id") REFERENCES "Employee" ("id")');
  });

  it('handles multiple relationships where some FK columns collide and some do not', () => {
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
        makeEntity({
          id: 'e3',
          name: 'Advisor',
          attributes: [makeAttr({ id: 'a3', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'advises',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Course (max=1) gets FK to Student: "id" collides → "student_id"
    const courseTable = result.ddl.split('CREATE TABLE "Course"')[1];
    expect(courseTable).toContain('"student_id" INTEGER');
    expect(courseTable).toContain('FOREIGN KEY ("student_id") REFERENCES "Student" ("id")');
    // Advisor (max=1) gets FK to Student: "id" doesn't collide with "aid" → plain "id"
    const advisorTable = result.ddl.split('CREATE TABLE "Advisor"')[1];
    expect(advisorTable).toContain('FOREIGN KEY ("id") REFERENCES "Student" ("id")');
    expect(advisorTable).not.toContain('"student_id"');
  });

  it('prefixes FK when collision is with a non-PK column', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Order',
          attributes: [
            makeAttr({ id: 'a1', name: 'oid', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a3', name: 'customer_id', dataType: { name: 'INT' } }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Customer',
          attributes: [makeAttr({ id: 'a2', name: 'customer_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'places',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    // Order already has non-PK column "customer_id"; FK from Customer also named "customer_id"
    const orderDDL = result.ddl.split('CREATE TABLE "Order"')[1];
    expect(orderDDL).toContain('"customer_customer_id" INTEGER');
    expect(orderDDL).toContain('FOREIGN KEY ("customer_customer_id") REFERENCES "Customer" ("customer_id")');
  });

  it('total participation FK column with collision is NOT NULL', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'B',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'A',
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
    // A has max=1 → FK side, min=1 → total participation → NOT NULL + merge
    const aTable = result.ddl.split(/CREATE TABLE "A[^"]*"/)[1];
    expect(aTable).toContain('"b_id" INTEGER NOT NULL');
    expect(aTable).toContain('FOREIGN KEY ("b_id") REFERENCES "B" ("id")');
  });

  // -----------------------------------------------------------------------
  // 1:1 with second side optional
  // -----------------------------------------------------------------------

  it('handles 1:1 where second side is optional and merges with total participation', () => {
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
    // A has min=1 → total participation; both max=1, A (min=1) gets FK → merge
    const aTable = result.ddl.split('CREATE TABLE "A_rel"')[1];
    expect(aTable).toContain('FOREIGN KEY ("b_id") REFERENCES "B" ("id")');
    expect(aTable).toContain('"b_id" INTEGER NOT NULL');
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
  // Candidate key columns must be NOT NULL (issue #16)
  // -----------------------------------------------------------------------

  it('adds NOT NULL to candidate key column even when attribute is nullable', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Students',
          attributes: [
            makeAttr({ id: 'a1', name: 'Names', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
            makeAttr({ id: 'a2', name: 'Emails', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
            makeAttr({ id: 'a3', name: 'ids', dataType: { name: 'VARCHAR', precision: 255 }, nullable: true }),
          ],
          candidateKeys: [makePK(['a2']), makeUK(['a3'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"ids" VARCHAR(255) NOT NULL');
    expect(result.ddl).toContain('UNIQUE ("ids")');
    expect(result.ddl).toContain('PRIMARY KEY ("Emails")');
  });

  it('adds NOT NULL to all columns in a composite candidate key', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'first_name', dataType: { name: 'VARCHAR' }, nullable: true }),
            makeAttr({ id: 'a3', name: 'last_name', dataType: { name: 'VARCHAR' }, nullable: true }),
          ],
          candidateKeys: [makePK(['a1']), makeUK(['a2', 'a3'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"first_name" VARCHAR(255) NOT NULL');
    expect(result.ddl).toContain('"last_name" VARCHAR(255) NOT NULL');
    expect(result.ddl).toContain('UNIQUE ("first_name", "last_name")');
  });

  it('adds NOT NULL to multiple candidate key columns across separate keys', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'T',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a2', name: 'email', dataType: { name: 'VARCHAR' }, nullable: true }),
            makeAttr({ id: 'a3', name: 'ssn', dataType: { name: 'VARCHAR' }, nullable: true }),
          ],
          candidateKeys: [makePK(['a1']), makeUK(['a2'], 'uk1'), makeUK(['a3'], 'uk2')],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('"email" VARCHAR(255) NOT NULL');
    expect(result.ddl).toContain('"ssn" VARCHAR(255) NOT NULL');
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'rel2',
          participants: [
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
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
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
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
    expect(dogTable).toContain('"cat_id" INTEGER');
    expect(dogTable).toContain('FOREIGN KEY ("cat_id") REFERENCES "Cat" ("id")');
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
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
        { id: 'agg1', name: 'AggR', relationshipId: 'r1', position: { x: 0, y: 0 } },
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
        {
          id: 'r2', name: 'r2',
          participants: [
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
        {
          id: 'r3', name: 'r3',
          participants: [
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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

  // -----------------------------------------------------------------------
  // Total participation → table merge (entity_relationship naming)
  // -----------------------------------------------------------------------

  it('merges entity with relationship table for 1:N with total participation', () => {
    // Scenario from issue #7: customers owns games
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'customers',
          attributes: [makeAttr({ id: 'a1', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'games',
          attributes: [makeAttr({ id: 'a2', name: 'gid', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false })],
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
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // customers has max=1 → FK side; customers min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "customers_owns"');
    expect(result.ddl).not.toContain('CREATE TABLE "customers" (');
    // FK column should be NOT NULL due to total participation
    const mergedTable = result.ddl.split('CREATE TABLE "customers_owns"')[1];
    expect(mergedTable).toContain('"cid" INTEGER NOT NULL');
    expect(mergedTable).toContain('"gid" VARCHAR(255) NOT NULL');
    expect(mergedTable).toContain('PRIMARY KEY ("cid")');
    expect(mergedTable).toContain('FOREIGN KEY ("gid") REFERENCES "games" ("gid")');
    // games table should be separate and unchanged
    expect(result.ddl).toContain('CREATE TABLE "games"');
  });

  it('does NOT merge when partial participation (other side min=0)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Department',
          attributes: [makeAttr({ id: 'a1', name: 'dept_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a2', name: 'emp_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_in',
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
    // No merge: Employee has max=1 → FK side; Employee min=0 → partial participation
    expect(result.ddl).toContain('CREATE TABLE "Employee"');
    expect(result.ddl).not.toContain('CREATE TABLE "Employee_works_in"');
    // FK column should be nullable
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    expect(empTable).toContain('"dept_id" INTEGER');
    expect(empTable).not.toContain('"dept_id" INTEGER NOT NULL');
  });

  it('merges 1:1 relationship with total participation on FK side', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [makeAttr({ id: 'a1', name: 'pid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'License',
          attributes: [makeAttr({ id: 'a2', name: 'lid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'holds',
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
    // License has max=1 and min=1 → FK side with total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "License_holds"');
    expect(result.ddl).not.toContain('CREATE TABLE "License" (');
    const licTable = result.ddl.split('CREATE TABLE "License_holds"')[1];
    expect(licTable).toContain('"pid" INTEGER NOT NULL');
    expect(licTable).toContain('FOREIGN KEY ("pid") REFERENCES "Person" ("pid")');
  });

  it('does NOT merge self-referencing relationships', () => {
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Self-referencing should NOT merge
    expect(result.ddl).toContain('CREATE TABLE "Employee"');
    expect(result.ddl).not.toContain('CREATE TABLE "Employee_manages"');
    expect(result.ddl).toContain('"ref_id" INTEGER');
  });

  it('makes FK columns NOT NULL when merging due to total participation', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Advisor',
          attributes: [makeAttr({ id: 'a2', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'advised_by',
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
    // Student has max=1 → FK side; Student min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "Student_advised_by"');
    const studentTable = result.ddl.split('CREATE TABLE "Student_advised_by"')[1];
    // FK column "aid" should be NOT NULL
    expect(studentTable).toContain('"aid" INTEGER NOT NULL');
  });

  it('keeps FK columns nullable when no total participation', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Advisor',
          attributes: [makeAttr({ id: 'a2', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'advised_by',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    // No merge: Student has max=1 → FK side; Student min=0 → partial participation
    expect(result.ddl).toContain('CREATE TABLE "Student"');
    const studentTable = result.ddl.split('CREATE TABLE "Student"')[1];
    // FK column "aid" should be nullable (no NOT NULL)
    expect(studentTable).toContain('"aid" INTEGER');
    expect(studentTable).not.toContain('"aid" INTEGER NOT NULL');
  });

  it('merges with relationship attributes included in merged table', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Department',
          attributes: [makeAttr({ id: 'a2', name: 'did', dataType: { name: 'INT' }, nullable: false })],
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
            makeAttr({ id: 'ra2', name: 'role', dataType: { name: 'VARCHAR', precision: 50 }, nullable: true }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Employee gets merged with works_in
    expect(result.ddl).toContain('CREATE TABLE "Employee_works_in"');
    const empTable = result.ddl.split('CREATE TABLE "Employee_works_in"')[1];
    // Relationship attributes should be in the merged table
    expect(empTable).toContain('"start_date" DATE');
    expect(empTable).toContain('"role" VARCHAR(50)');
    // FK should be NOT NULL
    expect(empTable).toContain('"did" INTEGER NOT NULL');
    expect(empTable).toContain('FOREIGN KEY ("did") REFERENCES "Department" ("did")');
  });

  it('merges with composite PK on referenced entity', () => {
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
          name: 'Product',
          attributes: [
            makeAttr({ id: 'a2', name: 'brand', dataType: { name: 'VARCHAR', precision: 50 }, nullable: false }),
            makeAttr({ id: 'a3', name: 'sku', dataType: { name: 'VARCHAR', precision: 20 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a2', 'a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'contains',
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
    // Order has max=1 → FK side; Order min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "Order_contains"');
    const orderTable = result.ddl.split('CREATE TABLE "Order_contains"')[1];
    expect(orderTable).toContain('"brand" VARCHAR(50) NOT NULL');
    expect(orderTable).toContain('"sku" VARCHAR(20) NOT NULL');
    expect(orderTable).toContain('FOREIGN KEY ("brand", "sku") REFERENCES "Product" ("brand", "sku")');
  });

  it('updates FK references when merged table is referenced by other tables', () => {
    // A is referenced by B; A gets merged → B's FK should point to new name
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Parent',
          attributes: [makeAttr({ id: 'a1', name: 'pid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Child',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
        makeEntity({
          id: 'e3',
          name: 'Grandchild',
          attributes: [makeAttr({ id: 'a3', name: 'gid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_child',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'has_grandchild',
          participants: [
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Child is NOT merged (Child has max=1 → FK side, but min=0 → partial participation)
    // Grandchild IS merged (Grandchild has max=1 → FK side, min=1 → total participation)
    expect(result.ddl).toContain('CREATE TABLE "Child"');
    expect(result.ddl).toContain('CREATE TABLE "Grandchild_has_grandchild"');
    // Grandchild's FK should reference Child (not renamed)
    const gcTable = result.ddl.split('CREATE TABLE "Grandchild_has_grandchild"')[1];
    expect(gcTable).toContain('FOREIGN KEY ("cid") REFERENCES "Child" ("cid")');
  });

  it('updates FK references pointing to a merged table', () => {
    // Product gets merged; Supplier also references Product via 1:N → FK on Product should use new name
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Category',
          attributes: [makeAttr({ id: 'a1', name: 'cat_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Product',
          attributes: [makeAttr({ id: 'a2', name: 'prod_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
        makeEntity({
          id: 'e3',
          name: 'Supplier',
          attributes: [makeAttr({ id: 'a3', name: 'sup_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'belongs_to',
          participants: [
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'supplies',
          participants: [
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
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
    // Product merged with belongs_to (Product has max=1, min=1 → total participation)
    expect(result.ddl).toContain('CREATE TABLE "Product_belongs_to"');
    // Product (now Product_belongs_to) has FK to Category AND FK to Supplier
    const prodTable = result.ddl.split('CREATE TABLE "Product_belongs_to"')[1];
    expect(prodTable).toContain('FOREIGN KEY ("cat_id") REFERENCES "Category" ("cat_id")');
    expect(prodTable).toContain('FOREIGN KEY ("sup_id") REFERENCES "Supplier" ("sup_id")');
  });

  it('handles multiple merge candidates on same entity (uses first relationship)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Advisor',
          attributes: [makeAttr({ id: 'a2', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
        makeEntity({
          id: 'e3',
          name: 'Department',
          attributes: [makeAttr({ id: 'a3', name: 'did', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'advised_by',
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
          name: 'enrolled_in',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Student has max=1 and min=1 in both; qualifies for merge with both; first (advised_by) wins
    expect(result.ddl).toContain('CREATE TABLE "Student_advised_by"');
    expect(result.ddl).not.toContain('CREATE TABLE "Student_enrolled_in"');
    expect(result.ddl).not.toContain('CREATE TABLE "Student" (');
    // Both FK columns should be NOT NULL
    const studentTable = result.ddl.split('CREATE TABLE "Student_advised_by"')[1];
    expect(studentTable).toContain('"aid" INTEGER NOT NULL');
    expect(studentTable).toContain('"did" INTEGER NOT NULL');
  });

  it('merges 1:1 both mandatory and renames FK side table', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Alpha',
          attributes: [makeAttr({ id: 'a1', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Beta',
          attributes: [makeAttr({ id: 'a2', name: 'bid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'linked',
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
    // Both mandatory: FK on alphabetically later (Beta); Alpha min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "Beta_linked"');
    expect(result.ddl).not.toContain('CREATE TABLE "Beta" (');
    const betaTable = result.ddl.split('CREATE TABLE "Beta_linked"')[1];
    expect(betaTable).toContain('"aid" INTEGER NOT NULL');
    expect(betaTable).toContain('FOREIGN KEY ("aid") REFERENCES "Alpha" ("aid")');
  });

  it('does NOT merge for M:N relationships (junction table created instead)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // M:N with total participation on both sides → still junction table, no merge
    expect(result.ddl).toContain('CREATE TABLE "Student"');
    expect(result.ddl).toContain('CREATE TABLE "Course"');
    expect(result.ddl).toContain('CREATE TABLE "enrolls"');
    expect(result.ddl).not.toContain('Student_enrolls');
    expect(result.ddl).not.toContain('Course_enrolls');
  });

  it('does NOT merge identifying relationships (handled by weak entity logic)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Building',
          attributes: [makeAttr({ id: 'a1', name: 'bid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Room',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'rnum', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
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
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Identifying relationships are skipped by merge logic
    expect(result.ddl).toContain('CREATE TABLE "Room"');
    expect(result.ddl).not.toContain('Room_has');
  });

  it('merges with numeric max > 1 on other side and total participation on FK side', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Task',
          attributes: [makeAttr({ id: 'a1', name: 'tid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Worker',
          attributes: [makeAttr({ id: 'a2', name: 'wid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'assigned_to',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: 5 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Task has max=1 → FK side; Task min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "Task_assigned_to"');
    const taskTable = result.ddl.split('CREATE TABLE "Task_assigned_to"')[1];
    expect(taskTable).toContain('"wid" INTEGER NOT NULL');
    expect(taskTable).toContain('FOREIGN KEY ("wid") REFERENCES "Worker" ("wid")');
  });

  it('preserves topological sort order with merged tables', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Dept',
          attributes: [makeAttr({ id: 'a1', name: 'did', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Emp',
          attributes: [makeAttr({ id: 'a2', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_in',
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
    // Dept should come before Emp_works_in (Emp has max=1 → FK side, min=1 → merge)
    const deptPos = result.ddl.indexOf('CREATE TABLE "Dept"');
    const empPos = result.ddl.indexOf('CREATE TABLE "Emp_works_in"');
    expect(deptPos).toBeLessThan(empPos);
  });

  it('handles merge when FK column collides with existing entity column', () => {
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
    // Order has max=1 → FK side, min=1 → merge; FK column "id" collides with Order's "id"
    expect(result.ddl).toContain('CREATE TABLE "Order_places"');
    const orderTable = result.ddl.split('CREATE TABLE "Order_places"')[1];
    expect(orderTable).toContain('"customer_id" INTEGER NOT NULL');
    expect(orderTable).toContain('FOREIGN KEY ("customer_id") REFERENCES "Customer" ("id")');
  });

  it('handles merge with multivalued attribute table referencing merged entity', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [
            makeAttr({ id: 'a1', name: 'pid', dataType: { name: 'INT' }, nullable: false }),
            makeAttr({ id: 'a3', name: 'phone', dataType: { name: 'VARCHAR', precision: 20 }, kind: 'multivalued' }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Company',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_at',
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
    // Person has max=1 → FK side, min=1 → merge → Person_works_at
    expect(result.ddl).toContain('CREATE TABLE "Person_works_at"');
    expect(result.ddl).toContain('CREATE TABLE "Person_phone"');
    // The multivalued table's FK should reference the merged name
    const phoneTable = result.ddl.split('CREATE TABLE "Person_phone"')[1];
    expect(phoneTable).toContain('FOREIGN KEY ("pid") REFERENCES "Person_works_at" ("pid")');
  });

  // -----------------------------------------------------------------------
  // Self-referencing edge cases with total participation
  // -----------------------------------------------------------------------

  it('does NOT merge self-referencing relationship even with total participation cardinality', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'manages',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "Employee"');
    expect(result.ddl).not.toContain('Employee_manages');
    expect(result.ddl).toContain('"ref_eid" INTEGER');
    expect(result.ddl).toContain('FOREIGN KEY ("ref_eid") REFERENCES "Employee" ("eid")');
  });

  it('handles self-referencing with composite PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Node',
          attributes: [
            makeAttr({ id: 'a1', name: 'ns', dataType: { name: 'VARCHAR', precision: 50 }, nullable: false }),
            makeAttr({ id: 'a2', name: 'key', dataType: { name: 'VARCHAR', precision: 50 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1', 'a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'parent',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
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
    expect(result.ddl).toContain('"ref_ns" VARCHAR(50)');
    expect(result.ddl).toContain('"ref_key" VARCHAR(50)');
    expect(result.ddl).toContain('FOREIGN KEY ("ref_ns", "ref_key") REFERENCES "Node" ("ns", "key")');
  });

  // -----------------------------------------------------------------------
  // Merged table referenced by multiple other tables
  // -----------------------------------------------------------------------

  it('updates FK references in multiple tables when a merged table is referenced', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Author',
          attributes: [makeAttr({ id: 'a1', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'Publisher',
          attributes: [makeAttr({ id: 'a2', name: 'pub_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3',
          name: 'Review',
          attributes: [makeAttr({ id: 'a3', name: 'rid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
        makeEntity({
          id: 'e4',
          name: 'Award',
          attributes: [makeAttr({ id: 'a4', name: 'awid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a4'], 'pk4')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'published_by',
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
          name: 'reviews',
          participants: [
            { entityId: 'e3', cardinality: { min: 0, max: 1 } },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r3',
          name: 'wins',
          participants: [
            { entityId: 'e4', cardinality: { min: 0, max: 1 } },
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
    // Author merged (min=1, max=1 → FK side with total participation)
    expect(result.ddl).toContain('CREATE TABLE "Author_published_by"');
    // Review and Award both reference Author → should now reference Author_published_by
    const reviewTable = result.ddl.split('CREATE TABLE "Review"')[1];
    expect(reviewTable).toContain('FOREIGN KEY ("aid") REFERENCES "Author_published_by" ("aid")');
    const awardTable = result.ddl.split('CREATE TABLE "Award"')[1];
    expect(awardTable).toContain('FOREIGN KEY ("aid") REFERENCES "Author_published_by" ("aid")');
  });

  // -----------------------------------------------------------------------
  // Junction table with PK attribute collision
  // -----------------------------------------------------------------------

  it('prefixes junction table FK columns when both entities share PK attribute names', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Teacher',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Student',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'teaches',
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
    expect(result.ddl).toContain('CREATE TABLE "teaches"');
    // Both have "id" PK → collision detected → prefixed with entity name
    const junctionTable = result.ddl.split('CREATE TABLE "teaches"')[1];
    expect(junctionTable).toContain('"teacher_id" INTEGER NOT NULL');
    expect(junctionTable).toContain('"student_id" INTEGER NOT NULL');
    expect(junctionTable).toContain('FOREIGN KEY ("teacher_id") REFERENCES "Teacher" ("id")');
    expect(junctionTable).toContain('FOREIGN KEY ("student_id") REFERENCES "Student" ("id")');
  });

  // -----------------------------------------------------------------------
  // Deferred FK via ALTER TABLE for cyclic references
  // -----------------------------------------------------------------------

  it('generates ALTER TABLE for deferred FKs in cyclic dependencies', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Chicken',
          attributes: [makeAttr({ id: 'a1', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'Egg',
          attributes: [makeAttr({ id: 'a2', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'lays',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'r2',
          name: 'hatches',
          participants: [
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
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
    // Both tables created with their FK constraints despite cycle
    expect(result.ddl).toContain('CREATE TABLE "Chicken"');
    expect(result.ddl).toContain('CREATE TABLE "Egg"');
    const eggTable = result.ddl.split('CREATE TABLE "Egg"')[1];
    expect(eggTable).toContain('FOREIGN KEY ("cid") REFERENCES "Chicken" ("cid")');
    const chickenTable = result.ddl.split('CREATE TABLE "Chicken"')[1];
    expect(chickenTable).toContain('FOREIGN KEY ("eid") REFERENCES "Egg" ("eid")');
  });

  // -----------------------------------------------------------------------
  // Relationship attributes on identifying relationship are skipped
  // -----------------------------------------------------------------------

  it('skips relationship attributes on identifying relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          attributes: [makeAttr({ id: 'a1', name: 'oid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
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
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: true,
          attributes: [
            makeAttr({ id: 'ra1', name: 'since', dataType: { name: 'DATE' } }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Identifying relationship attributes are skipped
    expect(result.ddl).not.toContain('"since"');
  });

  // -----------------------------------------------------------------------
  // 1:N with no merge and partial participation → nullable FK
  // -----------------------------------------------------------------------

  it('produces nullable FK for 1:N with partial participation (min=0 on FK side)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Car',
          attributes: [makeAttr({ id: 'a1', name: 'vin', dataType: { name: 'VARCHAR', precision: 17 }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Garage',
          attributes: [makeAttr({ id: 'a2', name: 'gid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'parked_in',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
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
    // Car has max=1 → FK side. Car has min=0 → partial participation → no merge, FK nullable
    expect(result.ddl).toContain('CREATE TABLE "Car"');
    expect(result.ddl).not.toContain('Car_parked_in');
    const carTable = result.ddl.split('CREATE TABLE "Car"')[1];
    expect(carTable).toContain('"gid" INTEGER');
    expect(carTable).not.toContain('"gid" INTEGER NOT NULL');
    expect(carTable).toContain('FOREIGN KEY ("gid") REFERENCES "Garage" ("gid")');
  });

  // -----------------------------------------------------------------------
  // 1:N with total participation → NOT NULL FK + merge
  // -----------------------------------------------------------------------

  it('produces NOT NULL FK for 1:N with total participation (min=1 on FK side)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Car',
          attributes: [makeAttr({ id: 'a1', name: 'vin', dataType: { name: 'VARCHAR', precision: 17 }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Garage',
          attributes: [makeAttr({ id: 'a2', name: 'gid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'parked_in',
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
    // Car has max=1 → FK side. Car has min=1 → total participation → merge + NOT NULL FK
    expect(result.ddl).toContain('CREATE TABLE "Car_parked_in"');
    expect(result.ddl).not.toContain('CREATE TABLE "Car" (');
    const carTable = result.ddl.split('CREATE TABLE "Car_parked_in"')[1];
    expect(carTable).toContain('"gid" INTEGER NOT NULL');
    expect(carTable).toContain('FOREIGN KEY ("gid") REFERENCES "Garage" ("gid")');
  });

  // -----------------------------------------------------------------------
  // Entity with no relationships (disconnected)
  // -----------------------------------------------------------------------

  it('handles entities with no relationships (disconnected)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Standalone',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Also_Alone',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "Standalone"');
    expect(result.ddl).toContain('CREATE TABLE "Also_Alone"');
    expect(result.warnings).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Mixed: some relationships with merge, some without
  // -----------------------------------------------------------------------

  it('correctly handles mix of merged and non-merged relationships on different entities', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'Advisor',
          attributes: [makeAttr({ id: 'a2', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3',
          name: 'Library',
          attributes: [makeAttr({ id: 'a3', name: 'lid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'advised_by',
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
          name: 'uses',
          participants: [
            { entityId: 'e3', cardinality: { min: 0, max: 1 } },
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
    // Student merged (min=1, total participation in advised_by)
    expect(result.ddl).toContain('CREATE TABLE "Student_advised_by"');
    // Library NOT merged (min=0, partial participation in uses)
    expect(result.ddl).toContain('CREATE TABLE "Library"');
    expect(result.ddl).not.toContain('Library_uses');
    // Library FK should be nullable
    const libTable = result.ddl.split('CREATE TABLE "Library"')[1];
    expect(libTable).toContain('"sid" INTEGER');
    expect(libTable).not.toContain('"sid" INTEGER NOT NULL');
    // Library's FK should reference the merged Student table name
    expect(libTable).toContain('FOREIGN KEY ("sid") REFERENCES "Student_advised_by" ("sid")');
  });

  // -----------------------------------------------------------------------
  // M:N with total participation on both sides → no merge, junction table
  // -----------------------------------------------------------------------

  it('creates junction table for M:N even when min >= 1 on both sides', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Doctor',
          attributes: [makeAttr({ id: 'a1', name: 'did', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Patient',
          attributes: [makeAttr({ id: 'a2', name: 'pid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'treats',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('CREATE TABLE "Doctor"');
    expect(result.ddl).toContain('CREATE TABLE "Patient"');
    expect(result.ddl).toContain('CREATE TABLE "treats"');
    expect(result.ddl).not.toContain('Doctor_treats');
    expect(result.ddl).not.toContain('Patient_treats');
  });

  // -----------------------------------------------------------------------
  // 1:1 both mandatory → merge on alphabetical FK side
  // -----------------------------------------------------------------------

  it('merges 1:1 both mandatory with total participation', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Badge',
          attributes: [makeAttr({ id: 'a2', name: 'bid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_badge',
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
    // Both mandatory, 1:1 → alphabetical: "Employee" > "Badge" → Employee gets FK
    // Employee min=1 → total participation → merge
    expect(result.ddl).toContain('CREATE TABLE "Employee_has_badge"');
    expect(result.ddl).not.toContain('CREATE TABLE "Employee" (');
    const empTable = result.ddl.split('CREATE TABLE "Employee_has_badge"')[1];
    expect(empTable).toContain('"bid" INTEGER NOT NULL');
    expect(empTable).toContain('FOREIGN KEY ("bid") REFERENCES "Badge" ("bid")');
  });

  // -----------------------------------------------------------------------
  // 1:1 both optional → no merge
  // -----------------------------------------------------------------------

  it('does NOT merge 1:1 both optional (no total participation)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a1', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Badge',
          attributes: [makeAttr({ id: 'a2', name: 'bid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has_badge',
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
    // Both optional → alphabetical FK on Employee, no merge
    expect(result.ddl).toContain('CREATE TABLE "Employee"');
    expect(result.ddl).toContain('CREATE TABLE "Badge"');
    expect(result.ddl).not.toContain('Employee_has_badge');
    const empTable = result.ddl.split('CREATE TABLE "Employee"')[1];
    expect(empTable).toContain('"bid" INTEGER');
    expect(empTable).not.toContain('"bid" INTEGER NOT NULL');
  });

  // -----------------------------------------------------------------------
  // Merge with cycle → deferred ALTER TABLE uses merged name
  // -----------------------------------------------------------------------

  it('handles merge combined with cyclic FK dependencies', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'A',
          attributes: [makeAttr({ id: 'a1', name: 'aid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'], 'pk1')],
        }),
        makeEntity({
          id: 'e2',
          name: 'B',
          attributes: [makeAttr({ id: 'a2', name: 'bid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'r1',
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
          name: 'r2',
          participants: [
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
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
    // A merged with r1 (min=1 → total participation)
    expect(result.ddl).toContain('CREATE TABLE "A_r1"');
    // B is NOT merged (min=0)
    expect(result.ddl).toContain('CREATE TABLE "B"');
    // Cycle between A_r1 and B should be handled (tables created + possible ALTER TABLE)
    expect(result.ddl).toContain('FOREIGN KEY');
  });

  // -----------------------------------------------------------------------
  // Aggregation: ON DELETE SET NULL for aggregated 1:N relationship
  // -----------------------------------------------------------------------

  it('generates ON DELETE SET NULL for aggregated 1:N relationship FK', () => {
    // Course(1) --[has]--> Projects(N), aggregation wraps "has"
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Course',
          attributes: [makeAttr({ id: 'a1', name: 'course_id', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Projects',
          attributes: [makeAttr({ id: 'a2', name: 'project_id', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'has',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [{ id: 'agg1', name: 'CourseProjects', relationshipId: 'r1' }],
    };
    const result = exporter.export(model);
    expect(result.ddl).toContain('FOREIGN KEY ("course_id") REFERENCES "Course" ("course_id") ON DELETE SET NULL');
  });

  // -----------------------------------------------------------------------
  // Aggregation: ON DELETE SET NULL for aggregated M:N junction table
  // -----------------------------------------------------------------------

  it('generates ON DELETE SET NULL for aggregated M:N relationship junction table FKs', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
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
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1' }],
    };
    const result = exporter.export(model);
    const junctionDDL = result.ddl.split('CREATE TABLE "enrolls"')[1];
    expect(junctionDDL).toContain('FOREIGN KEY ("sid") REFERENCES "Student" ("sid") ON DELETE SET NULL');
    expect(junctionDDL).toContain('FOREIGN KEY ("cid") REFERENCES "Course" ("cid") ON DELETE SET NULL');
  });

  // -----------------------------------------------------------------------
  // Non-aggregated relationship: no ON DELETE clause
  // -----------------------------------------------------------------------

  it('does not add ON DELETE clause for non-aggregated 1:N relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Dept',
          attributes: [makeAttr({ id: 'a1', name: 'did', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Emp',
          attributes: [makeAttr({ id: 'a2', name: 'eid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'works_in',
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
    expect(result.ddl).toContain('FOREIGN KEY ("did") REFERENCES "Dept" ("did")');
    expect(result.ddl).not.toContain('ON DELETE');
  });

  // -----------------------------------------------------------------------
  // Weak entity (identifying relationship): ON DELETE CASCADE
  // -----------------------------------------------------------------------

  it('generates ON DELETE CASCADE for weak entity identifying relationship FK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Building',
          attributes: [makeAttr({ id: 'a1', name: 'bname', dataType: { name: 'VARCHAR', precision: 100 }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Room',
          isWeak: true,
          attributes: [makeAttr({ id: 'a2', name: 'rnum', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'located_in',
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
    const roomDDL = result.ddl.split('CREATE TABLE "Room"')[1];
    expect(roomDDL).toContain('FOREIGN KEY ("bname") REFERENCES "Building" ("bname") ON DELETE CASCADE');
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
      aggregations: [{ id: 'agg1', name: 'EnrollAgg', relationshipId: 'r1', position: { x: 0, y: 0 } }],
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
      aggregations: [{ id: 'agg1', name: 'Agg', relationshipId: 'missing_rel', position: { x: 0, y: 0 } }],
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
      aggregations: [{ id: 'agg1', name: 'Agg', relationshipId: 'r1', position: { x: 0, y: 0 } }],
    };
    const result = testExporter.testResolveParticipantEntities(
      { entityId: 'agg1', cardinality: { min: 0, max: '*' }, isAggregation: true },
      model,
    );
    // Only the normal entity participant should be returned, not the aggregation participant
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });

  // -----------------------------------------------------------------------
  // Partial key conversion for weak entities (issue #15)
  // -----------------------------------------------------------------------

  it('includes partial key attribute in weak entity composite PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Schools',
          attributes: [
            makeAttr({ id: 'a1', name: 'name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Students',
          isWeak: true,
          attributes: [
            makeAttr({ id: 'a2', name: 'Name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: true }),
            makeAttr({ id: 'a3', name: 'student_id', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false, isPartialKey: true }),
          ],
          candidateKeys: [],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'identifies',
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
    const studentsTable = result.ddl.split('CREATE TABLE "Students"')[1];
    expect(studentsTable).toContain('PRIMARY KEY ("name", "student_id")');
    expect(studentsTable).toContain('FOREIGN KEY ("name") REFERENCES "Schools" ("name")');
  });

  it('includes partial key in PK even when weak entity also has a candidate key', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Building',
          attributes: [
            makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Room',
          isWeak: true,
          attributes: [
            makeAttr({ id: 'a2', name: 'number', dataType: { name: 'INT' }, nullable: false, isPartialKey: true }),
          ],
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
    // "number" from candidate key + "id" from owner PK — partial key should not be duplicated
    expect(roomTable).toContain('PRIMARY KEY ("number", "id")');
    expect(roomTable).toContain('FOREIGN KEY ("id") REFERENCES "Building" ("id")');
  });

  it('includes partial key in weak entity PK when there is no candidate key', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Department',
          attributes: [
            makeAttr({ id: 'a1', name: 'dept_id', dataType: { name: 'INT' }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'Project',
          isWeak: true,
          attributes: [
            makeAttr({ id: 'a2', name: 'proj_name', dataType: { name: 'VARCHAR', precision: 100 }, nullable: false, isPartialKey: true }),
            makeAttr({ id: 'a3', name: 'budget', dataType: { name: 'NUMERIC' }, nullable: true }),
          ],
          candidateKeys: [],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'runs',
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
    const projectTable = result.ddl.split('CREATE TABLE "Project"')[1];
    // PK should be composite: owner's PK + partial key
    expect(projectTable).toContain('PRIMARY KEY ("dept_id", "proj_name")');
    expect(projectTable).toContain('FOREIGN KEY ("dept_id") REFERENCES "Department" ("dept_id")');
    // No "has no primary key" warning for the weak entity
    expect(result.warnings).not.toContain('Entity "Project" has no primary key');
  });

  it('prefixes FK column name when weak entity has attribute colliding with owner PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'school',
          attributes: [
            makeAttr({ id: 'a1', name: 'name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false }),
          ],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2',
          name: 'student',
          isWeak: true,
          attributes: [
            makeAttr({ id: 'a2', name: 'name', dataType: { name: 'VARCHAR', precision: 255 }, nullable: true }),
            makeAttr({ id: 'a3', name: 'id', dataType: { name: 'VARCHAR', precision: 255 }, nullable: false, isPartialKey: true }),
          ],
          candidateKeys: [],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'enrolled_in',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    const studentTable = result.ddl.split('CREATE TABLE "student"')[1];
    // FK column should be prefixed to avoid collision with student's own "name"
    expect(studentTable).toContain('"school_name"');
    expect(studentTable).toContain('PRIMARY KEY ("school_name", "id")');
    expect(studentTable).toContain('FOREIGN KEY ("school_name") REFERENCES "school" ("name")');
    // Student's own "name" should still be there
    expect(studentTable).toContain('"name" VARCHAR(255)');
  });
});

// ---------------------------------------------------------------------------
// N-ary Relationship DDL Generation
// ---------------------------------------------------------------------------

describe('N-ary Relationships', () => {
  it('generates a junction table for ternary relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1', name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2', name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3', name: 'Instructor',
          attributes: [makeAttr({ id: 'a3', name: 'iid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1', name: 'Teaches',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };

    const result = exporter.export(model);
    const ddl = result.ddl;

    // Should generate a junction table named "Teaches"
    expect(ddl).toContain('CREATE TABLE "Teaches"');

    // Junction table should have FK columns for all 3 entities
    expect(ddl).toContain('"sid"');
    expect(ddl).toContain('"cid"');
    expect(ddl).toContain('"iid"');

    // Junction table should have a composite PK with all 3 FK columns
    expect(ddl).toContain('PRIMARY KEY ("sid", "cid", "iid")');

    // Junction table should have FK references to all 3 entity tables
    expect(ddl).toContain('REFERENCES "Student"');
    expect(ddl).toContain('REFERENCES "Course"');
    expect(ddl).toContain('REFERENCES "Instructor"');
  });

  it('generates junction table for ternary relationship with PK name collisions', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1', name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2', name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3', name: 'Instructor',
          attributes: [makeAttr({ id: 'a3', name: 'id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1', name: 'Teaches',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };

    const result = exporter.export(model);
    const ddl = result.ddl;

    // With all entities having "id" as PK, there should be collision handling
    expect(ddl).toContain('CREATE TABLE "Teaches"');
    // Disambiguated column names
    expect(ddl).toContain('"student_id"');
    expect(ddl).toContain('"course_id"');
    expect(ddl).toContain('"instructor_id"');
  });

  it('adds relationship attributes to the junction table for n-ary relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1', name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2', name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3', name: 'Instructor',
          attributes: [makeAttr({ id: 'a3', name: 'iid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
      ],
      relationships: [
        {
          id: 'r1', name: 'Teaches',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
          ],
          isIdentifying: false,
          attributes: [
            makeAttr({ id: 'ra1', name: 'grade', dataType: { name: 'VARCHAR', precision: 2 } }),
          ],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };

    const result = exporter.export(model);
    const ddl = result.ddl;

    // The junction table should include the relationship attribute
    expect(ddl).toContain('CREATE TABLE "Teaches"');
    expect(ddl).toContain('"grade"');
  });

  it('generates junction table for quaternary relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1', name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
        makeEntity({
          id: 'e2', name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a2'], 'pk2')],
        }),
        makeEntity({
          id: 'e3', name: 'Instructor',
          attributes: [makeAttr({ id: 'a3', name: 'iid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a3'], 'pk3')],
        }),
        makeEntity({
          id: 'e4', name: 'Semester',
          attributes: [makeAttr({ id: 'a4', name: 'sem_id', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a4'], 'pk4')],
        }),
      ],
      relationships: [
        {
          id: 'r1', name: 'Registration',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
            { entityId: 'e4', cardinality: { min: 1, max: '*' } },
          ],
          isIdentifying: false, attributes: [], position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };

    const result = exporter.export(model);
    const ddl = result.ddl;

    expect(ddl).toContain('CREATE TABLE "Registration"');
    // All 4 FK columns
    expect(ddl).toContain('"sid"');
    expect(ddl).toContain('"cid"');
    expect(ddl).toContain('"iid"');
    expect(ddl).toContain('"sem_id"');
    // PK includes all 4
    expect(ddl).toContain('PRIMARY KEY ("sid", "cid", "iid", "sem_id")');
    // FK references to all 4 entities
    expect(ddl).toContain('REFERENCES "Student"');
    expect(ddl).toContain('REFERENCES "Course"');
    expect(ddl).toContain('REFERENCES "Instructor"');
    expect(ddl).toContain('REFERENCES "Semester"');
  });

  // -----------------------------------------------------------------------
  // Edge cases for n-ary junction table with missing participants
  // -----------------------------------------------------------------------

  it('produces empty junction table when all participants reference nonexistent entities', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [
        {
          id: 'r1',
          name: 'Ghost',
          participants: [
            { entityId: 'missing1', cardinality: { min: 0, max: '*' } },
            { entityId: 'missing2', cardinality: { min: 0, max: '*' } },
            { entityId: 'missing3', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: false,
          attributes: [],
          position: { x: 0, y: 0 },
        },
      ],
      aggregations: [],
    };
    const result = exporter.export(model);
    // Junction table created but with no columns
    expect(result.ddl).toContain('CREATE TABLE "Ghost"');
  });

  it('warns about relationship with fewer than 2 participants', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Lone',
          attributes: [makeAttr({ id: 'a1', name: 'lid', dataType: { name: 'INT' }, nullable: false })],
          candidateKeys: [makePK(['a1'])],
        }),
      ],
      relationships: [
        {
          id: 'r1',
          name: 'incomplete',
          participants: [
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
    expect(result.warnings).toContain('Relationship "incomplete" has fewer than 2 participants');
  });
});
