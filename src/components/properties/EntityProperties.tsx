import { useState } from 'react';
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

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    const id = addAttribute(entity.id, newAttrName.trim(), { name: 'VARCHAR', precision: 255 });
    setNewAttrName('');
    setSelection({ type: 'attribute', entityId: entity.id, attributeId: id });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="entity-properties">
      {/* Name */}
      <div>
        <label className="block text-gray-600 mb-0.5">Name</label>
        <input
          value={entity.name}
          onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          data-testid="entity-name-edit"
        />
      </div>

      {/* Is Weak */}
      <label className="flex items-center gap-1.5 text-gray-600">
        <input
          type="checkbox"
          checked={entity.isWeak}
          onChange={(e) => updateEntity(entity.id, { isWeak: e.target.checked })}
          data-testid="entity-weak-checkbox"
        />
        Weak Entity
      </label>

      {/* Attributes */}
      <div>
        <h4 className="font-bold text-gray-700 mb-1">Attributes</h4>
        {entity.attributes.length === 0 && (
          <p className="text-gray-400 italic">No attributes</p>
        )}
        {entity.attributes.map((attr) => (
          <div
            key={attr.id}
            onClick={() => setSelection({ type: 'attribute', entityId: entity.id, attributeId: attr.id })}
            className="px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200 flex justify-between"
            data-testid={`attr-list-item-${attr.id}`}
          >
            <span>{attr.name}</span>
            <span className="text-gray-400">{attr.dataType.name}</span>
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <input
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
            placeholder="Attribute name"
            className="flex-1 px-2 py-0.5 border border-gray-300 rounded"
            data-testid="new-attr-name-input"
          />
          <button
            onClick={handleAddAttribute}
            disabled={!newAttrName.trim()}
            className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="add-attr-button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Candidate Keys */}
      <CandidateKeyProperties entity={entity} />

      {/* Delete */}
      <button
        onClick={() => {
          if (window.confirm(`Delete entity "${entity.name}"?`)) {
            deleteEntity(entity.id);
          }
        }}
        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 mt-2"
        data-testid="delete-entity-button"
      >
        Delete Entity
      </button>
    </div>
  );
}
