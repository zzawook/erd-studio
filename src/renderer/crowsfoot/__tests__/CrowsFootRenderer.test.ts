import { describe, it, expect } from 'vitest';
import { crowsFootRenderer } from '../CrowsFootRenderer';
import type { ERDModel, Entity, Relationship, Attribute, Aggregation } from '../../../ir/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttr(overrides: Partial<Attribute> & { id: string; name: string }): Attribute {
  return {
    dataType: { name: 'INT' },
    nullable: false,
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

function makeRelationship(
  overrides: Partial<Relationship> & { id: string; name: string },
): Relationship {
  return {
    participants: [],
    isIdentifying: false,
    attributes: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrowsFootRenderer', () => {
  // -----------------------------------------------------------------------
  // Empty model
  // -----------------------------------------------------------------------
  it('returns empty nodes and edges for an empty model', () => {
    const result = crowsFootRenderer.render({ entities: [], relationships: [], aggregations: [] });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Single entity → 1 crowsfootEntity node (no attribute nodes)
  // -----------------------------------------------------------------------
  it('produces a single crowsfootEntity node for one entity (no attribute nodes)', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [
            makeAttr({ id: 'a1', name: 'id' }),
            makeAttr({ id: 'a2', name: 'name' }),
          ],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes, edges } = crowsFootRenderer.render(model);

    // Only 1 entity node — no separate attribute nodes in crow's foot
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('crowsfootEntity');
    expect(edges).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Node data includes entity and foreignKeys
  // -----------------------------------------------------------------------
  it('includes entity and foreignKeys in node data', () => {
    const entity = makeEntity({
      id: 'e1',
      name: 'Student',
      attributes: [makeAttr({ id: 'a1', name: 'sid' })],
    });

    const model: ERDModel = { entities: [entity], relationships: [], aggregations: [] };
    const { nodes } = crowsFootRenderer.render(model);

    expect(nodes[0].data).toHaveProperty('entity');
    expect(nodes[0].data).toHaveProperty('foreignKeys');
    expect(nodes[0].data.entity.name).toBe('Student');
    expect(Array.isArray(nodes[0].data.foreignKeys)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Relationship → 1 crowsfootEdge (not a node)
  // -----------------------------------------------------------------------
  it('creates a crowsfootEdge (not a node) for a relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student' }),
        makeEntity({ id: 'e2', name: 'Course' }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes, edges } = crowsFootRenderer.render(model);

    // No relationship nodes in crow's foot — only entity nodes
    expect(nodes.filter((n) => n.type === 'crowsfootEntity')).toHaveLength(2);
    expect(nodes).toHaveLength(2);

    // One edge for the relationship
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('crowsfootEdge');
  });

  // -----------------------------------------------------------------------
  // Edge data contains cardinalities and relationship
  // -----------------------------------------------------------------------
  it('includes cardinalities and relationship in edge data', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student' }),
        makeEntity({ id: 'e2', name: 'Course' }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    const edge = edges[0];

    expect(edge.data?.relationship.name).toBe('Enrolls');
    expect(edge.data?.sourceCardinality).toEqual({ min: 0, max: '*' });
    expect(edge.data?.targetCardinality).toEqual({ min: 1, max: 1 });
  });

  // -----------------------------------------------------------------------
  // Edge source/target point to entity nodes
  // -----------------------------------------------------------------------
  it('sets edge source and target to entity node IDs', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'A' }),
        makeEntity({ id: 'e2', name: 'B' }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    expect(edges[0].source).toBe('entity::e1');
    expect(edges[0].target).toBe('entity::e2');
  });

  // -----------------------------------------------------------------------
  // FK computation: 1:N → FK on many side
  // -----------------------------------------------------------------------
  it('assigns foreign keys to the many side in a 1:N relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Department',
          attributes: [makeAttr({ id: 'a1', name: 'dept_id' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Employee',
          attributes: [makeAttr({ id: 'a2', name: 'emp_id' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'WorksIn',
          participants: [
            // Department side: 1
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            // Employee side: many
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);

    // Employee (many side) should have FK referencing Department
    const employeeNode = nodes.find((n) => n.id === 'entity::e2');
    expect(employeeNode?.data.foreignKeys).toHaveLength(1);
    expect(employeeNode?.data.foreignKeys[0].attributeName).toBe('dept_id');
    expect(employeeNode?.data.foreignKeys[0].referencedEntityName).toBe('Department');

    // Department (one side) should have no FKs
    const deptNode = nodes.find((n) => n.id === 'entity::e1');
    expect(deptNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // No FK markers for M:N
  // -----------------------------------------------------------------------
  it('does not assign FK markers for M:N relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Course',
          attributes: [makeAttr({ id: 'a2', name: 'cid' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);

    const studentNode = nodes.find((n) => n.id === 'entity::e1');
    const courseNode = nodes.find((n) => n.id === 'entity::e2');

    expect(studentNode?.data.foreignKeys).toHaveLength(0);
    expect(courseNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Multiple relationships → correct edge count
  // -----------------------------------------------------------------------
  it('creates the correct number of edges for multiple relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student' }),
        makeEntity({ id: 'e2', name: 'Course' }),
        makeEntity({ id: 'e3', name: 'Professor' }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
        makeRelationship({
          id: 'r2',
          name: 'Teaches',
          participants: [
            { entityId: 'e3', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes, edges } = crowsFootRenderer.render(model);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Relationship with less than 2 participants is skipped
  // -----------------------------------------------------------------------
  it('skips relationships with fewer than 2 participants', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'A' })],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Self',
          participants: [{ entityId: 'e1', cardinality: { min: 1, max: 1 } }],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    expect(edges).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 1:1 FK goes to optional side (min=0)
  // -----------------------------------------------------------------------
  it('assigns FK to the optional side in a 1:1 relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Person',
          attributes: [makeAttr({ id: 'a1', name: 'pid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Passport',
          attributes: [makeAttr({ id: 'a2', name: 'passId' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Has',
          participants: [
            // Person: mandatory side (min=1)
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            // Passport: optional side (min=0)
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);

    // Passport (optional side, min=0) should get the FK
    const passportNode = nodes.find((n) => n.id === 'entity::e2');
    expect(passportNode?.data.foreignKeys).toHaveLength(1);
    expect(passportNode?.data.foreignKeys[0].referencedEntityName).toBe('Person');

    // Person (mandatory) should not have FK
    const personNode = nodes.find((n) => n.id === 'entity::e1');
    expect(personNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Node position from IR
  // -----------------------------------------------------------------------
  it('uses entity position from the IR model', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'X', position: { x: 50, y: 75 } })],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);
    expect(nodes[0].position).toEqual({ x: 50, y: 75 });
  });

  // -----------------------------------------------------------------------
  // Aggregation virtual entity node
  // -----------------------------------------------------------------------
  it('creates a crowsfootEntity node for an aggregation with bracketed name', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 300, y: 0 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 150, y: 0 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1', position: { x: 150, y: 150 } }],
    };

    const { nodes } = crowsFootRenderer.render(model);

    const aggNode = nodes.find((n) => n.id === 'entity::agg1');
    expect(aggNode).toBeDefined();
    expect(aggNode?.type).toBe('crowsfootEntity');
    // Name should be wrapped in brackets
    expect(aggNode?.data?.entity.name).toBe('[Enrollment]');
    // Foreign keys should be empty
    expect(aggNode?.data?.foreignKeys).toEqual([]);
    // The virtual entity should not be weak
    expect(aggNode?.data?.entity.isWeak).toBe(false);
  });

  it('positions aggregation node using its persisted position', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 100, y: 50 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 300, y: 50 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 200, y: 100 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1', position: { x: 200, y: 200 } }],
    };

    const { nodes } = crowsFootRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'entity::agg1');
    expect(aggNode).toBeDefined();
    // Position should come directly from the aggregation's persisted position
    expect(aggNode?.position).toEqual({ x: 200, y: 200 });
  });

  it('aggregation node position is independent of connected entity positions', () => {
    // The aggregation position should NOT be recalculated from entities
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 1000, y: 1000 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 500, y: 500 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1', position: { x: 42, y: 99 } }],
    };

    const { nodes } = crowsFootRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'entity::agg1');
    expect(aggNode).toBeDefined();
    // Position should be exactly what was set, NOT computed from entities
    expect(aggNode?.position).toEqual({ x: 42, y: 99 });
  });

  it('does not crash when aggregation references non-existent relationship', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [],
      aggregations: [{ id: 'agg1', name: 'Ghost', relationshipId: 'nonexistent', position: { x: 0, y: 0 } }],
    };

    // Should not crash
    const { nodes } = crowsFootRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'entity::agg1');
    expect(aggNode).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Aggregation in relationship edge
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // 1:1 both mandatory → FK on alphabetically later entity
  // -----------------------------------------------------------------------
  it('assigns FK to alphabetically later entity in 1:1 both mandatory', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Alpha',
          attributes: [makeAttr({ id: 'a1', name: 'aid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Beta',
          attributes: [makeAttr({ id: 'a2', name: 'bid' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);

    // Beta > Alpha alphabetically, so Beta gets the FK
    const betaNode = nodes.find((n) => n.id === 'entity::e2');
    expect(betaNode?.data.foreignKeys).toHaveLength(1);
    expect(betaNode?.data.foreignKeys[0].referencedEntityName).toBe('Alpha');

    const alphaNode = nodes.find((n) => n.id === 'entity::e1');
    expect(alphaNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 1:1 both optional → FK on alphabetically later entity
  // -----------------------------------------------------------------------
  it('assigns FK to alphabetically later entity in 1:1 both optional', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Cat',
          attributes: [makeAttr({ id: 'a1', name: 'cid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Dog',
          attributes: [makeAttr({ id: 'a2', name: 'did' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Friends',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);

    // Both min=0, both optional. Dog > Cat alphabetically, so Dog gets the FK
    const dogNode = nodes.find((n) => n.id === 'entity::e2');
    expect(dogNode?.data.foreignKeys).toHaveLength(1);
    expect(dogNode?.data.foreignKeys[0].referencedEntityName).toBe('Cat');
  });

  // -----------------------------------------------------------------------
  // 1:N with PK referencing non-existent attribute (attr false branch)
  // -----------------------------------------------------------------------
  it('handles 1:N where PK references a non-existent attribute ID', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Parent',
          attributes: [makeAttr({ id: 'a1', name: 'pid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1', 'nonexistent'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Child',
          attributes: [makeAttr({ id: 'a2', name: 'cid' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'HasChild',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);
    // Child (many side) should have FK for the existing attribute only
    const childNode = nodes.find((n) => n.id === 'entity::e2');
    expect(childNode?.data.foreignKeys).toHaveLength(1);
    expect(childNode?.data.foreignKeys[0].attributeName).toBe('pid');
  });

  // -----------------------------------------------------------------------
  // 1:1 with PK referencing non-existent attribute (attr false branch)
  // -----------------------------------------------------------------------
  it('handles 1:1 where PK references a non-existent attribute ID', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Foo',
          attributes: [makeAttr({ id: 'a1', name: 'fid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1', 'missing_attr'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Goo',
          attributes: [makeAttr({ id: 'a2', name: 'gid' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel11',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);
    // Goo (optional side, min=0) gets FK; only the valid attr should create an FK
    const gooNode = nodes.find((n) => n.id === 'entity::e2');
    expect(gooNode?.data.foreignKeys).toHaveLength(1);
    expect(gooNode?.data.foreignKeys[0].attributeName).toBe('fid');
  });

  // -----------------------------------------------------------------------
  // 1:1 where other entity has no PK
  // -----------------------------------------------------------------------
  it('does not generate FK when other entity has no PK in 1:1', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'NoPK',
          attributes: [makeAttr({ id: 'a1', name: 'col' })],
          candidateKeys: [],
        }),
        makeEntity({
          id: 'e2',
          name: 'HasPK',
          attributes: [makeAttr({ id: 'a2', name: 'hid' })],
          candidateKeys: [{ id: 'ck2', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);
    // NoPK (optional side) would get FK but NoPK has no PK... wait,
    // the FK is from the OTHER entity's PK. NoPK references HasPK.
    // NoPK (min=0) gets FK from HasPK's PK
    const noPKNode = nodes.find((n) => n.id === 'entity::e1');
    expect(noPKNode?.data.foreignKeys).toHaveLength(1);

    // HasPK should not have FK for NoPK since NoPK has no PK
    const hasPKNode = nodes.find((n) => n.id === 'entity::e2');
    expect(hasPKNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 1:1 where optional side references entity with no PK (otherPk false branch)
  // -----------------------------------------------------------------------
  it('does not generate FK for 1:1 when referenced entity has no PK', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'WithPK',
          attributes: [makeAttr({ id: 'a1', name: 'wid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'NoPK',
          attributes: [makeAttr({ id: 'a2', name: 'col' })],
          candidateKeys: [],  // No PK
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            // WithPK is optional side (min=0), will try to get FK from NoPK
            { entityId: 'e1', cardinality: { min: 0, max: 1 } },
            // NoPK is mandatory side (min=1), has no PK for FK
            { entityId: 'e2', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = crowsFootRenderer.render(model);
    // WithPK (optional, min=0) would try to get FK from NoPK, but NoPK has no PK
    const withPKNode = nodes.find((n) => n.id === 'entity::e1');
    expect(withPKNode?.data.foreignKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Aggregation node uses its persisted position even with missing participants
  // -----------------------------------------------------------------------
  it('uses persisted position for aggregation even when participants are missing', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'R',
          participants: [
            { entityId: 'missing1', cardinality: { min: 0, max: '*' } },
            { entityId: 'missing2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Agg', relationshipId: 'r1', position: { x: 300, y: 300 } }],
    };

    const { nodes } = crowsFootRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'entity::agg1');
    expect(aggNode).toBeDefined();
    // Position comes directly from the aggregation's persisted position
    expect(aggNode?.position).toEqual({ x: 300, y: 300 });
  });

  // -----------------------------------------------------------------------
  // Edge handle assignment based on relative entity positions
  // -----------------------------------------------------------------------
  it('assigns right-src/left handles for horizontally arranged entities', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'A', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'B', position: { x: 300, y: 0 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    expect(edges[0].sourceHandle).toBe('right-src');
    expect(edges[0].targetHandle).toBe('left');
  });

  it('assigns bottom-src/top handles for vertically arranged entities', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'A', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'B', position: { x: 0, y: 300 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    expect(edges[0].sourceHandle).toBe('bottom-src');
    expect(edges[0].targetHandle).toBe('top');
  });

  it('assigns left-src/right handles when target is to the left of source', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'A', position: { x: 300, y: 0 } }),
        makeEntity({ id: 'e2', name: 'B', position: { x: 0, y: 0 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Rel',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = crowsFootRenderer.render(model);
    expect(edges[0].sourceHandle).toBe('left-src');
    expect(edges[0].targetHandle).toBe('right');
  });

  it('assigns handles for aggregation virtual entity edges', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 300, y: 0 } }),
        makeEntity({ id: 'e3', name: 'Professor', position: { x: 150, y: 300 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 150, y: 0 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
        makeRelationship({
          id: 'r2',
          name: 'Monitors',
          position: { x: 150, y: 200 },
          participants: [
            { entityId: 'agg1', cardinality: { min: 1, max: 1 }, isAggregation: true },
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1', position: { x: 150, y: 150 } }],
    };

    const { edges } = crowsFootRenderer.render(model);
    const monitorEdge = edges.find((e) => e.id === 'edge::r2');
    expect(monitorEdge).toBeDefined();
    // agg1 position is (150, 150), e3 is (150, 300) → vertical, target below
    expect(monitorEdge?.sourceHandle).toBe('bottom-src');
    expect(monitorEdge?.targetHandle).toBe('top');
  });

  it('creates edge connecting aggregation virtual entity to another entity', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 300, y: 0 } }),
        makeEntity({ id: 'e3', name: 'Professor', position: { x: 150, y: 300 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 150, y: 0 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
        makeRelationship({
          id: 'r2',
          name: 'Monitors',
          position: { x: 150, y: 200 },
          participants: [
            { entityId: 'agg1', cardinality: { min: 1, max: 1 }, isAggregation: true },
            { entityId: 'e3', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1', position: { x: 150, y: 150 } }],
    };

    const { edges } = crowsFootRenderer.render(model);

    // r2 edge should connect agg1 (as entity::agg1) to e3
    const monitorEdge = edges.find((e) => e.id === 'edge::r2');
    expect(monitorEdge).toBeDefined();
    expect(monitorEdge?.source).toBe('entity::agg1');
    expect(monitorEdge?.target).toBe('entity::e3');
    expect(monitorEdge?.data?.sourceCardinality).toEqual({ min: 1, max: 1 });
    expect(monitorEdge?.data?.targetCardinality).toEqual({ min: 0, max: '*' });
  });
});
