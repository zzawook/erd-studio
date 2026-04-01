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

  function getKeyMarkers(attr: Attribute): { pk: boolean; fk: boolean } {
    return {
      pk: pkAttrIds.has(attr.id),
      fk: fkAttrNames.has(attr.name),
    };
  }

  return (
    <div
      className={`bg-white border-2 border-gray-800 rounded-sm min-w-[160px] text-xs transition-shadow duration-150
        ${selected ? 'ring-2 ring-primary-500 ring-offset-2 shadow-lg' : 'shadow-md'}`}
      data-testid="crowsfoot-entity-node"
    >
      <NodeHandles />

      {/* Header */}
      <div className="bg-primary-600 text-white px-3 py-2 font-semibold text-center text-sm rounded-t-[1px]">
        {entity.name}
      </div>

      {/* PK attributes */}
      {pkAttributes.length > 0 && (
        <div className="border-b border-gray-300">
          {pkAttributes.map((attr) => {
            const markers = getKeyMarkers(attr);
            return (
              <div key={attr.id} className="px-3 py-1 flex justify-between gap-3 hover:bg-gray-50 transition-colors">
                <span className="underline font-medium flex items-center gap-1">
                  {markers.pk && <span className="font-mono text-[10px] bg-amber-50 text-amber-500 px-1 rounded">PK</span>}
                  {markers.fk && <span className="font-mono text-[10px] bg-primary-50 text-primary-500 px-1 rounded">FK</span>}
                  {attr.name}
                </span>
                <span className="text-gray-500">{formatType(attr)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Other attributes */}
      {otherAttributes.length > 0 && (
        <div>
          {otherAttributes.map((attr) => {
            const markers = getKeyMarkers(attr);
            return (
              <div key={attr.id} className="px-3 py-1 flex justify-between gap-3 hover:bg-gray-50 transition-colors">
                <span className="flex items-center gap-1">
                  {markers.fk && <span className="font-mono text-[10px] bg-primary-50 text-primary-500 px-1 rounded">FK</span>}
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
        <div className="px-3 py-1.5 text-gray-400 italic">No attributes</div>
      )}
    </div>
  );
}
