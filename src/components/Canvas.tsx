import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  applyNodeChanges,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
  type NodeChange,
  type Node,
} from '@xyflow/react';
import { useERDStore } from '../ir/store';
import { chenRenderer } from '../renderer/chen/ChenRenderer';
import { crowsFootRenderer } from '../renderer/crowsfoot/CrowsFootRenderer';
import { ChenEntityNode } from '../renderer/chen/nodes/ChenEntityNode';
import { ChenAttributeNode } from '../renderer/chen/nodes/ChenAttributeNode';
import { ChenRelationshipNode } from '../renderer/chen/nodes/ChenRelationshipNode';
import { ChenAggregationNode } from '../renderer/chen/nodes/ChenAggregationNode';
import { ChenJunctionNode } from '../renderer/chen/nodes/ChenJunctionNode';
import { ChenEdge } from '../renderer/chen/edges/ChenEdge';
import { CrowsFootEntityNode } from '../renderer/crowsfoot/nodes/CrowsFootEntityNode';
import { CrowsFootEdge } from '../renderer/crowsfoot/edges/CrowsFootEdge';
import type { SelectionTarget } from '../ir/types';

const chenNodeTypes: NodeTypes = {
  chenEntity: ChenEntityNode,
  chenAttribute: ChenAttributeNode,
  chenRelationship: ChenRelationshipNode,
  chenAggregation: ChenAggregationNode,
  chenJunction: ChenJunctionNode,
};

const crowsfootNodeTypes: NodeTypes = {
  crowsfootEntity: CrowsFootEntityNode,
};

const chenEdgeTypes: EdgeTypes = {
  chenEdge: ChenEdge,
};

const crowsfootEdgeTypes: EdgeTypes = {
  crowsfootEdge: CrowsFootEdge,
};

export function handleNodeDragStop(
  nodeId: string,
  position: { x: number; y: number },
  updateEntity: (id: string, patch: { position: { x: number; y: number } }) => void,
  updateRelationship: (id: string, patch: { position: { x: number; y: number } }) => void,
  updateAggregation?: (id: string, patch: { position: { x: number; y: number } }) => void,
  aggregationIds?: Set<string>,
) {
  const parts = nodeId.split('::');
  const kind = parts[0];
  const id = parts[1];
  if (kind === 'entity') {
    // In crow's foot notation, aggregation nodes use entity:: prefix.
    // Check if this ID belongs to an aggregation before updating entity.
    if (aggregationIds?.has(id) && updateAggregation) {
      updateAggregation(id, { position });
    } else {
      updateEntity(id, { position });
    }
  } else if (kind === 'rel') {
    updateRelationship(id, { position });
  } else if (kind === 'agg' && updateAggregation) {
    updateAggregation(id, { position });
  }
}

export function handleNodeClick(nodeId: string): SelectionTarget {
  const parts = nodeId.split('::');
  const kind = parts[0];
  if (kind === 'entity') {
    return { type: 'entity', entityId: parts[1] };
  } else if (kind === 'rel') {
    return { type: 'relationship', relationshipId: parts[1] };
  } else if (kind === 'attr') {
    return { type: 'attribute', entityId: parts[1], attributeId: parts[2] };
  } else if (kind === 'relattr') {
    return { type: 'relAttribute', relationshipId: parts[1], attributeId: parts[2] };
  } else if (kind === 'agg') {
    return { type: 'aggregation', aggregationId: parts[1] };
  }
  return null;
}

function getSelectedNodeId(selection: SelectionTarget): string | null {
  if (!selection) return null;
  if (selection.type === 'entity') return `entity::${selection.entityId}`;
  if (selection.type === 'relationship') return `rel::${selection.relationshipId}`;
  if (selection.type === 'attribute') return `attr::${selection.entityId}::${selection.attributeId}`;
  if (selection.type === 'relAttribute') return `relattr::${selection.relationshipId}::${selection.attributeId}`;
  if (selection.type === 'aggregation') return `agg::${selection.aggregationId}`;
  return null;
}

export function Canvas() {
  const model = useERDStore((s) => s.model);
  const notation = useERDStore((s) => s.notation);
  const selection = useERDStore((s) => s.selection);
  const setSelection = useERDStore((s) => s.setSelection);
  const updateEntity = useERDStore((s) => s.updateEntity);
  const updateRelationship = useERDStore((s) => s.updateRelationship);
  const updateAggregation = useERDStore((s) => s.updateAggregation);
  const nodePositions = useERDStore((s) => s.nodePositions);
  const setNodePosition = useERDStore((s) => s.setNodePosition);

  // Build a set of aggregation IDs so drag handler can distinguish them from entities
  const aggregationIds = useMemo(
    () => new Set(model.aggregations.map((a) => a.id)),
    [model.aggregations],
  );

  const renderer = notation === 'chen' ? chenRenderer : crowsFootRenderer;
  const rendered = useMemo(() => renderer.render(model, nodePositions), [model, notation, nodePositions]);

  // Apply selection highlighting to nodes
  const selectedNodeId = getSelectedNodeId(selection);
  const renderedNodes = useMemo(() => {
    return rendered.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [rendered.nodes, selectedNodeId]);

  // Local node state for live dragging
  const [nodes, setNodes] = useState<Node[]>(renderedNodes);

  // Sync rendered output to local state when model/notation changes
  useEffect(() => {
    setNodes(renderedNodes);
  }, [renderedNodes]);

  const nodeTypes = notation === 'chen' ? chenNodeTypes : crowsfootNodeTypes;
  const edgeTypes = notation === 'chen' ? chenEdgeTypes : crowsfootEdgeTypes;

  // Handle node changes (dragging) live
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Update positions in store during drag so junction dots follow in real-time
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      handleNodeDragStop(node.id, node.position, updateEntity, updateRelationship, updateAggregation, aggregationIds);
      const kind = node.id.split('::')[0];
      const id = node.id.split('::')[1];
      if (kind === 'attr' || kind === 'relattr') {
        setNodePosition(node.id, node.position);
      }
      // In Chen notation, keep aggregation box and relationship diamond in sync
      if (notation === 'chen') {
        if (kind === 'agg') {
          const agg = model.aggregations.find((a) => a.id === id);
          if (agg) updateRelationship(agg.relationshipId, { position: node.position });
        } else if (kind === 'rel') {
          const agg = model.aggregations.find((a) => a.relationshipId === id);
          if (agg) updateAggregation(agg.id, { position: node.position });
        }
      }
    },
    [updateEntity, updateRelationship, updateAggregation, aggregationIds, setNodePosition, notation, model.aggregations]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      handleNodeDragStop(node.id, node.position, updateEntity, updateRelationship, updateAggregation, aggregationIds);
      const kind = node.id.split('::')[0];
      const id = node.id.split('::')[1];
      if (kind === 'attr' || kind === 'relattr') {
        setNodePosition(node.id, node.position);
      }
      // In Chen notation, keep aggregation box and relationship diamond in sync
      if (notation === 'chen') {
        if (kind === 'agg') {
          const agg = model.aggregations.find((a) => a.id === id);
          if (agg) updateRelationship(agg.relationshipId, { position: node.position });
        } else if (kind === 'rel') {
          const agg = model.aggregations.find((a) => a.relationshipId === id);
          if (agg) updateAggregation(agg.id, { position: node.position });
        }
      }
      // Select the dragged node
      const sel = handleNodeClick(node.id);
      setSelection(sel);
    },
    [updateEntity, updateRelationship, updateAggregation, aggregationIds, setNodePosition, setSelection, notation, model.aggregations]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const sel = handleNodeClick(node.id);
      setSelection(sel);
    },
    [setSelection]
  );

  const onPaneClick = useCallback(() => {
    setSelection(null);
  }, [setSelection]);

  const isEmpty = model.entities.length === 0 && model.relationships.length === 0;

  return (
    <div className="flex-1 h-full" data-testid="canvas">
      <ReactFlow
        nodes={nodes}
        edges={rendered.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          zoomable
          pannable
          nodeColor="#94a3b8"
          maskColor="rgba(0,0,0,0.08)"
          style={{ backgroundColor: '#f8fafc' }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#e2e8f0" />

        {/* Welcome overlay for empty canvas */}
        {isEmpty && (
          <Panel position="top-center">
            <div className="mt-24 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-8 max-w-sm text-center" style={{ animation: 'fade-in 0.3s ease-out' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto mb-4 text-primary-400">
                <rect x="4" y="6" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <rect x="22" y="24" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <polygon points="20,16 26,20 20,24 14,20" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M11 16v4h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M29 24v-4h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="text-base font-semibold text-gray-800 mb-2">Start Your ER Diagram</h3>
              <div className="text-sm text-gray-500 space-y-2 text-left">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Add an entity using the sidebar</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Define attributes and keys</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Create relationships between entities</span>
                </div>
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
