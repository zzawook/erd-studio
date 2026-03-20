import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChenJunctionNode } from '../nodes/ChenJunctionNode';

function makeNodeProps(overrides: Record<string, unknown> = {}) {
  return {
    id: 'junction::j1',
    type: 'chenJunction' as const,
    data: {},
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
    width: 8,
    height: 8,
    ...overrides,
  };
}

describe('ChenJunctionNode', () => {
  it('renders with the correct test id', () => {
    render(
      <ReactFlowProvider>
        <ChenJunctionNode {...makeNodeProps()} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chen-junction-node')).toBeInTheDocument();
  });

  it('has small dot appearance (w-2 h-2 class)', () => {
    render(
      <ReactFlowProvider>
        <ChenJunctionNode {...makeNodeProps()} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-junction-node');
    expect(node.className).toContain('w-2');
    expect(node.className).toContain('h-2');
  });
});
