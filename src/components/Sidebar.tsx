import { useState } from 'react';
import { useERDStore } from '../ir/store';
import type { Participant } from '../ir/types';
import { validateCardinality } from '../utils/validation';
import { CollapsibleSection } from './CollapsibleSection';
import { showToast } from './Toast';

export function Sidebar() {
  const model = useERDStore((s) => s.model);
  const addEntity = useERDStore((s) => s.addEntity);
  const addRelationship = useERDStore((s) => s.addRelationship);
  const addAggregation = useERDStore((s) => s.addAggregation);
  const setSelection = useERDStore((s) => s.setSelection);
  const selection = useERDStore((s) => s.selection);

  // Entity form
  const [entityName, setEntityName] = useState('');

  // Relationship form
  const [relName, setRelName] = useState('');
  const [relEntity1, setRelEntity1] = useState('');
  const [relEntity2, setRelEntity2] = useState('');
  const [relMin1, setRelMin1] = useState('0');
  const [relMax1, setRelMax1] = useState('*');
  const [relMin2, setRelMin2] = useState('0');
  const [relMax2, setRelMax2] = useState('*');
  const [relIdentifying, setRelIdentifying] = useState(false);
  const [relError, setRelError] = useState('');

  // Aggregation form
  const [aggName, setAggName] = useState('');
  const [aggRelId, setAggRelId] = useState('');

  const handleAddEntity = () => {
    if (!entityName.trim()) return;
    const x = 100 + Math.random() * 400;
    const y = 100 + Math.random() * 300;
    const id = addEntity(entityName.trim(), { x, y });
    setEntityName('');
    setSelection({ type: 'entity', entityId: id });
    showToast(`Entity "${entityName.trim()}" created`, 'success');
  };

  const handleAddRelationship = () => {
    if (!relName.trim() || !relEntity1 || !relEntity2) {
      setRelError('Fill in all fields');
      return;
    }

    const v1 = validateCardinality(relMin1, relMax1);
    if (v1) { setRelError(`Entity 1: ${v1}`); return; }

    const v2 = validateCardinality(relMin2, relMax2);
    if (v2) { setRelError(`Entity 2: ${v2}`); return; }

    const min1 = parseInt(relMin1, 10);
    const max1 = relMax1 === '*' ? '*' as const : parseInt(relMax1, 10);
    const min2 = parseInt(relMin2, 10);
    const max2 = relMax2 === '*' ? '*' as const : parseInt(relMax2, 10);

    const parseParticipantId = (val: string): { entityId: string; isAggregation: boolean } => {
      if (val.startsWith('agg:')) {
        return { entityId: val.slice(4), isAggregation: true };
      }
      return { entityId: val, isAggregation: false };
    };

    const p1 = parseParticipantId(relEntity1);
    const p2 = parseParticipantId(relEntity2);

    const participants: Participant[] = [
      { entityId: p1.entityId, cardinality: { min: min1, max: max1 }, isAggregation: p1.isAggregation },
      { entityId: p2.entityId, cardinality: { min: min2, max: max2 }, isAggregation: p2.isAggregation },
    ];

    // Position between the two entities/aggregations
    const findPos = (id: string, isAgg: boolean) => {
      if (isAgg) {
        // Use the aggregated relationship's position
        const agg = model.aggregations.find((a) => a.id === id);
        const rel = agg ? model.relationships.find((r) => r.id === agg.relationshipId) : null;
        return rel?.position ?? { x: 300, y: 200 };
      }
      return model.entities.find((e) => e.id === id)?.position ?? { x: 300, y: 200 };
    };

    const e1Pos = findPos(p1.entityId, p1.isAggregation);
    const e2Pos = findPos(p2.entityId, p2.isAggregation);
    const pos = {
      x: (e1Pos.x + e2Pos.x) / 2,
      y: (e1Pos.y + e2Pos.y) / 2,
    };

    const id = addRelationship(relName.trim(), participants, pos);

    if (relIdentifying) {
      useERDStore.getState().updateRelationship(id, { isIdentifying: true });
    }

    setRelName('');
    setRelEntity1('');
    setRelEntity2('');
    setRelMin1('0');
    setRelMax1('*');
    setRelMin2('0');
    setRelMax2('*');
    setRelIdentifying(false);
    setRelError('');
    setSelection({ type: 'relationship', relationshipId: id });
    showToast(`Relationship "${relName.trim()}" created`, 'success');
  };

  const selectedEntityId = selection && selection.type === 'entity' ? selection.entityId
    : selection && selection.type === 'attribute' ? selection.entityId
    : null;
  const selectedRelId = selection && selection.type === 'relationship' ? selection.relationshipId
    : selection && selection.type === 'relAttribute' ? selection.relationshipId
    : null;

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";
  const selectClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";
  const btnPrimary = "w-full px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="h-full w-full bg-white overflow-y-auto custom-scrollbar flex flex-col text-sm" data-testid="sidebar">

      {/* ── Entities ── */}
      <CollapsibleSection title="Entities" count={model.entities.length}>
        {/* Add Entity form */}
        <div className="flex gap-2">
          <input
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntity()}
            placeholder="Entity name"
            className={`flex-1 ${inputClass}`}
            data-testid="entity-name-input"
          />
          <button
            onClick={handleAddEntity}
            disabled={!entityName.trim()}
            className="shrink-0 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-entity-button"
          >
            Add
          </button>
        </div>

        {/* Entity list */}
        <div className="mt-3 flex flex-col gap-0.5">
          {model.entities.length === 0 && (
            <div className="text-center py-4">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-2 text-gray-300">
                <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
              </svg>
              <p className="text-gray-400 text-xs">No entities yet</p>
              <p className="text-gray-300 text-[11px]">Use the form above to add one</p>
            </div>
          )}
          {model.entities.map((e) => (
            <div
              key={e.id}
              onClick={() => setSelection({ type: 'entity', entityId: e.id })}
              className={`px-3 py-2 rounded-md cursor-pointer flex items-center gap-2 transition-colors
                ${selectedEntityId === e.id
                  ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                  : 'hover:bg-gray-50 text-gray-700'}`}
              data-testid={`entity-list-item-${e.id}`}
            >
              <span className="w-2 h-2 rounded-sm bg-primary-400 shrink-0" />
              <span className="truncate">{e.isWeak ? `⟨${e.name}⟩` : e.name}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Relationships ── */}
      <CollapsibleSection title="Relationships" count={model.relationships.length}>
        {/* Add Relationship form */}
        <div className="flex flex-col gap-2">
          <input
            value={relName}
            onChange={(e) => { setRelName(e.target.value); setRelError(''); }}
            placeholder="Relationship name"
            className={inputClass}
            data-testid="rel-name-input"
          />

          <select
            value={relEntity1}
            onChange={(e) => { setRelEntity1(e.target.value); setRelError(''); }}
            className={selectClass}
            data-testid="rel-entity1-select"
          >
            <option value="">Entity 1...</option>
            {model.entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
            {model.aggregations.map((a) => (
              <option key={`agg-${a.id}`} value={`agg:${a.id}`}>[Agg] {a.name}</option>
            ))}
          </select>

          {/* Cardinality 1 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min</label>
              <input
                value={relMin1}
                onChange={(e) => { setRelMin1(e.target.value); setRelError(''); }}
                className={`${inputClass} text-center`}
                placeholder="0"
                data-testid="rel-min1-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max</label>
              <input
                value={relMax1}
                onChange={(e) => { setRelMax1(e.target.value); setRelError(''); }}
                className={`${inputClass} text-center`}
                placeholder="*"
                data-testid="rel-max1-input"
              />
            </div>
          </div>

          <select
            value={relEntity2}
            onChange={(e) => { setRelEntity2(e.target.value); setRelError(''); }}
            className={selectClass}
            data-testid="rel-entity2-select"
          >
            <option value="">Entity 2...</option>
            {model.entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
            {model.aggregations.map((a) => (
              <option key={`agg-${a.id}`} value={`agg:${a.id}`}>[Agg] {a.name}</option>
            ))}
          </select>

          {/* Cardinality 2 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min</label>
              <input
                value={relMin2}
                onChange={(e) => { setRelMin2(e.target.value); setRelError(''); }}
                className={`${inputClass} text-center`}
                placeholder="0"
                data-testid="rel-min2-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max</label>
              <input
                value={relMax2}
                onChange={(e) => { setRelMax2(e.target.value); setRelError(''); }}
                className={`${inputClass} text-center`}
                placeholder="*"
                data-testid="rel-max2-input"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 py-1">
            <input
              type="checkbox"
              checked={relIdentifying}
              onChange={(e) => setRelIdentifying(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              data-testid="rel-identifying-checkbox"
            />
            Identifying
          </label>

          {relError && <p className="text-red-500 text-xs" data-testid="rel-error">{relError}</p>}

          <button
            onClick={handleAddRelationship}
            className={btnPrimary}
            data-testid="add-relationship-button"
          >
            Create Relationship
          </button>
        </div>

        {/* Relationship list */}
        <div className="mt-3 flex flex-col gap-0.5">
          {model.relationships.length === 0 && (
            <div className="text-center py-4">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-2 text-gray-300">
                <polygon points="16,4 28,16 16,28 4,16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
              </svg>
              <p className="text-gray-400 text-xs">No relationships yet</p>
              <p className="text-gray-300 text-[11px]">Add entities first, then create relationships</p>
            </div>
          )}
          {model.relationships.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelection({ type: 'relationship', relationshipId: r.id })}
              className={`px-3 py-2 rounded-md cursor-pointer flex items-center gap-2 transition-colors
                ${selectedRelId === r.id
                  ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                  : 'hover:bg-gray-50 text-gray-700'}`}
              data-testid={`rel-list-item-${r.id}`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0 text-amber-400">
                <polygon points="4,0 8,4 4,8 0,4" fill="currentColor" />
              </svg>
              <span className="truncate">{r.name}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Aggregations ── */}
      <CollapsibleSection title="Aggregations" count={model.aggregations.length} defaultOpen={false}>
        {/* Add Aggregation form */}
        <div className="flex flex-col gap-2">
          <input
            value={aggName}
            onChange={(e) => setAggName(e.target.value)}
            placeholder="Aggregation name"
            className={inputClass}
            data-testid="agg-name-input"
          />
          <select
            value={aggRelId}
            onChange={(e) => setAggRelId(e.target.value)}
            className={selectClass}
            data-testid="agg-rel-select"
          >
            <option value="">Relationship to aggregate...</option>
            {model.relationships.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!aggName.trim() || !aggRelId) return;
              const id = addAggregation(aggName.trim(), aggRelId);
              showToast(`Aggregation "${aggName.trim()}" created`, 'success');
              setAggName('');
              setAggRelId('');
              setSelection({ type: 'aggregation', aggregationId: id });
            }}
            disabled={!aggName.trim() || !aggRelId}
            className={btnPrimary}
            data-testid="add-agg-button"
          >
            Create Aggregation
          </button>
        </div>

        {/* Aggregation list */}
        <div className="mt-3 flex flex-col gap-0.5">
          {model.aggregations.length === 0 && (
            <div className="text-center py-4">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-2 text-gray-300">
                <rect x="6" y="6" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x="10" y="10" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
              </svg>
              <p className="text-gray-400 text-xs">No aggregations yet</p>
              <p className="text-gray-300 text-[11px]">Create relationships first</p>
            </div>
          )}
          {model.aggregations.map((a) => {
            const isSelected = selection?.type === 'aggregation' && selection.aggregationId === a.id;
            return (
              <div
                key={a.id}
                onClick={() => setSelection({ type: 'aggregation', aggregationId: a.id })}
                className={`px-3 py-2 rounded-md cursor-pointer flex items-center gap-2 transition-colors
                  ${isSelected
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'hover:bg-gray-50 text-gray-700'}`}
                data-testid={`agg-list-item-${a.id}`}
              >
                <span className="w-2 h-2 rounded-[1px] border border-emerald-400 shrink-0" />
                <span className="truncate">{a.name}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}
