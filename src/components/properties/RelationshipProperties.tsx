import { useState, useEffect } from 'react';
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
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

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

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-4" data-testid="relationship-properties">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
        <input
          value={relationship.name}
          onChange={(e) => updateRelationship(relationship.id, { name: e.target.value })}
          className={inputClass}
          data-testid="rel-name-edit"
        />
      </div>

      {/* Identifying */}
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={relationship.isIdentifying}
          onChange={(e) => updateRelationship(relationship.id, { isIdentifying: e.target.checked })}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          data-testid="rel-identifying-edit"
        />
        Identifying Relationship
      </label>

      {/* Participants */}
      <div className="border-t border-gray-100 pt-3">
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Participants</h4>
        <div className="flex flex-col gap-2">
          {relationship.participants.map((p, i) => {
            const entity = model.entities.find((e) => e.id === p.entityId);
            return (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border-l-2 border-primary-400">
                <div className="font-medium text-gray-700 mb-2 text-sm">
                  {entity?.name ?? 'Unknown'}
                  {p.role ? ` (${p.role})` : ''}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <input
                      defaultValue={String(p.cardinality.min)}
                      onBlur={(e) => handleCardinalityChange(i, 'min', e.target.value)}
                      className={`w-full px-3 py-1.5 border rounded-md text-sm text-center shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-primary-500 ${cardErrors[i] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                      data-testid={`participant-min-${i}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <input
                      defaultValue={String(p.cardinality.max)}
                      onBlur={(e) => handleCardinalityChange(i, 'max', e.target.value)}
                      className={`w-full px-3 py-1.5 border rounded-md text-sm text-center shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-primary-500 ${cardErrors[i] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                      data-testid={`participant-max-${i}`}
                    />
                  </div>
                </div>
                {cardErrors[i] && (
                  <p className="text-red-500 text-xs mt-1" data-testid={`participant-error-${i}`}>
                    {cardErrors[i]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Relationship Attributes */}
      <div className="border-t border-gray-100 pt-3">
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Relationship Attributes</h4>
        {relationship.attributes.length === 0 && (
          <p className="text-gray-400 italic text-xs py-1">No attributes</p>
        )}
        <div className="flex flex-col gap-0.5">
          {relationship.attributes.map((attr) => (
            <div
              key={attr.id}
              onClick={() => setSelection({ type: 'relAttribute', relationshipId: relationship.id, attributeId: attr.id })}
              className="px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 flex justify-between items-center transition-colors"
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
            data-testid="new-rel-attr-name"
          />
          <button
            onClick={handleAddAttribute}
            disabled={!newAttrName.trim()}
            className="shrink-0 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-rel-attr-button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Delete */}
      <div className="border-t border-red-100 pt-4 mt-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors"
            data-testid="delete-rel-button"
          >
            Delete Relationship
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
                deleteRelationship(relationship.id);
                setConfirming(false);
              }}
              className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              style={{ animation: 'confirm-pulse 1.5s ease-in-out infinite' }}
              data-testid="delete-rel-button"
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
