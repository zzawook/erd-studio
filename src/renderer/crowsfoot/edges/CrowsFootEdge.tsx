import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
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

  // Place the min-cardinality symbol (bar/circle) beyond the max symbol.
  // For "many" the crow's foot convergence is at `size` px, so place beyond that.
  // For "one" the perpendicular line is at 0px, so place close to it.
  const minOffset = isMany ? size + 5 : 10;

  if (isOptional) {
    // Circle for optional
    const cx = x + cos * minOffset;
    const cy = y + sin * minOffset;
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
    const bx = x + cos * minOffset;
    const by = y + sin * minOffset;
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
    // Crow's foot: three prongs at entity (x,y) converging to a single point outward.
    // This matches standard Crow's Foot notation where the fork touches the entity.
    const perpX = -sin * 8;
    const perpY = cos * 8;
    const cx = x + cos * size;  // convergence point (outward along edge)
    const cy = y + sin * size;
    // Top prong
    elements.push(
      <line key="crow1" x1={x - perpX} y1={y - perpY} x2={cx} y2={cy}
        stroke="#374151" strokeWidth={1.5} />
    );
    // Middle prong
    elements.push(
      <line key="crow2" x1={x} y1={y} x2={cx} y2={cy}
        stroke="#374151" strokeWidth={1.5} />
    );
    // Bottom prong
    elements.push(
      <line key="crow3" x1={x + perpX} y1={y + perpY} x2={cx} y2={cy}
        stroke="#374151" strokeWidth={1.5} />
    );
  } else {
    // Single line for "one", offset slightly from entity handle
    const oneOffset = 4;
    const ox = x + cos * oneOffset;
    const oy = y + sin * oneOffset;
    const perpX = -sin * 8;
    const perpY = cos * 8;
    elements.push(
      <line key="one" x1={ox - perpX} y1={oy - perpY} x2={ox + perpX} y2={oy + perpY}
        stroke="#374151" strokeWidth={1.5} />
    );
  }

  return elements;
}

/**
 * Convert a handle Position to the outward-pointing angle for marker drawing.
 * The angle points away from the entity along the edge, so `drawMarker`'s fan
 * (which spreads in the angle direction) opens toward the entity — matching
 * standard Crow's Foot notation where the prongs face the entity.
 */
export function positionToAngle(position: Position): number {
  switch (position) {
    case Position.Right:  return 0;             // edge exits right → angle rightward (outward)
    case Position.Left:   return Math.PI;       // edge exits left  → angle leftward (outward)
    case Position.Bottom: return Math.PI / 2;   // edge exits down  → angle downward (outward)
    case Position.Top:    return -Math.PI / 2;  // edge exits up    → angle upward (outward)
  }
}

export function CrowsFootEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
}: EdgeProps<CrowsFootEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const sourceAngle = positionToAngle(sourcePosition);
  const targetAngle = positionToAngle(targetPosition);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#374151', strokeWidth: 1.5 }} />

      {/* Markers at source and target */}
      <g>
        {data?.sourceCardinality && drawMarker(data.sourceCardinality, sourceX, sourceY, sourceAngle)}
        {data?.targetCardinality && drawMarker(data.targetCardinality, targetX, targetY, targetAngle)}
      </g>

      {/* Relationship name label */}
      {data?.relationship && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-white/95 px-2 py-1 text-xs font-semibold text-gray-600 rounded-md border border-gray-200 shadow-sm"
            data-testid="crowsfoot-edge-label"
          >
            {data.relationship.name}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
