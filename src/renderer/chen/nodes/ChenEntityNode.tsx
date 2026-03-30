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
      className={`px-5 py-3 bg-white text-center font-semibold text-[13px] tracking-tight min-w-[100px] rounded-sm transition-shadow duration-150
        ${isWeak
          ? 'border-[3px] border-gray-800 outline outline-2 outline-gray-800 outline-offset-2'
          : 'border-2 border-gray-800 border-t-[3px] border-t-primary-500'
        }
        ${selected ? 'shadow-md shadow-primary-200' : 'shadow-sm'}`}
      data-testid="chen-entity-node"
    >
      <NodeHandles />
      <span>{entity.name}</span>
    </div>
  );
}
