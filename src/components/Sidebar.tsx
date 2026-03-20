import { useState } from 'react';
import { useERDStore } from '../ir/store';
import type { Participant } from '../ir/types';
import { validateCardinality } from '../utils/validation';

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
  };

  const selectedEntityId = selection && selection.type === 'entity' ? selection.entityId
    : selection && selection.type === 'attribute' ? selection.entityId
    : null;
  const selectedRelId = selection && selection.type === 'relationship' ? selection.relationshipId
    : selection && selection.type === 'relAttribute' ? selection.relationshipId
    : null;

  return (
    <div className="h-full w-full border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto flex flex-col gap-4 text-xs [scrollbar-gutter:stable]" data-testid="sidebar">
      {/* Add Entity */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Add Entity</h3>
        <div className="flex gap-1">
          <input
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntity()}
            placeholder="Entity name"
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            data-testid="entity-name-input"
          />
          <button
            onClick={handleAddEntity}
            disabled={!entityName.trim()}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-entity-button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Add Relationship */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Add Relationship</h3>
        <div className="flex flex-col gap-1">
          <input
            value={relName}
            onChange={(e) => { setRelName(e.target.value); setRelError(''); }}
            placeholder="Relationship name"
            className="px-2 py-1 border border-gray-300 rounded"
            data-testid="rel-name-input"
          />

          <select
            value={relEntity1}
            onChange={(e) => { setRelEntity1(e.target.value); setRelError(''); }}
            className="px-2 py-1 border border-gray-300 rounded"
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

          <div className="flex gap-1 items-center">
            <label className="text-gray-500 w-5 shrink-0">min</label>
            <input
              value={relMin1}
              onChange={(e) => { setRelMin1(e.target.value); setRelError(''); }}
              className="flex-1 min-w-[40px] px-1 py-0.5 border border-gray-300 rounded text-center"
              data-testid="rel-min1-input"
            />
            <label className="text-gray-500 w-5 shrink-0">max</label>
            <input
              value={relMax1}
              onChange={(e) => { setRelMax1(e.target.value); setRelError(''); }}
              className="flex-1 min-w-[40px] px-1 py-0.5 border border-gray-300 rounded text-center"
              data-testid="rel-max1-input"
            />
          </div>

          <select
            value={relEntity2}
            onChange={(e) => { setRelEntity2(e.target.value); setRelError(''); }}
            className="px-2 py-1 border border-gray-300 rounded"
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

          <div className="flex gap-1 items-center">
            <label className="text-gray-500 w-5 shrink-0">min</label>
            <input
              value={relMin2}
              onChange={(e) => { setRelMin2(e.target.value); setRelError(''); }}
              className="flex-1 min-w-[40px] px-1 py-0.5 border border-gray-300 rounded text-center"
              data-testid="rel-min2-input"
            />
            <label className="text-gray-500 w-5 shrink-0">max</label>
            <input
              value={relMax2}
              onChange={(e) => { setRelMax2(e.target.value); setRelError(''); }}
              className="flex-1 min-w-[40px] px-1 py-0.5 border border-gray-300 rounded text-center"
              data-testid="rel-max2-input"
            />
          </div>

          <label className="flex items-center gap-1 text-gray-600">
            <input
              type="checkbox"
              checked={relIdentifying}
              onChange={(e) => setRelIdentifying(e.target.checked)}
              data-testid="rel-identifying-checkbox"
            />
            Identifying
          </label>

          {relError && <p className="text-red-500 text-[10px]" data-testid="rel-error">{relError}</p>}

          <button
            onClick={handleAddRelationship}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="add-relationship-button"
          >
            Create
          </button>
        </div>
      </div>

      {/* Entity list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Entities</h3>
        {model.entities.length === 0 && <p className="text-gray-400 italic">None</p>}
        {model.entities.map((e) => (
          <div
            key={e.id}
            onClick={() => setSelection({ type: 'entity', entityId: e.id })}
            className={`px-2 py-1 rounded cursor-pointer truncate
              ${selectedEntityId === e.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'}`}
            data-testid={`entity-list-item-${e.id}`}
          >
            {e.isWeak ? `⟨${e.name}⟩` : e.name}
          </div>
        ))}
      </div>

      {/* Relationship list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Relationships</h3>
        {model.relationships.length === 0 && <p className="text-gray-400 italic">None</p>}
        {model.relationships.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelection({ type: 'relationship', relationshipId: r.id })}
            className={`px-2 py-1 rounded cursor-pointer truncate
              ${selectedRelId === r.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'}`}
            data-testid={`rel-list-item-${r.id}`}
          >
            {r.name}
          </div>
        ))}
      </div>

      {/* Add Aggregation */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Add Aggregation</h3>
        <div className="flex flex-col gap-1">
          <input
            value={aggName}
            onChange={(e) => setAggName(e.target.value)}
            placeholder="Aggregation name"
            className="px-2 py-1 border border-gray-300 rounded"
            data-testid="agg-name-input"
          />
          <select
            value={aggRelId}
            onChange={(e) => setAggRelId(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded"
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
              setAggName('');
              setAggRelId('');
              setSelection({ type: 'aggregation', aggregationId: id });
            }}
            disabled={!aggName.trim() || !aggRelId}
            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="add-agg-button"
          >
            Create
          </button>
        </div>
      </div>

      {/* Aggregation list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-1">Aggregations</h3>
        {model.aggregations.length === 0 && <p className="text-gray-400 italic">None</p>}
        {model.aggregations.map((a) => {
          const isSelected = selection?.type === 'aggregation' && selection.aggregationId === a.id;
          return (
            <div
              key={a.id}
              onClick={() => setSelection({ type: 'aggregation', aggregationId: a.id })}
              className={`px-2 py-1 rounded cursor-pointer truncate
                ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'}`}
              data-testid={`agg-list-item-${a.id}`}
            >
              {a.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
