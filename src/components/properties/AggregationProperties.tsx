import { useState, useEffect } from 'react';
import { useERDStore } from '../../ir/store';
import type { Aggregation } from '../../ir/types';

interface Props {
  aggregation: Aggregation;
}

export function AggregationProperties({ aggregation }: Props) {
  const model = useERDStore((s) => s.model);
  const updateAggregation = useERDStore((s) => s.updateAggregation);
  const deleteAggregation = useERDStore((s) => s.deleteAggregation);

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

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

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";

  return (
    <div className="flex flex-col gap-4" data-testid="aggregation-properties">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
        <input
          value={aggregation.name}
          onChange={(e) => updateAggregation(aggregation.id, { name: e.target.value })}
          className={inputClass}
          data-testid="agg-name-edit"
        />
      </div>

      {/* Aggregated Relationship */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Aggregated Relationship</label>
        <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-700">
          {rel?.name ?? 'Unknown'}
        </div>
      </div>

      {/* Participating entities */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Participants</label>
        <div className="flex flex-col gap-0.5">
          {participantNames.map((name, i) => (
            <div key={i} className="px-3 py-1.5 text-sm text-gray-700 bg-gray-50 rounded-md border border-gray-100">{name}</div>
          ))}
        </div>
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-xs text-blue-700 leading-relaxed">
          This aggregation treats the relationship "{rel?.name}" and its participating entities as a single unit that can participate in other relationships.
        </p>
      </div>

      {/* Delete */}
      <div className="border-t border-red-100 pt-4 mt-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors"
            data-testid="delete-agg-button"
          >
            Delete Aggregation
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
                deleteAggregation(aggregation.id);
                setConfirming(false);
              }}
              className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              style={{ animation: 'confirm-pulse 1.5s ease-in-out infinite' }}
              data-testid="delete-agg-button"
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
