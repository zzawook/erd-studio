import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotationSwitcher } from '../NotationSwitcher';
import { useERDStore } from '../../ir/store';

describe('NotationSwitcher', () => {
  beforeEach(() => {
    useERDStore.setState({
      model: { entities: [], relationships: [] },
      notation: 'chen',
      selection: null,
    });
  });

  it('renders the notation switcher container', () => {
    render(<NotationSwitcher />);
    expect(screen.getByTestId('notation-switcher')).toBeInTheDocument();
  });

  it('renders Chen and Crow\'s Foot options', () => {
    render(<NotationSwitcher />);
    expect(screen.getByTestId('notation-chen')).toHaveTextContent('Chen');
    expect(screen.getByTestId('notation-crowsfoot')).toHaveTextContent("Crow's Foot");
  });

  it('highlights the active notation', () => {
    render(<NotationSwitcher />);
    const chenButton = screen.getByTestId('notation-chen');
    expect(chenButton.className).toContain('bg-blue-600');
    const crowsfootButton = screen.getByTestId('notation-crowsfoot');
    expect(crowsfootButton.className).not.toContain('bg-blue-600');
  });

  it('clicking Crow\'s Foot calls setNotation', async () => {
    const user = userEvent.setup();
    render(<NotationSwitcher />);
    await user.click(screen.getByTestId('notation-crowsfoot'));
    expect(useERDStore.getState().notation).toBe('crowsfoot');
  });

  it('clicking Chen when already Chen keeps notation', async () => {
    const user = userEvent.setup();
    render(<NotationSwitcher />);
    await user.click(screen.getByTestId('notation-chen'));
    expect(useERDStore.getState().notation).toBe('chen');
  });

  it('updates active class when notation changes', async () => {
    const user = userEvent.setup();
    render(<NotationSwitcher />);

    await user.click(screen.getByTestId('notation-crowsfoot'));
    // Re-render reflects store state
    const crowsfootButton = screen.getByTestId('notation-crowsfoot');
    expect(crowsfootButton.className).toContain('bg-blue-600');
    const chenButton = screen.getByTestId('notation-chen');
    expect(chenButton.className).not.toContain('bg-blue-600');
  });
});
