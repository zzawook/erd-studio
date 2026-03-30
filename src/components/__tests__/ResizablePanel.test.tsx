import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResizablePanel } from '../ResizablePanel';

describe('ResizablePanel', () => {
  it('renders children', () => {
    render(
      <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
        <div data-testid="child-content">Hello</div>
      </ResizablePanel>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('has a resize handle', () => {
    render(
      <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
        <span>Content</span>
      </ResizablePanel>,
    );

    expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
  });

  it('renders at the default width', () => {
    render(
      <ResizablePanel defaultWidth={300} minWidth={100} maxWidth={400} side="right">
        <span>Content</span>
      </ResizablePanel>,
    );

    const panel = screen.getByTestId('resizable-panel');
    expect(panel.style.width).toBe('300px');
  });

  it('resizes the panel on mouse drag (left side)', () => {
    render(
      <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
        <span>Content</span>
      </ResizablePanel>,
    );

    const handle = screen.getByTestId('resize-handle');
    const panel = screen.getByTestId('resizable-panel');

    // Simulate drag: mousedown on handle, then mousemove, then mouseup
    fireEvent.mouseDown(handle, { clientX: 250 });
    fireEvent(document, new MouseEvent('mousemove', { clientX: 300, bubbles: true }));
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    // For side="left", delta = moveX - startX = 300 - 250 = 50; newWidth = 250 + 50 = 300
    expect(panel.style.width).toBe('300px');
  });

  it('resizes the panel on mouse drag (right side)', () => {
    render(
      <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="right">
        <span>Content</span>
      </ResizablePanel>,
    );

    const handle = screen.getByTestId('resize-handle');
    const panel = screen.getByTestId('resizable-panel');

    // For side="right", delta = startX - moveX, so dragging left increases width
    fireEvent.mouseDown(handle, { clientX: 250 });
    fireEvent(document, new MouseEvent('mousemove', { clientX: 200, bubbles: true }));
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    // delta = 250 - 200 = 50; newWidth = 250 + 50 = 300
    expect(panel.style.width).toBe('300px');
  });

  it('clamps width to minWidth', () => {
    render(
      <ResizablePanel defaultWidth={200} minWidth={150} maxWidth={400} side="left">
        <span>Content</span>
      </ResizablePanel>,
    );

    const handle = screen.getByTestId('resize-handle');
    const panel = screen.getByTestId('resizable-panel');

    // Drag far to the left to try to go below min
    fireEvent.mouseDown(handle, { clientX: 200 });
    fireEvent(document, new MouseEvent('mousemove', { clientX: 0, bubbles: true }));
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    // delta = 0 - 200 = -200; newWidth = max(150, 200 + (-200)) = 150
    expect(panel.style.width).toBe('150px');
  });

  it('does not resize after mouseup (isResizing guard)', () => {
    render(
      <ResizablePanel defaultWidth={200} minWidth={100} maxWidth={400} side="left">
        <span>Content</span>
      </ResizablePanel>,
    );

    const handle = screen.getByTestId('resize-handle');
    const panel = screen.getByTestId('resizable-panel');

    // Start drag then release
    fireEvent.mouseDown(handle, { clientX: 200 });
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    // Further mousemove after mouseup should NOT change width
    fireEvent(document, new MouseEvent('mousemove', { clientX: 400, bubbles: true }));

    // Width should remain at 200 (default)
    expect(panel.style.width).toBe('200px');
  });

  it('clamps width to maxWidth', () => {
    render(
      <ResizablePanel defaultWidth={200} minWidth={100} maxWidth={300} side="left">
        <span>Content</span>
      </ResizablePanel>,
    );

    const handle = screen.getByTestId('resize-handle');
    const panel = screen.getByTestId('resizable-panel');

    // Drag far to the right to try to go above max
    fireEvent.mouseDown(handle, { clientX: 200 });
    fireEvent(document, new MouseEvent('mousemove', { clientX: 600, bubbles: true }));
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    // delta = 600 - 200 = 400; newWidth = min(300, 200 + 400) = 300
    expect(panel.style.width).toBe('300px');
  });

  describe('keyboard resize (onKeyDown)', () => {
    it('decreases width on ArrowLeft', () => {
      render(
        <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
          <span>Content</span>
        </ResizablePanel>,
      );

      const handle = screen.getByTestId('resize-handle');
      const panel = screen.getByTestId('resizable-panel');

      fireEvent.keyDown(handle, { key: 'ArrowLeft' });

      // step=10, 250 - 10 = 240
      expect(panel.style.width).toBe('240px');
    });

    it('increases width on ArrowRight', () => {
      render(
        <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
          <span>Content</span>
        </ResizablePanel>,
      );

      const handle = screen.getByTestId('resize-handle');
      const panel = screen.getByTestId('resizable-panel');

      fireEvent.keyDown(handle, { key: 'ArrowRight' });

      // step=10, 250 + 10 = 260
      expect(panel.style.width).toBe('260px');
    });

    it('clamps width to minWidth on ArrowLeft', () => {
      render(
        <ResizablePanel defaultWidth={105} minWidth={100} maxWidth={400} side="left">
          <span>Content</span>
        </ResizablePanel>,
      );

      const handle = screen.getByTestId('resize-handle');
      const panel = screen.getByTestId('resizable-panel');

      // Press ArrowLeft twice: 105 -> 100 -> 100 (clamped)
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(panel.style.width).toBe('100px');

      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(panel.style.width).toBe('100px');
    });

    it('clamps width to maxWidth on ArrowRight', () => {
      render(
        <ResizablePanel defaultWidth={395} minWidth={100} maxWidth={400} side="left">
          <span>Content</span>
        </ResizablePanel>,
      );

      const handle = screen.getByTestId('resize-handle');
      const panel = screen.getByTestId('resizable-panel');

      // Press ArrowRight twice: 395 -> 400 -> 400 (clamped)
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(panel.style.width).toBe('400px');

      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(panel.style.width).toBe('400px');
    });

    it('does not change width on other keys', () => {
      render(
        <ResizablePanel defaultWidth={250} minWidth={100} maxWidth={400} side="left">
          <span>Content</span>
        </ResizablePanel>,
      );

      const handle = screen.getByTestId('resize-handle');
      const panel = screen.getByTestId('resizable-panel');

      fireEvent.keyDown(handle, { key: 'ArrowUp' });
      expect(panel.style.width).toBe('250px');

      fireEvent.keyDown(handle, { key: 'Enter' });
      expect(panel.style.width).toBe('250px');
    });
  });
});
