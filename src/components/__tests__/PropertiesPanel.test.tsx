import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertiesPanel } from '../PropertiesPanel';
import { useERDStore } from '../../ir/store';

describe('PropertiesPanel', () => {
  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
  });

  it('renders the properties panel', () => {
    render(<PropertiesPanel />);
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('shows default message when nothing is selected', () => {
    render(<PropertiesPanel />);
    expect(screen.getByText('Select an element')).toBeInTheDocument();
  });

  it('shows EntityProperties when an entity is selected', () => {
    const id = useERDStore.getState().addEntity('Student', { x: 0, y: 0 });
    useERDStore.setState({ selection: { type: 'entity', entityId: id } });

    render(<PropertiesPanel />);
    expect(screen.getByTestId('entity-properties')).toBeInTheDocument();
  });

  it('shows "Entity not found" when selected entity does not exist', () => {
    useERDStore.setState({ selection: { type: 'entity', entityId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Entity not found')).toBeInTheDocument();
  });

  it('shows RelationshipProperties when a relationship is selected', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.setState({ selection: { type: 'relationship', relationshipId: rid } });

    render(<PropertiesPanel />);
    expect(screen.getByTestId('relationship-properties')).toBeInTheDocument();
  });

  it('shows "Relationship not found" when selected relationship does not exist', () => {
    useERDStore.setState({ selection: { type: 'relationship', relationshipId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Relationship not found')).toBeInTheDocument();
  });

  it('shows AttributeProperties when an entity attribute is selected', () => {
    const eid = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    const aid = useERDStore.getState().addAttribute(eid, 'col', { name: 'INT' });
    useERDStore.setState({ selection: { type: 'attribute', entityId: eid, attributeId: aid } });

    render(<PropertiesPanel />);
    expect(screen.getByTestId('attribute-properties')).toBeInTheDocument();
  });

  it('shows "Attribute not found" when selected entity attribute does not exist', () => {
    const eid = useERDStore.getState().addEntity('E', { x: 0, y: 0 });
    useERDStore.setState({ selection: { type: 'attribute', entityId: eid, attributeId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Attribute not found')).toBeInTheDocument();
  });

  it('shows "Attribute not found" when entity for attribute does not exist', () => {
    useERDStore.setState({ selection: { type: 'attribute', entityId: 'nonexistent', attributeId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Attribute not found')).toBeInTheDocument();
  });

  it('shows AttributeProperties when a relationship attribute is selected', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const aid = useERDStore.getState().addRelationshipAttribute(rid, 'col', { name: 'INT' });
    useERDStore.setState({ selection: { type: 'relAttribute', relationshipId: rid, attributeId: aid } });

    render(<PropertiesPanel />);
    expect(screen.getByTestId('attribute-properties')).toBeInTheDocument();
  });

  it('shows "Attribute not found" for nonexistent relationship attribute', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    useERDStore.setState({ selection: { type: 'relAttribute', relationshipId: rid, attributeId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Attribute not found')).toBeInTheDocument();
  });

  it('shows "Attribute not found" when relationship for relAttribute does not exist', () => {
    useERDStore.setState({ selection: { type: 'relAttribute', relationshipId: 'nonexistent', attributeId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Attribute not found')).toBeInTheDocument();
  });

  it('shows AggregationProperties when an aggregation is selected', () => {
    const e1 = useERDStore.getState().addEntity('A', { x: 0, y: 0 });
    const e2 = useERDStore.getState().addEntity('B', { x: 0, y: 0 });
    const rid = useERDStore.getState().addRelationship('rel', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const aggId = useERDStore.getState().addAggregation('AggR', rid);
    useERDStore.setState({ selection: { type: 'aggregation', aggregationId: aggId } });

    render(<PropertiesPanel />);
    expect(screen.getByTestId('aggregation-properties')).toBeInTheDocument();
  });

  it('shows "Aggregation not found" when selected aggregation does not exist', () => {
    useERDStore.setState({ selection: { type: 'aggregation', aggregationId: 'nonexistent' } });

    render(<PropertiesPanel />);
    expect(screen.getByText('Aggregation not found')).toBeInTheDocument();
  });
});
