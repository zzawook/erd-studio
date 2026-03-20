import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { CrowsFootEntityNode } from '../nodes/CrowsFootEntityNode';
import type { Entity, Attribute } from '../../../ir/types';
import type { ForeignKeyInfo } from '../nodes/CrowsFootEntityNode';

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

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'e1',
    name: 'Student',
    isWeak: false,
    attributes: [],
    candidateKeys: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeNodeProps(entity: Entity, foreignKeys: ForeignKeyInfo[] = []) {
  return {
    id: `entity::${entity.id}`,
    type: 'crowsfootEntity' as const,
    data: { entity, foreignKeys },
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    deletable: true,
    selectable: true,
    width: 160,
    height: 100,
  };
}

describe('CrowsFootEntityNode', () => {
  it('renders the entity name in the header', () => {
    const entity = makeEntity({ name: 'Employee' });
    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('Employee')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(makeEntity())} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('crowsfoot-entity-node')).toBeInTheDocument();
  });

  it('renders PK attributes listed first with PK marker', () => {
    const entity = makeEntity({
      name: 'Student',
      attributes: [
        makeAttr({ id: 'a1', name: 'sid' }),
        makeAttr({ id: 'a2', name: 'name', dataType: { name: 'VARCHAR' } }),
      ],
      candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
    });

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    // PK marker should appear
    expect(screen.getByText('PK')).toBeInTheDocument();
    // Both attribute names should be rendered
    expect(screen.getByText('sid')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('renders all attributes', () => {
    const entity = makeEntity({
      attributes: [
        makeAttr({ id: 'a1', name: 'id' }),
        makeAttr({ id: 'a2', name: 'email', dataType: { name: 'VARCHAR' } }),
        makeAttr({ id: 'a3', name: 'age', dataType: { name: 'INT' } }),
      ],
      candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
    });

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('renders FK marker for foreign key attributes', () => {
    const entity = makeEntity({
      attributes: [
        makeAttr({ id: 'a1', name: 'eid' }),
        makeAttr({ id: 'a2', name: 'dept_id', dataType: { name: 'INT' } }),
      ],
      candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
    });

    const foreignKeys: ForeignKeyInfo[] = [
      { attributeName: 'dept_id', referencedEntityName: 'Department' },
    ];

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity, foreignKeys)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('FK')).toBeInTheDocument();
  });

  it('renders data type for attributes', () => {
    const entity = makeEntity({
      attributes: [
        makeAttr({ id: 'a1', name: 'salary', dataType: { name: 'NUMERIC', precision: 10, scale: 2 } }),
      ],
    });

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('NUMERIC(10,2)')).toBeInTheDocument();
  });

  it('renders data type with precision only', () => {
    const entity = makeEntity({
      attributes: [
        makeAttr({ id: 'a1', name: 'code', dataType: { name: 'VARCHAR', precision: 50 } }),
      ],
    });

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('VARCHAR(50)')).toBeInTheDocument();
  });

  it('renders "No attributes" when entity has no attributes', () => {
    const entity = makeEntity({ attributes: [] });

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('No attributes')).toBeInTheDocument();
  });

  it('applies selection styles when selected', () => {
    const entity = makeEntity({ name: 'SelectedEntity' });
    const props = { ...makeNodeProps(entity), selected: true };
    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...props} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('crowsfoot-entity-node');
    expect(node.className).toContain('ring-2');
  });

  it('renders PK,FK marker when attribute is both PK and FK', () => {
    const entity = makeEntity({
      attributes: [
        makeAttr({ id: 'a1', name: 'dept_id' }),
      ],
      candidateKeys: [{ id: 'ck1', name: 'PK', attributeIds: ['a1'], isPrimary: true }],
    });

    const foreignKeys: ForeignKeyInfo[] = [
      { attributeName: 'dept_id', referencedEntityName: 'Department' },
    ];

    render(
      <ReactFlowProvider>
        <CrowsFootEntityNode {...makeNodeProps(entity, foreignKeys)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('PK,FK')).toBeInTheDocument();
  });
});
