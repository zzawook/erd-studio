import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleSection } from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders the title', () => {
    render(
      <CollapsibleSection title="My Section">
        <div>Content</div>
      </CollapsibleSection>,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('renders children when open by default', () => {
    render(
      <CollapsibleSection title="Open Section">
        <div>Visible content</div>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('displays count badge when count is provided and greater than 0', () => {
    render(
      <CollapsibleSection title="Items" count={5}>
        <div>Content</div>
      </CollapsibleSection>,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not display count badge when count is 0', () => {
    render(
      <CollapsibleSection title="Items" count={0}>
        <div>Content</div>
      </CollapsibleSection>,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('toggles open/closed when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection title="Toggle Section" defaultOpen={true}>
        <div>Inner content</div>
      </CollapsibleSection>,
    );

    const button = screen.getByRole('button', { name: /Toggle Section/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Click to expand again
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('starts collapsed when defaultOpen is false', () => {
    render(
      <CollapsibleSection title="Closed Section" defaultOpen={false}>
        <div>Hidden content</div>
      </CollapsibleSection>,
    );

    const button = screen.getByRole('button', { name: /Closed Section/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
