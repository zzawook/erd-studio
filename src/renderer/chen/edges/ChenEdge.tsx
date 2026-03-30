import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { Cardinality } from '../../../ir/types';

export type ChenEdgeData = {
  edgeKind: 'entity-attribute' | 'entity-relationship' | 'relationship-attribute';
  cardinality?: Cardinality;
  role?: string;
  isDerived?: boolean;
};

type ChenEdgeType = Edge<ChenEdgeData, 'chenEdge'>;

/** Format cardinality as (min, n) per CS4221 convention */
export function formatCardinality(c: Cardinality): string {
  const maxStr = c.max === '*' ? 'n' : String(c.max);
  return `(${c.min}, ${maxStr})`;
}

/**
 * Compute label position: 20% along the line from source,
 * offset perpendicular to the line so it sits beside it, not on top.
 */
function computeLabelPosition(
  sx: number, sy: number, tx: number, ty: number
): { x: number; y: number } {
  const t = 0.2; // 20% from source
  const px = sx + (tx - sx) * t;
  const py = sy + (ty - sy) * t;

  // Perpendicular offset (to the right of the direction vector)
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const offset = 14; // pixels offset to the side

  return {
    x: px + perpX * offset,
    y: py + perpY * offset,
  };
}

export function ChenEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<ChenEdgeType>) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const showLabel = data?.edgeKind === 'entity-relationship' && data?.cardinality;
  const isDashed = data?.isDerived === true;

  const labelPos = showLabel
    ? computeLabelPosition(sourceX, sourceY, targetX, targetY)
    : null;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#374151',
          strokeWidth: 1.5,
          strokeDasharray: isDashed ? '6 3' : undefined,
        }}
      />
      {showLabel && data?.cardinality && labelPos && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPos.x}px,${labelPos.y}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="text-[11px] font-semibold text-gray-600 bg-white/90 px-1.5 py-0.5 rounded border border-gray-200/50 shadow-sm"
            data-testid="chen-edge-label"
          >
            {formatCardinality(data.cardinality)}
            {data.role ? ` ${data.role}` : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
