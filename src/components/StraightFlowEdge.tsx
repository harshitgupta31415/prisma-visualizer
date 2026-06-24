import React from 'react';
import { BaseEdge, EdgeProps, getStraightPath } from '@xyflow/react';

export function StraightFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  animated,
  className,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const strokeColor = style.stroke || 'currentColor';

  return (
    <>
      <BaseEdge 
        id={id} 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={style} 
        className={className}
      />
      {animated && (
        <path
          d="M -5,-3.5 L 5,0 L -5,3.5 Z"
          fill={strokeColor}
          style={{
            offsetPath: `path('${edgePath}')`,
            offsetRotate: 'auto',
            animation: className?.includes('react-flow__edge-hovered') 
              ? 'flow-glide 0.6s linear infinite' 
              : 'flow-glide 1.8s linear infinite',
            filter: `drop-shadow(0 0 3px ${strokeColor})`,
          }}
        />
      )}
    </>
  );
}
