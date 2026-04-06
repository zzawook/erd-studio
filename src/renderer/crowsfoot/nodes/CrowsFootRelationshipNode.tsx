import { type NodeProps, type Node } from '@xyflow/react';
import type { Relationship } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type CrowsFootRelationshipNodeData = {
  relationship: Relationship;
};

type CrowsFootRelationshipNodeType = Node<CrowsFootRelationshipNodeData, 'crowsfootRelationship'>;

/**
 * A diamond-shaped node used to represent n-ary relationships (3+ participants)
 * in Crow's Foot notation. Binary relationships are drawn as direct edges,
 * but n-ary relationships need a central node connected to each participant.
 */
export function CrowsFootRelationshipNode({ data, selected }: NodeProps<CrowsFootRelationshipNodeType>) {
  const { relationship } = data;

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-150 ${selected ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]' : ''}`}
      style={{ width: 120, height: 80 }}
      data-testid="crowsfoot-relationship-node"
    >
      <NodeHandles />

      <svg
        viewBox="0 0 120 80"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="60,4 116,40 60,76 4,40"
          fill="#fafafa"
          stroke="#1f2937"
          strokeWidth={1.5}
        />
      </svg>

      <span className="relative z-10 text-[11px] font-semibold text-gray-700 text-center px-2 max-w-[80px] truncate">
        {relationship.name}
      </span>
    </div>
  );
}
