import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { CrowsFootRelationshipNode } from '../nodes/CrowsFootRelationshipNode';
import type { Relationship } from '../../../ir/types';

function makeRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: 'r1',
    name: 'teaches',
    participants: [
      { entityId: 'e1', cardinality: { min: 0, max: '*' } },
      { entityId: 'e2', cardinality: { min: 0, max: '*' } },
      { entityId: 'e3', cardinality: { min: 0, max: '*' } },
    ],
    isIdentifying: false,
    attributes: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeNodeProps(relationship: Relationship, selected = false) {
  return {
    id: `rel::${relationship.id}`,
    type: 'crowsfootRelationship' as const,
    data: { relationship },
    selected,
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

describe('CrowsFootRelationshipNode', () => {
  it('renders the relationship name', () => {
    const rel = makeRelationship({ name: 'advises' });
    render(
      <ReactFlowProvider>
        <CrowsFootRelationshipNode {...makeNodeProps(rel)} />
      </ReactFlowProvider>,
    );
    expect(screen.getByText('advises')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    render(
      <ReactFlowProvider>
        <CrowsFootRelationshipNode {...makeNodeProps(makeRelationship())} />
      </ReactFlowProvider>,
    );
    expect(screen.getByTestId('crowsfoot-relationship-node')).toBeInTheDocument();
  });

  it('renders a diamond SVG polygon', () => {
    const { container } = render(
      <ReactFlowProvider>
        <CrowsFootRelationshipNode {...makeNodeProps(makeRelationship())} />
      </ReactFlowProvider>,
    );
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
    expect(polygon?.getAttribute('points')).toBe('60,4 116,40 60,76 4,40');
  });

  it('applies selection styles when selected', () => {
    const rel = makeRelationship();
    render(
      <ReactFlowProvider>
        <CrowsFootRelationshipNode {...makeNodeProps(rel, true)} />
      </ReactFlowProvider>,
    );
    const node = screen.getByTestId('crowsfoot-relationship-node');
    expect(node.className).toContain('drop-shadow');
  });

  it('does not apply selection styles when not selected', () => {
    const rel = makeRelationship();
    render(
      <ReactFlowProvider>
        <CrowsFootRelationshipNode {...makeNodeProps(rel, false)} />
      </ReactFlowProvider>,
    );
    const node = screen.getByTestId('crowsfoot-relationship-node');
    expect(node.className).not.toContain('drop-shadow');
  });
});
