
import React, { MouseEvent, TouchEvent, useRef, useCallback, useMemo } from 'react';
import { CanvasModule, ModuleStatus, Port, Connection, ModuleType } from '../types';
import { PlayIcon, XMarkIcon } from './icons';
import { TOOLBOX_MODULES } from '../constants';
import { ModuleOutputSummary } from './ModuleOutputSummary';
import { ModuleInputSummary } from './ModuleInputSummary';
import { useTheme } from '../contexts/ThemeContext';

interface PortComponentProps {
  port: Port; isInput: boolean; moduleId: string;
  portRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onStartConnection: (moduleId: string, portName: string, clientX: number, clientY: number, isInput: boolean) => void;
  onEndConnection: (moduleId: string, portName: string, isInput: boolean) => void;
  isTappedSource: boolean;
  onTapPort: (moduleId: string, portName: string, isInput: boolean) => void;
  style: React.CSSProperties;
}

interface ModuleNodeProps {
  module: CanvasModule;
  allModules: CanvasModule[];
  allConnections: Connection[];
  isSelected: boolean;
  onEditParameters: (id: string) => void;
  onDragStart: (moduleId: string, e: MouseEvent) => void;
  onTouchDragStart: (moduleId: string, e: TouchEvent) => void;
  portRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onStartConnection: (moduleId: string, portName: string, clientX: number, clientY: number, isInput: boolean) => void;
  onEndConnection: (moduleId: string, portName: string, isInput: boolean) => void;
  onViewDetails: (moduleId: string) => void;
  onRunModule: (moduleId: string) => void;
  tappedSourcePort: { moduleId: string; portName: string; } | null;
  onTapPort: (moduleId: string, portName: string, isInput: boolean) => void;
  cancelDragConnection: () => void;
  onDelete: (id: string) => void;
  onModuleNameChange: (id: string, newName: string) => void;
  onUpdateModuleParameters?: (id: string, params: Record<string, any>) => void;
  scale: number;
  dragConnection: { from: { moduleId: string; portName: string; isInput: boolean; }; to: { x: number; y: number; }; } | null;
  isRunnable: boolean;
}

const getStatusColors = (theme: 'light' | 'dark') => ({
    [ModuleStatus.Pending]: theme === 'light' ? 'bg-gray-100 border-gray-400' : 'bg-gray-800/50 border-gray-600',
    [ModuleStatus.Running]: theme === 'light' ? 'bg-yellow-100 border-yellow-500' : 'bg-yellow-900/50 border-yellow-500',
    [ModuleStatus.Success]: theme === 'light' ? 'bg-blue-100 border-blue-500' : 'bg-blue-900/50 border-blue-500',
    [ModuleStatus.Error]: theme === 'light' ? 'bg-red-100 border-red-500' : 'bg-red-900/50 border-red-500',
});

// Special status colors for ScenarioRunner and PipelineExplainer (always gray when pending)
const getSpecialModuleStatusColors = (theme: 'light' | 'dark') => ({
    [ModuleStatus.Pending]: theme === 'light' ? 'bg-gray-200/50 border-gray-400' : 'bg-gray-700/50 border-gray-500',
    [ModuleStatus.Running]: theme === 'light' ? 'bg-yellow-100 border-yellow-500' : 'bg-yellow-900/50 border-yellow-500',
    [ModuleStatus.Success]: theme === 'light' ? 'bg-blue-100 border-blue-500' : 'bg-blue-900/50 border-blue-500',
    [ModuleStatus.Error]: theme === 'light' ? 'bg-red-100 border-red-500' : 'bg-red-900/50 border-red-500',
});

const PortComponent: React.FC<PortComponentProps> = ({ port, isInput, moduleId, portRefs, onStartConnection, onEndConnection, isTappedSource, onTapPort, style }) => {
    const { theme } = useTheme();
    const handleMouseDown = (e: MouseEvent) => { e.stopPropagation(); onStartConnection(moduleId, port.name, e.clientX, e.clientY, isInput); };
    const handleMouseUp = (e: MouseEvent) => { e.stopPropagation(); onEndConnection(moduleId, port.name, isInput); };
    const handleTouchStart = (e: TouchEvent) => { e.stopPropagation(); const t = e.touches[0]; onStartConnection(moduleId, port.name, t.clientX, t.clientY, isInput); };
    const handleTouchEnd = (e: TouchEvent) => { e.stopPropagation(); onEndConnection(moduleId, port.name, isInput); };
    const handleClick = (e: MouseEvent) => { e.stopPropagation(); onTapPort(moduleId, port.name, isInput); };

    return (
        <div 
             ref={el => { const key = `${moduleId}-${port.name}-${isInput ? 'in' : 'out'}`; if (el) portRefs.current.set(key, el); else portRefs.current.delete(key); }}
             style={style}
             className={`w-4 h-4 rounded-full border-2 cursor-pointer z-10 ${isTappedSource ? 'bg-purple-500 border-purple-400 ring-2 ring-purple-300' : theme === 'light' ? 'bg-gray-400 border-gray-500 hover:bg-blue-500' : 'bg-gray-600 border-gray-400 hover:bg-blue-500'}`}
             onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
             onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
             onClick={handleClick}
             title={port.name}
        />
    );
};

export const ComponentRenderer: React.FC<ModuleNodeProps> = ({ 
    module, 
    allModules, 
    allConnections, 
    isSelected, 
    onEditParameters, 
    onDragStart, 
    onTouchDragStart, 
    portRefs, 
    onStartConnection, 
    onEndConnection, 
    onViewDetails, 
    onRunModule, 
    tappedSourcePort, 
    onTapPort, 
    onDelete,
    cancelDragConnection,
    onModuleNameChange,
    onUpdateModuleParameters,
    scale,
    dragConnection,
    isRunnable 
}) => {
  const { theme } = useTheme();
  const lastTapRef = useRef(0);
  const moduleInfo = TOOLBOX_MODULES.find(m => m.type === module.type);

  const handleDelete = (e: MouseEvent | TouchEvent) => { e.stopPropagation(); onDelete(module.id); };
  const handleMouseDown = (e: MouseEvent) => { e.stopPropagation(); onDragStart(module.id, e); };
  
  const handleDoubleClick = (e: MouseEvent) => { e.stopPropagation(); onEditParameters(module.id); };

  const handleTouchStart = (e: TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault(); onEditParameters(module.id);
      lastTapRef.current = 0; return;
    }
    lastTapRef.current = now;
    onTouchDragStart(module.id, e);
  };

  const isRunnableAndPending = isRunnable && module.status === ModuleStatus.Pending;
  const isSpecialModule = module.type === ModuleType.ScenarioRunner || module.type === ModuleType.PipelineExplainer;
  const isTextBox = module.type === ModuleType.TextBox;
  const isGroupBox = module.type === ModuleType.GroupBox;
  const statusColors = getStatusColors(theme);
  const specialModuleStatusColors = getSpecialModuleStatusColors(theme);
  const moduleStatusColors = isSpecialModule ? specialModuleStatusColors : statusColors;
  
  // Different styling for special modules: rounded corners (rounded-2xl) and different shape
  const borderRadiusClass = isSpecialModule ? 'rounded-2xl' : 'rounded-lg';
  const getBackgroundColor = () => {
    if (theme === "light") {
      if (module.status === ModuleStatus.Success) {
        return "bg-blue-100";
      } else if (module.status === ModuleStatus.Pending && isRunnable) {
        return "bg-green-100";
      }
      return "bg-white";
    } else {
      if (module.status === ModuleStatus.Success) {
        return "bg-blue-900/50";
      } else if (module.status === ModuleStatus.Pending && isRunnable) {
        return "bg-green-900/30";
      }
      return "bg-gray-800";
    }
  };
  const ringOffset = theme === "light" ? "ring-offset-white" : "ring-offset-gray-900";
  const wrapperClasses = `absolute w-56 h-auto min-h-[80px] backdrop-blur-md border ${borderRadiusClass} shadow-lg flex flex-col cursor-move ${getBackgroundColor()} ${moduleStatusColors[module.status]} ${isRunnableAndPending && !isSpecialModule ? (theme === 'light' ? 'border-green-600 bg-green-100' : 'border-green-600 bg-green-900/30') : ''} ${isSelected ? `ring-2 ring-offset-2 ${ringOffset} ring-blue-500` : ''}`;
  
  // Render TextBox
  if (isTextBox) {
    const text = module.parameters?.text || '';
    const fontSize = module.parameters?.fontSize || 14;
    const color = module.parameters?.color || '#ffffff';
    const width = module.parameters?.width || 200;
    const height = module.parameters?.height || 60;
    const [isEditing, setIsEditing] = React.useState(false);
    const [editText, setEditText] = React.useState(text);
    const [isResizing, setIsResizing] = React.useState(false);
    const [resizeStart, setResizeStart] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
    const textInputRef = React.useRef<HTMLTextAreaElement>(null);
    const textBoxRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (isEditing && textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.select();
      }
    }, [isEditing]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(e.target.value);
    };

    const handleTextBlur = () => {
      setIsEditing(false);
      if (editText !== text && onUpdateModuleParameters) {
        onUpdateModuleParameters(module.id, { text: editText });
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditText(text);
    };

    const handleResizeStart = (e: MouseEvent) => {
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: width,
        height: height
      });
    };

    React.useEffect(() => {
      if (!isResizing) return;

      const handleResizeMove = (e: globalThis.MouseEvent) => {
        if (!onUpdateModuleParameters) return;
        const dx = (e.clientX - resizeStart.x) / scale;
        const dy = (e.clientY - resizeStart.y) / scale;
        const newWidth = Math.max(100, resizeStart.width + dx);
        const newHeight = Math.max(40, resizeStart.height + dy);
        onUpdateModuleParameters(module.id, { width: newWidth, height: newHeight });
      };

      const handleResizeEnd = () => {
        setIsResizing(false);
      };

      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);

      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }, [isResizing, resizeStart, scale, module.id, onUpdateModuleParameters]);

    return (
      <div 
        ref={textBoxRef}
        className={`absolute backdrop-blur-md border rounded-lg shadow-lg flex flex-col cursor-move bg-green-900/30 border-green-500 relative ${isSelected ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500' : ''}`}
        style={{ 
          left: module.position.x, 
          top: module.position.y,
          width: `${width}px`,
          minHeight: `${height}px`,
          height: `${height}px`
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
      >
        {/* Delete button in top-right corner */}
        <button 
          onClick={handleDelete}
          className="absolute top-1 right-1 p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors z-10"
          title="Delete"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
        <div className="p-2 flex-grow overflow-auto" style={{ height: `${height - 16}px` }}>
          {isEditing ? (
            <textarea
              ref={textInputRef}
              value={editText}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditText(text);
                }
                // Allow Enter for line breaks, only Escape closes editing
              }}
              className="w-full h-full bg-transparent border-none outline-none resize-none"
              style={{ fontSize: `${fontSize}px`, color: color || '#90ee90' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="w-full min-h-[20px] cursor-text whitespace-pre-wrap break-words"
              style={{ fontSize: `${fontSize}px`, color: color || '#90ee90' }}
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
              {text || <span className="text-green-500/50 italic">텍스트를 입력하세요...</span>}
            </div>
          )}
        </div>
        {/* Resize handle */}
        {isSelected && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gray-600 hover:bg-gray-500 border-t border-l border-gray-400 rounded-tl-lg"
            onMouseDown={handleResizeStart}
            style={{ zIndex: 20 }}
          />
        )}
      </div>
    );
  }

  // Render GroupBox
  if (isGroupBox) {
    const groupData = module.parameters as { moduleIds?: string[]; bounds?: { x: number; y: number; width: number; height: number } };
    const groupModules = allModules.filter(m => groupData?.moduleIds?.includes(m.id));
    const isSuccess = module.status === ModuleStatus.Success;
    
    return (
      <div className="absolute" style={{ left: module.position.x, top: module.position.y - 20 }}>
        {/* Group name outside the box */}
        <div className="mb-1">
          <input
            type="text"
            value={module.name}
            onChange={(e) => onModuleNameChange(module.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`bg-transparent ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200/50' : 'text-gray-300 hover:bg-gray-800/50'} font-semibold border-none outline-none px-1 rounded`}
            placeholder="그룹 이름"
            style={{ 
              width: `${(module.parameters?.bounds?.width || 300)}px`,
              fontSize: `${module.parameters?.fontSize || 12}px`
            }}
          />
        </div>
        
        {/* Group box */}
        <div
          className={`border-2 border-dashed rounded-lg shadow-lg cursor-move ${
            isSuccess 
              ? 'border-green-400 bg-green-900/10' 
              : 'border-purple-400 bg-purple-900/10'
          } ${isSelected ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500' : ''}`}
          style={{
            width: module.parameters?.bounds?.width || 300,
            height: (module.parameters?.bounds?.height || 200) + 40, // Add extra space at bottom
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className={`flex items-center justify-end px-2 py-1 border-b rounded-t-lg h-6 flex-shrink-0 ${
            isSuccess 
              ? 'bg-green-900/30 border-green-400/30' 
              : 'bg-purple-900/30 border-purple-400/30'
          }`}>
            <button 
              onClick={handleDelete}
              className={`p-0.5 rounded transition-colors ${
                isSuccess 
                  ? 'text-green-400 hover:text-red-400 hover:bg-red-900/30' 
                  : 'text-purple-400 hover:text-red-400 hover:bg-red-900/30'
              }`}
              title="Delete Group"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
          {/* Extra space at bottom for execution results */}
          <div className="h-10"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={wrapperClasses}
      style={{ left: module.position.x, top: module.position.y }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Header: Name & Run */}
      <div className={`flex items-center justify-between px-2 py-1 ${theme === 'light' ? 'bg-gray-200/30 border-b border-gray-300' : 'bg-gray-900/30 border-b border-gray-700'} ${isSpecialModule ? 'rounded-t-2xl' : 'rounded-t-lg'} h-12 flex-shrink-0`}>
         <div className="flex items-center gap-2 overflow-hidden">
            {moduleInfo && <moduleInfo.icon className={`w-4 h-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} flex-shrink-0`} />}
            <h3 
                className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-gray-200'} text-sm leading-tight`} 
                style={{ 
                    wordBreak: 'break-word', 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}
                title={module.name}
            >
                {module.name}
            </h3>
         </div>
         <div className="flex items-center gap-1 flex-shrink-0">
             {isSpecialModule ? (
                 // Special button for ScenarioRunner and PipelineExplainer: "전체실행" button
                 <button 
                    onClick={(e) => { e.stopPropagation(); onRunModule(module.id); }}
                    className={`px-2 py-1 rounded-md transition-colors text-xs font-semibold whitespace-normal ${
                        module.status === ModuleStatus.Success
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : module.status === ModuleStatus.Running
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                        : module.status === ModuleStatus.Error
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-gray-600 hover:bg-gray-500 text-white'
                    }`}
                    title="전체실행"
                    style={{ lineHeight: '1.1', minWidth: '50px' }}
                 >
                    <span className="block">전체</span>
                    <span className="block">실행</span>
                 </button>
             ) : (
                 // Regular play button for other modules
             <button 
                onClick={(e) => { e.stopPropagation(); if(isRunnable) onRunModule(module.id); }}
                disabled={!isRunnable}
                className={`p-1 rounded-full transition-colors ${
                    !isRunnable 
                        ? (theme === 'light' ? 'text-gray-400 cursor-not-allowed opacity-50' : 'text-gray-600 cursor-not-allowed opacity-50')
                        : module.status === ModuleStatus.Success
                        ? (theme === 'light' ? 'text-green-600 hover:bg-green-100 hover:text-green-700' : 'text-green-500 hover:bg-green-900/30 hover:text-green-400')
                        : (theme === 'light' ? 'text-blue-600 hover:bg-blue-100 hover:text-blue-700' : 'text-blue-500 hover:bg-blue-900/30 hover:text-blue-400')
                }`}
                title={isRunnable ? (module.status === ModuleStatus.Success ? "Module executed successfully" : "Run Module") : "Upstream modules must run successfully first"}
             >
                <PlayIcon className="w-8 h-8" />
             </button>
             )}
             <button 
                onClick={handleDelete}
                className={`p-1 ${theme === 'light' ? 'text-gray-600 hover:text-red-500 hover:bg-red-100' : 'text-gray-500 hover:text-red-400 hover:bg-red-900/30'} rounded-full transition-colors`}
                title="Delete Module"
             >
                <XMarkIcon className="w-4 h-4" />
             </button>
         </div>
      </div>

      {/* Body: Split Left/Right */}
      <div className="flex flex-grow min-h-[32px] relative">
          
           {/* Left: Input Area (1/3) */}
           <div 
                className={`w-1/3 border-r ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100/50' : 'border-gray-700 hover:bg-gray-700/50'} p-1 flex flex-col relative group transition-colors cursor-pointer`}
                onClick={(e) => { e.stopPropagation(); onEditParameters(module.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); onEditParameters(module.id); }}
           >
                {/* Tooltip for Description */}
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-black text-xs text-gray-200 rounded shadow-lg z-50 pointer-events-none border border-gray-600">
                    {moduleInfo?.description}
                    <div className="text-[10px] text-gray-500 mt-1">Click to edit parameters</div>
                </div>

                <span className={`font-black ${theme === 'light' ? 'text-gray-600' : 'text-gray-500'} text-[8px] tracking-widest text-center mb-0.5`}>INPUT</span>

                {/* Parameter Summary */}
                <div className="flex-grow flex items-center justify-center">
                    {(() => {
                        const summary = <ModuleInputSummary module={module} />;
                        return summary || null;
                    })()}
                </div>

                 {/* Input Ports - Positioned on the Left Edge */}
                 {module.inputs.map((port, index) => {
                    const totalPorts = module.inputs.length;
                    const spacing = 100 / (totalPorts + 1);
                    const topPercent = spacing * (index + 1);
                    
                    return (
                        <div key={port.name} className="absolute left-[-9px] z-10" style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}>
                            <PortComponent 
                                port={port} isInput={true} moduleId={module.id} portRefs={portRefs}
                                onStartConnection={onStartConnection} onEndConnection={onEndConnection}
                                isTappedSource={tappedSourcePort?.moduleId === module.id && tappedSourcePort?.portName === port.name}
                                onTapPort={onTapPort}
                                style={{}}
                            />
                             {/* Port Label Tooltip */}
                             <div className="absolute left-full ml-1 top-1/2 -translate-y-1/2 px-1 py-0.5 bg-black/80 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                                {port.name}
                             </div>
                        </div>
                    );
                 })}
           </div>

           {/* Right: Output Area (2/3) */}
           <div
                className={`w-2/3 p-1 flex flex-col justify-center relative ${module.type !== ModuleType.DefinePolicyInfo ? `${theme === 'light' ? 'hover:bg-gray-100/50' : 'hover:bg-gray-700/50'} cursor-pointer group` : ''} transition-colors`}
                onClick={(e) => { e.stopPropagation(); if (module.type !== ModuleType.DefinePolicyInfo) onViewDetails(module.id); }}
           >
                 {/* Tooltip for View Results (DefinePolicyInfo 제외) */}
                 {module.type !== ModuleType.DefinePolicyInfo && (
                 <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-black text-[10px] text-gray-200 rounded shadow-lg z-50 pointer-events-none border border-gray-600 whitespace-nowrap">
                    Click to view Results
                 </div>
                 )}

                <ModuleOutputSummary module={module} />

                {/* Output Ports - Positioned on the Right Edge */}
                {module.outputs.map((port, index) => {
                    const totalPorts = module.outputs.length;
                    const spacing = 100 / (totalPorts + 1);
                    const topPercent = spacing * (index + 1);

                    return (
                        <div key={port.name} className="absolute right-[-9px] z-10" style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}>
                             <PortComponent 
                                port={port} isInput={false} moduleId={module.id} portRefs={portRefs}
                                onStartConnection={onStartConnection} onEndConnection={onEndConnection}
                                isTappedSource={tappedSourcePort?.moduleId === module.id && tappedSourcePort?.portName === port.name}
                                onTapPort={onTapPort}
                                style={{}}
                            />
                            {/* Port Label Tooltip */}
                             <div className="absolute right-full mr-1 top-1/2 -translate-y-1/2 px-1 py-0.5 bg-black/80 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                                {port.name}
                             </div>
                        </div>
                    );
                })}
           </div>
      </div>
    </div>
  );
};
