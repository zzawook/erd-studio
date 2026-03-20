import { useState, useCallback, useRef } from 'react';

interface Props {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanel({ defaultWidth, minWidth, maxWidth, side, children, className = '' }: Props) {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = side === 'left'
        ? moveEvent.clientX - startX.current
        : startX.current - moveEvent.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, minWidth, maxWidth, side]);

  return (
    <div
      className={`relative shrink-0 h-full ${className}`}
      style={{ width }}
      data-testid="resizable-panel"
    >
      {children}
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/50 z-10
          ${side === 'left' ? 'right-0' : 'left-0'}`}
        data-testid="resize-handle"
      />
    </div>
  );
}
