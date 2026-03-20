import { useState } from 'react';
import { useERDStore } from '../ir/store';
import { NotationSwitcher } from './NotationSwitcher';
import { ExportDialog } from './ExportDialog';

export function Toolbar() {
  const clearModel = useERDStore((s) => s.clearModel);
  const [showExport, setShowExport] = useState(false);

  return (
    <>
      <div
        className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-4 shrink-0"
        data-testid="toolbar"
      >
        <h1 className="text-lg font-semibold text-gray-800 mr-auto">CS4221 ERD Tool</h1>
        <NotationSwitcher />
        <button
          onClick={() => setShowExport(true)}
          className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          data-testid="export-button"
        >
          Export DDL
        </button>
        <button
          onClick={() => {
            if (window.confirm('Clear all entities and relationships?')) {
              clearModel();
            }
          }}
          className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          data-testid="clear-button"
        >
          Clear All
        </button>
      </div>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </>
  );
}
