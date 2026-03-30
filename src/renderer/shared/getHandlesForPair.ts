/**
 * Determine which side handles to use for source/target based on their relative positions.
 * Returns handle IDs matching those in NodeHandles.tsx.
 */
export function getHandlesForPair(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sourceHandle: 'right-src', targetHandle: 'left' }
      : { sourceHandle: 'left-src', targetHandle: 'right' };
  } else {
    return dy > 0
      ? { sourceHandle: 'bottom-src', targetHandle: 'top' }
      : { sourceHandle: 'top-src', targetHandle: 'bottom' };
  }
}
