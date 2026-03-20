import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { Cardinality, Relationship } from '../../../ir/types';

export type CrowsFootEdgeData = {
  relationship: Relationship;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
};

type CrowsFootEdgeType = Edge<CrowsFootEdgeData, 'crowsfootEdge'>;

export function drawMarker(
  cardinality: Cardinality,
  x: number,
  y: number,
  angle: number,
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const size = 10;

  // Determine if many (max > 1 or '*')
  const isMany = cardinality.max === '*' || (typeof cardinality.max === 'number' && cardinality.max > 1);
  const isOptional = cardinality.min === 0;

  if (isOptional) {
    // Circle for optional
    const cx = x + cos * (size + 5);
    const cy = y + sin * (size + 5);
    elements.push(
      <circle
        key="circle"
        cx={cx}
        cy={cy}
        r={4}
        fill="white"
        stroke="#374151"
        strokeWidth={1.5}
      />
    );
  } else {
    // Bar for mandatory
    const bx = x + cos * (size + 5);
    const by = y + sin * (size + 5);
    const perpX = -sin * 8;
    const perpY = cos * 8;
    elements.push(
      <line
        key="bar"
        x1={bx - perpX}
        y1={by - perpY}
        x2={bx + perpX}
        y2={by + perpY}
        stroke="#374151"
        strokeWidth={1.5}
      />
    );
  }

  if (isMany) {
    // Crow's foot (three lines spreading out)
    const perpX = -sin * 8;
    const perpY = cos * 8;
    // Top line
    elements.push(
      <line key="crow1" x1={x} y1={y} x2={x + cos * size - perpX} y2={y + sin * size - perpY}
        stroke="#374151" strokeWidth={1.5} />
    );
    // Middle line
    elements.push(
      <line key="crow2" x1={x} y1={y} x2={x + cos * size} y2={y + sin * size}
        stroke="#374151" strokeWidth={1.5} />
    );
    // Bottom line
    elements.push(
      <line key="crow3" x1={x} y1={y} x2={x + cos * size + perpX} y2={y + sin * size + perpY}
        stroke="#374151" strokeWidth={1.5} />
    );
  } else {
    // Single line for "one"
    const perpX = -sin * 8;
    const perpY = cos * 8;
    elements.push(
      <line key="one" x1={x - perpX} y1={y - perpY} x2={x + perpX} y2={y + perpY}
        stroke="#374151" strokeWidth={1.5} />
    );
  }

  return elements;
}

export function CrowsFootEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<CrowsFootEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    borderRadius: 8,
  });

  const sourceAngle = Math.atan2(targetY - sourceY, targetX - sourceX);
  const targetAngle = Math.atan2(sourceY - targetY, sourceX - targetX);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#374151', strokeWidth: 1.5 }} />

      {/* Markers at source and target */}
      <svg className="react-flow__edge-interaction" style={{ overflow: 'visible' }}>
        <g>
          {data?.sourceCardinality && drawMarker(data.sourceCardinality, sourceX, sourceY, sourceAngle)}
          {data?.targetCardinality && drawMarker(data.targetCardinality, targetX, targetY, targetAngle)}
        </g>
      </svg>

      {/* Relationship name label */}
      {data?.relationship && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700 rounded border border-gray-300"
            data-testid="crowsfoot-edge-label"
          >
            {data.relationship.name}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
