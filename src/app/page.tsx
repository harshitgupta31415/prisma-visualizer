'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { 
  Database, 
  Search, 
  HelpCircle, 
  AlertTriangle,
  Code,
  BookOpen,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { parsePrismaSchema, PrismaSchema } from '../utils/prismaParser';
import { Visualizer } from '../components/Visualizer';
import { PresetSelector, PRESETS } from '../components/PresetSelector';

export default function PrismaVisualizerApp() {
  const [code, setCode] = useState<string>(PRESETS[0].code);
  const [parsedSchema, setParsedSchema] = useState<PrismaSchema>({ models: [], enums: [] });
  const [parserError, setParserError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(PRESETS[0].id);

  // Search & Focus State
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Resizable Panels State
  const [editorWidth, setEditorWidth] = useState(450); // initial width in pixels
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  // Copy code helper
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Clear code helper
  const handleClearCode = () => {
    setCode('');
    setActivePresetId(null);
  };

  // Initialize parser
  useEffect(() => {
    try {
      const parsed = parsePrismaSchema(code);
      setParsedSchema(parsed);
      setParserError(null);
    } catch (err: any) {
      setParserError(err.message || 'Error parsing schema');
    }
  }, [code]);

  // Handle code change from editor
  const handleEditorChange = (value: string | undefined) => {
    const updatedCode = value || '';
    setCode(updatedCode);
    setActivePresetId(null); // Clear active preset if code is customized
  };

  // Setup Prisma language in Monaco
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    // Register custom language for Prisma
    monaco.languages.register({ id: 'prisma' });

    // Set keywords and tokenizers for syntax highlighting
    monaco.languages.setMonarchTokensProvider('prisma', {
      keywords: [
        'model', 'enum', 'datasource', 'generator', 'db', 'client'
      ],
      typeKeywords: [
        'String', 'Boolean', 'Int', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes', 'BigInt', 'Unsupported'
      ],
      operators: ['=', '?', '[]'],
      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier'
            }
          }],
          // Attributes
          [/@[a-zA-Z_]\w*/, 'tag'],
          [/@@[a-zA-Z_]\w*/, 'tag'],
          // Comments
          [/\/\/.*$/, 'comment'],
          [/\/\/\/.*$/, 'comment'],
          // Strings
          [/"([^"\\]|\\.)*"/, 'string'],
          // Numbers
          [/\d+/, 'number'],
          // Delimiters
          [/[{}()\[\]]/, 'delimiter'],
        ]
      }
    });

    // Custom theme matching the premium dashboard look
    monaco.editor.defineTheme('prisma-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },
        { token: 'tag', foreground: 'CE9178' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#0c0c0e',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#4A4A5A',
        'editorLineNumber.activeForeground': '#a855f7',
        'editor.lineHighlightBackground': '#18181f',
      }
    });

    monaco.editor.setTheme('prisma-dark');
  };

  // Draggable Divider Resize Handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.classList.add('resizing');
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    document.body.classList.remove('resizing');
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    
    // Set min/max boundaries
    if (newWidth > 320 && newWidth < containerRect.width - 400) {
      setEditorWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Search Results filtering
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches: string[] = [];
    
    parsedSchema.models.forEach(m => {
      if (m.name.toLowerCase().includes(query)) {
        matches.push(m.name);
      }
    });

    parsedSchema.enums.forEach(e => {
      if (e.name.toLowerCase().includes(query)) {
        matches.push(e.name);
      }
    });

    setSearchResults(matches);
  }, [searchQuery, parsedSchema]);

  // Total Relationships count
  const getRelationCount = () => {
    let count = 0;
    parsedSchema.models.forEach(model => {
      model.fields.forEach(field => {
        if (field.isRelation && field.relationFields && field.relationFields.length > 0) {
          count += field.relationFields.length;
        }
      });
    });
    return count;
  };

  // Total fields count
  const getFieldCount = () => {
    let count = 0;
    parsedSchema.models.forEach(m => {
      count += m.fields.length;
    });
    return count;
  };

  // Find correct line number in Prisma schema code
  const findLineInCode = (schemaCode: string, nodeName: string, fieldName?: string): number => {
    const lines = schemaCode.split('\n');
    const nodeRegex = new RegExp(`^\\s*(model|enum)\\s+${nodeName}\\b`);
    
    let nodeStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (nodeRegex.test(lines[i])) {
        nodeStartIndex = i;
        break;
      }
    }

    if (nodeStartIndex === -1) return 1;

    if (!fieldName) {
      return nodeStartIndex + 1;
    }

    // Look for the field/value line within the block
    for (let i = nodeStartIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Ignore comments
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
        continue;
      }
      
      // Check if block ended
      if (trimmed.includes('}')) {
        break;
      }
      
      const tokens = trimmed.split(/\s+/);
      if (tokens.length > 0 && tokens[0] === fieldName) {
        return i + 1;
      }
    }

    return nodeStartIndex + 1;
  };

  // Handle visualizer node/field clicks to select/highlight code line
  const handleSelectElement = useCallback((nodeName: string, fieldName?: string) => {
    setFocusedNodeId(nodeName);
    
    const triggerSelection = () => {
      if (editorRef.current) {
        const lineNumber = findLineInCode(code, nodeName, fieldName);
        const lines = code.split('\n');
        const lineContent = lines[lineNumber - 1] || '';
        
        editorRef.current.revealLineInCenter(lineNumber);
        editorRef.current.setPosition({ lineNumber, column: 1 });
        editorRef.current.setSelection({
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1
        });
        editorRef.current.focus();
      }
    };

    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      // Wait for layout/DOM transition to finish so Monaco Editor has correct viewport dimensions
      setTimeout(triggerSelection, 100);
    } else {
      triggerSelection();
    }
  }, [code, isSidebarCollapsed]);

  return (
    <div ref={containerRef} className="dashboard-container">
      {/* Top Header Navigation Bar */}
      <header className="dashboard-header">
        <div className="header-logo-section">
          <div className="logo-badge">⬢</div>
          <div className="logo-title-group">
            <h1 className="logo-title">Prisma Visualizer</h1>
            <span className="logo-subtitle">Interactive ERD Renderer</span>
          </div>
        </div>

        {/* Global Schema Search Engine */}
        <div className="header-search-bar-wrapper">
          <div className="search-input-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search schemas (e.g. User, OrderStatus)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear-btn">×</button>
            )}
          </div>
          {isSearchFocused && searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map((name) => (
                <button
                  key={name}
                  onMouseDown={() => {
                    setFocusedNodeId(name);
                    setSearchQuery('');
                  }}
                  className="search-result-item"
                >
                  <span className="result-indicator">⚡</span>
                  <span className="result-name">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="header-actions">
          <a
            href="https://github.com/prisma/prisma"
            target="_blank"
            rel="noopener noreferrer"
            className="social-btn"
            title="Prisma GitHub Repository"
          >
            <Code size={18} />
          </a>
        </div>
      </header>

      {/* Main Split Screen Area */}
      <div className="dashboard-body">
        {/* Left Panel: Editor & Presets */}
        <aside className={`editor-panel ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ width: `${isSidebarCollapsed ? 0 : editorWidth}px` }}>
          {/* Editor Header / Title */}
          <div className="panel-section-header">
            <div className="panel-title-container">
              <Database size={16} className="text-purple" />
              <span>Prisma Editor</span>
            </div>
            
            <div className="editor-actions-container">
              <button
                onClick={handleCopyCode}
                className="editor-action-btn"
                title="Copy Schema to Clipboard"
              >
                <Copy size={12} />
                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                onClick={handleClearCode}
                className="editor-action-btn"
                title="Clear Editor"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="editor-action-btn"
                title="Collapse Editor Sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="monaco-wrapper">
            <Editor
              height="100%"
              defaultLanguage="prisma"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbersMinChars: 3,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          {/* Parser Error Notification */}
          {parserError && (
            <div className="error-alert-box">
              <AlertTriangle size={16} className="error-icon" />
              <div className="error-message">{parserError}</div>
            </div>
          )}

          {/* Preset Selector Container */}
          <div className="presets-wrapper">
            <PresetSelector
              onSelectPreset={(presetCode) => setCode(presetCode)}
              activePresetId={activePresetId}
              setActivePresetId={setActivePresetId}
            />
          </div>
        </aside>

        {/* Draggable Divider */}
        {!isSidebarCollapsed && <div className="drag-divider" onMouseDown={startResizing} />}

        {/* Right Panel: Canvas Visualizer */}
        <main className="canvas-panel-main">
          {/* Real-time Statistics Header */}
          <div className="canvas-header-bar">
            <div className="stats-container">
              <div className="stat-card">
                <span className="stat-label">Models</span>
                <span className="stat-value text-purple">{parsedSchema.models.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Enums</span>
                <span className="stat-value text-emerald">{parsedSchema.enums.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Fields</span>
                <span className="stat-value">{getFieldCount()}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Relations</span>
                <span className="stat-value text-pink">{getRelationCount()}</span>
              </div>
            </div>
            
            {focusedNodeId && (
              <div className="focus-indicator-badge">
                <span className="focus-text">Focusing: <strong>{focusedNodeId}</strong></span>
                <button onClick={() => setFocusedNodeId(null)} className="focus-close-btn">×</button>
              </div>
            )}
          </div>

          {/* React Flow Visualizer */}
          <div className="canvas-viewport" style={{ position: 'relative' }}>
            {isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="floating-trigger-btn"
                title="Expand Editor Sidebar"
              >
                <ChevronRight size={16} />
                <span>Show Editor</span>
              </button>
            )}
            <Visualizer
              schema={parsedSchema}
              focusedNodeId={focusedNodeId}
              onSelectNode={setFocusedNodeId}
              onSelectElement={handleSelectElement}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
