import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityProperties } from '../EntityProperties';
import { useERDStore } from '../../../ir/store';
import type { Entity } from '../../../ir/types';

function getEntity(id: string): Entity {
  return useERDStore.getState().model.entities.find((e) => e.id === id)!;
}

describe('EntityProperties', () => {
  let entityId: string;

  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
    entityId = useERDStore.getState().addEntity('Student', { x: 100, y: 100 });
  });

  it('renders entity properties', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('entity-properties')).toBeInTheDocument();
  });

  it('displays the entity name in the input', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('entity-name-edit')).toHaveValue('Student');
  });

  it('edits the entity name', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);

    const input = screen.getByTestId('entity-name-edit');
    fireEvent.change(input, { target: { value: 'Teacher' } });

    expect(useERDStore.getState().model.entities[0].name).toBe('Teacher');
  });

  it('shows "No attributes" when entity has none', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('No attributes')).toBeInTheDocument();
  });

  it('lists attributes when entity has some', () => {
    useERDStore.getState().addAttribute(entityId, 'name', { name: 'VARCHAR', precision: 100 });
    useERDStore.getState().addAttribute(entityId, 'age', { name: 'INT' });

    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('VARCHAR')).toBeInTheDocument();
    expect(screen.getByText('INT')).toBeInTheDocument();
  });

  it('adds an attribute via the form', async () => {
    const user = userEvent.setup();
    render(<EntityProperties entity={getEntity(entityId)} />);

    await user.type(screen.getByTestId('new-attr-name-input'), 'email');
    await user.click(screen.getByTestId('add-attr-button'));

    const entity = getEntity(entityId);
    expect(entity.attributes).toHaveLength(1);
    expect(entity.attributes[0].name).toBe('email');
    expect(entity.attributes[0].dataType.name).toBe('VARCHAR');
    expect(entity.attributes[0].dataType.precision).toBe(255);
  });

  it('clears input after adding an attribute', async () => {
    const user = userEvent.setup();
    render(<EntityProperties entity={getEntity(entityId)} />);

    await user.type(screen.getByTestId('new-attr-name-input'), 'email');
    await user.click(screen.getByTestId('add-attr-button'));

    expect(screen.getByTestId('new-attr-name-input')).toHaveValue('');
  });

  it('selects the newly added attribute', async () => {
    const user = userEvent.setup();
    render(<EntityProperties entity={getEntity(entityId)} />);

    await user.type(screen.getByTestId('new-attr-name-input'), 'email');
    await user.click(screen.getByTestId('add-attr-button'));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('attribute');
  });

  it('add attribute button is disabled when input is empty', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('add-attr-button')).toBeDisabled();
  });

  it('does not add attribute when name is whitespace', async () => {
    const user = userEvent.setup();
    render(<EntityProperties entity={getEntity(entityId)} />);

    await user.type(screen.getByTestId('new-attr-name-input'), '   ');
    await user.click(screen.getByTestId('add-attr-button'));

    expect(getEntity(entityId).attributes).toHaveLength(0);
  });

  it('adds attribute on Enter keypress', async () => {
    const user = userEvent.setup();
    render(<EntityProperties entity={getEntity(entityId)} />);

    await user.type(screen.getByTestId('new-attr-name-input'), 'email{Enter}');
    expect(getEntity(entityId).attributes).toHaveLength(1);
  });

  it('clicking an attribute selects it', async () => {
    const user = userEvent.setup();
    const aid = useERDStore.getState().addAttribute(entityId, 'col', { name: 'INT' });

    render(<EntityProperties entity={getEntity(entityId)} />);
    await user.click(screen.getByTestId(`attr-list-item-${aid}`));

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('attribute');
    if (selection?.type === 'attribute') {
      expect(selection.attributeId).toBe(aid);
    }
  });

  it('shows candidate key properties section', () => {
    render(<EntityProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('candidate-key-properties')).toBeInTheDocument();
  });

  it('deletes entity when delete button is clicked and confirmed', async () => {
    const user = userEvent.setup();

    render(<EntityProperties entity={getEntity(entityId)} />);
    // First click shows the confirm UI
    await user.click(screen.getByTestId('delete-entity-button'));
    // Second click on the confirm button actually deletes
    await user.click(screen.getByTestId('delete-entity-button'));

    expect(useERDStore.getState().model.entities).toHaveLength(0);
  });

  it('does not delete entity when confirm is cancelled', async () => {
    const user = userEvent.setup();

    render(<EntityProperties entity={getEntity(entityId)} />);
    // First click shows the confirm UI
    await user.click(screen.getByTestId('delete-entity-button'));
    // Click Cancel instead of confirm
    await user.click(screen.getByText('Cancel'));

    expect(useERDStore.getState().model.entities).toHaveLength(1);
  });
});
