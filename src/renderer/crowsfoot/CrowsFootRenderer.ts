import type { Node, Edge } from '@xyflow/react';
import type { Renderer, RendererOutput } from '../types';
import type { ERDModel, Entity, Relationship } from '../../ir/types';
import type { CrowsFootEntityNodeData, ForeignKeyInfo } from './nodes/CrowsFootEntityNode';
import type { CrowsFootRelationshipNodeData } from './nodes/CrowsFootRelationshipNode';
import type { CrowsFootEdgeData } from './edges/CrowsFootEdge';
import { isMany, fkColumnName } from '../../utils/cardinality';
import { getHandlesForPair } from '../shared/getHandlesForPair';

/** Returns true if a relationship has 3 or more participants (n-ary). */
function isNary(rel: Relationship): boolean {
  return rel.participants.length > 2;
}

function computeForeignKeys(entity: Entity, model: ERDModel): ForeignKeyInfo[] {
  const fks: ForeignKeyInfo[] = [];

  for (const rel of model.relationships) {
    if (rel.participants.length < 2) continue;

    // N-ary relationships (3+) are handled via junction tables — no FK markers on entities
    if (isNary(rel)) continue;

    for (let i = 0; i < rel.participants.length; i++) {
      const participant = rel.participants[i];
      if (participant.entityId !== entity.id) continue;

      // This entity is in the relationship. Determine if it needs FK columns.
      // In a 1:N relationship, the "many" side gets the FK.
      // In a 1:1 relationship, the optional side gets the FK.
      // In M:N, both sides get FKs through a junction table (visual only, no FK markers).
      const otherParticipants = rel.participants.filter((_, idx) => idx !== i);

      for (const other of otherParticipants) {
        const otherEntity = model.entities.find((e) => e.id === other.entityId);
        if (!otherEntity) continue;

        const isMyManyVal = isMany(participant.cardinality);
        const isOtherManyVal = isMany(other.cardinality);

        // Many side gets FK in 1:N
        if (isMyManyVal && !isOtherManyVal) {
          const otherPk = otherEntity.candidateKeys.find((ck) => ck.isPrimary);
          if (otherPk) {
            for (const attrId of otherPk.attributeIds) {
              const attr = otherEntity.attributes.find((a) => a.id === attrId);
              if (attr) {
                fks.push({
                  attributeName: fkColumnName(otherEntity.name, attr.name),
                  referencedEntityName: otherEntity.name,
                });
              }
            }
          }
        }
        // 1:1 - optional side gets FK
        else if (!isMyManyVal && !isOtherManyVal) {
          const myMin = participant.cardinality.min;
          const otherMin = other.cardinality.min;
          if (myMin === 0 || (myMin === otherMin && entity.name > otherEntity.name)) {
            const otherPk = otherEntity.candidateKeys.find((ck) => ck.isPrimary);
            if (otherPk) {
              for (const attrId of otherPk.attributeIds) {
                const attr = otherEntity.attributes.find((a) => a.id === attrId);
                if (attr) {
                  fks.push({
                    attributeName: fkColumnName(otherEntity.name, attr.name),
                    referencedEntityName: otherEntity.name,
                  });
                }
              }
            }
          }
        }
        // M:N - no FK markers on entity (junction table handles it)
      }
    }
  }

  return fks;
}

export const crowsFootRenderer: Renderer = {
  render(model: ERDModel): RendererOutput {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Build position lookup for handle assignment
    const positionMap = new Map<string, { x: number; y: number }>();

    // Process entities
    for (const entity of model.entities) {
      const foreignKeys = computeForeignKeys(entity, model);

      const entityNode: Node<CrowsFootEntityNodeData> = {
        id: `entity::${entity.id}`,
        type: 'crowsfootEntity',
        position: entity.position,
        data: { entity, foreignKeys },
      };
      nodes.push(entityNode);
      positionMap.set(entity.id, entity.position);
    }

    // Process aggregations as virtual entity nodes
    for (const agg of model.aggregations) {
      const rel = model.relationships.find((r) => r.id === agg.relationshipId);
      if (!rel) continue;

      // Use the aggregation's persisted position
      const aggPosition = agg.position;

      // Create a virtual entity representing the aggregation
      const virtualEntity: Entity = {
        id: agg.id,
        name: `[${agg.name}]`,
        isWeak: false,
        attributes: [],
        candidateKeys: [],
        position: aggPosition,
      };

      const aggNode: Node<CrowsFootEntityNodeData> = {
        id: `entity::${agg.id}`,
        type: 'crowsfootEntity',
        position: aggPosition,
        data: { entity: virtualEntity, foreignKeys: [] },
      };
      nodes.push(aggNode);
      positionMap.set(agg.id, aggPosition);
    }

    // Process relationships as edges between entities
    for (const rel of model.relationships) {
      if (rel.participants.length < 2) continue;

      if (isNary(rel)) {
        // N-ary relationship: create a central relationship diamond node
        // and draw crow's foot edges from it to each participant entity
        const relNode: Node<CrowsFootRelationshipNodeData> = {
          id: `rel::${rel.id}`,
          type: 'crowsfootRelationship',
          position: rel.position,
          data: { relationship: rel },
        };
        nodes.push(relNode);

        for (let i = 0; i < rel.participants.length; i++) {
          const participant = rel.participants[i];
          const entityNodeId = `entity::${participant.entityId}`;
          const participantPos = positionMap.get(participant.entityId) ?? { x: 0, y: 0 };
          const handles = getHandlesForPair(rel.position, participantPos);

          const edge: Edge<CrowsFootEdgeData> = {
            id: `edge::${rel.id}::${participant.entityId}${participant.role ? `::${participant.role}` : ''}`,
            source: `rel::${rel.id}`,
            target: entityNodeId,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            type: 'crowsfootEdge',
            data: {
              relationship: rel,
              // Source side (relationship node) has no cardinality marker
              sourceCardinality: { min: 1, max: 1 },
              targetCardinality: participant.cardinality,
            },
          };
          edges.push(edge);
        }
      } else {
        // Binary relationship: direct edge between two entities
        const source = rel.participants[0];
        const target = rel.participants[1];

        const sourceNodeId = `entity::${source.entityId}`;
        const targetNodeId = `entity::${target.entityId}`;

        const sourcePos = positionMap.get(source.entityId) ?? { x: 0, y: 0 };
        const targetPos = positionMap.get(target.entityId) ?? { x: 0, y: 0 };
        const handles = getHandlesForPair(sourcePos, targetPos);

        const edge: Edge<CrowsFootEdgeData> = {
          id: `edge::${rel.id}`,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'crowsfootEdge',
          data: {
            relationship: rel,
            sourceCardinality: source.cardinality,
            targetCardinality: target.cardinality,
          },
        };
        edges.push(edge);
      }
    }

    return { nodes, edges };
  },
};
