import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { useERDStore } from '../ir/store';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  useERDStore.setState({
    model: { entities: [], relationships: [], aggregations: [] },
    notation: 'chen',
    selection: null,
  });
});

describe('App', () => {
  it('renders without crashing', () => {
    expect(() => {
      render(<App />);
    }).not.toThrow();
  });

  it('renders the toolbar', () => {
    render(<App />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('renders the sidebar', () => {
    render(<App />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders the properties panel', () => {
    render(<App />);
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
  });

  it('renders the canvas', () => {
    render(<App />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('deselects on Escape key press', () => {
    // Set a selection first
    useERDStore.setState({ selection: { type: 'entity', id: 'e1' } });
    expect(useERDStore.getState().selection).not.toBeNull();

    render(<App />);

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(useERDStore.getState().selection).toBeNull();
  });

  it('does not deselect on Escape when focus is in an input', () => {
    useERDStore.setState({ selection: { type: 'entity', id: 'e1' } });

    render(<App />);

    // Create a temporary input to simulate focus inside an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'Escape' });

    // Selection should remain because target is INPUT
    expect(useERDStore.getState().selection).not.toBeNull();

    document.body.removeChild(input);
  });

  it('does not deselect on non-Escape keys', () => {
    useERDStore.setState({ selection: { type: 'entity', id: 'e1' } });

    render(<App />);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(useERDStore.getState().selection).not.toBeNull();
  });

  it('cleans up keydown listener on unmount', () => {
    useERDStore.setState({ selection: { type: 'entity', id: 'e1' } });

    const { unmount } = render(<App />);
    unmount();

    // After unmount, Escape should not clear selection
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useERDStore.getState().selection).not.toBeNull();
  });
});
