import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 290;
const FIELD_HEIGHT = 38;
const HEADER_HEIGHT = 52;
const ENUM_VAL_HEIGHT = 30;

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 90,
    ranksep: 130,
  });

  nodes.forEach((node) => {
    let height = 150;
    if (node.type === 'model') {
      const fieldsCount = (node.data?.fields as any[])?.length || 0;
      height = HEADER_HEIGHT + (fieldsCount * FIELD_HEIGHT) + 20; // 20px padding
    } else if (node.type === 'enum') {
      const valuesCount = (node.data?.values as any[])?.length || 0;
      height = HEADER_HEIGHT + (valuesCount * ENUM_VAL_HEIGHT) + 20;
    }
    
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    let height = 150;
    if (node.type === 'model') {
      const fieldsCount = (node.data?.fields as any[])?.length || 0;
      height = HEADER_HEIGHT + (fieldsCount * FIELD_HEIGHT) + 20;
    } else if (node.type === 'enum') {
      const valuesCount = (node.data?.values as any[])?.length || 0;
      height = HEADER_HEIGHT + (valuesCount * ENUM_VAL_HEIGHT) + 20;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  // Create a map of node positions for quick lookup
  const nodePositionMap = new Map<string, { x: number; y: number }>();
  layoutedNodes.forEach((node) => {
    nodePositionMap.set(node.id, node.position);
  });

  // Dynamically route edges to inner-facing handles
  const layoutedEdges = edges.map((edge) => {
    const sourcePos = nodePositionMap.get(edge.source);
    const targetPos = nodePositionMap.get(edge.target);

    if (!sourcePos || !targetPos) return edge;

    // Check if the source and target nodes are vertically stacked (aligned in the same column)
    const isVerticallyStacked = Math.abs(sourcePos.x - targetPos.x) < 20;
    
    let sourceSuffix = '';
    let targetSuffix = '';

    if (isVerticallyStacked) {
      // Vertically stacked: use the same side for both source and target handles
      // to route the line straight down the side of the cards without crossing them.
      // Deterministically hash the edge ID to distribute connections between left and right sides.
      let hash = 0;
      for (let i = 0; i < edge.id.length; i++) {
        hash = edge.id.charCodeAt(i) + ((hash << 5) - hash);
      }
      const useLeft = Math.abs(hash) % 2 === 0;
      const side = useLeft ? '-left' : '-right';
      sourceSuffix = side;
      targetSuffix = side;
    } else {
      // Horizontally separated: use facing sides (inner-facing)
      const isSourceLeft = sourcePos.x < targetPos.x;
      sourceSuffix = isSourceLeft ? '-right' : '-left';
      targetSuffix = isSourceLeft ? '-left' : '-right';
    }

    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    if (sourceHandle) {
      const base = sourceHandle.replace(/-left|-right/g, '');
      sourceHandle = `${base}${sourceSuffix}`;
    }

    if (targetHandle) {
      const base = targetHandle.replace(/-left|-right/g, '');
      targetHandle = `${base}${targetSuffix}`;
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });

  // Group and assign sequential channel indices to prevent any overlaps/collisions
  const channelEdges: { [key: string]: string[] } = {};

  layoutedEdges.forEach((edge) => {
    const isSourceLeft = edge.sourceHandle?.endsWith('-left');
    const sourceKey = `${edge.source}__${isSourceLeft ? 'left' : 'right'}`;
    if (!channelEdges[sourceKey]) channelEdges[sourceKey] = [];
    if (!channelEdges[sourceKey].includes(edge.id)) {
      channelEdges[sourceKey].push(edge.id);
    }

    const isTargetLeft = edge.targetHandle?.endsWith('-left');
    const targetKey = `${edge.target}__${isTargetLeft ? 'left' : 'right'}`;
    if (!channelEdges[targetKey]) channelEdges[targetKey] = [];
    if (!channelEdges[targetKey].includes(edge.id)) {
      channelEdges[targetKey].push(edge.id);
    }
  });

  // Sort each group alphabetically by ID to keep indices stable and deterministic
  for (const key in channelEdges) {
    channelEdges[key].sort();
  }

  const finalEdges = layoutedEdges.map((edge) => {
    const isSourceLeft = edge.sourceHandle?.endsWith('-left');
    const sourceKey = `${edge.source}__${isSourceLeft ? 'left' : 'right'}`;
    const sourceChannelIndex = channelEdges[sourceKey].indexOf(edge.id);

    const isTargetLeft = edge.targetHandle?.endsWith('-left');
    const targetKey = `${edge.target}__${isTargetLeft ? 'left' : 'right'}`;
    const targetChannelIndex = channelEdges[targetKey].indexOf(edge.id);

    return {
      ...edge,
      data: {
        ...edge.data,
        sourceChannelIndex,
        targetChannelIndex,
      },
    };
  });

  return { nodes: layoutedNodes, edges: finalEdges };
};
