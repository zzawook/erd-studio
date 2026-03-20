import { type NodeProps, type Node } from '@xyflow/react';
import type { Relationship } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type ChenRelationshipNodeData = {
  relationship: Relationship;
};

type ChenRelationshipNodeType = Node<ChenRelationshipNodeData, 'chenRelationship'>;

export function ChenRelationshipNode({ data, selected }: NodeProps<ChenRelationshipNodeType>) {
  const { relationship } = data;
  const isIdentifying = relationship.isIdentifying;

  return (
    <div
      className={`relative flex items-center justify-center ${selected ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.7)]' : ''}`}
      style={{ width: 120, height: 80 }}
      data-testid="chen-relationship-node"
    >
      <NodeHandles />

      <svg
        viewBox="0 0 120 80"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="60,4 116,40 60,76 4,40"
          fill="white"
          stroke="#1f2937"
          strokeWidth={2}
        />
        {isIdentifying && (
          <polygon
            points="60,12 108,40 60,68 12,40"
            fill="none"
            stroke="#1f2937"
            strokeWidth={2}
          />
        )}
      </svg>

      <span className="relative z-10 text-xs font-semibold text-center px-2 max-w-[80px] truncate">
        {relationship.name}
      </span>
    </div>
  );
}
