import type { ReactNode } from 'react';
import { useERDStore } from '../ir/store';
import { EntityProperties } from './properties/EntityProperties';
import { RelationshipProperties } from './properties/RelationshipProperties';
import { AttributeProperties } from './properties/AttributeProperties';
import { AggregationProperties } from './properties/AggregationProperties';

export function PropertiesPanel() {
  const selection = useERDStore((s) => s.selection);
  const model = useERDStore((s) => s.model);

  let content: ReactNode;

  if (!selection) {
    content = <p className="text-gray-400 italic text-xs">Select an element to edit its properties</p>;
  } else if (selection.type === 'entity') {
    const entity = model.entities.find((e) => e.id === selection.entityId);
    if (entity) {
      content = <EntityProperties entity={entity} />;
    } else {
      content = <p className="text-gray-400 italic text-xs">Entity not found</p>;
    }
  } else if (selection.type === 'relationship') {
    const rel = model.relationships.find((r) => r.id === selection.relationshipId);
    if (rel) {
      content = <RelationshipProperties relationship={rel} />;
    } else {
      content = <p className="text-gray-400 italic text-xs">Relationship not found</p>;
    }
  } else if (selection.type === 'attribute') {
    const entity = model.entities.find((e) => e.id === selection.entityId);
    const attr = entity?.attributes.find((a) => a.id === selection.attributeId);
    if (entity && attr) {
      content = <AttributeProperties attribute={attr} entityId={entity.id} context="entity" />;
    } else {
      content = <p className="text-gray-400 italic text-xs">Attribute not found</p>;
    }
  } else if (selection.type === 'relAttribute') {
    const rel = model.relationships.find((r) => r.id === selection.relationshipId);
    const attr = rel?.attributes.find((a) => a.id === selection.attributeId);
    if (rel && attr) {
      content = <AttributeProperties attribute={attr} relationshipId={rel.id} context="relationship" />;
    } else {
      content = <p className="text-gray-400 italic text-xs">Attribute not found</p>;
    }
  } else if (selection.type === 'aggregation') {
    const agg = model.aggregations.find((a) => a.id === selection.aggregationId);
    if (agg) {
      content = <AggregationProperties aggregation={agg} />;
    } else {
      content = <p className="text-gray-400 italic text-xs">Aggregation not found</p>;
    }
  } else {
    content = <p className="text-gray-400 italic text-xs">Select an element</p>;
  }

  return (
    <div className="h-full border-l border-gray-200 bg-gray-50 p-3 overflow-y-auto text-xs" data-testid="properties-panel">
      <h2 className="font-bold text-gray-700 mb-2 text-sm">Properties</h2>
      {content}
    </div>
  );
}
