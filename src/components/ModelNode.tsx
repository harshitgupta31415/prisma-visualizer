import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Key, Link2, HelpCircle, Eye, ShieldAlert } from 'lucide-react';
import { PrismaField } from '../utils/prismaParser';

interface ModelNodeProps {
  data: {
    name: string;
    fields: PrismaField[];
    documentation?: string;
    onFieldHover?: (fieldName: string | null) => void;
    hoveredField?: string | null;
    highlighted?: boolean;
    active?: boolean;
    onSelectElement?: (nodeName: string, fieldName?: string) => void;
  };
}

export const ModelNode = memo(({ data }: ModelNodeProps) => {
  const { name, fields, documentation, highlighted, active, onSelectElement } = data;

  return (
    <div className={`model-node ${active ? 'active' : ''} ${highlighted ? 'highlighted' : ''}`}>
      {/* Node Header */}
      <div 
        className="model-node-header"
        onClick={() => onSelectElement?.(name)}
        style={{ cursor: 'pointer' }}
      >
        <div className="model-node-title-container">
          <span className="model-node-icon">📊</span>
          <h3 className="model-node-title">{name}</h3>
        </div>
        {documentation && (
          <div className="model-node-info-tooltip-container">
            <HelpCircle size={14} className="model-node-info-icon" />
            <div className="model-node-tooltip">{documentation}</div>
          </div>
        )}
      </div>

      {/* Fields List */}
      <div className="model-node-fields">
        {fields.map((field) => {
          const isPrimaryKey = field.isId;
          const isForeignKey = field.relationFields && field.relationFields.length > 0;
          const isRelationField = field.isRelation;

          return (
            <div
              key={field.name}
              className={`model-field-row ${
                isPrimaryKey ? 'primary-key' : ''
              } ${isRelationField ? 'relation-field-row' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement?.(name, field.name);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Left Handles */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${field.name}-target-left`}
                style={{ background: '#38bdf8' }}
              />
              <Handle
                type="source"
                position={Position.Left}
                id={`${field.name}-source-left`}
                style={{ background: '#ec4899' }}
              />

              {/* Field Icon / Key Indicators */}
              <div className="model-field-indicators">
                {isPrimaryKey && (
                  <span title="Primary Key (@id)">
                    <Key size={12} className="field-icon primary-key-icon" />
                  </span>
                )}
                {field.isUnique && (
                  <span className="field-icon unique-icon" title="Unique (@unique)">U</span>
                )}
                {isForeignKey && (
                  <span title={`Foreign Key referencing ${field.type}`}>
                    <Link2 size={12} className="field-icon foreign-key-icon" />
                  </span>
                )}
                {!isPrimaryKey && !field.isUnique && !isForeignKey && (
                  <span className="field-icon-placeholder" />
                )}
              </div>

              {/* Field Metadata */}
              <div className="model-field-info">
                <span className="model-field-name">{field.name}</span>
                <span className="model-field-type">
                  {field.type}
                  {field.isList && '[]'}
                  {field.isOptional && '?'}
                </span>
              </div>

              {/* Right Handles */}
              <Handle
                type="target"
                position={Position.Right}
                id={`${field.name}-target-right`}
                style={{ background: '#38bdf8' }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={`${field.name}-source-right`}
                style={{ background: '#ec4899' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

ModelNode.displayName = 'ModelNode';
