import { type NodeProps, type Node } from '@xyflow/react';
import type { Entity } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type ChenEntityNodeData = {
  entity: Entity;
};

type ChenEntityNodeType = Node<ChenEntityNodeData, 'chenEntity'>;

export function ChenEntityNode({ data, selected }: NodeProps<ChenEntityNodeType>) {
  const { entity } = data;
  const isWeak = entity.isWeak;

  return (
    <div
      className={`px-5 py-3 bg-white text-center font-semibold text-sm min-w-[100px]
        ${isWeak
          ? 'border-[3px] border-gray-800 outline outline-2 outline-gray-800 outline-offset-2'
          : 'border-2 border-gray-800'
        }
        ${selected ? 'shadow-[0_0_0_3px_rgba(59,130,246,0.7)]' : ''}`}
      data-testid="chen-entity-node"
    >
      <NodeHandles />
      <span>{entity.name}</span>
    </div>
  );
}
