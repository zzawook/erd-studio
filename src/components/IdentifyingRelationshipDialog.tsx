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
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" data-testid="identifying-rel-dialog">
      <div className="bg-white rounded-lg shadow-xl w-[400px] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-800">Select Identifying Relationship</h2>
          <p className="text-xs text-gray-500 mt-1">
            Choose which relationship identifies the weak entity "{entityName}"
          </p>
        </div>

        {/* Options */}
        <div className="px-4 py-3 flex flex-col gap-2">
          {relationships.map((rel) => (
            <button
              key={rel.id}
              onClick={() => onSelect(rel.id)}
              className="w-full text-left px-3 py-2 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-400 text-sm"
              data-testid={`rel-option-${rel.id}`}
            >
              <span className="font-medium">{rel.name}</span>
              <span className="text-gray-400 ml-2">→ {rel.otherEntityName}</span>
            </button>
          ))}
        </div>

        {/* Cancel */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            data-testid="identifying-rel-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
