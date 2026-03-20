import { type NodeProps, type Node } from '@xyflow/react';
import type { Entity, Attribute } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type ForeignKeyInfo = {
  attributeName: string;
  referencedEntityName: string;
};

export type CrowsFootEntityNodeData = {
  entity: Entity;
  foreignKeys: ForeignKeyInfo[];
};

type CrowsFootEntityNodeType = Node<CrowsFootEntityNodeData, 'crowsfootEntity'>;

export function CrowsFootEntityNode({ data, selected }: NodeProps<CrowsFootEntityNodeType>) {
  const { entity, foreignKeys } = data;

  const primaryKey = entity.candidateKeys.find((ck) => ck.isPrimary);
  const pkAttrIds = new Set(primaryKey?.attributeIds ?? []);
  const fkAttrNames = new Set(foreignKeys.map((fk) => fk.attributeName));

  const pkAttributes = entity.attributes.filter((a) => pkAttrIds.has(a.id));
  const otherAttributes = entity.attributes.filter((a) => !pkAttrIds.has(a.id));

  function formatType(attr: Attribute): string {
    let t = attr.dataType.name;
    if (attr.dataType.precision != null) {
      t += `(${attr.dataType.precision}`;
      if (attr.dataType.scale != null) {
        t += `,${attr.dataType.scale}`;
      }
      t += ')';
    }
    return t;
  }

  function getKeyMarker(attr: Attribute): string {
    const markers: string[] = [];
    if (pkAttrIds.has(attr.id)) markers.push('PK');
    if (fkAttrNames.has(attr.name)) markers.push('FK');
    return markers.join(',');
  }

  return (
    <div
      className={`bg-white border-2 border-gray-800 rounded-sm min-w-[160px] text-xs shadow-sm
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}`}
      data-testid="crowsfoot-entity-node"
    >
      <NodeHandles />

      {/* Header */}
      <div className="bg-blue-600 text-white px-3 py-1.5 font-bold text-center">
        {entity.name}
      </div>

      {/* PK attributes */}
      {pkAttributes.length > 0 && (
        <div className="border-b border-gray-300">
          {pkAttributes.map((attr) => (
            <div key={attr.id} className="px-3 py-0.5 flex justify-between gap-3">
              <span className="underline font-medium">
                <span className="text-yellow-600 mr-1">{getKeyMarker(attr)}</span>
                {attr.name}
              </span>
              <span className="text-gray-500">{formatType(attr)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Other attributes */}
      {otherAttributes.length > 0 && (
        <div>
          {otherAttributes.map((attr) => {
            const marker = getKeyMarker(attr);
            return (
              <div key={attr.id} className="px-3 py-0.5 flex justify-between gap-3">
                <span>
                  {marker && <span className="text-blue-600 mr-1">{marker}</span>}
                  {attr.name}
                </span>
                <span className="text-gray-500">{formatType(attr)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {entity.attributes.length === 0 && (
        <div className="px-3 py-1 text-gray-400 italic">No attributes</div>
      )}
    </div>
  );
}
