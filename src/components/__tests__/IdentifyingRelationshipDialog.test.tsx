import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentifyingRelationshipDialog } from '../IdentifyingRelationshipDialog';

const relationships = [
  { id: 'r1', name: 'owns', otherEntityName: 'Building' },
  { id: 'r2', name: 'located_in', otherEntityName: 'City' },
];

describe('IdentifyingRelationshipDialog', () => {
  it('renders the dialog with entity name', () => {
    render(
      <IdentifyingRelationshipDialog
        entityName="Room"
        relationships={relationships}
        onSelect={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('identifying-rel-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Room/)).toBeInTheDocument();
  });

  it('renders all relationship options', () => {
    render(
      <IdentifyingRelationshipDialog
        entityName="Room"
        relationships={relationships}
        onSelect={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('rel-option-r1')).toBeInTheDocument();
    expect(screen.getByTestId('rel-option-r2')).toBeInTheDocument();
    expect(screen.getByText('owns')).toBeInTheDocument();
    expect(screen.getByText('located_in')).toBeInTheDocument();
  });

  it('calls onSelect with relationship id when option is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <IdentifyingRelationshipDialog
        entityName="Room"
        relationships={relationships}
        onSelect={onSelect}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByTestId('rel-option-r1'));
    expect(onSelect).toHaveBeenCalledWith('r1');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <IdentifyingRelationshipDialog
        entityName="Room"
        relationships={relationships}
        onSelect={() => {}}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByTestId('identifying-rel-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
