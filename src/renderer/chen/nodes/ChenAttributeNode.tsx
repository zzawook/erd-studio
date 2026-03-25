import { type NodeProps, type Node } from '@xyflow/react';
import type { Attribute } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type ChenAttributeNodeData = {
  attribute: Attribute;
  entityId?: string;
  relationshipId?: string;
  isPrimaryKey: boolean;
  isPartialKey: boolean;
};

type ChenAttributeNodeType = Node<ChenAttributeNodeData, 'chenAttribute'>;

export function ChenAttributeNode({ data, selected }: NodeProps<ChenAttributeNodeType>) {
  const { attribute, isPrimaryKey, isPartialKey } = data;
  // Per CS4221: PK = filled black, partial key = open circle (same as regular), regular = open circle
  const isFilled = isPrimaryKey;

  return (
    <div
      className={`flex items-center gap-1.5 px-1 py-0.5 rounded
        ${selected ? 'bg-blue-100 ring-2 ring-blue-400 ring-offset-1' : ''}`}
      data-testid="chen-attribute-node"
    >
      <NodeHandles variant="invisible" />

      {/* Circle */}
      <div
        className={`w-4 h-4 rounded-full border-2 shrink-0
          ${isFilled
            ? 'bg-gray-800 border-gray-800'
            : 'bg-white border-gray-800'
          }
          ${isPartialKey ? 'border-gray-800 bg-white' : ''}`}
        data-testid="attr-circle"
      />

      {/* Name label outside the circle */}
      <span className={`text-xs text-gray-800 whitespace-nowrap ${isPrimaryKey ? 'underline' : ''}`}>
        {attribute.name}
      </span>
    </div>
  );
}
