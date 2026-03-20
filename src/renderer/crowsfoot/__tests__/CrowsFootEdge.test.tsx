import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider, ReactFlow } from '@xyflow/react';
import { CrowsFootEdge, drawMarker } from '../edges/CrowsFootEdge';
import type { Relationship, Cardinality } from '../../../ir/types';

// ReactFlow requires ResizeObserver which is not available in jsdom
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const edgeTypes = { crowsfootEdge: CrowsFootEdge };

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

describe('CrowsFootEdge via ReactFlow', () => {
  it('renders without crashing with basic data', () => {
    const sourceCardinality: Cardinality = { min: 1, max: 1 };
    const targetCardinality: Cardinality = { min: 0, max: '*' };

    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 300, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'crowsfootEdge',
        data: {
          relationship: makeRelationship(),
          sourceCardinality,
          targetCardinality,
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

  it('renders without crashing for 1:1 relationship', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 300, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'crowsfootEdge',
        data: {
          relationship: makeRelationship({ name: 'Has' }),
          sourceCardinality: { min: 1, max: 1 } as Cardinality,
          targetCardinality: { min: 0, max: 1 } as Cardinality,
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

  it('renders without crashing for M:N relationship', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 300, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'crowsfootEdge',
        data: {
          relationship: makeRelationship({ name: 'ManyToMany' }),
          sourceCardinality: { min: 0, max: '*' } as Cardinality,
          targetCardinality: { min: 0, max: '*' } as Cardinality,
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

  it('renders without crashing for mandatory many cardinality', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', position: { x: 300, y: 0 }, data: {} },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'crowsfootEdge',
        data: {
          relationship: makeRelationship({ name: 'Contains' }),
          sourceCardinality: { min: 1, max: 1 } as Cardinality,
          targetCardinality: { min: 1, max: '*' } as Cardinality,
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
});

describe('CrowsFootEdge direct render', () => {
  it('renders edge path with relationship data', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CrowsFootEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={0}
            data={{
              relationship: makeRelationship({ name: 'TestRel' }),
              sourceCardinality: { min: 1, max: 1 },
              targetCardinality: { min: 0, max: '*' },
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

  it('renders markers for source and target cardinality', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CrowsFootEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={100}
            data={{
              relationship: makeRelationship(),
              sourceCardinality: { min: 1, max: 1 },
              targetCardinality: { min: 0, max: '*' },
            }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    // Should have marker elements (lines, circles)
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders without data (no label or markers)', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CrowsFootEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={0}
            data={undefined as any}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(container.querySelector('path')).toBeTruthy();
    expect(screen.queryByTestId('crowsfoot-edge-label')).toBeNull();
  });

  it('renders with mandatory-one markers (bar + one)', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CrowsFootEdge
            id="test-edge"
            source="n1"
            target="n2"
            sourceX={0}
            sourceY={0}
            targetX={300}
            targetY={0}
            data={{
              relationship: makeRelationship({ name: 'OneToOne' }),
              sourceCardinality: { min: 1, max: 1 },
              targetCardinality: { min: 1, max: 1 },
            }}
            sourcePosition={'left' as any}
            targetPosition={'right' as any}
          />
        </svg>
      </ReactFlowProvider>,
    );
    const lines = container.querySelectorAll('line');
    // Each side: bar + one = 2 lines, total 4
    expect(lines.length).toBe(4);
  });
});

describe('drawMarker', () => {
  it('draws optional-one marker (circle + one-line)', () => {
    const elements = drawMarker({ min: 0, max: 1 }, 100, 100, 0);
    expect(elements).toHaveLength(2);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('circle');
    expect(keys).toContain('one');
  });

  it('draws mandatory-one marker (bar + one-line)', () => {
    const elements = drawMarker({ min: 1, max: 1 }, 100, 100, 0);
    expect(elements).toHaveLength(2);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('bar');
    expect(keys).toContain('one');
  });

  it('draws optional-many marker (circle + crow foot)', () => {
    const elements = drawMarker({ min: 0, max: '*' }, 100, 100, 0);
    expect(elements).toHaveLength(4);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('circle');
    expect(keys).toContain('crow1');
    expect(keys).toContain('crow2');
    expect(keys).toContain('crow3');
  });

  it('draws mandatory-many marker (bar + crow foot)', () => {
    const elements = drawMarker({ min: 1, max: '*' }, 100, 100, 0);
    expect(elements).toHaveLength(4);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('bar');
    expect(keys).toContain('crow1');
    expect(keys).toContain('crow2');
    expect(keys).toContain('crow3');
  });

  it('treats numeric max > 1 as many', () => {
    const elements = drawMarker({ min: 1, max: 5 }, 100, 100, Math.PI / 4);
    expect(elements).toHaveLength(4);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('bar');
    expect(keys).toContain('crow1');
  });

  it('treats numeric max = 1 as one', () => {
    const elements = drawMarker({ min: 0, max: 1 }, 50, 50, Math.PI / 2);
    expect(elements).toHaveLength(2);
    const keys = elements.map((e) => e.key);
    expect(keys).toContain('circle');
    expect(keys).toContain('one');
  });
});
