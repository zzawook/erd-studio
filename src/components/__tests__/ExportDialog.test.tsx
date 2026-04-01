import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../ExportDialog';
import { useERDStore } from '../../ir/store';

describe('ExportDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    useERDStore.setState({
      model: { entities: [], relationships: [], aggregations: [] },
      notation: 'chen',
      selection: null,
    });
  });

  it('renders the dialog', () => {
    render(<ExportDialog onClose={onClose} />);
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
    expect(screen.getByText('Export DDL')).toBeInTheDocument();
  });

  it('renders dialect select with PostgreSQL and MySQL options', () => {
    render(<ExportDialog onClose={onClose} />);
    // Dialect select is now a segmented button group; the hidden div with testid still exists
    expect(screen.getByTestId('dialect-select')).toBeInTheDocument();
    // Both dialect buttons should be rendered
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('MySQL')).toBeInTheDocument();
  });

  it('defaults to PostgreSQL dialect', () => {
    render(<ExportDialog onClose={onClose} />);
    // PostgreSQL button should have the active class (bg-primary-600)
    const pgButton = screen.getByText('PostgreSQL');
    expect(pgButton.className).toContain('bg-primary-600');
  });

  it('shows empty DDL placeholder when model is empty', () => {
    render(<ExportDialog onClose={onClose} />);
    expect(screen.getByTestId('ddl-output')).toHaveTextContent('-- No entities to export');
  });

  it('generates DDL output for model with entities', () => {
    const id = useERDStore.getState().addEntity('User', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(id, 'id', { name: 'INT' });
    const attrId = useERDStore.getState().model.entities[0].attributes[0].id;
    useERDStore.getState().addCandidateKey(id, 'PK', [attrId], true);

    render(<ExportDialog onClose={onClose} />);
    expect(screen.getByTestId('ddl-output').textContent).toContain('CREATE TABLE "User"');
  });

  it('switches dialect to MySQL', async () => {
    const user = userEvent.setup();
    const id = useERDStore.getState().addEntity('User', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(id, 'id', { name: 'INT' });
    const attrId = useERDStore.getState().model.entities[0].attributes[0].id;
    useERDStore.getState().addCandidateKey(id, 'PK', [attrId], true);

    render(<ExportDialog onClose={onClose} />);
    // Click the MySQL button in the segmented button group
    await user.click(screen.getByText('MySQL'));

    expect(screen.getByTestId('ddl-output').textContent).toContain('CREATE TABLE `User`');
  });

  it('shows warnings when they exist', () => {
    // Entity with no PK and no attributes
    useERDStore.getState().addEntity('Empty', { x: 0, y: 0 });

    render(<ExportDialog onClose={onClose} />);
    expect(screen.getByTestId('export-warnings')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
  });

  it('does not show warnings section when there are none', () => {
    const id = useERDStore.getState().addEntity('T', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(id, 'id', { name: 'INT' });
    const attrId = useERDStore.getState().model.entities[0].attributes[0].id;
    useERDStore.getState().addCandidateKey(id, 'PK', [attrId], true);
    // Update the attribute to be non-nullable
    useERDStore.getState().updateAttribute(id, attrId, { nullable: false });

    render(<ExportDialog onClose={onClose} />);
    expect(screen.queryByTestId('export-warnings')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportDialog onClose={onClose} />);

    await user.click(screen.getByTestId('export-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders copy and download buttons', () => {
    render(<ExportDialog onClose={onClose} />);
    expect(screen.getByTestId('copy-button')).toHaveTextContent('Copy to Clipboard');
    expect(screen.getByTestId('download-button')).toHaveTextContent('Download .sql');
  });

  it('copies DDL to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    const id = useERDStore.getState().addEntity('T', { x: 0, y: 0 });
    useERDStore.getState().addAttribute(id, 'id', { name: 'INT' });
    const attrId = useERDStore.getState().model.entities[0].attributes[0].id;
    useERDStore.getState().addCandidateKey(id, 'PK', [attrId], true);

    render(<ExportDialog onClose={onClose} />);
    await user.click(screen.getByTestId('copy-button'));

    expect(mockWriteText).toHaveBeenCalled();
    expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!');
  });

  it('falls back to execCommand when clipboard API fails', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    });
    // jsdom may not have execCommand, so define it
    document.execCommand = vi.fn().mockReturnValue(true);

    render(<ExportDialog onClose={onClose} />);
    await user.click(screen.getByTestId('copy-button'));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!');
  });

  it('downloads SQL file when download button is clicked', async () => {
    const user = userEvent.setup();
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
    const mockRevokeObjectURL = vi.fn();

    // Mock URL methods
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    // Track anchor element creation without recursion
    const origCreateElement = Document.prototype.createElement;
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(function (this: Document, ...args: [string, ...unknown[]]) {
      const el = origCreateElement.apply(this, args as [string, ElementCreationOptions?]);
      if (args[0] === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(<ExportDialog onClose={onClose} />);
    await user.click(screen.getByTestId('download-button'));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    createSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
