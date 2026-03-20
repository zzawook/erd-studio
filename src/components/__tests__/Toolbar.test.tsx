import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import { useERDStore } from '../../ir/store';

describe('Toolbar', () => {
  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
  });

  it('renders the toolbar', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<Toolbar />);
    expect(screen.getByText('CS4221 ERD Tool')).toBeInTheDocument();
  });

  it('renders the export button', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('export-button')).toHaveTextContent('Export DDL');
  });

  it('renders the clear button', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('clear-button')).toHaveTextContent('Clear All');
  });

  it('renders the notation switcher', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('notation-switcher')).toBeInTheDocument();
  });

  it('opens export dialog when export button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByTestId('export-button'));
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
  });

  it('clears model when clear button is clicked and confirmed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Add an entity to the model first
    useERDStore.getState().addEntity('Test', { x: 0, y: 0 });
    expect(useERDStore.getState().model.entities).toHaveLength(1);

    render(<Toolbar />);
    await user.click(screen.getByTestId('clear-button'));
    expect(useERDStore.getState().model.entities).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it('does not clear model when clear is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    useERDStore.getState().addEntity('Test', { x: 0, y: 0 });
    expect(useERDStore.getState().model.entities).toHaveLength(1);

    render(<Toolbar />);
    await user.click(screen.getByTestId('clear-button'));
    expect(useERDStore.getState().model.entities).toHaveLength(1);

    vi.restoreAllMocks();
  });

  it('closes export dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar />);

    // Open dialog
    await user.click(screen.getByTestId('export-button'));
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();

    // Close dialog
    await user.click(screen.getByTestId('export-close-button'));
    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
  });
});
