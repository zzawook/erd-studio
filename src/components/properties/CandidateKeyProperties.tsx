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

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";

  return (
    <div data-testid="candidate-key-properties">
      <h4 className="font-semibold text-gray-700 mb-2 text-sm">Candidate Keys</h4>

      {entity.candidateKeys.length === 0 && (
        <p className="text-gray-400 italic text-xs py-1">No keys defined</p>
      )}

      <div className="flex flex-col gap-1">
        {entity.candidateKeys.map((ck) => {
          const attrNames = ck.attributeIds
            .map((id) => entity.attributes.find((a) => a.id === id)?.name ?? '?')
            .join(', ');

          return (
            <div
              key={ck.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors"
              data-testid={`ck-item-${ck.id}`}
            >
              <input
                type="radio"
                name={`pk-${entity.id}`}
                checked={ck.isPrimary}
                onChange={() => setPrimaryKey(entity.id, ck.id)}
                disabled={entity.isWeak}
                title={entity.isWeak ? "Weak entities derive PK from identifying relationship" : "Set as Primary Key"}
                className="text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                data-testid={`ck-primary-radio-${ck.id}`}
              />
              <span className={`flex-1 text-sm ${ck.isPrimary ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                {ck.name}
                <span className="text-gray-400 ml-1 font-normal text-xs">({attrNames})</span>
              </span>
              <button
                onClick={() => deleteCandidateKey(entity.id, ck.id)}
                className="rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                title="Delete key"
                data-testid={`ck-delete-${ck.id}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 w-full py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
          data-testid="add-ck-button"
        >
          + Add Key
        </button>
      ) : (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-2">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name"
            className={inputClass}
            data-testid="ck-name-input"
          />

          <div className="text-xs font-medium text-gray-500 mt-1">Select attributes:</div>
          <div className="flex flex-col gap-1">
            {entity.attributes.map((attr) => (
              <label key={attr.id} className="flex items-center gap-2 text-sm text-gray-700 py-0.5 px-1 rounded hover:bg-white transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAttrs.includes(attr.id)}
                  onChange={() => toggleAttr(attr.id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  data-testid={`ck-attr-checkbox-${attr.id}`}
                />
                {attr.name}
              </label>
            ))}
          </div>

          <label className={`flex items-center gap-2 text-sm py-1 ${entity.isWeak ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600'}`}>
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={entity.isWeak}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              data-testid="ck-primary-checkbox"
            />
            Primary Key
          </label>
          {entity.isWeak && (
            <p className="text-xs text-amber-600 ml-1">
              Weak entities derive their PK from the identifying relationship + partial key
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!keyName.trim() || selectedAttrs.length === 0}
              className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="ck-save-button"
            >
              Save
            </button>
            <button
              onClick={() => { setShowForm(false); setKeyName(''); setSelectedAttrs([]); setIsPrimary(false); }}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
