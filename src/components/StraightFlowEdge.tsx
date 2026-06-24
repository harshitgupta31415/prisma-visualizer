import React from 'react';
import { BaseEdge, EdgeProps, useNodes } from '@xyflow/react';

function getNodeBox(node: any) {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const w = node.measured?.width ?? node.width ?? 290;
  let h = node.measured?.height ?? node.height;
  if (h === undefined) {
    if (node.type === 'model') {
      const fieldsCount = (node.data?.fields as any[])?.length || 0;
      h = 52 + fieldsCount * 38 + 20;
    } else if (node.type === 'enum') {
      const valuesCount = (node.data?.values as any[])?.length || 0;
      h = 52 + valuesCount * 30 + 20;
    } else {
      h = 150;
    }
  }
  return { x1: x, x2: x + w, y1: y, y2: y + h };
}

function checkVerticalIntersection(
  x: number,
  yStart: number,
  yEnd: number,
  nodes: any[],
  sourceId: string,
  targetId: string
) {
  const yMin = Math.min(yStart, yEnd);
  const yMax = Math.max(yStart, yEnd);

  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) continue;
    const box = getNodeBox(node);
    
    // Check if the vertical line x is inside the horizontal range of the node (with 5px padding)
    const horizontallyInside = x >= box.x1 - 5 && x <= box.x2 + 5;
    // Check if the vertical line's Y range overlaps with the node's Y range (with 5px padding)
    const verticallyOverlaps = yMin < box.y2 + 5 && yMax > box.y1 - 5;

    if (horizontallyInside && verticallyOverlaps) {
      return true;
    }
  }
  return false;
}

function checkCrossingIntersection(
  y: number,
  x1: number,
  x2: number,
  nodes: any[],
  sourceId: string,
  targetId: string
) {
  const xMin = Math.min(x1, x2);
  const xMax = Math.max(x1, x2);

  for (const node of nodes) {
    // Do NOT exclude sourceId and targetId here, because a very tall source or target node
    // can vertically overlap with the crossing segment y, leading to intersection if it is horizontally within bounds.
    const box = getNodeBox(node);
    
    // Check if y (with crossing diagonal vertical span padding of 30px) overlaps with the node's vertical range
    const verticallyOverlaps = (y - 30) < box.y2 && (y + 30) > box.y1;
    // Check if the crossing segment overlaps horizontally with the node
    const horizontallyOverlaps = xMin < box.x2 + 5 && xMax > box.x1 - 5;

    if (verticallyOverlaps && horizontallyOverlaps) {
      return true;
    }
  }
  return false;
}

export function StraightFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  animated,
  className,
  source,
  target,
  data,
}: EdgeProps & { className?: string }) {
  const shoulderDistance = 35;
  
  const isSourceLeft = sourcePosition === 'left';
  const isTargetLeft = targetPosition === 'left';

  const sourceOffset = isSourceLeft ? -shoulderDistance : shoulderDistance;
  const targetOffset = isTargetLeft ? -shoulderDistance : shoulderDistance;

  // Read the sequential channel indices from the layout engine to ensure collision-free parallel offsets
  const sourceChannelIndex = (data?.sourceChannelIndex as number) ?? 0;
  const targetChannelIndex = (data?.targetChannelIndex as number) ?? 0;

  const absOffsetSource = sourceChannelIndex * 12; // 0, 12, 24, 36, ... px horizontal separation from the shoulder
  const absOffsetTarget = targetChannelIndex * 12; // 0, 12, 24, 36, ... px horizontal separation from the shoulder
  const midYOffset = (sourceChannelIndex - 3) * 8; // -24 to +24 px vertical separation at crossing midpoint

  // Apply horizontal offsets to the shoulders so parallel vertical lines run separated in the channel (guaranteed outer side)
  const sourceShoulderX = sourceX + sourceOffset + (isSourceLeft ? -absOffsetSource : absOffsetSource);
  const targetShoulderX = targetX + targetOffset + (isTargetLeft ? -absOffsetTarget : absOffsetTarget);

  const nodes = useNodes();
  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);

  const sourceBox = sourceNode ? getNodeBox(sourceNode) : null;
  const targetBox = targetNode ? getNodeBox(targetNode) : null;

  // Compute the vertical midpoint in the rank gap
  const midY = (sourceY + targetY) / 2;
  
  // Find candidate crossing Y coordinates to avoid nodes
  let candidates: number[] = [midY];
  if (sourceBox && targetBox) {
    if (sourceY < targetY) {
      const sourceBottom = sourceBox.y2;
      const targetTop = targetBox.y1;
      candidates.push(sourceBottom + 40);
      candidates.push(targetTop - 40);
    } else {
      const sourceTop = sourceBox.y1;
      const targetBottom = targetBox.y2;
      candidates.push(sourceTop - 40);
      candidates.push(targetBottom + 40);
    }
  }

  // Add gaps above and below all other nodes as potential crossing corridors
  for (const node of nodes) {
    if (node.id === source || node.id === target) continue;
    const box = getNodeBox(node);
    candidates.push(box.y1 - 40);
    candidates.push(box.y2 + 40);
  }

  // Filter candidates to lie strictly within the vertical range of the connection
  const yMinLimit = Math.min(sourceY, targetY);
  const yMaxLimit = Math.max(sourceY, targetY);
  let filteredCandidates = candidates.filter(y => y > yMinLimit && y < yMaxLimit);

  // Sort candidates by proximity to the midpoint
  filteredCandidates.sort((a, b) => Math.abs(a - midY) - Math.abs(b - midY));

  // Find the first candidate Y that does not result in any node collision
  let Y_cross = midY;
  for (const cand of filteredCandidates) {
    const intVertSource = checkVerticalIntersection(sourceShoulderX, sourceY, cand, nodes, source, target);
    const intVertTarget = checkVerticalIntersection(targetShoulderX, cand, targetY, nodes, source, target);
    const intCrossing = checkCrossingIntersection(cand, sourceShoulderX, targetShoulderX, nodes, source, target);
    
    if (!intVertSource && !intVertTarget && !intCrossing) {
      Y_cross = cand;
      break;
    }
  }

  // Create a sloped crossing segment by offsetting Y coordinates
  // Use a steep crossingSpan (25px) to guarantee they cross other paths at a visible angle
  const crossingSpan = 25;
  const midY1 = Y_cross + midYOffset + (sourceY < targetY ? -crossingSpan : crossingSpan);
  const midY2 = Y_cross + midYOffset + (sourceY < targetY ? crossingSpan : -crossingSpan);

  let edgePath = '';
  
  if (Math.abs(sourceY - targetY) < 40) {
    // Same rank: simple horizontal connection with merging
    edgePath = `M ${sourceX} ${sourceY} ` +
               `L ${sourceX + sourceOffset} ${sourceY} ` +
               `L ${sourceShoulderX} ${sourceY} ` +
               `L ${targetShoulderX} ${targetY} ` +
               `L ${targetX + targetOffset} ${targetY} ` +
               `L ${targetX} ${targetY}`;
  } else {
    // Different ranks: 5-segment orthogonal-diagonal highway path with obstacle avoidance.
    edgePath = `M ${sourceX} ${sourceY} ` +
               `L ${sourceX + sourceOffset} ${sourceY} ` +
               `L ${sourceShoulderX} ${sourceY} ` +
               `L ${sourceShoulderX} ${midY1} ` +
               `L ${targetShoulderX} ${midY2} ` +
               `L ${targetShoulderX} ${targetY} ` +
               `L ${targetX + targetOffset} ${targetY} ` +
               `L ${targetX} ${targetY}`;
  }

  const strokeColor = style.stroke || 'currentColor';
  const isHovered = className?.includes('react-flow__edge-hovered');

  // Core line style (thinner and crisp)
  const finalStyle: React.CSSProperties = {
    ...style,
    strokeWidth: isHovered ? 6.0 : 3.5,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  // Background glow path style (thick and semi-transparent)
  const glowStyle: React.CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth: isHovered ? 18.0 : 9.0,
    opacity: isHovered ? 0.35 : 0.12,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  return (
    <>
      {/* Background glow path (zero filters, extremely fast GPU draw) */}
      <BaseEdge 
        id={`${id}-glow`} 
        path={edgePath} 
        style={glowStyle} 
        className={className ? `${className}-glow` : 'react-flow__edge-glow'}
      />
      {/* Core line path */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={finalStyle} 
        className={className}
      />
      {/* Gliding arrow indicator (rendered only on hover/selection to prevent idle CPU load) */}
      {isHovered && (
        <path
          d="M -5,-3.5 L 5,0 L -5,3.5 Z"
          fill={strokeColor}
          style={{
            offsetPath: `path('${edgePath}')`,
            offsetRotate: 'auto',
            animation: 'flow-glide 0.6s linear infinite',
          }}
        />
      )}
    </>
  );
}
