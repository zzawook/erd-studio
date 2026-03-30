import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttributeProperties } from '../AttributeProperties';
import { useERDStore } from '../../../ir/store';
import type { Attribute } from '../../../ir/types';

function getEntityAttr(entityId: string, attrId: string): Attribute {
  return useERDStore.getState().model.entities
    .find((e) => e.id === entityId)!
    .attributes.find((a) => a.id === attrId)!;
}

function getRelAttr(relId: string, attrId: string): Attribute {
  return useERDStore.getState().model.relationships
    .find((r) => r.id === relId)!
    .attributes.find((a) => a.id === attrId)!;
}

describe('AttributeProperties', () => {
  let entityId: string;
  let attrId: string;

  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
    entityId = useERDStore.getState().addEntity('T', { x: 0, y: 0 });
    attrId = useERDStore.getState().addAttribute(entityId, 'col', { name: 'VARCHAR', precision: 255 });
  });

  it('renders attribute properties', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attribute-properties')).toBeInTheDocument();
  });

  it('displays the attribute name', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-name-edit')).toHaveValue('col');
  });

  it('edits the attribute name', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const input = screen.getByTestId('attr-name-edit');
    fireEvent.change(input, { target: { value: 'email' } });

    expect(getEntityAttr(entityId, attrId).name).toBe('email');
  });

  it('displays the data type select', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-type-select')).toHaveValue('VARCHAR');
  });

  it('changes the data type', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.selectOptions(screen.getByTestId('attr-type-select'), 'INT');
    expect(getEntityAttr(entityId, attrId).dataType.name).toBe('INT');
  });

  // -----------------------------------------------------------------------
  // Conditional precision/scale fields
  // -----------------------------------------------------------------------

  it('shows precision field for VARCHAR', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-precision-input')).toBeInTheDocument();
  });

  it('shows precision field for NUMERIC', () => {
    useERDStore.getState().updateAttribute(entityId, attrId, {
      dataType: { name: 'NUMERIC', precision: 10, scale: 2 },
    });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-precision-input')).toBeInTheDocument();
    expect(screen.getByTestId('attr-scale-input')).toBeInTheDocument();
  });

  it('does not show precision for INT', () => {
    useERDStore.getState().updateAttribute(entityId, attrId, { dataType: { name: 'INT' } });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.queryByTestId('attr-precision-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('attr-scale-input')).not.toBeInTheDocument();
  });

  it('does not show scale for VARCHAR', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.queryByTestId('attr-scale-input')).not.toBeInTheDocument();
  });

  it('edits precision', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const precisionInput = screen.getByTestId('attr-precision-input');
    fireEvent.change(precisionInput, { target: { value: '100' } });

    expect(getEntityAttr(entityId, attrId).dataType.precision).toBe(100);
  });

  it('clears precision to undefined when empty', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const precisionInput = screen.getByTestId('attr-precision-input');
    fireEvent.change(precisionInput, { target: { value: '' } });

    expect(getEntityAttr(entityId, attrId).dataType.precision).toBeUndefined();
  });

  it('edits scale for NUMERIC', () => {
    useERDStore.getState().updateAttribute(entityId, attrId, {
      dataType: { name: 'NUMERIC', precision: 10 },
    });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const scaleInput = screen.getByTestId('attr-scale-input');
    fireEvent.change(scaleInput, { target: { value: '2' } });

    expect(getEntityAttr(entityId, attrId).dataType.scale).toBe(2);
  });

  it('clears scale to undefined when empty', () => {
    useERDStore.getState().updateAttribute(entityId, attrId, {
      dataType: { name: 'NUMERIC', precision: 10, scale: 2 },
    });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const scaleInput = screen.getByTestId('attr-scale-input');
    fireEvent.change(scaleInput, { target: { value: '' } });

    expect(getEntityAttr(entityId, attrId).dataType.scale).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Nullable
  // -----------------------------------------------------------------------

  it('shows nullable checkbox checked by default', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-nullable-checkbox')).toBeChecked();
  });

  it('toggles nullable', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-nullable-checkbox'));
    expect(getEntityAttr(entityId, attrId).nullable).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Kind
  // -----------------------------------------------------------------------

  it('displays kind select with default value', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-kind-select')).toHaveValue('simple');
  });

  it('changes kind', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.selectOptions(screen.getByTestId('attr-kind-select'), 'derived');
    expect(getEntityAttr(entityId, attrId).kind).toBe('derived');
  });

  // -----------------------------------------------------------------------
  // Partial Key (entity context only)
  // -----------------------------------------------------------------------

  it('shows partial key checkbox in entity context', () => {
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );
    expect(screen.getByTestId('attr-partial-key-checkbox')).toBeInTheDocument();
  });

  it('does not show partial key checkbox in relationship context', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const raid = useERDStore.getState().addRelationshipAttribute(rid, 'x', { name: 'INT' });

    render(
      <AttributeProperties
        attribute={getRelAttr(rid, raid)}
        relationshipId={rid}
        context="relationship"
      />
    );
    expect(screen.queryByTestId('attr-partial-key-checkbox')).not.toBeInTheDocument();
  });

  it('toggling partial key ON auto-sets entity as weak', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(getEntityAttr(entityId, attrId).isPartialKey).toBe(true);
    expect(useERDStore.getState().model.entities.find((e) => e.id === entityId)!.isWeak).toBe(true);
  });

  it('toggling partial key ON with 1 relationship auto-marks it identifying', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const relId = useERDStore.getState().addRelationship('owns', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(useERDStore.getState().model.relationships.find((r) => r.id === relId)!.isIdentifying).toBe(true);
  });

  it('toggling last partial key OFF reverts entity to non-weak', async () => {
    // Set up: entity is weak with one partial key
    useERDStore.getState().updateEntity(entityId, { isWeak: true });
    useERDStore.getState().updateAttribute(entityId, attrId, { isPartialKey: true });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(getEntityAttr(entityId, attrId).isPartialKey).toBe(false);
    expect(useERDStore.getState().model.entities.find((e) => e.id === entityId)!.isWeak).toBe(false);
  });

  it('shows dialog when multiple relationships exist', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const e3 = useERDStore.getState().addEntity('C', { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r2', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(screen.getByTestId('identifying-rel-dialog')).toBeInTheDocument();
  });

  it('dialog cancel reverts partial key and weak entity', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const e3 = useERDStore.getState().addEntity('C', { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r2', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    await user.click(screen.getByTestId('identifying-rel-cancel'));

    expect(getEntityAttr(entityId, attrId).isPartialKey).toBe(false);
    expect(useERDStore.getState().model.entities.find((e) => e.id === entityId)!.isWeak).toBe(false);
  });

  it('dialog select marks chosen relationship as identifying', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const e3 = useERDStore.getState().addEntity('C', { x: 0, y: 0 });
    const relId1 = useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r2', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    await user.click(screen.getByTestId(`rel-option-${relId1}`));

    expect(screen.queryByTestId('identifying-rel-dialog')).not.toBeInTheDocument();
    expect(useERDStore.getState().model.relationships.find((r) => r.id === relId1)!.isIdentifying).toBe(true);
  });

  it('does not show dialog when entity has no relationships', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(screen.queryByTestId('identifying-rel-dialog')).not.toBeInTheDocument();
    expect(useERDStore.getState().model.entities.find((e) => e.id === entityId)!.isWeak).toBe(true);
  });

  it('does not auto-mark identifying when one already exists', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const relId = useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().updateRelationship(relId, { isIdentifying: true });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    // Should still be identifying (not toggled off)
    expect(useERDStore.getState().model.relationships.find((r) => r.id === relId)!.isIdentifying).toBe(true);
  });

  it('dialog cancel keeps entity weak if other partial keys remain', async () => {
    const attr2Id = useERDStore.getState().addAttribute(entityId, 'col2', { name: 'INT' });
    useERDStore.getState().updateEntity(entityId, { isWeak: true });
    useERDStore.getState().updateAttribute(entityId, attr2Id, { isPartialKey: true });

    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const e3 = useERDStore.getState().addEntity('C', { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().addRelationship('r2', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    await user.click(screen.getByTestId('identifying-rel-cancel'));

    // Entity stays weak because col2 is still a partial key
    expect(useERDStore.getState().model.entities.find((e) => e.id === entityId)!.isWeak).toBe(true);
  });

  it('shows connected message when identifying relationship exists', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const relId = useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().updateEntity(entityId, { isWeak: true });
    useERDStore.getState().updateAttribute(entityId, attrId, { isPartialKey: true });
    useERDStore.getState().updateRelationship(relId, { isIdentifying: true });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    expect(screen.getByText('Connected to identifying relationship line')).toBeInTheDocument();
  });

  it('toggling last partial key OFF un-marks identifying relationship', async () => {
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const relId = useERDStore.getState().addRelationship('r1', [
      { entityId, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.getState().updateEntity(entityId, { isWeak: true });
    useERDStore.getState().updateAttribute(entityId, attrId, { isPartialKey: true });
    useERDStore.getState().updateRelationship(relId, { isIdentifying: true });

    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    expect(useERDStore.getState().model.relationships.find((r) => r.id === relId)!.isIdentifying).toBe(false);
  });

  it('partial key toggle is a no-op without entityId', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('attr-partial-key-checkbox'));
    // Should not crash, attribute unchanged since no entityId
    expect(getEntityAttr(entityId, attrId).isPartialKey).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  it('deletes entity attribute and navigates back to entity', async () => {
    const user = userEvent.setup();
    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    await user.click(screen.getByTestId('delete-attr-button'));
    expect(useERDStore.getState().model.entities[0].attributes).toHaveLength(0);
    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('entity');
  });

  it('deletes relationship attribute and navigates back to relationship', async () => {
    const user = userEvent.setup();
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const raid = useERDStore.getState().addRelationshipAttribute(rid, 'x', { name: 'INT' });

    render(
      <AttributeProperties
        attribute={getRelAttr(rid, raid)}
        relationshipId={rid}
        context="relationship"
      />
    );

    await user.click(screen.getByTestId('delete-attr-button'));
    expect(useERDStore.getState().model.relationships.find((r) => r.id === rid)!.attributes).toHaveLength(0);
    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('relationship');
  });

  // -----------------------------------------------------------------------
  // Back button
  // -----------------------------------------------------------------------

  it('back button navigates to entity selection', async () => {
    const user = userEvent.setup();
    useERDStore.setState({ selection: { type: 'attribute', entityId, attributeId: attrId } });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        entityId={entityId}
        context="entity"
      />
    );

    const backButton = screen.getByText(/Back/);
    await user.click(backButton);

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('entity');
  });

  it('back button navigates to relationship selection', async () => {
    const user = userEvent.setup();
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const raid = useERDStore.getState().addRelationshipAttribute(rid, 'x', { name: 'INT' });

    render(
      <AttributeProperties
        attribute={getRelAttr(rid, raid)}
        relationshipId={rid}
        context="relationship"
      />
    );

    const backButton = screen.getByText(/Back/);
    await user.click(backButton);

    const selection = useERDStore.getState().selection;
    expect(selection?.type).toBe('relationship');
  });

  // -----------------------------------------------------------------------
  // Relationship attribute updates
  // -----------------------------------------------------------------------

  it('edits relationship attribute name', async () => {
    const user = userEvent.setup();
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const raid = useERDStore.getState().addRelationshipAttribute(rid, 'x', { name: 'INT' });

    render(
      <AttributeProperties
        attribute={getRelAttr(rid, raid)}
        relationshipId={rid}
        context="relationship"
      />
    );

    const input = screen.getByTestId('attr-name-edit');
    fireEvent.change(input, { target: { value: 'y' } });

    expect(getRelAttr(rid, raid).name).toBe('y');
  });

  // -----------------------------------------------------------------------
  // Back button with no entityId or relationshipId (edge case)
  // -----------------------------------------------------------------------

  it('back button does nothing when neither entityId nor relationshipId is set', async () => {
    const user = userEvent.setup();
    useERDStore.setState({ selection: null });

    render(
      <AttributeProperties
        attribute={getEntityAttr(entityId, attrId)}
        context="entity"
      />
    );

    const backButton = screen.getByText(/Back/);
    await user.click(backButton);

    // selection remains null since no entityId was provided
    expect(useERDStore.getState().selection).toBeNull();
  });
});
