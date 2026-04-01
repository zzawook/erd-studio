import { useState, useEffect } from 'react';
import { useERDStore } from '../../ir/store';
import type { Entity } from '../../ir/types';
import { CandidateKeyProperties } from './CandidateKeyProperties';

interface Props {
  entity: Entity;
}

export function EntityProperties({ entity }: Props) {
  const updateEntity = useERDStore((s) => s.updateEntity);
  const deleteEntity = useERDStore((s) => s.deleteEntity);
  const addAttribute = useERDStore((s) => s.addAttribute);
  const setSelection = useERDStore((s) => s.setSelection);

  const [newAttrName, setNewAttrName] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    const id = addAttribute(entity.id, newAttrName.trim(), { name: 'VARCHAR', precision: 255 });
    setNewAttrName('');
    setSelection({ type: 'attribute', entityId: entity.id, attributeId: id });
  };

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-4" data-testid="entity-properties">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
        <input
          value={entity.name}
          onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
          className={inputClass}
          data-testid="entity-name-edit"
        />
      </div>

      {/* Attributes */}
      <div className="border-t border-gray-100 pt-3">
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Attributes</h4>
        {entity.attributes.length === 0 && (
          <p className="text-gray-400 italic text-xs py-1">No attributes</p>
        )}
        <div className="flex flex-col gap-0.5">
          {entity.attributes.map((attr) => (
            <div
              key={attr.id}
              onClick={() => setSelection({ type: 'attribute', entityId: entity.id, attributeId: attr.id })}
              className="px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 flex justify-between items-center transition-colors"
              data-testid={`attr-list-item-${attr.id}`}
            >
              <span className="text-sm text-gray-700">{attr.name}</span>
              <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{attr.dataType.name}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
            placeholder="Attribute name"
            className={`flex-1 ${inputClass}`}
            data-testid="new-attr-name-input"
          />
          <button
            onClick={handleAddAttribute}
            disabled={!newAttrName.trim()}
            className="shrink-0 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-attr-button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Candidate Keys */}
      <div className="border-t border-gray-100 pt-3">
        <CandidateKeyProperties entity={entity} />
      </div>

      {/* Delete */}
      <div className="border-t border-red-100 pt-4 mt-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors"
            data-testid="delete-entity-button"
          >
            Delete Entity
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteEntity(entity.id);
                setConfirming(false);
              }}
              className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              style={{ animation: 'confirm-pulse 1.5s ease-in-out infinite' }}
              data-testid="delete-entity-button"
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
