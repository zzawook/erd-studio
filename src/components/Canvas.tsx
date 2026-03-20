import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
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
) {
  const parts = nodeId.split('::');
  const kind = parts[0];
  const id = parts[1];
  if (kind === 'entity') {
    updateEntity(id, { position });
  } else if (kind === 'rel') {
    updateRelationship(id, { position });
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
  const nodePositions = useERDStore((s) => s.nodePositions);
  const setNodePosition = useERDStore((s) => s.setNodePosition);

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
      handleNodeDragStop(node.id, node.position, updateEntity, updateRelationship);
      const kind = node.id.split('::')[0];
      if (kind === 'attr' || kind === 'relattr') {
        setNodePosition(node.id, node.position);
      }
    },
    [updateEntity, updateRelationship, setNodePosition]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      handleNodeDragStop(node.id, node.position, updateEntity, updateRelationship);
      const kind = node.id.split('::')[0];
      if (kind === 'attr' || kind === 'relattr') {
        setNodePosition(node.id, node.position);
      }
      // Select the dragged node
      const sel = handleNodeClick(node.id);
      setSelection(sel);
    },
    [updateEntity, updateRelationship, setNodePosition, setSelection]
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
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
