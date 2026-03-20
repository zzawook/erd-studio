import { type NodeProps, type Node } from '@xyflow/react';
import type { Aggregation } from '../../../ir/types';
import { NodeHandles } from '../../shared/NodeHandles';

export type ChenAggregationNodeData = {
  aggregation: Aggregation;
  width: number;
  height: number;
};

type ChenAggregationNodeType = Node<ChenAggregationNodeData, 'chenAggregation'>;

export function ChenAggregationNode({ data, selected }: NodeProps<ChenAggregationNodeType>) {
  const { aggregation, width, height } = data;

  return (
    <div
      className={`border-2 border-solid border-gray-800 bg-gray-50/20 relative
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      style={{ width, height }}
      data-testid="chen-aggregation-node"
    >
      <NodeHandles />
      <div className="absolute -top-5 left-1 text-[10px] font-bold text-gray-600 bg-white px-1 rounded">
        {aggregation.name}
      </div>
    </div>
  );
}
