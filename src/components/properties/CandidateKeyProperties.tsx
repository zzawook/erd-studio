import { useState } from 'react';
import { useERDStore } from '../../ir/store';
import type { Entity } from '../../ir/types';

interface Props {
  entity: Entity;
}

export function CandidateKeyProperties({ entity }: Props) {
  const addCandidateKey = useERDStore((s) => s.addCandidateKey);
  const deleteCandidateKey = useERDStore((s) => s.deleteCandidateKey);
  const setPrimaryKey = useERDStore((s) => s.setPrimaryKey);

  const [keyName, setKeyName] = useState('');
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!keyName.trim() || selectedAttrs.length === 0) return;
    addCandidateKey(entity.id, keyName.trim(), selectedAttrs, isPrimary);
    setKeyName('');
    setSelectedAttrs([]);
    setIsPrimary(false);
    setShowForm(false);
  };

  const toggleAttr = (attrId: string) => {
    setSelectedAttrs((prev) =>
      prev.includes(attrId)
        ? prev.filter((id) => id !== attrId)
        : [...prev, attrId]
    );
  };

  return (
    <div data-testid="candidate-key-properties">
      <h4 className="font-bold text-gray-700 mb-1">Candidate Keys</h4>

      {entity.candidateKeys.length === 0 && (
        <p className="text-gray-400 italic">No keys defined</p>
      )}

      {entity.candidateKeys.map((ck) => {
        const attrNames = ck.attributeIds
          .map((id) => entity.attributes.find((a) => a.id === id)?.name ?? '?')
          .join(', ');

        return (
          <div
            key={ck.id}
            className="flex items-center gap-1 py-0.5"
            data-testid={`ck-item-${ck.id}`}
          >
            <input
              type="radio"
              name={`pk-${entity.id}`}
              checked={ck.isPrimary}
              onChange={() => setPrimaryKey(entity.id, ck.id)}
              title="Set as Primary Key"
              data-testid={`ck-primary-radio-${ck.id}`}
            />
            <span className={`flex-1 ${ck.isPrimary ? 'font-bold' : ''}`}>
              {ck.name}
              <span className="text-gray-400 ml-1">({attrNames})</span>
            </span>
            <button
              onClick={() => deleteCandidateKey(entity.id, ck.id)}
              className="text-red-500 hover:text-red-700 px-1"
              title="Delete key"
              data-testid={`ck-delete-${ck.id}`}
            >
              &times;
            </button>
          </div>
        );
      })}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mt-1 text-blue-600 hover:underline"
          data-testid="add-ck-button"
        >
          + Add Key
        </button>
      ) : (
        <div className="mt-1 p-2 bg-white rounded border border-gray-200 flex flex-col gap-1">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name"
            className="px-2 py-0.5 border border-gray-300 rounded"
            data-testid="ck-name-input"
          />

          <div className="text-gray-600">Select attributes:</div>
          {entity.attributes.map((attr) => (
            <label key={attr.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedAttrs.includes(attr.id)}
                onChange={() => toggleAttr(attr.id)}
                data-testid={`ck-attr-checkbox-${attr.id}`}
              />
              {attr.name}
            </label>
          ))}

          <label className="flex items-center gap-1 text-gray-600">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              data-testid="ck-primary-checkbox"
            />
            Primary Key
          </label>

          <div className="flex gap-1">
            <button
              onClick={handleAdd}
              disabled={!keyName.trim() || selectedAttrs.length === 0}
              className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              data-testid="ck-save-button"
            >
              Save
            </button>
            <button
              onClick={() => { setShowForm(false); setKeyName(''); setSelectedAttrs([]); setIsPrimary(false); }}
              className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
