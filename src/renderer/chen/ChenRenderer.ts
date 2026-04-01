import type { Node, Edge } from '@xyflow/react';
import type { Renderer, RendererOutput } from '../types';
import type { ERDModel, Entity, Relationship, Attribute } from '../../ir/types';
import type { ChenEntityNodeData } from './nodes/ChenEntityNode';
import type { ChenAttributeNodeData } from './nodes/ChenAttributeNode';
import type { ChenRelationshipNodeData } from './nodes/ChenRelationshipNode';
import type { ChenAggregationNodeData } from './nodes/ChenAggregationNode';
import type { ChenJunctionNodeData } from './nodes/ChenJunctionNode';
import type { ChenEdgeData } from './edges/ChenEdge';
import { getHandlesForPair } from '../shared/getHandlesForPair';

const ATTR_RADIUS = 120;
const ATTR_START_ANGLE = -Math.PI / 2;
const AGG_PADDING = 40;

function computeAttributePosition(
  parentPos: { x: number; y: number },
  index: number,
  total: number,
): { x: number; y: number } {
  if (total === 0) return parentPos;
  const angleStep = (2 * Math.PI) / Math.max(total, 1);
  const angle = ATTR_START_ANGLE + index * angleStep;
  return {
    x: parentPos.x + ATTR_RADIUS * Math.cos(angle),
    y: parentPos.y + ATTR_RADIUS * Math.sin(angle),
  };
}

// Approximate node dimensions for handle position calculation
const ENTITY_W = 100;
const ENTITY_H = 40;
const REL_W = 120;
const REL_H = 80;

/**
 * Get the approximate exit point of a handle on a node,
 * given the node's top-left position and the handle side.
 */
function getHandleExitPoint(
  nodePos: { x: number; y: number },
  side: 'top' | 'bottom' | 'left' | 'right',
  nodeType: 'entity' | 'relationship',
): { x: number; y: number } {
  const w = nodeType === 'relationship' ? REL_W : ENTITY_W;
  const h = nodeType === 'relationship' ? REL_H : ENTITY_H;
  switch (side) {
    case 'top':    return { x: nodePos.x + w / 2, y: nodePos.y };
    case 'bottom': return { x: nodePos.x + w / 2, y: nodePos.y + h };
    case 'left':   return { x: nodePos.x,         y: nodePos.y + h / 2 };
    case 'right':  return { x: nodePos.x + w,     y: nodePos.y + h / 2 };
  }
}

/**
 * Extract which side a handle ID refers to.
 */
function handleSide(handleId: string): 'top' | 'bottom' | 'left' | 'right' {
  if (handleId.startsWith('top')) return 'top';
  if (handleId.startsWith('bottom')) return 'bottom';
  if (handleId.startsWith('left')) return 'left';
  return 'right';
}

function isAttributeInPrimaryKey(entity: Entity, attrId: string): boolean {
  return entity.candidateKeys.some(
    (ck) => ck.isPrimary && ck.attributeIds.includes(attrId)
  );
}

export const chenRenderer: Renderer = {
  render(model: ERDModel, nodePositions?: Record<string, { x: number; y: number }>): RendererOutput {
    const pos = nodePositions ?? {};
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Process aggregations — box wraps only the relationship diamond (per CS4221 L02 slide 17)
    for (const agg of model.aggregations) {
      const rel = model.relationships.find((r) => r.id === agg.relationshipId);
      if (!rel) continue;

      // Box wraps just the relationship diamond, no padding
      const aggNode: Node<ChenAggregationNodeData> = {
        id: `agg::${agg.id}`,
        type: 'chenAggregation',
        position: agg.position,
        data: {
          aggregation: agg,
          width: REL_W,
          height: REL_H,
        },
        style: { zIndex: -1 },
        draggable: false,
      };
      nodes.push(aggNode);
    }

    // Find identifying relationship and dominant entity for each weak entity
    // Also track which rel→entity edges need a junction node for partial keys
    const weakEntityInfo = new Map<string, {
      relId: string;
      relPos: { x: number; y: number };
      dominantEntityId: string;
      dominantPos: { x: number; y: number };
      junctionId: string;
    }>();
    for (const entity of model.entities) {
      if (!entity.isWeak) continue;
      if (!entity.attributes.some((a) => a.isPartialKey)) continue;
      const identRel = model.relationships.find(
        (r) => r.isIdentifying && r.participants.some((p) => p.entityId === entity.id && !p.isAggregation)
      );
      if (!identRel) continue;
      const dominantParticipant = identRel.participants.find((p) => p.entityId !== entity.id);
      const dominantEntity = dominantParticipant ? model.entities.find((e) => e.id === dominantParticipant.entityId) : null;
      if (dominantEntity) {
        const junctionId = `junction::${identRel.id}::${dominantEntity.id}`;
        weakEntityInfo.set(entity.id, {
          relId: identRel.id,
          relPos: identRel.position,
          dominantEntityId: dominantEntity.id,
          dominantPos: dominantEntity.position,
          junctionId,
        });

        // Compute junction on the actual handle-to-handle line
        const erHandlesForJunction = getHandlesForPair(dominantEntity.position, identRel.position);
        const relExit = getHandleExitPoint(
          identRel.position,
          handleSide(erHandlesForJunction.targetHandle),
          'relationship',
        );
        const domExit = getHandleExitPoint(
          dominantEntity.position,
          handleSide(erHandlesForJunction.sourceHandle),
          'entity',
        );
        const midX = (relExit.x + domExit.x) / 2;
        const midY = (relExit.y + domExit.y) / 2;
        // Offset by half the junction dot size (w-2 = 8px → 4px) so it centers on the line
        const junctionNode: Node<ChenJunctionNodeData> = {
          id: junctionId,
          type: 'chenJunction',
          position: { x: midX - 4, y: midY - 4 },
          data: {},
          draggable: false,
        };
        nodes.push(junctionNode);
      }
    }
    // No edge splitting — junction dots just sit on top of the straight line

    // Process entities
    for (const entity of model.entities) {
      const entityNode: Node<ChenEntityNodeData> = {
        id: `entity::${entity.id}`,
        type: 'chenEntity',
        position: entity.position,
        data: { entity },
      };
      nodes.push(entityNode);

      // Separate partial key attrs from normal attrs for positioning
      const normalAttrs = entity.attributes.filter((a) => !a.isPartialKey);
      const partialKeyAttrs = entity.attributes.filter((a) => a.isPartialKey);

      // Normal attribute nodes (connected to entity)
      for (let i = 0; i < normalAttrs.length; i++) {
        const attr = normalAttrs[i];
        const isPrimaryKey = isAttributeInPrimaryKey(entity, attr.id);

        const attrNodeId = `attr::${entity.id}::${attr.id}`;
        const attrPosition = pos[attrNodeId] ?? computeAttributePosition(entity.position, i, normalAttrs.length);
        const attrNode: Node<ChenAttributeNodeData> = {
          id: attrNodeId,
          type: 'chenAttribute',
          position: attrPosition,
          data: {
            attribute: attr,
            entityId: entity.id,
            isPrimaryKey,
            isPartialKey: false,
          },
          draggable: true,
        };
        nodes.push(attrNode);

        const handles = getHandlesForPair(entity.position, attrPosition);
        const attrEdge: Edge<ChenEdgeData> = {
          id: `edge::ea::${entity.id}::${attr.id}`,
          source: `entity::${entity.id}`,
          target: `attr::${entity.id}::${attr.id}`,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'chenEdge',
          data: { edgeKind: 'entity-attribute', isDerived: attr.kind === 'derived' },
        };
        edges.push(attrEdge);
      }

      // Partial key attribute nodes:
      // 1. Connected to the weak entity (like any normal attribute)
      // 2. ALSO connected to the junction node on the rel→dominant entity line
      const wInfo = weakEntityInfo.get(entity.id);
      for (let i = 0; i < partialKeyAttrs.length; i++) {
        const attr = partialKeyAttrs[i];
        const attrNodeId = `attr::${entity.id}::${attr.id}`;

        // Position near the entity like a normal attribute
        const attrPosition = pos[attrNodeId] ?? computeAttributePosition(
          entity.position, normalAttrs.length + i, normalAttrs.length + partialKeyAttrs.length
        );
        const attrNode: Node<ChenAttributeNodeData> = {
          id: attrNodeId,
          type: 'chenAttribute',
          position: attrPosition,
          data: {
            attribute: attr,
            entityId: entity.id,
            isPrimaryKey: false,
            isPartialKey: true,
          },
          draggable: true,
        };
        nodes.push(attrNode);

        // Edge 1: entity → partial key attribute (normal attribute connection)
        const entityHandles = getHandlesForPair(entity.position, attrPosition);
        edges.push({
          id: `edge::ea::${entity.id}::${attr.id}`,
          source: `entity::${entity.id}`,
          target: attrNodeId,
          sourceHandle: entityHandles.sourceHandle,
          targetHandle: entityHandles.targetHandle,
          type: 'chenEdge',
          data: { edgeKind: 'entity-attribute' },
        });

        // Edge 2: partial key attribute → junction node (branches to the participation line)
        if (wInfo) {
          // Use same handle-to-handle calculation for the junction position
          const pkHandles = getHandlesForPair(wInfo.dominantPos, wInfo.relPos);
          const pkRelExit = getHandleExitPoint(wInfo.relPos, handleSide(pkHandles.targetHandle), 'relationship');
          const pkDomExit = getHandleExitPoint(wInfo.dominantPos, handleSide(pkHandles.sourceHandle), 'entity');
          const junctionPos = {
            x: (pkRelExit.x + pkDomExit.x) / 2,
            y: (pkRelExit.y + pkDomExit.y) / 2,
          };
          const junctionHandles = getHandlesForPair(attrPosition, junctionPos);
          edges.push({
            id: `edge::pk::${entity.id}::${attr.id}`,
            source: attrNodeId,
            target: wInfo.junctionId,
            sourceHandle: junctionHandles.sourceHandle,
            targetHandle: junctionHandles.targetHandle,
            type: 'chenEdge',
            data: { edgeKind: 'entity-attribute' },
          });
        }
      }
    }

    // Process relationships
    for (const rel of model.relationships) {
      const relNode: Node<ChenRelationshipNodeData> = {
        id: `rel::${rel.id}`,
        type: 'chenRelationship',
        position: rel.position,
        data: { relationship: rel },
      };
      nodes.push(relNode);

      // Edges: participant → relationship (with cardinality)
      for (const participant of rel.participants) {
        const sourceId = participant.isAggregation
          ? `agg::${participant.entityId}`
          : `entity::${participant.entityId}`;

        // Find participant position to compute handles
        let participantPos = rel.position; // fallback
        if (participant.isAggregation) {
          const agg = model.aggregations.find((a) => a.id === participant.entityId);
          const aggRel = agg ? model.relationships.find((r) => r.id === agg.relationshipId) : null;
          if (aggRel) participantPos = aggRel.position;
        } else {
          const entity = model.entities.find((e) => e.id === participant.entityId);
          if (entity) participantPos = entity.position;
        }

        // Straight edge from entity to relationship (junction dot sits on top visually)
        const erHandles = getHandlesForPair(participantPos, rel.position);

        const erEdge: Edge<ChenEdgeData> = {
          id: `edge::er::${rel.id}::${participant.entityId}${participant.role ? `::${participant.role}` : ''}`,
          source: sourceId,
          target: `rel::${rel.id}`,
          sourceHandle: erHandles.sourceHandle,
          targetHandle: erHandles.targetHandle,
          type: 'chenEdge',
          data: {
            edgeKind: 'entity-relationship',
            cardinality: participant.cardinality,
            role: participant.role,
          },
        };
        edges.push(erEdge);
      }

      // Relationship attribute nodes
      for (let i = 0; i < rel.attributes.length; i++) {
        const attr = rel.attributes[i];
        const relAttrNodeId = `relattr::${rel.id}::${attr.id}`;
        const relAttrPosition = pos[relAttrNodeId] ?? computeAttributePosition(rel.position, i, rel.attributes.length);
        const attrNode: Node<ChenAttributeNodeData> = {
          id: relAttrNodeId,
          type: 'chenAttribute',
          position: relAttrPosition,
          data: {
            attribute: attr,
            relationshipId: rel.id,
            isPrimaryKey: false,
            isPartialKey: false,
          },
          draggable: true,
        };
        nodes.push(attrNode);

        const relAttrHandles = getHandlesForPair(rel.position, relAttrPosition);
        const raEdge: Edge<ChenEdgeData> = {
          id: `edge::ra::${rel.id}::${attr.id}`,
          source: `rel::${rel.id}`,
          target: `relattr::${rel.id}::${attr.id}`,
          sourceHandle: relAttrHandles.sourceHandle,
          targetHandle: relAttrHandles.targetHandle,
          type: 'chenEdge',
          data: { edgeKind: 'relationship-attribute' },
        };
        edges.push(raEdge);
      }
    }

    return { nodes, edges };
  },
};
