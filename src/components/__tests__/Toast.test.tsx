import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer, showToast, useToastCleanup } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Flush all pending timers so toasts are cleaned up between tests
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('adds a success toast that is visible in the container', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('Saved successfully', 'success');
      });
      rerender(<ToastContainer />);

      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });

    it('adds an error toast', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('Something went wrong', 'error');
      });
      rerender(<ToastContainer />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('adds an info toast', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('FYI info', 'info');
      });
      rerender(<ToastContainer />);

      expect(screen.getByText('FYI info')).toBeInTheDocument();
    });

    it('defaults to success type when type is omitted', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('Default type');
      });
      rerender(<ToastContainer />);

      expect(screen.getByText('Default type')).toBeInTheDocument();
    });
  });

  describe('ToastContainer', () => {
    it('renders nothing when there are no toasts', () => {
      const { container } = render(<ToastContainer />);
      expect(container.innerHTML).toBe('');
    });

    it('renders multiple toasts', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('First', 'success');
        showToast('Second', 'error');
      });
      rerender(<ToastContainer />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });

  describe('auto-removal', () => {
    it('marks toast as exiting after 2700ms', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('Will exit', 'success');
      });
      rerender(<ToastContainer />);

      const toastEl = screen.getByText('Will exit').closest('div[style]');
      expect(toastEl).toBeTruthy();
      // Before 2700ms - should have toast-in animation
      expect(toastEl!.style.animation).toContain('toast-in');

      // Advance to 2700ms - should transition to exit animation
      act(() => {
        vi.advanceTimersByTime(2700);
      });
      rerender(<ToastContainer />);

      const exitingToast = screen.getByText('Will exit').closest('div[style]');
      expect(exitingToast!.style.animation).toContain('toast-out');
    });

    it('removes toast after 3000ms', () => {
      const { rerender } = render(<ToastContainer />);

      act(() => {
        showToast('Will disappear', 'info');
      });
      rerender(<ToastContainer />);
      expect(screen.getByText('Will disappear')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      rerender(<ToastContainer />);

      expect(screen.queryByText('Will disappear')).not.toBeInTheDocument();
    });
  });

  describe('dismiss button', () => {
    it('removes toast when dismiss button is clicked', async () => {
      // Use real timers for user interaction
      vi.useRealTimers();
      const user = userEvent.setup();

      const { rerender } = render(<ToastContainer />);

      // showToast outside of act is fine with real timers
      showToast('Dismiss me', 'success');
      rerender(<ToastContainer />);

      expect(screen.getByText('Dismiss me')).toBeInTheDocument();

      const dismissButton = screen.getByLabelText('Dismiss');
      await user.click(dismissButton);

      rerender(<ToastContainer />);
      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();

      // Re-enable fake timers for afterEach cleanup
      vi.useFakeTimers();
    });
  });

  describe('useToastCleanup', () => {
    it('can be used in a component without errors', () => {
      function TestComponent() {
        useToastCleanup();
        return <div>cleanup consumer</div>;
      }

      const { unmount } = render(<TestComponent />);
      expect(screen.getByText('cleanup consumer')).toBeInTheDocument();
      // Unmount triggers the cleanup effect
      unmount();
    });
  });
});
