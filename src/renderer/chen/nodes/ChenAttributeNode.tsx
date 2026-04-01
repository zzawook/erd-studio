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
      className={`flex items-center gap-1.5 px-1 py-0.5 rounded transition-all duration-150
        ${selected ? 'bg-primary-50 ring-2 ring-primary-400 ring-offset-1' : ''}`}
      data-testid="chen-attribute-node"
    >
      <NodeHandles variant="invisible" />

      {/* Circle */}
      <div
        className={`w-[18px] h-[18px] rounded-full border-2 shrink-0
          ${isFilled
            ? 'bg-primary-600 border-primary-600'
            : 'bg-white border-gray-800'
          }
          ${isPartialKey ? 'border-gray-800 bg-white' : ''}`}
        data-testid="attr-circle"
      />

      {/* Name label outside the circle */}
      <span className="text-[12px] text-gray-700 font-medium whitespace-nowrap">
        {attribute.name}
      </span>
    </div>
  );
}
