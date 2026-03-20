import { useERDStore } from '../../ir/store';
import type { Attribute, AttributeKind } from '../../ir/types';
import { DATA_TYPE_NAMES } from '../../ir/types';

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
  const updateAttribute = useERDStore((s) => s.updateAttribute);
  const deleteAttribute = useERDStore((s) => s.deleteAttribute);
  const updateRelationshipAttribute = useERDStore((s) => s.updateRelationshipAttribute);
  const deleteRelationshipAttribute = useERDStore((s) => s.deleteRelationshipAttribute);
  const setSelection = useERDStore((s) => s.setSelection);

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

  const showPrecision = attribute.dataType.name === 'VARCHAR' || attribute.dataType.name === 'NUMERIC';
  const showScale = attribute.dataType.name === 'NUMERIC';

  return (
    <div className="flex flex-col gap-2" data-testid="attribute-properties">
      <button
        onClick={() => {
          if (entityId) setSelection({ type: 'entity', entityId });
          else if (relationshipId) setSelection({ type: 'relationship', relationshipId });
        }}
        className="text-blue-600 text-left hover:underline text-[10px]"
      >
        &larr; Back
      </button>

      {/* Name */}
      <div>
        <label className="block text-gray-600 mb-0.5">Name</label>
        <input
          value={attribute.name}
          onChange={(e) => update({ name: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          data-testid="attr-name-edit"
        />
      </div>

      {/* Data Type */}
      <div>
        <label className="block text-gray-600 mb-0.5">Data Type</label>
        <select
          value={attribute.dataType.name}
          onChange={(e) => update({ dataType: { ...attribute.dataType, name: e.target.value } })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
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
          <label className="block text-gray-600 mb-0.5">Precision</label>
          <input
            type="number"
            value={attribute.dataType.precision ?? ''}
            onChange={(e) => update({
              dataType: {
                ...attribute.dataType,
                precision: e.target.value ? parseInt(e.target.value, 10) : undefined,
              },
            })}
            className="w-full px-2 py-1 border border-gray-300 rounded"
            data-testid="attr-precision-input"
          />
        </div>
      )}

      {/* Scale */}
      {showScale && (
        <div>
          <label className="block text-gray-600 mb-0.5">Scale</label>
          <input
            type="number"
            value={attribute.dataType.scale ?? ''}
            onChange={(e) => update({
              dataType: {
                ...attribute.dataType,
                scale: e.target.value ? parseInt(e.target.value, 10) : undefined,
              },
            })}
            className="w-full px-2 py-1 border border-gray-300 rounded"
            data-testid="attr-scale-input"
          />
        </div>
      )}

      {/* Nullable */}
      <label className="flex items-center gap-1.5 text-gray-600">
        <input
          type="checkbox"
          checked={attribute.nullable}
          onChange={(e) => update({ nullable: e.target.checked })}
          data-testid="attr-nullable-checkbox"
        />
        Nullable
      </label>

      {/* Kind */}
      <div>
        <label className="block text-gray-600 mb-0.5">Kind</label>
        <select
          value={attribute.kind}
          onChange={(e) => update({ kind: e.target.value as AttributeKind })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          data-testid="attr-kind-select"
        >
          <option value="simple">Simple</option>
          <option value="composite">Composite</option>
          <option value="derived">Derived</option>
          <option value="multivalued">Multivalued</option>
        </select>
      </div>

      {/* Partial Key */}
      {context === 'entity' && (
        <div>
          <label className="flex items-center gap-1.5 text-gray-600">
            <input
              type="checkbox"
              checked={attribute.isPartialKey}
              onChange={(e) => update({ isPartialKey: e.target.checked })}
              disabled={!pkInfo.isWeak}
              data-testid="attr-partial-key-checkbox"
            />
            Partial Key
          </label>
          {!pkInfo.isWeak && (
            <p className="text-[10px] text-gray-400 mt-0.5 ml-5">
              Entity must be marked as "Weak Entity" first
            </p>
          )}
          {pkInfo.isWeak && !pkInfo.hasIdentifying && attribute.isPartialKey && (
            <p className="text-[10px] text-amber-500 mt-0.5 ml-5">
              Create an identifying relationship to a dominant entity for proper rendering
            </p>
          )}
          {pkInfo.isWeak && pkInfo.hasIdentifying && attribute.isPartialKey && (
            <p className="text-[10px] text-green-600 mt-0.5 ml-5">
              Connected to identifying relationship line
            </p>
          )}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 mt-1"
        data-testid="delete-attr-button"
      >
        Delete Attribute
      </button>
    </div>
  );
}
