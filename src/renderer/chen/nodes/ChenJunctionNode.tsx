import { type NodeProps, type Node } from '@xyflow/react';
import { NodeHandles } from '../../shared/NodeHandles';

export type ChenJunctionNodeData = Record<string, never>;

type ChenJunctionNodeType = Node<ChenJunctionNodeData, 'chenJunction'>;

/** Small dot used as a branch point on a line (e.g., for partial keys). */
export function ChenJunctionNode(_props: NodeProps<ChenJunctionNodeType>) {
  return (
    <div
      className="w-2 h-2 rounded-full bg-gray-800"
      data-testid="chen-junction-node"
    >
      <NodeHandles variant="invisible" />
    </div>
  );
}
