import { useEffect, useCallback } from 'react';

interface RelOption {
  id: string;
  name: string;
  otherEntityName: string;
}

interface Props {
  entityName: string;
  relationships: RelOption[];
  onSelect: (relId: string) => void;
  onCancel: () => void;
}

export function IdentifyingRelationshipDialog({ entityName, relationships, onSelect, onCancel }: Props) {
  // Escape key to cancel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      data-testid="identifying-rel-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[420px] flex flex-col border border-gray-200"
        style={{ animation: 'modal-enter 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Select Identifying Relationship</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which relationship identifies the weak entity "{entityName}"
          </p>
        </div>

        {/* Options */}
        <div className="px-5 py-4 flex flex-col gap-2">
          {relationships.map((rel) => (
            <button
              key={rel.id}
              onClick={() => onSelect(rel.id)}
              className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-all text-sm group"
              data-testid={`rel-option-${rel.id}`}
            >
              <span className="font-medium text-gray-800 group-hover:text-primary-700">{rel.name}</span>
              <span className="text-gray-400 ml-2">→ {rel.otherEntityName}</span>
            </button>
          ))}
        </div>

        {/* Cancel */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
            data-testid="identifying-rel-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
