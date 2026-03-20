import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider, ReactFlow } from '@xyflow/react';
import { ChenEdge, formatCardinality } from '../edges/ChenEdge';
import type { Cardinality } from '../../../ir/types';

// ReactFlow requires ResizeObserver which is not available in jsdom
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const edgeTypes = { chenEdge: ChenEdge };

describe('ChenEdge component', () => {
  it('renders without crashing for entity-attribute edges', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 200, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'chenEdge',
        data: { edgeKind: 'entity-attribute' as const },
      },
    ];

    expect(() => {
      render(
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} />
        </ReactFlowProvider>,
      );
    }).not.toThrow();
  });

  it('renders without crashing for entity-relationship edges with cardinality', () => {
    const cardinality: Cardinality = { min: 1, max: '*' };
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 200, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'chenEdge',
        data: {
          edgeKind: 'entity-relationship' as const,
          cardinality,
        },
      },
    ];

    expect(() => {
      render(
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} />
        </ReactFlowProvider>,
      );
    }).not.toThrow();
  });

  it('renders without crashing for edges with role', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 200, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'chenEdge',
        data: {
          edgeKind: 'entity-relationship' as const,
          cardinality: { min: 0, max: '*' } as Cardinality,
          role: 'manager',
        },
      },
    ];

    expect(() => {
      render(
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} />
        </ReactFlowProvider>,
      );
    }).not.toThrow();
  });

  it('renders without crashing for relationship-attribute edges', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 200, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'chenEdge',
        data: { edgeKind: 'relationship-attribute' as const },
      },
    ];

    expect(() => {
      render(
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} />
        </ReactFlowProvider>,
      );
    }).not.toThrow();
  });
});

describe('ChenEdge direct render', () => {
  it('renders edge without label for entity-attribute kind', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={0}
            data={{ edgeKind: 'entity-attribute' }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(container.querySelector('path')).toBeTruthy();
    expect(screen.queryByTestId('chen-edge-label')).toBeNull();
  });

  it('renders edge path for entity-relationship with cardinality', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={100}
            data={{
              edgeKind: 'entity-relationship',
              cardinality: { min: 1, max: '*' },
            }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    // Edge path is rendered; label is portaled by EdgeLabelRenderer
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('renders edge path for entity-relationship with cardinality and role', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={0}
            data={{
              edgeKind: 'entity-relationship',
              cardinality: { min: 0, max: '*' },
              role: 'manager',
            }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('renders edge without label for relationship-attribute kind', () => {
    render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={0}
            data={{ edgeKind: 'relationship-attribute' }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('chen-edge-label')).toBeNull();
  });

  it('renders dashed edge for derived attributes', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge-derived"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={0}
            data={{ edgeKind: 'entity-attribute', isDerived: true }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path?.getAttribute('style')).toContain('stroke-dasharray: 6 3');
  });

  it('renders edge without label when no data is provided', () => {
    render(
      <ReactFlowProvider>
        <svg>
          <ChenEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={0}
            data={undefined as any}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('chen-edge-label')).toBeNull();
  });
});

describe('formatCardinality (CS4221 notation)', () => {
  it('formats (min, max) with numeric max', () => {
    expect(formatCardinality({ min: 0, max: 1 })).toBe('(0, 1)');
  });

  it('formats (min, n) with wildcard max', () => {
    expect(formatCardinality({ min: 1, max: '*' })).toBe('(1, n)');
  });

  it('formats (0, n) correctly', () => {
    expect(formatCardinality({ min: 0, max: '*' })).toBe('(0, n)');
  });

  it('formats (1, 1) correctly', () => {
    expect(formatCardinality({ min: 1, max: 1 })).toBe('(1, 1)');
  });

  it('formats arbitrary numeric range', () => {
    expect(formatCardinality({ min: 2, max: 5 })).toBe('(2, 5)');
  });
});
