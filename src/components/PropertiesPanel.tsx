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
    content = (
      <div className="flex flex-col items-center justify-center h-full text-center px-6" aria-live="polite">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-3 text-gray-200">
          <rect x="8" y="12" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M34 20l4-4m0 0l-4-4m4 4H30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="36" cy="36" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
        <p className="text-sm text-gray-400 font-medium">Select an element</p>
        <p className="text-xs text-gray-300 mt-1">Click an entity, relationship, or attribute on the canvas to edit its properties</p>
      </div>
    );
  } else if (selection.type === 'entity') {
    const entity = model.entities.find((e) => e.id === selection.entityId);
    if (entity) {
      content = <EntityProperties entity={entity} />;
    } else {
      content = <p className="text-gray-400 italic text-sm">Entity not found</p>;
    }
  } else if (selection.type === 'relationship') {
    const rel = model.relationships.find((r) => r.id === selection.relationshipId);
    if (rel) {
      content = <RelationshipProperties relationship={rel} />;
    } else {
      content = <p className="text-gray-400 italic text-sm">Relationship not found</p>;
    }
  } else if (selection.type === 'attribute') {
    const entity = model.entities.find((e) => e.id === selection.entityId);
    const attr = entity?.attributes.find((a) => a.id === selection.attributeId);
    if (entity && attr) {
      content = <AttributeProperties attribute={attr} entityId={entity.id} context="entity" />;
    } else {
      content = <p className="text-gray-400 italic text-sm">Attribute not found</p>;
    }
  } else if (selection.type === 'relAttribute') {
    const rel = model.relationships.find((r) => r.id === selection.relationshipId);
    const attr = rel?.attributes.find((a) => a.id === selection.attributeId);
    if (rel && attr) {
      content = <AttributeProperties attribute={attr} relationshipId={rel.id} context="relationship" />;
    } else {
      content = <p className="text-gray-400 italic text-sm">Attribute not found</p>;
    }
  } else if (selection.type === 'aggregation') {
    const agg = model.aggregations.find((a) => a.id === selection.aggregationId);
    if (agg) {
      content = <AggregationProperties aggregation={agg} />;
    } else {
      content = <p className="text-gray-400 italic text-sm">Aggregation not found</p>;
    }
  } else {
    content = <p className="text-gray-400 italic text-sm">Select an element</p>;
  }

  return (
    <div className="h-full bg-white overflow-y-auto custom-scrollbar p-4 text-sm" data-testid="properties-panel" aria-live="polite">
      <h2 className="font-semibold text-gray-900 mb-3 text-base pb-2 border-b border-gray-100">Properties</h2>
      {content}
    </div>
  );
}
