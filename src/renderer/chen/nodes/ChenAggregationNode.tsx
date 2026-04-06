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
      className={`border-2 border-gray-600 bg-gray-50/40 rounded-sm relative
        ${selected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
      style={{ width, height }}
      data-testid="chen-aggregation-node"
    >
      <NodeHandles />
      <div className="absolute -top-4 left-2 text-xs font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-200">
        {aggregation.name}
      </div>
    </div>
  );
}
