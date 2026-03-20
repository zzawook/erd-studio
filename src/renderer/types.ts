import type { Node, Edge } from '@xyflow/react';
import type { ERDModel } from '../ir/types';

export interface RendererOutput {
  nodes: Node[];
  edges: Edge[];
}

export interface Renderer {
  render(model: ERDModel, nodePositions?: Record<string, { x: number; y: number }>): RendererOutput;
}
