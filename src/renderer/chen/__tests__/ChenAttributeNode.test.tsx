import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChenAttributeNode } from '../nodes/ChenAttributeNode';
import type { Attribute } from '../../../ir/types';

function makeAttr(overrides: Partial<Attribute> = {}): Attribute {
  return {
    id: 'a1',
    name: 'name',
    dataType: { name: 'VARCHAR' },
    nullable: false,
    kind: 'simple',
    isPartialKey: false,
    childAttributeIds: [],
    ...overrides,
  };
}

function makeNodeProps(
  attribute: Attribute,
  opts: { isPrimaryKey?: boolean; isPartialKey?: boolean; entityId?: string } = {},
) {
  return {
    id: `attr::e1::${attribute.id}`,
    type: 'chenAttribute' as const,
    data: {
      attribute,
      entityId: opts.entityId ?? 'e1',
      isPrimaryKey: opts.isPrimaryKey ?? false,
      isPartialKey: opts.isPartialKey ?? false,
    },
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
    width: 80,
    height: 36,
  };
}

describe('ChenAttributeNode', () => {
  it('renders the attribute name outside the circle', () => {
    const attr = makeAttr({ name: 'email' });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('has the correct test id', () => {
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(makeAttr())} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('chen-attribute-node')).toBeInTheDocument();
  });

  it('renders a filled black circle for primary key attributes', () => {
    const attr = makeAttr({ name: 'id' });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr, { isPrimaryKey: true })} />
      </ReactFlowProvider>,
    );

    const circle = screen.getByTestId('attr-circle');
    expect(circle.className).toContain('bg-gray-800');
  });

  it('renders an open circle for partial key attributes (per CS4221)', () => {
    const attr = makeAttr({ name: 'partialId', isPartialKey: true });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr, { isPartialKey: true })} />
      </ReactFlowProvider>,
    );

    const circle = screen.getByTestId('attr-circle');
    expect(circle.className).toContain('bg-white');
  });

  it('renders an empty circle for non-key simple attributes', () => {
    const attr = makeAttr({ kind: 'simple', name: 'username' });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr)} />
      </ReactFlowProvider>,
    );

    const circle = screen.getByTestId('attr-circle');
    expect(circle.className).toContain('bg-white');
  });

  it('renders an empty circle for derived attributes (dashed line handled by edge)', () => {
    const attr = makeAttr({ kind: 'derived', name: 'age' });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr)} />
      </ReactFlowProvider>,
    );

    const circle = screen.getByTestId('attr-circle');
    expect(circle.className).toContain('bg-white');
  });

  it('renders name text next to circle', () => {
    const attr = makeAttr({ name: 'regular' });
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(attr)} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('regular')).toBeInTheDocument();
    expect(screen.getByTestId('attr-circle')).toBeInTheDocument();
  });

  it('applies selection styles when selected', () => {
    const attr = makeAttr({ name: 'selAttr' });
    const props = { ...makeNodeProps(attr), selected: true };
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...props} />
      </ReactFlowProvider>,
    );

    const node = screen.getByTestId('chen-attribute-node');
    expect(node.className).toContain('bg-blue-100');
  });

  it('has a circle element with rounded-full class', () => {
    render(
      <ReactFlowProvider>
        <ChenAttributeNode {...makeNodeProps(makeAttr())} />
      </ReactFlowProvider>,
    );

    const circle = screen.getByTestId('attr-circle');
    expect(circle.className).toContain('rounded-full');
  });
});
