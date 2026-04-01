import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentifyingRelationshipDialog } from '../IdentifyingRelationshipDialog';

const sampleRelationships = [
  { id: 'r1', name: 'belongs_to', otherEntityName: 'Department' },
  { id: 'r2', name: 'works_in', otherEntityName: 'Office' },
];

describe('IdentifyingRelationshipDialog', () => {
  it('renders the dialog with entity name', () => {
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('identifying-rel-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Employee/)).toBeInTheDocument();
  });

  it('renders relationship options', () => {
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('rel-option-r1')).toBeInTheDocument();
    expect(screen.getByTestId('rel-option-r2')).toBeInTheDocument();
    expect(screen.getByText('belongs_to')).toBeInTheDocument();
    expect(screen.getByText('works_in')).toBeInTheDocument();
  });

  it('calls onSelect when a relationship is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('rel-option-r1'));
    expect(onSelect).toHaveBeenCalledWith('r1');
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByTestId('identifying-rel-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel for non-Escape keys', () => {
    const onCancel = vi.fn();
    render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <IdentifyingRelationshipDialog
        entityName="Employee"
        relationships={sampleRelationships}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    unmount();

    // After unmount, Escape should not trigger onCancel
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
