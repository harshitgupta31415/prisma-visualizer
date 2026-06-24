import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  MarkerType,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { 
  Download, 
  Maximize2, 
  LayoutGrid, 
  ArrowUpDown, 
  ArrowLeftRight,
  Search,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { PrismaSchema } from '../utils/prismaParser';
import { getLayoutedElements } from '../utils/layout';
import { ModelNode } from './ModelNode';
import { EnumNode } from './EnumNode';
import { StraightFlowEdge } from './StraightFlowEdge';

const nodeTypes = {
  model: ModelNode,
  enum: EnumNode,
};

const edgeTypes = {
  straightFlow: StraightFlowEdge,
};

interface VisualizerProps {
  schema: PrismaSchema;
  focusedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectElement?: (nodeName: string, fieldName?: string) => void;
}

const VisualizerContent = ({ schema, focusedNodeId, onSelectNode, onSelectElement }: VisualizerProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, setViewport, getViewport } = useReactFlow();
  const [layoutDir, setLayoutDir] = useState<'TB' | 'LR'>('TB');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate React Flow elements from Prisma Schema
  const buildElements = useCallback(() => {
    const newNodes: any[] = [];
    const newEdges: any[] = [];
    const processedRelations = new Set<string>();

    // 1. Create nodes for Models
    schema.models.forEach((model) => {
      newNodes.push({
        id: model.name,
        type: 'model',
        data: {
          name: model.name,
          fields: model.fields,
          documentation: model.documentation,
          onSelectElement,
        },
        position: { x: 0, y: 0 },
      });
    });

    // 2. Create nodes for Enums
    schema.enums.forEach((enumData) => {
      newNodes.push({
        id: enumData.name,
        type: 'enum',
        data: {
          name: enumData.name,
          values: enumData.values,
          documentation: enumData.documentation,
          onSelectElement,
        },
        position: { x: 0, y: 0 },
      });
    });

    // 3. Create edges
    schema.models.forEach((model) => {
      model.fields.forEach((field) => {
        // If it's a relation field
        if (field.isRelation) {
          if (field.relationFields && field.relationFields.length > 0 && field.relationReferences) {
            // Explicit relation: FK -> PK
            field.relationFields.forEach((fk, idx) => {
              const pk = field.relationReferences![idx] || 'id';
              const edgeId = `rel__${model.name}.${fk}__to__${field.type}.${pk}`;
              
              if (!processedRelations.has(edgeId)) {
                processedRelations.add(edgeId);
                newEdges.push({
                  id: edgeId,
                  source: model.name,
                  sourceHandle: `${fk}-source-right`,
                  target: field.type,
                  targetHandle: `${pk}-target-left`,
                  animated: true,
                  type: 'straightFlow',
                  data: {
                    type: 'relation',
                    fk,
                    pk,
                    direction: layoutDir,
                  },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    color: '#f472b6',
                  },
                  style: { stroke: '#f472b6', strokeWidth: 3 },
                });
              }
            });
          } else {
            // Check for many-to-many implicit relation
            const targetModel = schema.models.find(m => m.name === field.type);
            if (targetModel) {
              const targetField = targetModel.fields.find(f => f.type === model.name);
              if (field.isList && targetField?.isList) {
                const relationKey = `m2m__${[model.name, field.type].sort().join('__to__')}`;
                
                if (!processedRelations.has(relationKey)) {
                  processedRelations.add(relationKey);
                  newEdges.push({
                    id: relationKey,
                    source: model.name,
                    sourceHandle: `${field.name}-source-right`,
                    target: field.type,
                    targetHandle: `${targetField.name}-target-left`,
                    animated: true,
                    type: 'straightFlow',
                    className: 'edge-m2m',
                    data: { type: 'm2m', direction: layoutDir },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      width: 12,
                      height: 12,
                      color: '#22d3ee',
                    },
                    style: { stroke: '#22d3ee', strokeWidth: 2.8, strokeDasharray: '6,6' },
                  });
                }
              }
            }
          }
        } else {
          // Check if the field references an Enum
          const isEnum = schema.enums.some((e) => e.name === field.type);
          if (isEnum) {
            const edgeId = `enum__${model.name}.${field.name}__to__${field.type}`;
            if (!processedRelations.has(edgeId)) {
              processedRelations.add(edgeId);
              newEdges.push({
                id: edgeId,
                source: model.name,
                sourceHandle: `${field.name}-source-right`,
                target: field.type,
                targetHandle: `${field.type}-enum-target-left`,
                animated: false,
                type: 'straightFlow',
                data: { type: 'enum', direction: layoutDir },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 12,
                  height: 12,
                  color: '#34d399',
                },
                style: { stroke: '#34d399', strokeWidth: 2.8 },
              });
            }
          }
        }
      });
    });

    // Apply layout
    const layouted = getLayoutedElements(newNodes, newEdges, layoutDir);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    // Zoom to fit
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 800 });
    }, 50);
  }, [schema, layoutDir, setNodes, setEdges, fitView, onSelectElement]);

  // Build elements when schema or layout changes
  useEffect(() => {
    buildElements();
  }, [schema, layoutDir, buildElements]);

  // Smooth focus on searched node
  useEffect(() => {
    if (focusedNodeId) {
      fitView({
        nodes: [{ id: focusedNodeId }],
        duration: 800,
        minZoom: 1.1,
        maxZoom: 1.3,
      });
      // Highlight the focused node
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            active: n.id === focusedNodeId,
          },
        }))
      );
    } else {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            active: false,
          },
        }))
      );
    }
  }, [focusedNodeId, fitView, setNodes]);

  // Focus effect for hover states (highlights hovered nodes/edges and dims others)
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: any) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
    setSelectedEdgeId(edge.id);
    onSelectNode(null);
  }, [onSelectNode]);

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
    setSelectedEdgeId(null);
  }, [onSelectNode]);

  // Compute node and edge styling overrides based on hover / selection states
  const targetHandlesWithMarker = new Set<string>();

  const updatedEdges = edges.map((edge) => {
    const activeNodeId = hoveredNodeId || focusedNodeId;
    
    // Determine if this edge should be highlighted or dimmed
    let isHighlighted = false;
    let isDimmed = false;

    if (activeNodeId) {
      const isConnected = edge.source === activeNodeId || edge.target === activeNodeId;
      isHighlighted = isConnected;
      isDimmed = !isConnected;
    } else if (selectedEdgeId) {
      const selectedEdge = edges.find(e => e.id === selectedEdgeId);
      const isSelected = edge.id === selectedEdgeId;
      
      // If the edge shares the same target and targetHandle as the selected edge,
      // it merges into the same line, so we highlight it too!
      const isMergedWithSelected = !!(selectedEdge && 
        edge.target === selectedEdge.target && 
        edge.targetHandle === selectedEdge.targetHandle);

      isHighlighted = isSelected || isMergedWithSelected;
      isDimmed = !isHighlighted;
    }

    let strokeColor = '#475569';
    let strokeWidth = 2.8;
    let animated = false;
    let className = edge.className || '';

    if (isHighlighted) {
      animated = true;
      strokeWidth = 8.0; // Thicker focused edge for high visibility on zoom-out
      className = `${edge.className || ''} react-flow__edge-hovered`.trim();
      
      if (edge.data?.type === 'relation') {
        strokeColor = '#ff2a85'; // Ultra Bright Neon Pink
      } else if (edge.data?.type === 'm2m') {
        strokeColor = '#00f0ff'; // Ultra Bright Neon Cyan
      } else {
        strokeColor = '#00ff87'; // Ultra Bright Neon Emerald Green
      }
    } else if (isDimmed) {
      strokeColor = 'rgba(100, 116, 139, 0.05)'; // Deeply dimmed line to make active paths stand out
      strokeWidth = 1.0;
    } else {
      // Default state: animate relations, standard width
      animated = edge.data?.type === 'relation' || edge.data?.type === 'm2m';
      strokeWidth = 4.5; // Thicker default lines for visibility on zoom-out
      if (edge.data?.type === 'relation') {
        strokeColor = 'rgba(255, 42, 133, 0.85)';
      } else if (edge.data?.type === 'm2m') {
        strokeColor = 'rgba(0, 240, 255, 0.85)';
      } else {
        strokeColor = 'rgba(0, 255, 135, 0.85)';
      }
    }

    // Only render one arrowhead per target handle to prevent overlap/stacking artifacts
    const markerKey = `${edge.target}__${edge.targetHandle}`;
    let markerEnd = undefined;

    if (!targetHandlesWithMarker.has(markerKey)) {
      targetHandlesWithMarker.add(markerKey);
      markerEnd = typeof edge.markerEnd === 'object' ? {
        ...edge.markerEnd,
        color: strokeColor,
      } : edge.markerEnd;
    }

    return {
      ...edge,
      animated,
      className,
      style: {
        ...edge.style,
        stroke: strokeColor,
        strokeWidth,
        transition: 'stroke 0.25s, stroke-width 0.25s, opacity 0.25s',
      },
      markerEnd,
    };
  });

  const updatedNodes = nodes.map((node) => {
    const activeNodeId = hoveredNodeId || focusedNodeId;

    let isHighlighted = false;
    let isDimmed = false;

    if (activeNodeId) {
      const isHovered = node.id === activeNodeId;
      const isConnected = edges.some(
        (e) =>
          (e.source === activeNodeId && e.target === node.id) ||
          (e.target === activeNodeId && e.source === node.id)
      );
      isHighlighted = isHovered || isConnected;
      isDimmed = !isHighlighted;
    } else if (selectedEdgeId) {
      const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
      
      // Find all edges that merge with the selected edge (same target and targetHandle)
      const mergedEdges = edges.filter(
        (e) =>
          selectedEdge &&
          e.target === selectedEdge.target &&
          e.targetHandle === selectedEdge.targetHandle
      );

      // Node is highlighted if it is the target, or if it is the source of any merged edge
      const isTarget = selectedEdge && node.id === selectedEdge.target;
      const isSourceOfAnyMerged = mergedEdges.some((e) => node.id === e.source);

      isHighlighted = isTarget || isSourceOfAnyMerged;
      isDimmed = !isHighlighted;
    }

    return {
      ...node,
      data: {
        ...node.data,
        highlighted: isHighlighted,
        active: node.id === focusedNodeId,
      },
      style: {
        ...node.style,
        opacity: isHighlighted ? 1 : isDimmed ? 0.12 : 1, // Deeply dim unconnected cards for high contrast
        transition: 'opacity 0.25s, transform 0.25s',
      },
    };
  });

  // Export Diagram as PNG
  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    
    // Select the viewport element of React Flow
    const flowViewport = containerRef.current.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowViewport) return;

    // Exclude font CSS embedding to resolve browser memory and crashing issues
    toPng(flowViewport, {
      backgroundColor: '#09090b',
      fontEmbedCSS: '', 
      style: {
        transform: 'scale(1)',
      },
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `prisma-schema-${schema.models.length}-tables.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error('Failed to export canvas as PNG', error);
      });
  }, [schema]);

  return (
    <div ref={containerRef} className="visualizer-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={updatedNodes}
        edges={updatedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeClick={(_, node) => {
          onSelectNode(node.id);
          setSelectedEdgeId(null);
        }}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        minZoom={0.02}
        maxZoom={5.0}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5} 
          color="#334155" 
          style={{ backgroundColor: '#09090b' }} 
        />
        <Controls showInteractive={false} className="canvas-controls" />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'enum') return '#10b981';
            return '#ec4899';
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          className="canvas-minimap"
        />

        {/* Custom Controls Panel */}
        <Panel position="top-right" className="canvas-panel">
          <div className="canvas-panel-buttons">
            <button
              onClick={() => setLayoutDir((dir) => (dir === 'TB' ? 'LR' : 'TB'))}
              title="Toggle Layout Direction (Vertical / Horizontal)"
              className="panel-btn"
            >
              {layoutDir === 'TB' ? (
                <>
                  <ArrowLeftRight size={15} />
                  <span>Horizontal Layout</span>
                </>
              ) : (
                <>
                  <ArrowUpDown size={15} />
                  <span>Vertical Layout</span>
                </>
              )}
            </button>

            <button
              onClick={buildElements}
              title="Recalculate Auto Layout"
              className="panel-btn"
            >
              <RotateCcw size={15} />
              <span>Reset Layout</span>
            </button>

            <button
              onClick={handleExport}
              title="Download Diagram as PNG Image"
              className="panel-btn primary"
            >
              <Download size={15} />
              <span>Export PNG</span>
            </button>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="bottom-left" className="legend-panel">
          <div className="legend-title">Relationship Legend</div>
          <div className="legend-item">
            <span className="legend-color-line relation-line"></span>
            <span className="legend-text">Relation (Pink: FK to PK)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color-line m2m-line"></span>
            <span className="legend-text">Many-to-Many (Cyan: Implicit)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color-line enum-line"></span>
            <span className="legend-text">Enum Reference (Green)</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const Visualizer = ({ schema, focusedNodeId, onSelectNode, onSelectElement }: VisualizerProps) => {
  return (
    <ReactFlowProvider>
      <VisualizerContent 
        schema={schema} 
        focusedNodeId={focusedNodeId} 
        onSelectNode={onSelectNode} 
        onSelectElement={onSelectElement} 
      />
    </ReactFlowProvider>
  );
};
