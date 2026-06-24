import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface EnumNodeProps {
  data: {
    name: string;
    values: string[];
    documentation?: string;
    highlighted?: boolean;
    active?: boolean;
    onSelectElement?: (nodeName: string, fieldName?: string) => void;
  };
}

export const EnumNode = memo(({ data }: EnumNodeProps) => {
  const { name, values, documentation, highlighted, active, onSelectElement } = data;

  return (
    <div className={`enum-node ${active ? 'active' : ''} ${highlighted ? 'highlighted' : ''}`}>
      {/* Target handles on both left and right sides */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${name}-enum-target-left`}
        style={{ background: '#10b981', top: '26px' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id={`${name}-enum-target-right`}
        style={{ background: '#10b981', top: '26px' }}
      />

      <div 
        className="enum-node-header"
        onClick={() => onSelectElement?.(name)}
        style={{ cursor: 'pointer' }}
      >
        <div className="enum-node-title-container">
          <span className="enum-node-icon">📋</span>
          <h3 className="enum-node-title">{name}</h3>
        </div>
        {documentation && (
          <div className="enum-node-info-tooltip-container">
            <span className="enum-node-info-icon">ℹ️</span>
            <div className="enum-node-tooltip">{documentation}</div>
          </div>
        )}
      </div>

      <div className="enum-node-values">
        {values.map((val) => (
          <div 
            key={val} 
            className="enum-value-row"
            onClick={(e) => {
              e.stopPropagation();
              onSelectElement?.(name, val);
            }}
            style={{ cursor: 'pointer' }}
          >
            <span className="enum-value-bullet">•</span>
            <span className="enum-value-text">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

EnumNode.displayName = 'EnumNode';
