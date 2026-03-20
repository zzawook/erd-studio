import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { NodeHandles } from '../NodeHandles';

// NodeHandles renders inside a ReactFlow node context, but we can wrap with
// ReactFlowProvider to make Handle components render without errors.

function renderNodeHandles(variant?: 'visible' | 'invisible') {
  return render(
    <ReactFlowProvider>
      <div>
        <NodeHandles variant={variant} />
      </div>
    </ReactFlowProvider>,
  );
}

describe('NodeHandles', () => {
  it('renders 8 handles with default (visible) variant', () => {
    const { container } = renderNodeHandles();
    // React Flow Handle renders as <div class="react-flow__handle ...">
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(8);
  });

  it('renders 8 handles with invisible variant', () => {
    const { container } = renderNodeHandles('invisible');
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(8);
  });
});
