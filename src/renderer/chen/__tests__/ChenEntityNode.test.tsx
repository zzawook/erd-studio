import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChenEntityNode } from '../nodes/ChenEntityNode';
import type { Entity } from '../../../ir/types';

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

// Minimal NodeProps shape required by the component
function makeNodeProps(entity: Entity) {
  return {
    id: `entity::${entity.id}`,
    type: 'chenEntity' as const,
    data: { entity },
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
    width: 100,
    height: 40,
  };
}

describe('ChenEntityNode', () => {
  it('renders the entity name', () => {
    const entity = makeEntity({ name: 'Department' });
    render(
      <ReactFlowProvider>
        <ChenEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('Department')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    const entity = makeEntity();
    render(
      <ReactFlowProvider>
        <ChenEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chen-entity-node')).toBeInTheDocument();
  });

  it('applies double-border class for weak entities', () => {
    const entity = makeEntity({ isWeak: true });
    render(
      <ReactFlowProvider>
        <ChenEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-entity-node');
    expect(node.className).toContain('outline');
    expect(node.className).toContain('outline-offset-2');
  });

  it('applies single border for strong entities', () => {
    const entity = makeEntity({ isWeak: false });
    render(
      <ReactFlowProvider>
        <ChenEntityNode {...makeNodeProps(entity)} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-entity-node');
    expect(node.className).toContain('border-2');
    expect(node.className).not.toContain('outline-offset-2');
  });
});
