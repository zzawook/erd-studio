import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CandidateKeyProperties } from '../CandidateKeyProperties';
import { useERDStore } from '../../../ir/store';
import type { Entity } from '../../../ir/types';

function getEntity(id: string): Entity {
  return useERDStore.getState().model.entities.find((e) => e.id === id)!;
}

describe('CandidateKeyProperties', () => {
  let entityId: string;
  let attr1Id: string;
  let attr2Id: string;

  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
    entityId = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    attr1Id = useERDStore.getState().addAttribute(entityId, 'id', { name: 'INT' });
    attr2Id = useERDStore.getState().addAttribute(entityId, 'email', { name: 'VARCHAR', precision: 255 });
  });

  it('renders candidate key properties', () => {
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('candidate-key-properties')).toBeInTheDocument();
    expect(screen.getByText('Candidate Keys')).toBeInTheDocument();
  });

  it('shows "No keys defined" when entity has no candidate keys', () => {
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('No keys defined')).toBeInTheDocument();
  });

  it('shows "+ Add Key" button', () => {
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId('add-ck-button')).toHaveTextContent('+ Add Key');
  });

  it('opens the add key form when button is clicked', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    expect(screen.getByTestId('ck-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('ck-primary-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('ck-save-button')).toBeInTheDocument();
  });

  it('shows attribute checkboxes in the add form', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    expect(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`ck-attr-checkbox-${attr2Id}`)).toBeInTheDocument();
  });

  it('save button is disabled when name or attributes are empty', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    expect(screen.getByTestId('ck-save-button')).toBeDisabled();
  });

  it('save button is disabled when name is provided but no attributes selected', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'PK');
    expect(screen.getByTestId('ck-save-button')).toBeDisabled();
  });

  it('save button is disabled when attributes are selected but no name', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    expect(screen.getByTestId('ck-save-button')).toBeDisabled();
  });

  it('adds a candidate key', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'PK');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId('ck-save-button'));

    const entity = getEntity(entityId);
    expect(entity.candidateKeys).toHaveLength(1);
    expect(entity.candidateKeys[0].name).toBe('PK');
    expect(entity.candidateKeys[0].attributeIds).toEqual([attr1Id]);
    expect(entity.candidateKeys[0].isPrimary).toBe(false);
  });

  it('adds a primary candidate key', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'PK');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId('ck-primary-checkbox'));
    await user.click(screen.getByTestId('ck-save-button'));

    const entity = getEntity(entityId);
    expect(entity.candidateKeys[0].isPrimary).toBe(true);
  });

  it('hides form after adding a key', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'PK');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId('ck-save-button'));

    expect(screen.queryByTestId('ck-name-input')).not.toBeInTheDocument();
  });

  it('does not add key when name is whitespace', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), '   ');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId('ck-save-button'));

    expect(getEntity(entityId).candidateKeys).toHaveLength(0);
  });

  it('closes form on Cancel', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    expect(screen.getByTestId('ck-name-input')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('ck-name-input')).not.toBeInTheDocument();
  });

  it('resets form state on Cancel', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    // Fill in some data
    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'PK');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId('ck-primary-checkbox'));

    // Cancel
    await user.click(screen.getByText('Cancel'));

    // Reopen
    await user.click(screen.getByTestId('add-ck-button'));
    expect(screen.getByTestId('ck-name-input')).toHaveValue('');
    expect(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`)).not.toBeChecked();
    expect(screen.getByTestId('ck-primary-checkbox')).not.toBeChecked();
  });

  // -----------------------------------------------------------------------
  // Listing and managing existing keys
  // -----------------------------------------------------------------------

  it('lists candidate keys', async () => {
    useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);
    useERDStore.getState().addCandidateKey(entityId, 'UK_email', [attr2Id], false);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('PK_id')).toBeInTheDocument();
    expect(screen.getByText('UK_email')).toBeInTheDocument();
  });

  it('shows attribute names in key display', () => {
    useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('(id)')).toBeInTheDocument();
  });

  it('shows ? for unknown attribute in key', () => {
    useERDStore.getState().addCandidateKey(entityId, 'BadKey', ['nonexistent'], false);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByText('(?)')).toBeInTheDocument();
  });

  it('highlights primary key with bold text', () => {
    const ckId = useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    const ckItem = screen.getByTestId(`ck-item-${ckId}`);
    const span = ckItem.querySelector('span.font-bold');
    expect(span).not.toBeNull();
  });

  it('shows radio button checked for primary key', () => {
    const ckId = useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);
    expect(screen.getByTestId(`ck-primary-radio-${ckId}`)).toBeChecked();
  });

  it('sets a different key as primary via radio button', async () => {
    const user = userEvent.setup();
    useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);
    const uk = useERDStore.getState().addCandidateKey(entityId, 'UK_email', [attr2Id], false);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId(`ck-primary-radio-${uk}`));

    const entity = getEntity(entityId);
    const newPK = entity.candidateKeys.find((ck) => ck.id === uk);
    expect(newPK?.isPrimary).toBe(true);
    // Old PK should no longer be primary
    const oldPK = entity.candidateKeys.find((ck) => ck.name === 'PK_id');
    expect(oldPK?.isPrimary).toBe(false);
  });

  it('deletes a candidate key', async () => {
    const user = userEvent.setup();
    const ckId = useERDStore.getState().addCandidateKey(entityId, 'PK_id', [attr1Id], true);

    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId(`ck-delete-${ckId}`));
    expect(getEntity(entityId).candidateKeys).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Toggle attribute selection
  // -----------------------------------------------------------------------

  it('toggles attribute selection in add form', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));

    const checkbox = screen.getByTestId(`ck-attr-checkbox-${attr1Id}`);

    // Select
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Deselect
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('supports multi-attribute candidate key', async () => {
    const user = userEvent.setup();
    render(<CandidateKeyProperties entity={getEntity(entityId)} />);

    await user.click(screen.getByTestId('add-ck-button'));
    await user.type(screen.getByTestId('ck-name-input'), 'CompKey');
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr1Id}`));
    await user.click(screen.getByTestId(`ck-attr-checkbox-${attr2Id}`));
    await user.click(screen.getByTestId('ck-save-button'));

    const entity = getEntity(entityId);
    expect(entity.candidateKeys[0].attributeIds).toEqual([attr1Id, attr2Id]);
  });
});
