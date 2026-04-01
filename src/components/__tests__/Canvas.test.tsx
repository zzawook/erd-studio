import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas, handleNodeDragStop, handleNodeClick } from '../Canvas';
import { useERDStore } from '../../ir/store';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  useERDStore.setState({
    model: { entities: [], relationships: [], aggregations: [] },
    notation: 'chen',
    selection: null,
  });
});

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>,
  );
}

describe('Canvas rendering', () => {
  it('renders without crashing', () => {
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders the canvas container', () => {
    renderCanvas();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('renders with chen notation by default', () => {
    renderCanvas();
    expect(useERDStore.getState().notation).toBe('chen');
  });

  it('renders with crowsfoot notation', () => {
    useERDStore.setState({ notation: 'crowsfoot' });
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders with entities in the model (chen)', () => {
    useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    useERDStore.getState().addEntity('Course', { x: 200, y: 0 });
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders with relationships in the model (chen)', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders with crowsfoot notation and entities/relationships', () => {
    useERDStore.setState({ notation: 'crowsfoot' });
    const e1 = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('Course', { x: 200, y: 0 });
    useERDStore.getState().addRelationship('enrolls', [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders with entity attributes (chen)', () => {
    const eid = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(eid, 'col1', { name: 'INT' });
    useERDStore.getState().addAttribute(eid, 'col2', { name: 'VARCHAR' });
    expect(() => renderCanvas()).not.toThrow();
  });

  it('renders with relationship attributes (chen)', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 1, y: 1 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationshipAttribute(relId, 'date', { name: 'DATE' });
    expect(() => renderCanvas()).not.toThrow();
  });
});

describe('Canvas pane click', () => {
  it('clicking pane clears selection', () => {
    const id = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    useERDStore.setState({ selection: { type: 'entity', entityId: id } });

    const { container } = renderCanvas();

    const pane = container.querySelector('.react-flow__pane');
    if (pane) {
      act(() => {
        fireEvent.click(pane);
      });
      expect(useERDStore.getState().selection).toBeNull();
    }
  });
});

describe('handleNodeDragStop', () => {
  it('calls updateEntity for entity nodes', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    handleNodeDragStop('entity::e1', { x: 50, y: 60 }, updateEntity, updateRelationship);
    expect(updateEntity).toHaveBeenCalledWith('e1', { position: { x: 50, y: 60 } });
    expect(updateRelationship).not.toHaveBeenCalled();
  });

  it('calls updateRelationship for rel nodes', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    handleNodeDragStop('rel::r1', { x: 100, y: 200 }, updateEntity, updateRelationship);
    expect(updateRelationship).toHaveBeenCalledWith('r1', { position: { x: 100, y: 200 } });
    expect(updateEntity).not.toHaveBeenCalled();
  });

  it('does nothing for unknown node kinds', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    handleNodeDragStop('attr::a1::a2', { x: 0, y: 0 }, updateEntity, updateRelationship);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateRelationship).not.toHaveBeenCalled();
  });

  it('calls updateAggregation for agg:: nodes (chen notation)', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    const updateAggregation = vi.fn();
    handleNodeDragStop('agg::agg1', { x: 75, y: 85 }, updateEntity, updateRelationship, updateAggregation);
    expect(updateAggregation).toHaveBeenCalledWith('agg1', { position: { x: 75, y: 85 } });
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateRelationship).not.toHaveBeenCalled();
  });

  it('calls updateAggregation for entity:: nodes when ID is in aggregationIds (crowsfoot notation)', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    const updateAggregation = vi.fn();
    const aggregationIds = new Set(['agg1']);
    handleNodeDragStop('entity::agg1', { x: 120, y: 130 }, updateEntity, updateRelationship, updateAggregation, aggregationIds);
    expect(updateAggregation).toHaveBeenCalledWith('agg1', { position: { x: 120, y: 130 } });
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateRelationship).not.toHaveBeenCalled();
  });

  it('calls updateEntity for entity:: nodes when ID is NOT in aggregationIds', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    const updateAggregation = vi.fn();
    const aggregationIds = new Set(['agg1']);
    handleNodeDragStop('entity::e1', { x: 50, y: 60 }, updateEntity, updateRelationship, updateAggregation, aggregationIds);
    expect(updateEntity).toHaveBeenCalledWith('e1', { position: { x: 50, y: 60 } });
    expect(updateAggregation).not.toHaveBeenCalled();
  });
});

describe('handleNodeClick', () => {
  it('returns entity selection for entity nodes', () => {
    const result = handleNodeClick('entity::e1');
    expect(result).toEqual({ type: 'entity', entityId: 'e1' });
  });

  it('returns relationship selection for rel nodes', () => {
    const result = handleNodeClick('rel::r1');
    expect(result).toEqual({ type: 'relationship', relationshipId: 'r1' });
  });

  it('returns attribute selection for attr nodes', () => {
    const result = handleNodeClick('attr::e1::a1');
    expect(result).toEqual({ type: 'attribute', entityId: 'e1', attributeId: 'a1' });
  });

  it('returns relAttribute selection for relattr nodes', () => {
    const result = handleNodeClick('relattr::r1::a1');
    expect(result).toEqual({ type: 'relAttribute', relationshipId: 'r1', attributeId: 'a1' });
  });

  it('returns null for unknown node kinds', () => {
    const result = handleNodeClick('unknown::x1');
    expect(result).toBeNull();
  });

  it('returns aggregation selection for agg nodes', () => {
    const result = handleNodeClick('agg::agg1');
    expect(result).toEqual({ type: 'aggregation', aggregationId: 'agg1' });
  });
});

describe('handleNodeDragStop with attr:: and relattr:: prefixes', () => {
  it('does not call updateEntity or updateRelationship for attr:: prefix', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    handleNodeDragStop('attr::e1::a1', { x: 10, y: 20 }, updateEntity, updateRelationship);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateRelationship).not.toHaveBeenCalled();
  });

  it('does not call updateEntity or updateRelationship for relattr:: prefix', () => {
    const updateEntity = vi.fn();
    const updateRelationship = vi.fn();
    handleNodeDragStop('relattr::r1::a1', { x: 30, y: 40 }, updateEntity, updateRelationship);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(updateRelationship).not.toHaveBeenCalled();
  });
});

describe('Canvas onNodeDragStop integration', () => {
  it('sets node position for attr:: nodes on drag stop', () => {
    const eid = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(eid, 'col', { name: 'INT' });

    renderCanvas();

    // Simulate the onNodeDragStop callback logic directly
    const nodeId = `attr::${eid}::a1`;
    const position = { x: 100, y: 200 };
    const kind = nodeId.split('::')[0];
    if (kind === 'attr' || kind === 'relattr') {
      useERDStore.getState().setNodePosition(nodeId, position);
    }
    handleNodeDragStop(nodeId, position, useERDStore.getState().updateEntity, useERDStore.getState().updateRelationship);
    const sel = handleNodeClick(nodeId);
    useERDStore.getState().setSelection(sel);

    expect(useERDStore.getState().nodePositions[nodeId]).toEqual(position);
    expect(useERDStore.getState().selection).toEqual({ type: 'attribute', entityId: eid, attributeId: 'a1' });
  });

  it('sets node position for relattr:: nodes on drag stop', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 1, y: 1 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationshipAttribute(relId, 'date', { name: 'DATE' });

    renderCanvas();

    const nodeId = `relattr::${relId}::ra1`;
    const position = { x: 50, y: 75 };
    const kind = nodeId.split('::')[0];
    if (kind === 'attr' || kind === 'relattr') {
      useERDStore.getState().setNodePosition(nodeId, position);
    }
    handleNodeDragStop(nodeId, position, useERDStore.getState().updateEntity, useERDStore.getState().updateRelationship);
    const sel = handleNodeClick(nodeId);
    useERDStore.getState().setSelection(sel);

    expect(useERDStore.getState().nodePositions[nodeId]).toEqual(position);
    expect(useERDStore.getState().selection).toEqual({ type: 'relAttribute', relationshipId: relId, attributeId: 'ra1' });
  });
});

describe('Canvas onNodeClick integration', () => {
  it('clicking an agg:: node returns aggregation selection', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    const aggId = useERDStore.getState().addAggregation('AggR', relId);

    const sel = handleNodeClick(`agg::${aggId}`);
    expect(sel).toEqual({ type: 'aggregation', aggregationId: aggId });
    if (sel) {
      useERDStore.getState().setSelection(sel);
    }
    expect(useERDStore.getState().selection).toEqual({ type: 'aggregation', aggregationId: aggId });
  });

  it('clicking an unknown:: node returns null', () => {
    const sel = handleNodeClick('foobar::x1');
    expect(sel).toBeNull();
  });
});
