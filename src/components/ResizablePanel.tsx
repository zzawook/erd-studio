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

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 10;
    if (e.key === 'ArrowLeft') {
      setWidth((w) => Math.max(minWidth, Math.min(maxWidth, w - step)));
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      setWidth((w) => Math.max(minWidth, Math.min(maxWidth, w + step)));
      e.preventDefault();
    }
  }, [minWidth, maxWidth]);

  return (
    <div
      className={`relative shrink-0 h-full ${className}`}
      style={{ width }}
      data-testid="resizable-panel"
    >
      {children}
      {/* Resize handle — wide invisible hit area with thin visible indicator */}
      <div
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        className={`absolute top-0 bottom-0 w-4 cursor-col-resize z-10 flex items-center justify-center group outline-none
          ${side === 'left' ? '-right-2' : '-left-2'}`}
        data-testid="resize-handle"
      >
        <div className="w-[2px] h-full bg-transparent group-hover:bg-primary-400 group-focus-visible:bg-primary-400 group-active:bg-primary-500 transition-colors duration-150" />
      </div>
    </div>
  );
}
