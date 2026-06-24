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
    nodesep: 150,
    ranksep: 200,
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

  return { nodes: layoutedNodes, edges };
};
