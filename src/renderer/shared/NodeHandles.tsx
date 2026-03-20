import { Handle, Position } from '@xyflow/react';

interface Props {
  variant?: 'visible' | 'invisible';
}

const visibleClass = '!bg-gray-500 !w-2 !h-2';
const invisibleClass = '!bg-transparent !border-0 !w-0 !h-0 !min-w-0 !min-h-0';

/** Renders all 8 handles (4 target + 4 source) for top/bottom/left/right. */
export function NodeHandles({ variant = 'visible' }: Props) {
  const cls = variant === 'visible' ? visibleClass : invisibleClass;

  return (
    <>
      <Handle type="target" position={Position.Top} id="top" className={cls} />
      <Handle type="source" position={Position.Top} id="top-src" className={cls} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={cls} />
      <Handle type="source" position={Position.Bottom} id="bottom-src" className={cls} />
      <Handle type="target" position={Position.Left} id="left" className={cls} />
      <Handle type="source" position={Position.Left} id="left-src" className={cls} />
      <Handle type="target" position={Position.Right} id="right" className={cls} />
      <Handle type="source" position={Position.Right} id="right-src" className={cls} />
    </>
  );
}
