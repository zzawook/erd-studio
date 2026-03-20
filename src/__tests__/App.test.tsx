import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
