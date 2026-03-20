import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AggregationProperties } from '../AggregationProperties';
import { useERDStore } from '../../../ir/store';
import type { Aggregation } from '../../../ir/types';

function getAggregation(id: string): Aggregation {
  return useERDStore.getState().model.aggregations.find((a) => a.id === id)!;
}

describe('AggregationProperties', () => {
  let entityId1: string;
  let entityId2: string;
  let relId: string;
  let aggId: string;

  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
      nodePositions: {},
    });
    entityId1 = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    entityId2 = useERDStore.getState().addEntity('Course', { x: 100, y: 0 });
    relId = useERDStore.getState().addRelationship(
      'Enrolls',
      [
        { entityId: entityId1, cardinality: { min: 0, max: '*' } },
        { entityId: entityId2, cardinality: { min: 1, max: 1 } },
      ],
      { x: 50, y: 50 },
    );
    aggId = useERDStore.getState().addAggregation('EnrollsAgg', relId);
  });

  it('renders aggregation properties', () => {
    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    expect(screen.getByTestId('aggregation-properties')).toBeInTheDocument();
  });

  it('renders aggregation name input with current name', () => {
    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    expect(screen.getByTestId('agg-name-edit')).toHaveValue('EnrollsAgg');
  });

  it('edits name and calls updateAggregation', () => {
    render(<AggregationProperties aggregation={getAggregation(aggId)} />);

    const input = screen.getByTestId('agg-name-edit');
    fireEvent.change(input, { target: { value: 'RenamedAgg' } });

    expect(useERDStore.getState().model.aggregations[0].name).toBe('RenamedAgg');
  });

  it('shows aggregated relationship name', () => {
    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    expect(screen.getByText('Enrolls')).toBeInTheDocument();
  });

  it('shows participant entity names', () => {
    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText('Course')).toBeInTheDocument();
  });

  it('deletes aggregation when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    await user.click(screen.getByTestId('delete-agg-button'));

    expect(useERDStore.getState().model.aggregations).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('does not delete aggregation when confirm is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AggregationProperties aggregation={getAggregation(aggId)} />);
    await user.click(screen.getByTestId('delete-agg-button'));

    expect(useERDStore.getState().model.aggregations).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('shows [Agg] prefix for aggregation participants', () => {
    // Create a second relationship that references the first aggregation as a participant
    const e3id = useERDStore.getState().addEntity('Dept', { x: 200, y: 0 });
    const rel2Id = useERDStore.getState().addRelationship(
      'AssignedTo',
      [
        { entityId: aggId, cardinality: { min: 0, max: '*' }, isAggregation: true },
        { entityId: e3id, cardinality: { min: 1, max: 1 } },
      ],
      { x: 150, y: 100 },
    );
    const agg2Id = useERDStore.getState().addAggregation('AssignedAgg', rel2Id);

    render(<AggregationProperties aggregation={getAggregation(agg2Id)} />);
    expect(screen.getByText('[Agg] EnrollsAgg')).toBeInTheDocument();
    expect(screen.getByText('Dept')).toBeInTheDocument();
  });

  it('shows Unknown and empty participants when relationship does not exist', () => {
    // Manually set the aggregation to reference a non-existent relationship
    useERDStore.getState().addAggregation('OrphanAgg', 'nonexistent_rel');
    const orphanAgg = useERDStore.getState().model.aggregations.find((a) => a.name === 'OrphanAgg')!;

    render(<AggregationProperties aggregation={orphanAgg} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows ? for participant with unknown entity', () => {
    // Add a relationship with an entity that doesn't exist
    const rel2Id = useERDStore.getState().addRelationship(
      'BadRel',
      [
        { entityId: 'nonexistent_entity', cardinality: { min: 0, max: '*' } },
        { entityId: entityId1, cardinality: { min: 1, max: 1 } },
      ],
      { x: 50, y: 50 },
    );
    const agg2Id = useERDStore.getState().addAggregation('BadAgg', rel2Id);

    render(<AggregationProperties aggregation={getAggregation(agg2Id)} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows ? for unknown aggregation participant', () => {
    // Create a relationship with an isAggregation participant pointing to non-existent id
    const e3id = useERDStore.getState().addEntity('Dept', { x: 200, y: 0 });
    const rel2Id = useERDStore.getState().addRelationship(
      'BrokenRel',
      [
        { entityId: 'nonexistent', cardinality: { min: 0, max: '*' }, isAggregation: true },
        { entityId: e3id, cardinality: { min: 1, max: 1 } },
      ],
      { x: 150, y: 100 },
    );
    const agg2Id = useERDStore.getState().addAggregation('BrokenAgg', rel2Id);

    render(<AggregationProperties aggregation={getAggregation(agg2Id)} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
