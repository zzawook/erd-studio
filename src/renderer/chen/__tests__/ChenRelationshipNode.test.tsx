import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChenRelationshipNode } from '../nodes/ChenRelationshipNode';
import type { Relationship } from '../../../ir/types';

function makeRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: 'r1',
    name: 'Enrolls',
    participants: [],
    isIdentifying: false,
    attributes: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeNodeProps(relationship: Relationship) {
  return {
    id: `rel::${relationship.id}`,
    type: 'chenRelationship' as const,
    data: { relationship },
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
    width: 120,
    height: 80,
  };
}

describe('ChenRelationshipNode', () => {
  it('renders the relationship name', () => {
    const rel = makeRelationship({ name: 'WorksFor' });
    render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...makeNodeProps(rel)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('WorksFor')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...makeNodeProps(makeRelationship())} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chen-relationship-node')).toBeInTheDocument();
  });

  it('renders an inner diamond polygon for identifying relationships', () => {
    const rel = makeRelationship({ isIdentifying: true });
    const { container } = render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...makeNodeProps(rel)} />
      </ReactFlowProvider>,
    );

    const polygons = container.querySelectorAll('polygon');
    // Outer diamond + inner diamond = 2 polygons
    expect(polygons.length).toBe(2);
  });

  it('renders only the outer diamond for non-identifying relationships', () => {
    const rel = makeRelationship({ isIdentifying: false });
    const { container } = render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...makeNodeProps(rel)} />
      </ReactFlowProvider>,
    );

    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(1);
  });

  it('applies selection styles when selected', () => {
    const rel = makeRelationship();
    const props = { ...makeNodeProps(rel), selected: true };
    const { container } = render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...props} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-relationship-node');
    expect(node.className).toContain('drop-shadow');
  });

  it('always renders the outer diamond SVG', () => {
    const { container } = render(
      <ReactFlowProvider>
        <ChenRelationshipNode {...makeNodeProps(makeRelationship())} />
      </ReactFlowProvider>,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
