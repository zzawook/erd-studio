import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../Sidebar';
import { useERDStore } from '../../ir/store';

describe('Sidebar', () => {
  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
  });

  it('renders the sidebar', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Entity form
  // -----------------------------------------------------------------------

  it('renders Add Entity section', () => {
    render(<Sidebar />);
    expect(screen.getByText('Add Entity')).toBeInTheDocument();
    expect(screen.getByTestId('entity-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('add-entity-button')).toBeInTheDocument();
  });

  it('add entity button is disabled when input is empty', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('add-entity-button')).toBeDisabled();
  });

  it('adds an entity when the form is submitted', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.type(screen.getByTestId('entity-name-input'), 'Student');
    await user.click(screen.getByTestId('add-entity-button'));

    expect(useERDStore.getState().model.entities).toHaveLength(1);
    expect(useERDStore.getState().model.entities[0].name).toBe('Student');
  });

  it('clears the input after adding an entity', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.type(screen.getByTestId('entity-name-input'), 'Student');
    await user.click(screen.getByTestId('add-entity-button'));

    expect(screen.getByTestId('entity-name-input')).toHaveValue('');
  });

  it('selects the newly added entity', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.type(screen.getByTestId('entity-name-input'), 'Student');
    await user.click(screen.getByTestId('add-entity-button'));

    const selection = useERDStore.getState().selection;
    expect(selection).not.toBeNull();
    expect(selection?.type).toBe('entity');
  });

  it('adds entity on Enter keypress', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.type(screen.getByTestId('entity-name-input'), 'Student{Enter}');
    expect(useERDStore.getState().model.entities).toHaveLength(1);
  });

  it('does not add entity when name is whitespace only', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.type(screen.getByTestId('entity-name-input'), '   ');
    await user.click(screen.getByTestId('add-entity-button'));

    expect(useERDStore.getState().model.entities).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Entity list
  // -----------------------------------------------------------------------

  it('shows "None" when there are no entities', () => {
    render(<Sidebar />);
    // Entity, relationship, and aggregation lists show "None" when empty
    const noneTexts = screen.getAllByText('None');
    expect(noneTexts.length).toBe(3);
  });

  it('displays entities in the list', () => {
    const id1 = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    const id2 = useERDStore.getState().addEntity('Course', { x: 0, y: 0 });

    render(<Sidebar />);
    // Use testids to target list items specifically (not the select options)
    expect(screen.getByTestId(`entity-list-item-${id1}`)).toHaveTextContent('Student');
    expect(screen.getByTestId(`entity-list-item-${id2}`)).toHaveTextContent('Course');
  });

  it('displays weak entities with angle brackets', () => {
    const id = useERDStore.getState().addEntity('Item', { x: 0, y: 0 });
    useERDStore.getState().updateEntity(id, { isWeak: true });

    render(<Sidebar />);
    const listItem = screen.getByTestId(`entity-list-item-${id}`);
    expect(listItem.textContent).toContain('\u27E8Item\u27E9');
  });

  it('clicking an entity selects it', async () => {
    const user = userEvent.setup();
    const id = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    useERDStore.setState({ selection: null });

    render(<Sidebar />);
    await user.click(screen.getByTestId(`entity-list-item-${id}`));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('entity');
    if (selection?.type === 'entity') {
      expect(selection.entityId).toBe(id);
    }
  });

  // -----------------------------------------------------------------------
  // Add Relationship form
  // -----------------------------------------------------------------------

  it('renders Add Relationship section', () => {
    render(<Sidebar />);
    expect(screen.getByText('Add Relationship')).toBeInTheDocument();
    expect(screen.getByTestId('rel-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('rel-entity1-select')).toBeInTheDocument();
    expect(screen.getByTestId('rel-entity2-select')).toBeInTheDocument();
    expect(screen.getByTestId('add-relationship-button')).toBeInTheDocument();
  });

  it('shows entity options in relationship dropdowns', () => {
    useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);
    const select1 = screen.getByTestId('rel-entity1-select');
    const options = select1.querySelectorAll('option');
    // 1 placeholder + 2 entities
    expect(options).toHaveLength(3);
  });

  it('shows validation error when fields are missing', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByTestId('add-relationship-button'));
    expect(screen.getByTestId('rel-error')).toHaveTextContent('Fill in all fields');
  });

  it('shows cardinality validation error for invalid min', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'rel');
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), e1id);
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e2id);

    // Set invalid min
    const min1 = screen.getByTestId('rel-min1-input');
    await user.clear(min1);
    await user.type(min1, '-1');

    await user.click(screen.getByTestId('add-relationship-button'));
    expect(screen.getByTestId('rel-error')).toBeInTheDocument();
  });

  it('shows cardinality validation error for entity 2', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'rel');
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), e1id);
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e2id);

    // Set invalid min2
    const min2 = screen.getByTestId('rel-min2-input');
    await user.clear(min2);
    await user.type(min2, 'abc');

    await user.click(screen.getByTestId('add-relationship-button'));
    const error = screen.getByTestId('rel-error');
    expect(error.textContent).toContain('Entity 2');
  });

  it('creates a relationship when form is valid', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'has');
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), e1id);
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e2id);

    await user.click(screen.getByTestId('add-relationship-button'));

    expect(useERDStore.getState().model.relationships).toHaveLength(1);
    expect(useERDStore.getState().model.relationships[0].name).toBe('has');
    // Should select the new relationship
    expect(useERDStore.getState().selection?.type).toBe('relationship');
  });

  it('resets form fields after successful relationship creation', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'has');
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), e1id);
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e2id);

    await user.click(screen.getByTestId('add-relationship-button'));

    expect(screen.getByTestId('rel-name-input')).toHaveValue('');
    expect(screen.getByTestId('rel-entity1-select')).toHaveValue('');
    expect(screen.getByTestId('rel-entity2-select')).toHaveValue('');
  });

  it('creates an identifying relationship when checkbox is checked', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'has');
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), e1id);
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e2id);
    await user.click(screen.getByTestId('rel-identifying-checkbox'));
    await user.click(screen.getByTestId('add-relationship-button'));

    expect(useERDStore.getState().model.relationships[0].isIdentifying).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Relationship list
  // -----------------------------------------------------------------------

  it('shows "None" for relationships when empty', () => {
    render(<Sidebar />);
    // There are two "None" texts - one for entities, one for relationships
    const noneTexts = screen.getAllByText('None');
    expect(noneTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('displays relationships in the list', () => {
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    useERDStore.getState().addRelationship('has', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    render(<Sidebar />);
    const allHas = screen.getAllByText('has');
    expect(allHas.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a relationship selects it', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('has', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.setState({ selection: null });

    render(<Sidebar />);
    await user.click(screen.getByTestId(`rel-list-item-${rid}`));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('relationship');
    if (selection?.type === 'relationship') {
      expect(selection.relationshipId).toBe(rid);
    }
  });

  // -----------------------------------------------------------------------
  // Selected entity highlighting with attribute selection
  // -----------------------------------------------------------------------

  it('highlights entity when attribute is selected', () => {
    const eid = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    const aid = useERDStore.getState().addAttribute(eid, 'col', { name: 'INT' });
    useERDStore.setState({ selection: { type: 'attribute', entityId: eid, attributeId: aid } });

    render(<Sidebar />);
    const item = screen.getByTestId(`entity-list-item-${eid}`);
    expect(item.className).toContain('bg-blue-100');
  });

  it('highlights relationship when relAttribute is selected', () => {
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const aid = useERDStore.getState().addRelationshipAttribute(rid, 'col', { name: 'INT' });
    useERDStore.setState({ selection: { type: 'relAttribute', relationshipId: rid, attributeId: aid } });

    render(<Sidebar />);
    const item = screen.getByTestId(`rel-list-item-${rid}`);
    expect(item.className).toContain('bg-blue-100');
  });

  // -----------------------------------------------------------------------
  // Clearing errors on input change
  // -----------------------------------------------------------------------

  it('clears error when relationship name changes', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Trigger error
    await user.click(screen.getByTestId('add-relationship-button'));
    expect(screen.getByTestId('rel-error')).toBeInTheDocument();

    // Change name
    await user.type(screen.getByTestId('rel-name-input'), 'a');
    expect(screen.queryByTestId('rel-error')).not.toBeInTheDocument();
  });

  it('clears error when max1 input changes', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Trigger error
    await user.click(screen.getByTestId('add-relationship-button'));
    expect(screen.getByTestId('rel-error')).toBeInTheDocument();

    // Change max1
    const max1 = screen.getByTestId('rel-max1-input');
    await user.clear(max1);
    await user.type(max1, '5');
    expect(screen.queryByTestId('rel-error')).not.toBeInTheDocument();
  });

  it('clears error when max2 input changes', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Trigger error
    await user.click(screen.getByTestId('add-relationship-button'));
    expect(screen.getByTestId('rel-error')).toBeInTheDocument();

    // Change max2
    const max2 = screen.getByTestId('rel-max2-input');
    await user.clear(max2);
    await user.type(max2, '10');
    expect(screen.queryByTestId('rel-error')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Aggregation form
  // -----------------------------------------------------------------------

  it('renders Add Aggregation section', () => {
    render(<Sidebar />);
    expect(screen.getByText('Add Aggregation')).toBeInTheDocument();
    expect(screen.getByTestId('agg-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('agg-rel-select')).toBeInTheDocument();
    expect(screen.getByTestId('add-agg-button')).toBeInTheDocument();
  });

  it('add aggregation button is disabled when fields are empty', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('add-agg-button')).toBeDisabled();
  });

  it('creates an aggregation when form is filled and submitted', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });

    render(<Sidebar />);

    await user.type(screen.getByTestId('agg-name-input'), 'MyAgg');
    await user.selectOptions(screen.getByTestId('agg-rel-select'), relId);
    await user.click(screen.getByTestId('add-agg-button'));

    expect(useERDStore.getState().model.aggregations).toHaveLength(1);
    expect(useERDStore.getState().model.aggregations[0].name).toBe('MyAgg');
    expect(useERDStore.getState().model.aggregations[0].relationshipId).toBe(relId);
    expect(useERDStore.getState().selection?.type).toBe('aggregation');
    // Form should be reset
    expect(screen.getByTestId('agg-name-input')).toHaveValue('');
    expect(screen.getByTestId('agg-rel-select')).toHaveValue('');
  });

  // -----------------------------------------------------------------------
  // Aggregation list
  // -----------------------------------------------------------------------

  it('displays aggregation names in the list', async () => {
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    const aggId = useERDStore.getState().addAggregation('AggR', relId);

    render(<Sidebar />);
    const item = screen.getByTestId(`agg-list-item-${aggId}`);
    expect(item).toHaveTextContent('AggR');
  });

  it('clicking an aggregation in the list selects it', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    const aggId = useERDStore.getState().addAggregation('AggR', relId);
    useERDStore.setState({ selection: null });

    render(<Sidebar />);
    await user.click(screen.getByTestId(`agg-list-item-${aggId}`));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('aggregation');
    if (selection?.type === 'aggregation') {
      expect(selection.aggregationId).toBe(aggId);
    }
  });

  it('highlights aggregation when selected', () => {
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    const aggId = useERDStore.getState().addAggregation('AggR', relId);
    useERDStore.setState({ selection: { type: 'aggregation', aggregationId: aggId } });

    render(<Sidebar />);
    const item = screen.getByTestId(`agg-list-item-${aggId}`);
    expect(item.className).toContain('bg-blue-100');
  });

  // -----------------------------------------------------------------------
  // Add relationship with aggregation participant
  // -----------------------------------------------------------------------

  it('creates relationship with aggregation participant (agg: prefix)', async () => {
    const user = userEvent.setup();
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const e3id = useERDStore.getState().addEntity('C', { x: 400, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    const aggId = useERDStore.getState().addAggregation('AggR', relId);

    render(<Sidebar />);

    await user.type(screen.getByTestId('rel-name-input'), 'uses');
    // Select the aggregation as entity 1 (agg: prefix)
    await user.selectOptions(screen.getByTestId('rel-entity1-select'), `agg:${aggId}`);
    // Select entity C as entity 2
    await user.selectOptions(screen.getByTestId('rel-entity2-select'), e3id);

    await user.click(screen.getByTestId('add-relationship-button'));

    const rels = useERDStore.getState().model.relationships;
    const newRel = rels.find((r) => r.name === 'uses');
    expect(newRel).toBeDefined();
    expect(newRel!.participants[0].isAggregation).toBe(true);
    expect(newRel!.participants[0].entityId).toBe(aggId);
    expect(newRel!.participants[1].isAggregation).toBe(false);
    expect(newRel!.participants[1].entityId).toBe(e3id);
  });

  it('shows aggregation options in relationship entity dropdowns', () => {
    const e1id = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2id = useERDStore.getState().addEntity('B', { x: 200, y: 0 });
    const relId = useERDStore.getState().addRelationship('R', [
      { entityId: e1id, cardinality: { min: 1, max: 1 } },
      { entityId: e2id, cardinality: { min: 0, max: '*' } },
    ], { x: 100, y: 100 });
    useERDStore.getState().addAggregation('AggR', relId);

    render(<Sidebar />);
    const select1 = screen.getByTestId('rel-entity1-select');
    const options = select1.querySelectorAll('option');
    // 1 placeholder + 2 entities + 1 aggregation = 4
    expect(options).toHaveLength(4);
    // The last option should be the aggregation
    const aggOption = Array.from(options).find((o) => o.textContent?.includes('[Agg]'));
    expect(aggOption).toBeDefined();
    expect(aggOption!.textContent).toContain('AggR');
  });
});
