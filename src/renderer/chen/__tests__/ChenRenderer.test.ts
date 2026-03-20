import { describe, it, expect } from 'vitest';
import { chenRenderer } from '../ChenRenderer';
import type { ERDModel, Entity, Relationship, Attribute, Aggregation } from '../../../ir/types';

// ---------------------------------------------------------------------------
// Helpers to build test data
// ---------------------------------------------------------------------------

function makeAttr(overrides: Partial<Attribute> & { id: string; name: string }): Attribute {
  return {
    dataType: { name: 'VARCHAR' },
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

function emptyModel(): ERDModel {
  return { entities: [], relationships: [], aggregations: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChenRenderer', () => {
  // -----------------------------------------------------------------------
  // Empty model
  // -----------------------------------------------------------------------
  it('returns empty nodes and edges for an empty model', () => {
    const result = chenRenderer.render(emptyModel());
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Single entity (no attributes)
  // -----------------------------------------------------------------------
  it('produces a single chenEntity node for one entity', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'Student' })],
      relationships: [],
      aggregations: [],
    };

    const { nodes, edges } = chenRenderer.render(model);
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(nodes[0].type).toBe('chenEntity');
  });

  // -----------------------------------------------------------------------
  // Entity node ID format
  // -----------------------------------------------------------------------
  it('formats entity node id as entity::{id}', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'abc', name: 'Foo' })],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    expect(nodes[0].id).toBe('entity::abc');
  });

  // -----------------------------------------------------------------------
  // Entity position matches IR
  // -----------------------------------------------------------------------
  it('uses the entity position from the IR model', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'X', position: { x: 42, y: 99 } })],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    expect(nodes[0].position).toEqual({ x: 42, y: 99 });
  });

  // -----------------------------------------------------------------------
  // Entity with attributes
  // -----------------------------------------------------------------------
  it('creates entity node + attribute nodes for an entity with attributes', () => {
    const attrs: Attribute[] = [
      makeAttr({ id: 'a1', name: 'id' }),
      makeAttr({ id: 'a2', name: 'name' }),
    ];

    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'Student', attributes: attrs })],
      relationships: [],
      aggregations: [],
    };

    const { nodes, edges } = chenRenderer.render(model);
    // 1 entity + 2 attributes
    expect(nodes).toHaveLength(3);

    const entityNodes = nodes.filter((n) => n.type === 'chenEntity');
    const attrNodes = nodes.filter((n) => n.type === 'chenAttribute');
    expect(entityNodes).toHaveLength(1);
    expect(attrNodes).toHaveLength(2);

    // 2 entity-attribute edges
    expect(edges).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Attribute node ID format
  // -----------------------------------------------------------------------
  it('formats attribute node id as attr::{entityId}::{attrId}', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'id' })],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const attrNode = nodes.find((n) => n.type === 'chenAttribute');
    expect(attrNode?.id).toBe('attr::e1::a1');
  });

  // -----------------------------------------------------------------------
  // Attribute positions are computed (not 0,0)
  // -----------------------------------------------------------------------
  it('computes attribute positions away from the entity position', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          position: { x: 100, y: 100 },
          attributes: [
            makeAttr({ id: 'a1', name: 'id' }),
            makeAttr({ id: 'a2', name: 'name' }),
          ],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const attrNodes = nodes.filter((n) => n.type === 'chenAttribute');

    for (const an of attrNodes) {
      // Each attribute position should differ from the entity position
      const isAtOrigin = an.position.x === 100 && an.position.y === 100;
      expect(isAtOrigin).toBe(false);
    }
  });

  // -----------------------------------------------------------------------
  // Entity-attribute edges
  // -----------------------------------------------------------------------
  it('creates entity-attribute edges with correct source/target and edgeKind', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'id' })],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { edges } = chenRenderer.render(model);
    expect(edges).toHaveLength(1);

    const edge = edges[0];
    expect(edge.source).toBe('entity::e1');
    expect(edge.target).toBe('attr::e1::a1');
    expect(edge.type).toBe('chenEdge');
    expect(edge.data?.edgeKind).toBe('entity-attribute');
  });

  // -----------------------------------------------------------------------
  // PK attribute marked correctly
  // -----------------------------------------------------------------------
  it('marks primary key attributes with isPrimaryKey = true', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [
            makeAttr({ id: 'a1', name: 'id' }),
            makeAttr({ id: 'a2', name: 'name' }),
          ],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const attrNodes = nodes.filter((n) => n.type === 'chenAttribute');

    const pkNode = attrNodes.find((n) => n.id === 'attr::e1::a1');
    const nonPkNode = attrNodes.find((n) => n.id === 'attr::e1::a2');

    expect(pkNode?.data?.isPrimaryKey).toBe(true);
    expect(nonPkNode?.data?.isPrimaryKey).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Weak entity data correct
  // -----------------------------------------------------------------------
  it('passes weak entity data correctly', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'Dependent', isWeak: true })],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    expect(nodes[0].data?.entity.isWeak).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Relationship node
  // -----------------------------------------------------------------------
  it('creates a chenRelationship node for a relationship', () => {
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
            { entityId: 'e2', cardinality: { min: 1, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const relNodes = nodes.filter((n) => n.type === 'chenRelationship');
    expect(relNodes).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Relationship node ID format
  // -----------------------------------------------------------------------
  it('formats relationship node id as rel::{id}', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [makeRelationship({ id: 'r1', name: 'Enrolls' })],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    expect(nodes[0].id).toBe('rel::r1');
  });

  // -----------------------------------------------------------------------
  // Entity-relationship edges with cardinality
  // -----------------------------------------------------------------------
  it('creates entity-relationship edges with cardinality data', () => {
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

    const { edges } = chenRenderer.render(model);
    const erEdges = edges.filter((e) => e.data?.edgeKind === 'entity-relationship');
    expect(erEdges).toHaveLength(2);

    // First edge: Student -> Enrolls
    expect(erEdges[0].source).toBe('entity::e1');
    expect(erEdges[0].target).toBe('rel::r1');
    expect(erEdges[0].data?.cardinality).toEqual({ min: 0, max: '*' });

    // Second edge: Course -> Enrolls
    expect(erEdges[1].source).toBe('entity::e2');
    expect(erEdges[1].target).toBe('rel::r1');
    expect(erEdges[1].data?.cardinality).toEqual({ min: 1, max: 1 });
  });

  // -----------------------------------------------------------------------
  // Entity-relationship edges include role
  // -----------------------------------------------------------------------
  it('includes role in entity-relationship edges when present', () => {
    const model: ERDModel = {
      entities: [makeEntity({ id: 'e1', name: 'Person' })],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Manages',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 }, role: 'manager' },
            { entityId: 'e1', cardinality: { min: 0, max: '*' }, role: 'employee' },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = chenRenderer.render(model);
    const erEdges = edges.filter((e) => e.data?.edgeKind === 'entity-relationship');
    expect(erEdges).toHaveLength(2);
    expect(erEdges[0].data?.role).toBe('manager');
    expect(erEdges[1].data?.role).toBe('employee');

    // Edge IDs include role
    expect(erEdges[0].id).toContain('::manager');
    expect(erEdges[1].id).toContain('::employee');
  });

  // -----------------------------------------------------------------------
  // Relationship attributes
  // -----------------------------------------------------------------------
  it('creates additional attribute nodes and edges for relationship attributes', () => {
    const relAttr = makeAttr({ id: 'ra1', name: 'grade' });

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
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          attributes: [relAttr],
        }),
      ],
      aggregations: [],
    };

    const { nodes, edges } = chenRenderer.render(model);

    // Relationship attribute node
    const relAttrNode = nodes.find((n) => n.id === 'relattr::r1::ra1');
    expect(relAttrNode).toBeDefined();
    expect(relAttrNode?.type).toBe('chenAttribute');
    expect(relAttrNode?.data?.attribute.name).toBe('grade');
    expect(relAttrNode?.data?.isPrimaryKey).toBe(false);
    expect(relAttrNode?.data?.relationshipId).toBe('r1');

    // Relationship-attribute edge
    const raEdge = edges.find((e) => e.id === 'edge::ra::r1::ra1');
    expect(raEdge).toBeDefined();
    expect(raEdge?.source).toBe('rel::r1');
    expect(raEdge?.target).toBe('relattr::r1::ra1');
    expect(raEdge?.data?.edgeKind).toBe('relationship-attribute');
  });

  // -----------------------------------------------------------------------
  // Multiple entities + relationships → correct counts
  // -----------------------------------------------------------------------
  it('produces correct counts for multiple entities and relationships', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'sid' })],
        }),
        makeEntity({
          id: 'e2',
          name: 'Course',
          attributes: [
            makeAttr({ id: 'a2', name: 'cid' }),
            makeAttr({ id: 'a3', name: 'title' }),
          ],
        }),
        makeEntity({
          id: 'e3',
          name: 'Professor',
          attributes: [makeAttr({ id: 'a4', name: 'pid' })],
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

    const { nodes, edges } = chenRenderer.render(model);

    // Nodes: 3 entities + 4 attributes + 2 relationships = 9
    expect(nodes).toHaveLength(9);
    expect(nodes.filter((n) => n.type === 'chenEntity')).toHaveLength(3);
    expect(nodes.filter((n) => n.type === 'chenAttribute')).toHaveLength(4);
    expect(nodes.filter((n) => n.type === 'chenRelationship')).toHaveLength(2);

    // Edges: 4 entity-attribute + 4 entity-relationship = 8
    expect(edges).toHaveLength(8);
    expect(edges.filter((e) => e.data?.edgeKind === 'entity-attribute')).toHaveLength(4);
    expect(edges.filter((e) => e.data?.edgeKind === 'entity-relationship')).toHaveLength(4);
  });

  // -----------------------------------------------------------------------
  // Attribute nodes are draggable
  // -----------------------------------------------------------------------
  it('sets attribute nodes as draggable', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          attributes: [makeAttr({ id: 'a1', name: 'id' })],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const attrNode = nodes.find((n) => n.type === 'chenAttribute');
    expect(attrNode?.draggable).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Partial key attribute
  // -----------------------------------------------------------------------
  it('passes isPartialKey from the attribute', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'WeakEntity',
          isWeak: true,
          attributes: [makeAttr({ id: 'a1', name: 'partialId', isPartialKey: true })],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    const attrNode = nodes.find((n) => n.type === 'chenAttribute');
    expect(attrNode?.data?.isPartialKey).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Relationship position from IR
  // -----------------------------------------------------------------------
  it('uses the relationship position from the IR model', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [
        makeRelationship({ id: 'r1', name: 'Rel', position: { x: 200, y: 300 } }),
      ],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);
    expect(nodes[0].position).toEqual({ x: 200, y: 300 });
  });

  // -----------------------------------------------------------------------
  // Aggregation rendering
  // -----------------------------------------------------------------------
  it('creates a chenAggregation node wrapping a relationship', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({ id: 'e1', name: 'Student', position: { x: 0, y: 0 } }),
        makeEntity({ id: 'e2', name: 'Course', position: { x: 300, y: 0 } }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'Enrolls',
          position: { x: 150, y: 100 },
          participants: [
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1' }],
    };

    const { nodes } = chenRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'agg::agg1');
    expect(aggNode).toBeDefined();
    expect(aggNode?.type).toBe('chenAggregation');
    // Width/height match REL_W=120, REL_H=80
    expect(aggNode?.data?.width).toBe(120);
    expect(aggNode?.data?.height).toBe(80);
    // Position matches the relationship position
    expect(aggNode?.position).toEqual({ x: 150, y: 100 });
    // Not draggable, zIndex=-1
    expect(aggNode?.draggable).toBe(false);
    expect(aggNode?.style).toEqual({ zIndex: -1 });
  });

  it('skips aggregation node when referenced relationship does not exist', () => {
    const model: ERDModel = {
      entities: [],
      relationships: [],
      aggregations: [{ id: 'agg1', name: 'Ghost', relationshipId: 'nonexistent' }],
    };

    // Should not crash
    const { nodes } = chenRenderer.render(model);
    const aggNode = nodes.find((n) => n.id === 'agg::agg1');
    expect(aggNode).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Partial key handling with identifying relationship
  // -----------------------------------------------------------------------
  it('creates junction node and two edges for partial key attributes', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'weak1',
          name: 'Dependent',
          isWeak: true,
          position: { x: 0, y: 0 },
          attributes: [
            makeAttr({ id: 'pk1', name: 'depName', isPartialKey: true }),
            makeAttr({ id: 'a1', name: 'age' }),
          ],
        }),
        makeEntity({
          id: 'strong1',
          name: 'Employee',
          position: { x: 300, y: 0 },
          attributes: [makeAttr({ id: 'a2', name: 'empId' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a2'], isPrimary: true }],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'DependsOn',
          isIdentifying: true,
          position: { x: 150, y: 0 },
          participants: [
            { entityId: 'weak1', cardinality: { min: 0, max: '*' } },
            { entityId: 'strong1', cardinality: { min: 1, max: 1 } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes, edges } = chenRenderer.render(model);

    // Junction node should be created
    const junctionNode = nodes.find((n) => n.id === 'junction::r1::strong1');
    expect(junctionNode).toBeDefined();
    expect(junctionNode?.type).toBe('chenJunction');
    expect(junctionNode?.draggable).toBe(false);

    // Partial key attribute node should have isPartialKey=true
    const pkAttrNode = nodes.find((n) => n.id === 'attr::weak1::pk1');
    expect(pkAttrNode).toBeDefined();
    expect(pkAttrNode?.data?.isPartialKey).toBe(true);

    // Partial key attribute should have 2 edges:
    // 1) entity→attribute edge
    const entityToAttrEdge = edges.find((e) => e.id === 'edge::ea::weak1::pk1');
    expect(entityToAttrEdge).toBeDefined();
    expect(entityToAttrEdge?.source).toBe('entity::weak1');
    expect(entityToAttrEdge?.target).toBe('attr::weak1::pk1');

    // 2) attribute→junction edge
    const attrToJunctionEdge = edges.find((e) => e.id === 'edge::pk::weak1::pk1');
    expect(attrToJunctionEdge).toBeDefined();
    expect(attrToJunctionEdge?.source).toBe('attr::weak1::pk1');
    expect(attrToJunctionEdge?.target).toBe('junction::r1::strong1');

    // Normal (non-partial-key) attribute should have only 1 edge (entity→attribute)
    const normalAttrEdge = edges.find((e) => e.id === 'edge::ea::weak1::a1');
    expect(normalAttrEdge).toBeDefined();
    const normalAttrJunctionEdge = edges.find((e) => e.id === 'edge::pk::weak1::a1');
    expect(normalAttrJunctionEdge).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Partial key without identifying relationship → no junction
  // -----------------------------------------------------------------------
  it('connects partial key to entity only when no identifying relationship exists', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'weak1',
          name: 'Dependent',
          isWeak: true,
          position: { x: 0, y: 0 },
          attributes: [
            makeAttr({ id: 'pk1', name: 'depName', isPartialKey: true }),
          ],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const { nodes, edges } = chenRenderer.render(model);

    // No junction node should be created
    const junctionNodes = nodes.filter((n) => n.type === 'chenJunction');
    expect(junctionNodes).toHaveLength(0);

    // Partial key attribute still connected to entity
    const entityToAttrEdge = edges.find((e) => e.id === 'edge::ea::weak1::pk1');
    expect(entityToAttrEdge).toBeDefined();

    // No junction edge
    const junctionEdge = edges.find((e) => e.id === 'edge::pk::weak1::pk1');
    expect(junctionEdge).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Entity-relationship handles with aggregation participant
  // -----------------------------------------------------------------------
  it('uses agg:: prefix for aggregation participant edges', () => {
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
        makeRelationship({
          id: 'r2',
          name: 'Monitors',
          position: { x: 150, y: 200 },
          participants: [
            { entityId: 'agg1', cardinality: { min: 1, max: 1 }, isAggregation: true },
            { entityId: 'e1', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [{ id: 'agg1', name: 'Enrollment', relationshipId: 'r1' }],
    };

    const { edges } = chenRenderer.render(model);
    const aggEdge = edges.find(
      (e) => e.data?.edgeKind === 'entity-relationship' && e.source === 'agg::agg1',
    );
    expect(aggEdge).toBeDefined();
    expect(aggEdge?.source).toBe('agg::agg1');
    expect(aggEdge?.target).toBe('rel::r2');
  });

  // -----------------------------------------------------------------------
  // nodePositions parameter overrides computed positions
  // -----------------------------------------------------------------------
  it('uses stored positions from nodePositions instead of computed ones', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Student',
          position: { x: 100, y: 100 },
          attributes: [makeAttr({ id: 'a1', name: 'id' })],
        }),
      ],
      relationships: [],
      aggregations: [],
    };

    const storedPositions: Record<string, { x: number; y: number }> = {
      'attr::e1::a1': { x: 500, y: 500 },
    };

    const { nodes } = chenRenderer.render(model, storedPositions);
    const attrNode = nodes.find((n) => n.id === 'attr::e1::a1');
    expect(attrNode?.position).toEqual({ x: 500, y: 500 });
  });

  // -----------------------------------------------------------------------
  // Vertical entity-relationship layout triggers top/bottom handles
  // -----------------------------------------------------------------------
  it('uses top/bottom handles when entities are vertically arranged', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Top',
          position: { x: 100, y: 0 },
        }),
        makeEntity({
          id: 'e2',
          name: 'Bottom',
          position: { x: 100, y: 400 },
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'VerticalRel',
          position: { x: 100, y: 200 },
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { edges } = chenRenderer.render(model);

    // Entity e1 is above the relationship, so the edge should use bottom-src/top handles
    const topEdge = edges.find((e) => e.id.includes('e1'));
    expect(topEdge).toBeDefined();
    expect(topEdge?.sourceHandle).toBe('bottom-src');
    expect(topEdge?.targetHandle).toBe('top');

    // Entity e2 is below the relationship, so the edge should use top-src/bottom handles
    const bottomEdge = edges.find((e) => e.id.includes('e2'));
    expect(bottomEdge).toBeDefined();
    expect(bottomEdge?.sourceHandle).toBe('top-src');
    expect(bottomEdge?.targetHandle).toBe('bottom');
  });

  // -----------------------------------------------------------------------
  // Vertical arrangement with weak entity junction
  // -----------------------------------------------------------------------
  it('computes junction node correctly with vertical arrangement', () => {
    const model: ERDModel = {
      entities: [
        makeEntity({
          id: 'e1',
          name: 'Owner',
          position: { x: 100, y: 0 },
          attributes: [makeAttr({ id: 'a1', name: 'oid' })],
          candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
        }),
        makeEntity({
          id: 'e2',
          name: 'Dep',
          isWeak: true,
          position: { x: 100, y: 400 },
          attributes: [makeAttr({ id: 'a2', name: 'seq', isPartialKey: true })],
          candidateKeys: [],
        }),
      ],
      relationships: [
        makeRelationship({
          id: 'r1',
          name: 'HasDep',
          isIdentifying: true,
          position: { x: 100, y: 200 },
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
        }),
      ],
      aggregations: [],
    };

    const { nodes } = chenRenderer.render(model);

    // A junction node should exist on the line between rel and dominant entity
    const junctionNode = nodes.find((n) => n.type === 'chenJunction');
    expect(junctionNode).toBeDefined();
    // Junction should be positioned between the relationship and the owner entity
    expect(junctionNode?.position).toBeDefined();
  });
});
