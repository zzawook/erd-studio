import { useState } from 'react';
import { useERDStore } from '../../ir/store';
import type { Attribute, AttributeKind } from '../../ir/types';
import { DATA_TYPE_NAMES } from '../../ir/types';
import { IdentifyingRelationshipDialog } from '../IdentifyingRelationshipDialog';

function usePartialKeyInfo(entityId?: string) {
  const model = useERDStore((s) => s.model);
  if (!entityId) return { isWeak: false, hasIdentifying: false };
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) return { isWeak: false, hasIdentifying: false };
  const hasIdentifying = model.relationships.some(
    (r) => r.isIdentifying && r.participants.some((p) => p.entityId === entityId)
  );
  return { isWeak: entity.isWeak, hasIdentifying };
}

interface Props {
  attribute: Attribute;
  entityId?: string;
  relationshipId?: string;
  context: 'entity' | 'relationship';
}

export function AttributeProperties({ attribute, entityId, relationshipId, context }: Props) {
  const pkInfo = usePartialKeyInfo(entityId);
  const model = useERDStore((s) => s.model);
  const updateAttribute = useERDStore((s) => s.updateAttribute);
  const deleteAttribute = useERDStore((s) => s.deleteAttribute);
  const updateRelationshipAttribute = useERDStore((s) => s.updateRelationshipAttribute);
  const deleteRelationshipAttribute = useERDStore((s) => s.deleteRelationshipAttribute);
  const updateEntity = useERDStore((s) => s.updateEntity);
  const updateRelationship = useERDStore((s) => s.updateRelationship);
  const setSelection = useERDStore((s) => s.setSelection);

  const [showRelPicker, setShowRelPicker] = useState(false);

  const update = (patch: Partial<Omit<Attribute, 'id'>>) => {
    if (context === 'entity' && entityId) {
      updateAttribute(entityId, attribute.id, patch);
    } else if (context === 'relationship' && relationshipId) {
      updateRelationshipAttribute(relationshipId, attribute.id, patch);
    }
  };

  const handleDelete = () => {
    if (context === 'entity' && entityId) {
      deleteAttribute(entityId, attribute.id);
      setSelection({ type: 'entity', entityId });
    } else if (context === 'relationship' && relationshipId) {
      deleteRelationshipAttribute(relationshipId, attribute.id);
      setSelection({ type: 'relationship', relationshipId });
    }
  };

  const handlePartialKeyToggle = (checked: boolean) => {
    if (!entityId) return;

    if (checked) {
      update({ isPartialKey: true });
      updateEntity(entityId, { isWeak: true });

      // Auto-mark identifying relationship if not already set
      if (!pkInfo.hasIdentifying) {
        const connectedRels = model.relationships.filter(
          (r) => r.participants.some((p) => p.entityId === entityId)
        );

        if (connectedRels.length === 1) {
          updateRelationship(connectedRels[0].id, { isIdentifying: true });
        } else if (connectedRels.length > 1) {
          setShowRelPicker(true);
        }
      }
    } else {
      update({ isPartialKey: false });

      // Check if any other partial keys remain on this entity
      const entity = model.entities.find((e) => e.id === entityId);
      const remainingPartialKeys = entity?.attributes.filter(
        (a) => a.isPartialKey && a.id !== attribute.id
      ) ?? [];

      if (remainingPartialKeys.length === 0) {
        updateEntity(entityId, { isWeak: false });
        // Un-mark any identifying relationships for this entity
        const identRels = model.relationships.filter(
          (r) => r.isIdentifying && r.participants.some((p) => p.entityId === entityId)
        );
        for (const rel of identRels) {
          updateRelationship(rel.id, { isIdentifying: false });
        }
      }
    }
  };

  const handleRelPickerSelect = (relId: string) => {
    updateRelationship(relId, { isIdentifying: true });
    setShowRelPicker(false);
  };

  const handleRelPickerCancel = () => {
    // Revert: un-mark partial key and weak
    update({ isPartialKey: false });
    const entity = model.entities.find((e) => e.id === entityId);
    const remainingPartialKeys = entity?.attributes.filter(
      (a) => a.isPartialKey && a.id !== attribute.id
    ) ?? [];
    if (remainingPartialKeys.length === 0 && entityId) {
      updateEntity(entityId, { isWeak: false });
    }
    setShowRelPicker(false);
  };

  const showPrecision = attribute.dataType.name === 'VARCHAR' || attribute.dataType.name === 'NUMERIC';
  const showScale = attribute.dataType.name === 'NUMERIC';

  // Build relationship options for the picker dialog
  const relPickerOptions = entityId
    ? model.relationships
        .filter((r) => r.participants.some((p) => p.entityId === entityId))
        .map((r) => {
          const otherParticipant = r.participants.find((p) => p.entityId !== entityId);
          const otherEntity = otherParticipant
            ? model.entities.find((e) => e.id === otherParticipant.entityId)
            : null;
          return { id: r.id, name: r.name, otherEntityName: otherEntity?.name ?? '?' };
        })
    : [];

  const entityName = entityId ? model.entities.find((e) => e.id === entityId)?.name ?? '' : '';
  const parentName = entityId
    ? model.entities.find((e) => e.id === entityId)?.name
    : model.relationships.find((r) => r.id === relationshipId)?.name;

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-3" data-testid="attribute-properties">
      {/* Breadcrumb */}
      <button
        onClick={() => {
          if (entityId) setSelection({ type: 'entity', entityId });
          else if (relationshipId) setSelection({ type: 'relationship', relationshipId });
        }}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1 self-start"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="text-gray-400">{parentName}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-medium text-gray-700">{attribute.name}</span>
      </button>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
        <input
          value={attribute.name}
          onChange={(e) => update({ name: e.target.value })}
          className={inputClass}
          data-testid="attr-name-edit"
        />
      </div>

      {/* Data Type group */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data Type</label>
          <select
            value={attribute.dataType.name}
            onChange={(e) => update({ dataType: { ...attribute.dataType, name: e.target.value } })}
            className={inputClass}
            data-testid="attr-type-select"
          >
            {DATA_TYPE_NAMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Precision */}
        {showPrecision && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Precision</label>
            <input
              type="number"
              value={attribute.dataType.precision ?? ''}
              onChange={(e) => update({
                dataType: {
                  ...attribute.dataType,
                  precision: e.target.value ? parseInt(e.target.value, 10) : undefined,
                },
              })}
              className={inputClass}
              data-testid="attr-precision-input"
            />
          </div>
        )}

        {/* Scale */}
        {showScale && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scale</label>
            <input
              type="number"
              value={attribute.dataType.scale ?? ''}
              onChange={(e) => update({
                dataType: {
                  ...attribute.dataType,
                  scale: e.target.value ? parseInt(e.target.value, 10) : undefined,
                },
              })}
              className={inputClass}
              data-testid="attr-scale-input"
            />
          </div>
        )}
      </div>

      {/* Nullable — toggle switch */}
      <label className="flex items-center justify-between text-sm text-gray-600 py-1">
        <span>Nullable</span>
        <span className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={attribute.nullable}
            onChange={(e) => update({ nullable: e.target.checked })}
            className="sr-only peer"
            data-testid="attr-nullable-checkbox"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:bg-primary-600 transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>

      {/* Kind */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Kind</label>
        <select
          value={attribute.kind}
          onChange={(e) => update({ kind: e.target.value as AttributeKind })}
          className={inputClass}
          data-testid="attr-kind-select"
        >
          <option value="simple">Simple</option>
          <option value="composite">Composite</option>
          <option value="derived">Derived</option>
          <option value="multivalued">Multivalued</option>
        </select>
      </div>

      {/* Partial Key — toggle switch */}
      {context === 'entity' && (
        <div>
          <label className="flex items-center justify-between text-sm text-gray-600 py-1">
            <span>Partial Key</span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={attribute.isPartialKey}
                onChange={(e) => handlePartialKeyToggle(e.target.checked)}
                className="sr-only peer"
                data-testid="attr-partial-key-checkbox"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:bg-primary-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
          {pkInfo.hasIdentifying && attribute.isPartialKey && (
            <p className="text-xs text-green-600 mt-1 ml-1">
              Connected to identifying relationship
            </p>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="border-t border-red-100 pt-3 mt-1">
        <button
          onClick={handleDelete}
          className="w-full py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors"
          data-testid="delete-attr-button"
        >
          Delete Attribute
        </button>
      </div>

      {/* Identifying Relationship Picker */}
      {showRelPicker && (
        <IdentifyingRelationshipDialog
          entityName={entityName}
          relationships={relPickerOptions}
          onSelect={handleRelPickerSelect}
          onCancel={handleRelPickerCancel}
        />
      )}
    </div>
  );
}
