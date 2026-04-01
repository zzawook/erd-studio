import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RelationshipProperties } from '../RelationshipProperties';
import { useERDStore } from '../../../ir/store';
import type { Relationship } from '../../../ir/types';

function getRel(id: string): Relationship {
  return useERDStore.getState().model.relationships.find((r) => r.id === id)!;
}

describe('RelationshipProperties', () => {
  let e1id: string;
  let e2id: string;
  let relId: string;

  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
    e1id = useERDStore.getState().addEntity('Department', { x: 0, y: 0 });
    e2id = useERDStore.getState().addEntity('Employee', { x: 200, y: 0 });
    relId = useERDStore.getState().addRelationship('works_in', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 0 });
  });

  it('renders relationship properties', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('relationship-properties')).toBeInTheDocument();
  });

  it('displays the relationship name', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('rel-name-edit')).toHaveValue('works_in');
  });

  it('edits the relationship name', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const input = screen.getByTestId('rel-name-edit');
    fireEvent.change(input, { target: { value: 'belongs_to' } });

    expect(getRel(relId).name).toBe('belongs_to');
  });

  it('shows identifying checkbox unchecked by default', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('rel-identifying-edit')).not.toBeChecked();
  });

  it('toggles identifying relationship', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.click(screen.getByTestId('rel-identifying-edit'));
    expect(getRel(relId).isIdentifying).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Participants
  // -----------------------------------------------------------------------

  it('shows participants with entity names', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    // Entity names appear both in participant display and in the "Add entity" dropdown.
    // Use getAllByText and check at least one match exists.
    expect(screen.getAllByText('Department').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Employee').length).toBeGreaterThanOrEqual(1);
  });

  it('shows participant with role when present', () => {
    useERDStore.getState().updateParticipant(relId, 0, { role: 'employer' });

    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByText('Department (employer)')).toBeInTheDocument();
  });

  it('shows "Unknown" for participant with missing entity', () => {
    // Create a relationship with a nonexistent entity
    const badRelId = useERDStore.getState().addRelationship('bad', [
      { entityId: 'nonexistent', cardinality: { min: 0, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    render(<RelationshipProperties relationship={getRel(badRelId)} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('displays cardinality inputs', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('participant-min-0')).toHaveValue('1');
    expect(screen.getByTestId('participant-max-0')).toHaveValue('1');
    expect(screen.getByTestId('participant-min-1')).toHaveValue('0');
    expect(screen.getByTestId('participant-max-1')).toHaveValue('*');
  });

  it('updates cardinality min on blur', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const minInput = screen.getByTestId('participant-min-0');
    await user.clear(minInput);
    await user.type(minInput, '0');
    await user.tab(); // blur

    expect(getRel(relId).participants[0].cardinality.min).toBe(0);
  });

  it('updates cardinality max on blur', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const maxInput = screen.getByTestId('participant-max-0');
    await user.clear(maxInput);
    await user.type(maxInput, '*');
    await user.tab(); // blur

    expect(getRel(relId).participants[0].cardinality.max).toBe('*');
  });

  it('shows validation error for invalid cardinality', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const minInput = screen.getByTestId('participant-min-0');
    await user.clear(minInput);
    await user.type(minInput, '-1');
    await user.tab(); // blur

    expect(screen.getByTestId('participant-error-0')).toBeInTheDocument();
  });

  it('shows validation error for invalid max', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const maxInput = screen.getByTestId('participant-max-0');
    await user.clear(maxInput);
    await user.type(maxInput, 'abc');
    await user.tab(); // blur

    expect(screen.getByTestId('participant-error-0')).toBeInTheDocument();
  });

  it('does not update store when cardinality is invalid', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    const minBefore = getRel(relId).participants[0].cardinality.min;
    const minInput = screen.getByTestId('participant-min-0');
    await user.clear(minInput);
    await user.type(minInput, '-1');
    await user.tab(); // blur

    expect(getRel(relId).participants[0].cardinality.min).toBe(minBefore);
  });

  // -----------------------------------------------------------------------
  // Relationship Attributes
  // -----------------------------------------------------------------------

  it('shows "No attributes" when relationship has none', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByText('No attributes')).toBeInTheDocument();
  });

  it('adds a relationship attribute', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.type(screen.getByTestId('new-rel-attr-name'), 'start_date');
    await user.click(screen.getByTestId('add-rel-attr-button'));

    expect(getRel(relId).attributes).toHaveLength(1);
    expect(getRel(relId).attributes[0].name).toBe('start_date');
  });

  it('clears input after adding relationship attribute', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.type(screen.getByTestId('new-rel-attr-name'), 'start_date');
    await user.click(screen.getByTestId('add-rel-attr-button'));

    expect(screen.getByTestId('new-rel-attr-name')).toHaveValue('');
  });

  it('selects newly added relationship attribute', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.type(screen.getByTestId('new-rel-attr-name'), 'start_date');
    await user.click(screen.getByTestId('add-rel-attr-button'));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('relAttribute');
  });

  it('does not add relationship attribute when name is empty', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.type(screen.getByTestId('new-rel-attr-name'), '   ');
    await user.click(screen.getByTestId('add-rel-attr-button'));

    expect(getRel(relId).attributes).toHaveLength(0);
  });

  it('add button is disabled when input is empty', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('add-rel-attr-button')).toBeDisabled();
  });

  it('adds attribute on Enter keypress', async () => {
    const user = userEvent.setup();
    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.type(screen.getByTestId('new-rel-attr-name'), 'grade{Enter}');
    expect(getRel(relId).attributes).toHaveLength(1);
  });

  it('lists relationship attributes', () => {
    useERDStore.getState().addRelationshipAttribute(relId, 'grade', { name: 'VARCHAR', precision: 2 });

    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByText('grade')).toBeInTheDocument();
    expect(screen.getByText('VARCHAR')).toBeInTheDocument();
  });

  it('clicking a relationship attribute selects it', async () => {
    const user = userEvent.setup();
    const aid = useERDStore.getState().addRelationshipAttribute(relId, 'grade', { name: 'VARCHAR', precision: 2 });

    render(<RelationshipProperties relationship={getRel(relId)} />);
    await user.click(screen.getByText('grade'));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('relAttribute');
    if (selection?.type === 'relAttribute') {
      expect(selection.attributeId).toBe(aid);
    }
  });

  // -----------------------------------------------------------------------
  // Delete Relationship
  // -----------------------------------------------------------------------

  it('deletes relationship when confirmed', async () => {
    const user = userEvent.setup();

    render(<RelationshipProperties relationship={getRel(relId)} />);
    // First click shows the confirm UI
    await user.click(screen.getByTestId('delete-rel-button'));
    // Second click on the confirm button actually deletes
    await user.click(screen.getByTestId('delete-rel-button'));

    expect(useERDStore.getState().model.relationships).toHaveLength(0);
  });

  it('does not delete relationship when cancelled', async () => {
    const user = userEvent.setup();

    render(<RelationshipProperties relationship={getRel(relId)} />);
    // First click shows the confirm UI
    await user.click(screen.getByTestId('delete-rel-button'));
    // Click Cancel instead of confirm
    await user.click(screen.getByText('Cancel'));

    expect(useERDStore.getState().model.relationships).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Add / Remove Participants (n-ary)
  // -----------------------------------------------------------------------

  it('adds a third participant via the dropdown', async () => {
    const user = userEvent.setup();
    const e3id = useERDStore.getState().addEntity('Project', { x: 400, y: 0 });

    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.selectOptions(screen.getByTestId('new-participant-select'), e3id);
    await user.click(screen.getByTestId('add-participant-button'));

    expect(getRel(relId).participants).toHaveLength(3);
    expect(getRel(relId).participants[2].entityId).toBe(e3id);
  });

  it('add participant button is disabled when no entity selected', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('add-participant-button')).toBeDisabled();
  });

  it('does not show remove button for binary relationships', () => {
    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.queryByTestId('remove-participant-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-participant-1')).not.toBeInTheDocument();
  });

  it('shows remove button when 3+ participants', () => {
    const e3id = useERDStore.getState().addEntity('Project', { x: 400, y: 0 });
    useERDStore.getState().addParticipant(relId, {
      entityId: e3id, cardinality: { min: 0, max: '*' },
    });

    render(<RelationshipProperties relationship={getRel(relId)} />);
    expect(screen.getByTestId('remove-participant-0')).toBeInTheDocument();
    expect(screen.getByTestId('remove-participant-1')).toBeInTheDocument();
    expect(screen.getByTestId('remove-participant-2')).toBeInTheDocument();
  });

  it('removes a participant', async () => {
    const user = userEvent.setup();
    const e3id = useERDStore.getState().addEntity('Project', { x: 400, y: 0 });
    useERDStore.getState().addParticipant(relId, {
      entityId: e3id, cardinality: { min: 0, max: '*' },
    });

    render(<RelationshipProperties relationship={getRel(relId)} />);
    await user.click(screen.getByTestId('remove-participant-2'));

    expect(getRel(relId).participants).toHaveLength(2);
  });

  it('shows aggregation participant with [Agg] prefix', () => {
    const aggRelId = useERDStore.getState().addRelationship('inner', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const aggId = useERDStore.getState().addAggregation('MyAgg', aggRelId);

    // Create a relationship with the aggregation as a participant
    const outerRelId = useERDStore.getState().addRelationship('outer', [
      { entityId: aggId, cardinality: { min: 0, max: '*' }, isAggregation: true },
      { entityId: e1id, cardinality: { min: 0, max: 1 } },
    ], { x: 0, y: 0 });

    render(<RelationshipProperties relationship={getRel(outerRelId)} />);
    expect(screen.getAllByText('[Agg] MyAgg').length).toBeGreaterThanOrEqual(1);
  });

  it('adds aggregation as participant via dropdown', async () => {
    const user = userEvent.setup();
    const aggRelId = useERDStore.getState().addRelationship('inner', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const aggId = useERDStore.getState().addAggregation('MyAgg', aggRelId);

    render(<RelationshipProperties relationship={getRel(relId)} />);

    await user.selectOptions(screen.getByTestId('new-participant-select'), `agg:${aggId}`);
    await user.click(screen.getByTestId('add-participant-button'));

    const updated = getRel(relId);
    expect(updated.participants).toHaveLength(3);
    expect(updated.participants[2].isAggregation).toBe(true);
    expect(updated.participants[2].entityId).toBe(aggId);
  });
});
