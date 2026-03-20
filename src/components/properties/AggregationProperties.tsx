import { useERDStore } from '../../ir/store';
import type { Aggregation } from '../../ir/types';

interface Props {
  aggregation: Aggregation;
}

export function AggregationProperties({ aggregation }: Props) {
  const model = useERDStore((s) => s.model);
  const updateAggregation = useERDStore((s) => s.updateAggregation);
  const deleteAggregation = useERDStore((s) => s.deleteAggregation);

  const rel = model.relationships.find((r) => r.id === aggregation.relationshipId);

  const participantNames = rel
    ? rel.participants.map((p) => {
        if (p.isAggregation) {
          const agg = model.aggregations.find((a) => a.id === p.entityId);
          return agg ? `[Agg] ${agg.name}` : '?';
        }
        const entity = model.entities.find((e) => e.id === p.entityId);
        return entity?.name ?? '?';
      })
    : [];

  return (
    <div className="flex flex-col gap-3" data-testid="aggregation-properties">
      {/* Name */}
      <div>
        <label className="block text-gray-600 mb-0.5">Name</label>
        <input
          value={aggregation.name}
          onChange={(e) => updateAggregation(aggregation.id, { name: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          data-testid="agg-name-edit"
        />
      </div>

      {/* Aggregated Relationship */}
      <div>
        <label className="block text-gray-600 mb-0.5">Aggregated Relationship</label>
        <div className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
          {rel?.name ?? 'Unknown'}
        </div>
      </div>

      {/* Participating entities */}
      <div>
        <label className="block text-gray-600 mb-0.5">Participants</label>
        {participantNames.map((name, i) => (
          <div key={i} className="px-2 py-0.5 text-gray-700">{name}</div>
        ))}
      </div>

      {/* Info */}
      <div className="text-gray-400 text-[10px] italic">
        This aggregation treats the relationship "{rel?.name}" and its participating entities as a single unit that can participate in other relationships.
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          if (window.confirm(`Delete aggregation "${aggregation.name}"?`)) {
            deleteAggregation(aggregation.id);
          }
        }}
        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 mt-2"
        data-testid="delete-agg-button"
      >
        Delete Aggregation
      </button>
    </div>
  );
}
