import { useState, useEffect } from 'react';
import { useERDStore } from '../ir/store';
import { NotationSwitcher } from './NotationSwitcher';
import { ExportDialog } from './ExportDialog';
import { showToast } from './Toast';

export function Toolbar() {
  const clearModel = useERDStore((s) => s.clearModel);
  const [showExport, setShowExport] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <>
      <div
        className="h-14 bg-white shadow-sm flex items-center px-5 gap-4 shrink-0 z-20 relative"
        data-testid="toolbar"
      >
        {/* Title */}
        <div className="mr-auto flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary-600 shrink-0">
            <rect x="2" y="3" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="15" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
            <path d="M10 6h4l-4 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 leading-tight">CS4221 ERD Tool</h1>
            <p className="text-[11px] text-gray-400 leading-tight">Entity-Relationship Diagram</p>
          </div>
        </div>

        <NotationSwitcher />

        {/* Export DDL */}
        <button
          onClick={() => setShowExport(true)}
          className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-1.5"
          data-testid="export-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export DDL
        </button>

        {/* Clear All — inline confirm pattern */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors"
            data-testid="clear-button"
          >
            Clear All
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                clearModel();
                setConfirming(false);
                showToast('All data cleared', 'info');
              }}
              className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              style={{ animation: 'confirm-pulse 1.5s ease-in-out infinite' }}
              data-testid="clear-button"
            >
              Confirm Clear
            </button>
          </div>
        )}
      </div>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </>
  );
}
