import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChenAggregationNode } from '../nodes/ChenAggregationNode';
import type { Aggregation } from '../../../ir/types';

function makeAggregation(overrides: Partial<Aggregation> = {}): Aggregation {
  return {
    id: 'agg1',
    name: 'TestAgg',
    relationshipId: 'rel1',
    ...overrides,
  };
}

function makeNodeProps(aggregation: Aggregation, overrides: Record<string, unknown> = {}) {
  return {
    id: `aggregation::${aggregation.id}`,
    type: 'chenAggregation' as const,
    data: { aggregation, width: 200, height: 120 },
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
    width: 200,
    height: 120,
    ...overrides,
  };
}

describe('ChenAggregationNode', () => {
  it('renders the aggregation name', () => {
    const agg = makeAggregation({ name: 'EnrollsAgg' });
    render(
      <ReactFlowProvider>
        <ChenAggregationNode {...makeNodeProps(agg)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('EnrollsAgg')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    const agg = makeAggregation();
    render(
      <ReactFlowProvider>
        <ChenAggregationNode {...makeNodeProps(agg)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chen-aggregation-node')).toBeInTheDocument();
  });

  it('shows selection styling when selected', () => {
    const agg = makeAggregation();
    render(
      <ReactFlowProvider>
        <ChenAggregationNode {...makeNodeProps(agg, { selected: true })} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-aggregation-node');
    expect(node.className).toContain('ring-2');
    expect(node.className).toContain('ring-primary-500');
  });
});
