import { useState } from 'react';
import { useERDStore } from '../../ir/store';
import type { Relationship } from '../../ir/types';
import { validateCardinality } from '../../utils/validation';

interface Props {
  relationship: Relationship;
}

export function RelationshipProperties({ relationship }: Props) {
  const model = useERDStore((s) => s.model);
  const updateRelationship = useERDStore((s) => s.updateRelationship);
  const updateParticipant = useERDStore((s) => s.updateParticipant);
  const deleteRelationship = useERDStore((s) => s.deleteRelationship);
  const addRelationshipAttribute = useERDStore((s) => s.addRelationshipAttribute);
  const setSelection = useERDStore((s) => s.setSelection);

  const [newAttrName, setNewAttrName] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({});

  const handleCardinalityChange = (index: number, field: 'min' | 'max', value: string) => {
    const participant = relationship.participants[index];
    if (!participant) return;

    const minStr = field === 'min' ? value : String(participant.cardinality.min);
    const maxStr = field === 'max' ? value : String(participant.cardinality.max);

    const error = validateCardinality(minStr, maxStr);
    setCardErrors((prev) => ({ ...prev, [index]: error }));

    if (error) return;

    const min = parseInt(minStr, 10);
    const max = maxStr === '*' ? '*' as const : parseInt(maxStr, 10);

    updateParticipant(relationship.id, index, {
      cardinality: { min, max },
    });
  };

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    const id = addRelationshipAttribute(relationship.id, newAttrName.trim(), { name: 'VARCHAR', precision: 255 });
    setNewAttrName('');
    setSelection({ type: 'relAttribute', relationshipId: relationship.id, attributeId: id });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="relationship-properties">
      {/* Name */}
      <div>
        <label className="block text-gray-600 mb-0.5">Name</label>
        <input
          value={relationship.name}
          onChange={(e) => updateRelationship(relationship.id, { name: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          data-testid="rel-name-edit"
        />
      </div>

      {/* Identifying */}
      <label className="flex items-center gap-1.5 text-gray-600">
        <input
          type="checkbox"
          checked={relationship.isIdentifying}
          onChange={(e) => updateRelationship(relationship.id, { isIdentifying: e.target.checked })}
          data-testid="rel-identifying-edit"
        />
        Identifying Relationship
      </label>

      {/* Participants */}
      <div>
        <h4 className="font-bold text-gray-700 mb-1">Participants</h4>
        {relationship.participants.map((p, i) => {
          const entity = model.entities.find((e) => e.id === p.entityId);
          return (
            <div key={i} className="mb-2 p-2 bg-white rounded border border-gray-200">
              <div className="font-medium text-gray-700 mb-1">
                {entity?.name ?? 'Unknown'}
                {p.role ? ` (${p.role})` : ''}
              </div>
              <div className="flex gap-1 items-center">
                <label className="text-gray-500 w-6">min</label>
                <input
                  defaultValue={String(p.cardinality.min)}
                  onBlur={(e) => handleCardinalityChange(i, 'min', e.target.value)}
                  className={`flex-1 px-1 py-0.5 border rounded text-center ${cardErrors[i] ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid={`participant-min-${i}`}
                />
                <label className="text-gray-500 w-6">max</label>
                <input
                  defaultValue={String(p.cardinality.max)}
                  onBlur={(e) => handleCardinalityChange(i, 'max', e.target.value)}
                  className={`flex-1 px-1 py-0.5 border rounded text-center ${cardErrors[i] ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid={`participant-max-${i}`}
                />
              </div>
              {cardErrors[i] && (
                <p className="text-red-500 text-[10px] mt-0.5" data-testid={`participant-error-${i}`}>
                  {cardErrors[i]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Relationship Attributes */}
      <div>
        <h4 className="font-bold text-gray-700 mb-1">Relationship Attributes</h4>
        {relationship.attributes.length === 0 && (
          <p className="text-gray-400 italic">No attributes</p>
        )}
        {relationship.attributes.map((attr) => (
          <div
            key={attr.id}
            onClick={() => setSelection({ type: 'relAttribute', relationshipId: relationship.id, attributeId: attr.id })}
            className="px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200 flex justify-between"
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
            data-testid="new-rel-attr-name"
          />
          <button
            onClick={handleAddAttribute}
            disabled={!newAttrName.trim()}
            className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="add-rel-attr-button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          if (window.confirm(`Delete relationship "${relationship.name}"?`)) {
            deleteRelationship(relationship.id);
          }
        }}
        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 mt-2"
        data-testid="delete-rel-button"
      >
        Delete Relationship
      </button>
    </div>
  );
}
