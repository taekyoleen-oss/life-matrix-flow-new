
import React, { useState, useCallback, useRef, useEffect, MouseEvent, TouchEvent, DragEvent, WheelEvent } from 'react';
import { CanvasModule, Connection, ModuleType, ModuleStatus } from '../types';
import { ComponentRenderer as ModuleNode } from './ComponentRenderer';
import { useTheme } from '../contexts/ThemeContext';

interface CanvasProps {
  modules: CanvasModule[];
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  selectedModuleIds: string[];
  setSelectedModuleIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateModulePositions: (updates: { id: string, position: { x: number, y: number } }[]) => void;
  onModuleDrop: (type: ModuleType, position: { x: number; y: number }) => void;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number, y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  onViewDetails: (moduleId: string) => void;
  onEditParameters: (moduleId: string) => void;
  onRunModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onUpdateModuleName: (id: string, newName: string) => void;
  onUpdateModuleParameters?: (id: string, params: Record<string, any>) => void;
  /** 비호환 포트 연결을 시도해 거부되었을 때 사용자에게 안내(토스트 등). */
  onConnectionRejected?: (message: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
    modules, connections, setConnections, selectedModuleIds, setSelectedModuleIds, 
    updateModulePositions, onModuleDrop, scale, setScale, pan, setPan, 
    canvasContainerRef, onViewDetails, onEditParameters, onRunModule,
    onDeleteModule, onUpdateModuleName, onUpdateModuleParameters, onConnectionRejected
}) => {
  const { theme } = useTheme();

  // 포트 타입을 사용자 친화적 한글 라벨로 변환(연결 거부 안내용).
  const portTypeLabel = useCallback((t: string): string => {
    const map: Record<string, string> = {
      data: '데이터(data)',
      premium: '보험료(premium)',
      premium_components: '보험료 구성요소(premium_components)',
      additional_variables: '추가 변수(additional_variables)',
      variables: '변수(variables)',
    };
    return map[t] ?? t;
  }, []);

  // 비호환 연결 거부 시 공통 안내 메시지 생성 + 콜백 호출.
  const notifyIncompatible = useCallback(
    (fromType?: string, toType?: string) => {
      if (!onConnectionRejected || !fromType || !toType) return;
      onConnectionRejected(
        `${portTypeLabel(fromType)} 출력은 ${portTypeLabel(toType)} 입력에 연결할 수 없습니다. 같은 종류의 포트끼리 연결하세요.`
      );
    },
    [onConnectionRejected, portTypeLabel]
  );
  const [dragConnection, setDragConnection] = useState<{ from: { moduleId: string, portName: string, isInput: boolean }, to: { x: number, y: number } } | null>(null);
  const [tappedSourcePort, setTappedSourcePort] = useState<{ moduleId: string; portName: string; } | null>(null);
  const portRefs = useRef(new Map<string, HTMLDivElement>());
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const mouseDownStart = useRef({ x: 0, y: 0 }); // Store initial mouse position for panning detection
  const [selectionBox, setSelectionBox] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const isSelecting = useRef(false);
  const isSpacePressed = useRef(false);
  const dragInfoRef = useRef<{
    draggedModuleIds: string[];
    startPositions: Map<string, { x: number, y: number }>;
    dragStartPoint: { x: number, y: number };
  } | null>(null);
  const touchDragInfoRef = useRef<{
    draggedModuleIds: string[];
    startPositions: Map<string, { x: number, y: number }>;
    dragStartPoint: { x: number, y: number };
    touchIdentifier: number;
  } | null>(null);
    
    const cancelDragConnection = useCallback(() => {
        setDragConnection(null);
    }, []);

  const getPortPosition = useCallback((
    module: CanvasModule,
    portName: string,
    isInput: boolean,
  ) => {
    const portEl = portRefs.current.get(`${module.id}-${portName}-${isInput ? 'in' : 'out'}`);
    if (!portEl || !canvasContainerRef.current) {
        const portIndex = isInput ? module.inputs.findIndex(p => p.name === portName) : module.outputs.findIndex(p => p.name === portName);
        const portCount = isInput ? module.inputs.length : module.outputs.length;
        const moduleWidth = 224; // w-56
        const moduleHeight = 60; // Approximate height
        return { 
            x: module.position.x + (isInput ? 0 : moduleWidth),
            y: module.position.y + (moduleHeight / (portCount + 1)) * (portIndex + 1)
        };
    }

    const portRect = portEl.getBoundingClientRect();
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();
    
    return {
        x: (portRect.left + portRect.width / 2 - canvasRect.left - pan.x) / scale,
        y: (portRect.top + portRect.height / 2 - canvasRect.top - pan.y) / scale
    };
  }, [scale, pan, canvasContainerRef]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow') as ModuleType;
    if (typeof type === 'undefined' || !type || !canvasContainerRef.current) return;
    
    const canvasBounds = canvasContainerRef.current.getBoundingClientRect();
    const position = {
      x: (e.clientX - canvasBounds.left - pan.x) / scale,
      y: (e.clientY - canvasBounds.top - pan.y) / scale,
    };
    
    // For Scenario Runner and Pipeline Explainer, account for box padding
    const isSpecialModule = type === ModuleType.ScenarioRunner || type === ModuleType.PipelineExplainer;
    const boxPadding = isSpecialModule ? 20 : 0;
    const moduleWidth = 224; // w-56
    const moduleHeight = isSpecialModule ? 120 : 60;
    
    onModuleDrop(type, {
      x: position.x - moduleWidth / 2 + boxPadding, 
      y: position.y - moduleHeight / 2 + boxPadding
    });
  };

  const handleDragMove = useCallback((e: globalThis.MouseEvent) => {
      if (!dragInfoRef.current) return;
      const { dragStartPoint, startPositions } = dragInfoRef.current;
      const dx = (e.clientX - dragStartPoint.x) / scale;
      const dy = (e.clientY - dragStartPoint.y) / scale;
      const updates: { id: string, position: { x: number, y: number } }[] = [];
      startPositions.forEach((startPos, id) => {
          updates.push({ id, position: { x: startPos.x + dx, y: startPos.y + dy } });
      });
      if (updates.length > 0) updateModulePositions(updates);
  }, [scale, updateModulePositions]);

  const handleDragEnd = useCallback(() => {
      dragInfoRef.current = null;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  const handleModuleDragStart = useCallback((draggedModuleId: string, e: MouseEvent) => {
    if (e.button !== 0) return;
    const isShift = e.shiftKey;
    const draggedModule = modules.find(m => m.id === draggedModuleId);
    const isGroupBox = draggedModule?.type === ModuleType.GroupBox;
    const alreadySelected = selectedModuleIds.includes(draggedModuleId);
    let idsToDrag = selectedModuleIds;

    if (isShift) {
        const newSelection = alreadySelected ? selectedModuleIds.filter(id => id !== draggedModuleId) : [...selectedModuleIds, draggedModuleId];
        setSelectedModuleIds(newSelection);
        idsToDrag = newSelection;
    } else if (!alreadySelected) {
        setSelectedModuleIds([draggedModuleId]);
        idsToDrag = [draggedModuleId];
    }
    
    const startPositions = new Map<string, { x: number, y: number }>();
    
    // If dragging a group box, include all modules in the group
    if (isGroupBox && draggedModule) {
        const groupModuleIds = (draggedModule.parameters as any)?.moduleIds || [];
        groupModuleIds.forEach((id: string) => {
            const module = modules.find(m => m.id === id);
            if (module) {
                startPositions.set(id, module.position);
                if (!idsToDrag.includes(id)) {
                    idsToDrag = [...idsToDrag, id];
                }
            }
        });
        // Also include the group box itself
        startPositions.set(draggedModuleId, draggedModule.position);
    } else {
        // Normal drag: just the selected modules
        modules.forEach(m => { if (idsToDrag.includes(m.id)) startPositions.set(m.id, m.position); });
    }
    
    dragInfoRef.current = { draggedModuleIds: idsToDrag, startPositions, dragStartPoint: { x: e.clientX, y: e.clientY } };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  }, [modules, selectedModuleIds, setSelectedModuleIds, handleDragMove, handleDragEnd]);
  
  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!touchDragInfoRef.current) return;
    let currentTouch: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) { if (e.touches[i].identifier === touchDragInfoRef.current.touchIdentifier) { currentTouch = e.touches[i]; break; }}
    if (!currentTouch) return;
    e.preventDefault();
    const { dragStartPoint, startPositions } = touchDragInfoRef.current;
    const dx = (currentTouch.clientX - dragStartPoint.x) / scale;
    const dy = (currentTouch.clientY - dragStartPoint.y) / scale;
    const updates: { id: string, position: { x: number, y: number } }[] = [];
    startPositions.forEach((startPos, id) => { updates.push({ id, position: { x: startPos.x + dx, y: startPos.y + dy } }); });
    if (updates.length > 0) updateModulePositions(updates);
  }, [scale, updateModulePositions]);

  const handleTouchEnd = useCallback(() => {
    if (touchDragInfoRef.current) {
        touchDragInfoRef.current = null;
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
    }
  }, [handleTouchMove]);
  
  const handleModuleTouchDragStart = useCallback((draggedModuleId: string, e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const isShift = e.shiftKey;
    const alreadySelected = selectedModuleIds.includes(draggedModuleId);
    let idsToDrag = selectedModuleIds;
    if (isShift) {
        const newSelection = alreadySelected ? selectedModuleIds.filter(id => id !== draggedModuleId) : [...selectedModuleIds, draggedModuleId];
        setSelectedModuleIds(newSelection);
        idsToDrag = newSelection;
    } else if (!alreadySelected) {
        setSelectedModuleIds([draggedModuleId]);
        idsToDrag = [draggedModuleId];
    }
    const startPositions = new Map<string, { x: number, y: number }>();
    modules.forEach(m => { if (idsToDrag.includes(m.id)) startPositions.set(m.id, m.position); });
    touchDragInfoRef.current = { draggedModuleIds: idsToDrag, startPositions, dragStartPoint: { x: touch.clientX, y: touch.clientY }, touchIdentifier: touch.identifier };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [modules, selectedModuleIds, setSelectedModuleIds, handleTouchMove, handleTouchEnd]);
  
  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
        return;
    }
    if (e.target === e.currentTarget && e.button === 0) {
        // If Space key is pressed, start panning mode immediately
        if (isSpacePressed.current) {
            e.preventDefault();
            isPanning.current = true;
            panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
            return;
        }
        // Otherwise, start selection box
        setSelectedModuleIds([]);
        setTappedSourcePort(null);
        isSelecting.current = true;
        const canvasRect = canvasContainerRef.current!.getBoundingClientRect();
        const startX = e.clientX - canvasRect.left;
        const startY = e.clientY - canvasRect.top;
        setSelectionBox({ x1: startX, y1: startY, x2: startX, y2: startY });
        // Store initial mouse position for panning detection
        mouseDownStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
      if (dragConnection && canvasContainerRef.current) {
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        setDragConnection(prev => prev ? ({ ...prev, to: { x: (e.clientX - canvasRect.left - pan.x) / scale, y: (e.clientY - canvasRect.top - pan.y) / scale } }) : null);
      } else if (isPanning.current) {
          setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      } else if (isSelecting.current && selectionBox && canvasContainerRef.current) {
          // Check if Space key is pressed to switch to panning mode
          if (isSpacePressed.current) {
              isSelecting.current = false;
              setSelectionBox(null);
              isPanning.current = true;
              panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
              (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
          } else {
              // Continue with selection box
              const canvasRect = canvasContainerRef.current.getBoundingClientRect();
              const currentX = e.clientX - canvasRect.left;
              const currentY = e.clientY - canvasRect.top;
              setSelectionBox(prev => prev ? { ...prev, x2: currentX, y2: currentY } : null);
          }
      }
  };

  const handleCanvasMouseUp = (e: MouseEvent) => {
      setDragConnection(null);
      if(isPanning.current) {
          isPanning.current = false;
          (e.currentTarget as HTMLElement).style.cursor = 'grab';
      }
      if (isSelecting.current) {
        isSelecting.current = false;
        if (selectionBox) {
            const { x1, y1, x2, y2 } = selectionBox;
            const selectionRect = { minX: (Math.min(x1, x2) - pan.x) / scale, minY: (Math.min(y1, y2) - pan.y) / scale, maxX: (Math.max(x1, x2) - pan.x) / scale, maxY: (Math.max(y1, y2) - pan.y) / scale };
            const moduleWidth = 224; const moduleHeight = 60; 
            const newlySelectedIds = modules.filter(module => (module.position.x < selectionRect.maxX && module.position.x + moduleWidth > selectionRect.minX && module.position.y < selectionRect.maxY && module.position.y + moduleHeight > selectionRect.minY)).map(m => m.id);
            if (newlySelectedIds.length > 0) {
                 if (e.shiftKey) setSelectedModuleIds(prev => Array.from(new Set([...prev, ...newlySelectedIds])));
                 else setSelectedModuleIds(newlySelectedIds);
            }
        }
        setSelectionBox(null);
    }
  };
  
  const handleWheel = (e: WheelEvent) => {
        // Ctrl + Wheel: Natural zoom
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            const newScale = Math.max(0.2, Math.min(2, scale + delta));
            if (!canvasContainerRef.current) return;
            const canvasRect = canvasContainerRef.current.getBoundingClientRect();
            const mousePoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
            const canvasPoint = { x: (mousePoint.x - pan.x) / scale, y: (mousePoint.y - pan.y) / scale };
            const newPan = { x: mousePoint.x - canvasPoint.x * newScale, y: mousePoint.y - canvasPoint.y * newScale };
            setScale(newScale); 
            setPan(newPan);
            return;
        }
        
        // Shift + Wheel: Horizontal scroll
        if (e.shiftKey) {
            e.preventDefault();
            const deltaX = e.deltaY; // Use deltaY for horizontal scrolling when Shift is pressed
            if (!canvasContainerRef.current) return;
            setPan(prev => ({ x: prev.x - deltaX, y: prev.y }));
            return;
        }
        
        // Default: Normal zoom (if not Ctrl or Shift)
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.max(0.2, Math.min(2, scale + delta));
        if (!canvasContainerRef.current) return;
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        const mousePoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        const canvasPoint = { x: (mousePoint.x - pan.x) / scale, y: (mousePoint.y - pan.y) / scale };
        const newPan = { x: mousePoint.x - canvasPoint.x * newScale, y: mousePoint.y - canvasPoint.y * newScale };
        setScale(newScale); 
        setPan(newPan);
  };

  const handleStartConnection = useCallback((moduleId: string, portName: string, clientX: number, clientY: number, isInput: boolean) => {
    if (!canvasContainerRef.current) return;
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();
    const to = { x: (clientX - canvasRect.left - pan.x) / scale, y: (clientY - canvasRect.top - pan.y) / scale };
    setDragConnection({ from: { moduleId, portName, isInput }, to });
  }, [scale, pan, canvasContainerRef]);

  const handleEndConnection = useCallback((moduleId: string, portName: string, dropOnIsInput: boolean) => {
    if (dragConnection) {
        const fromModule = modules.find(m => m.id === dragConnection.from.moduleId);
        const toModule = modules.find(m => m.id === moduleId);
        if (!fromModule || !toModule || fromModule.id === toModule.id) { setDragConnection(null); return; }
        const dragFromIsInput = dragConnection.from.isInput;
        if (dragFromIsInput && !dropOnIsInput) {
            const fromPort = toModule.outputs.find(p => p.name === portName);
            const toPort = fromModule.inputs.find(p => p.name === dragConnection.from.portName);
            if (fromPort && toPort && fromPort.type === toPort.type) {
                const newConnection: Connection = { id: `conn-${Date.now()}`, from: { moduleId: toModule.id, portName: fromPort.name }, to: { moduleId: fromModule.id, portName: toPort.name } };
                setConnections(prev => [...prev.filter(c => !(c.to.moduleId === fromModule.id && c.to.portName === toPort.name)), newConnection]);
            } else if (fromPort && toPort && fromPort.type !== toPort.type) {
                notifyIncompatible(fromPort.type, toPort.type);
            }
        } else if (!dragFromIsInput && dropOnIsInput) {
            const fromPort = fromModule.outputs.find(p => p.name === dragConnection.from.portName);
            const toPort = toModule.inputs.find(p => p.name === portName);
            if (fromPort && toPort && fromPort.type === toPort.type) {
                const newConnection: Connection = { id: `conn-${Date.now()}`, from: { moduleId: fromModule.id, portName: fromPort.name }, to: { moduleId: toModule.id, portName: toPort.name } };
                setConnections(prev => [...prev.filter(c => !(c.to.moduleId === toModule.id && c.to.portName === toPort.name)), newConnection]);
            } else if (fromPort && toPort && fromPort.type !== toPort.type) {
                notifyIncompatible(fromPort.type, toPort.type);
            }
        }
    }
    setDragConnection(null);
  }, [dragConnection, modules, setConnections, notifyIncompatible]);

  const handleTapPort = useCallback((moduleId: string, portName: string, isInput: boolean) => {
    cancelDragConnection(); 
    if (isInput) {
        if (tappedSourcePort) {
            const sourceModule = modules.find(m => m.id === tappedSourcePort.moduleId);
            const targetModule = modules.find(m => m.id === moduleId);
            if (!sourceModule || !targetModule || sourceModule.id === targetModule.id) { setTappedSourcePort(null); return; }
            const sourcePort = sourceModule.outputs.find(p => p.name === tappedSourcePort.portName);
            const targetPort = targetModule.inputs.find(p => p.name === portName);
            if (sourcePort && targetPort && sourcePort.type === targetPort.type) {
                const newConnection: Connection = { id: `conn-${Date.now()}`, from: tappedSourcePort, to: { moduleId, portName } };
                setConnections(prev => [...prev.filter(c => !(c.to.moduleId === moduleId && c.to.portName === portName)), newConnection]);
            } else if (sourcePort && targetPort && sourcePort.type !== targetPort.type) {
                notifyIncompatible(sourcePort.type, targetPort.type);
            }
            setTappedSourcePort(null);
        }
    } else {
        if (tappedSourcePort && tappedSourcePort.moduleId === moduleId && tappedSourcePort.portName === portName) setTappedSourcePort(null);
        else setTappedSourcePort({ moduleId, portName });
    }
  }, [tappedSourcePort, modules, setConnections, cancelDragConnection, notifyIncompatible]);
  
    const handleCanvasTouchEnd = (e: React.TouchEvent) => { if (dragConnection) cancelDragConnection(); }
    const handleConnectionDoubleClick = useCallback((connectionId: string) => { setConnections(prev => prev.filter(c => c.id !== connectionId)); }, [setConnections]);

  // Handle Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        isSpacePressed.current = true;
        if (canvasContainerRef.current) {
          canvasContainerRef.current.style.cursor = 'grabbing';
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
        if (!isPanning.current && canvasContainerRef.current) {
          canvasContainerRef.current.style.cursor = 'grab';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasContainerRef]);

  return (
    <div className="w-full h-full relative cursor-grab" onDragOver={handleDragOver} onDrop={handleDrop} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} onTouchEnd={handleCanvasTouchEnd} onWheel={handleWheel}>
      
      {/* Modules - Rendered FIRST to be below connections, but z-index handles layering anyway. 
          We use z-10 for modules and z-20 for SVG to ensure connections are on top. */}
      <div className="relative z-10" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: 'top left' }}>
        {/* Container boxes for Scenario Runner and Pipeline Explainer */}
        {modules
          .filter(module => module.type === ModuleType.ScenarioRunner || module.type === ModuleType.PipelineExplainer)
          .map(module => {
            const boxPadding = 20;
            const moduleWidth = 224; // w-56
            const moduleHeight = 120; // Increased height to accommodate module content
            const boxWidth = moduleWidth + boxPadding * 2;
            const boxHeight = moduleHeight + boxPadding * 2;
            const boxX = module.position.x - boxPadding;
            const boxY = module.position.y - boxPadding;
            
            return (
              <div
                key={`box-${module.id}`}
                className={`absolute border-2 ${theme === 'light' ? 'border-gray-300 bg-gray-100/20' : 'border-gray-500 bg-gray-800/20'} rounded-lg pointer-events-none`}
                style={{
                  left: `${boxX}px`,
                  top: `${boxY}px`,
                  width: `${boxWidth}px`,
                  height: `${boxHeight}px`,
                }}
              />
            );
          })}
        
        {modules.map(module => {
          // Check if all connected inputs have a source module with status 'Success'
          const isRunnable = module.inputs.every(input => {
              const connection = connections.find(c => c.to.moduleId === module.id && c.to.portName === input.name);
              if (!connection) return true; // If not connected, it might fail at runtime but "runnable" logic is about upstream readiness.
              const sourceModule = modules.find(m => m.id === connection.from.moduleId);
              return sourceModule?.status === ModuleStatus.Success;
          });

          return (
            <ModuleNode 
                key={module.id} module={module} allModules={modules} allConnections={connections}
                isSelected={selectedModuleIds.includes(module.id)} 
                onDragStart={handleModuleDragStart} onTouchDragStart={handleModuleTouchDragStart}
                onEditParameters={onEditParameters}
                portRefs={portRefs} onStartConnection={handleStartConnection} onEndConnection={handleEndConnection}
                onViewDetails={onViewDetails} scale={scale} onRunModule={onRunModule}
                tappedSourcePort={tappedSourcePort} onTapPort={handleTapPort}
                cancelDragConnection={cancelDragConnection} onDelete={onDeleteModule}
                onModuleNameChange={onUpdateModuleName} 
                onUpdateModuleParameters={onUpdateModuleParameters}
                dragConnection={dragConnection}
                isRunnable={isRunnable}
            />
          );
        })}
      </div>

      {/* SVG Connections - Rendered AFTER modules to place them ON TOP (via DOM order and z-index) */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" /></marker>
            <marker id="arrow-drag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" /></marker>
        </defs>
        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`}}>
            {connections.map(conn => {
                const fromModule = modules.find(m => m.id === conn.from.moduleId);
                const toModule = modules.find(m => m.id === conn.to.moduleId);
                if (!fromModule || !toModule) return null;
                const start = getPortPosition(fromModule, conn.from.portName, false);
                const end = getPortPosition(toModule, conn.to.portName, true);
                const pathD = `M${start.x},${start.y} C${start.x},${start.y + 75} ${end.x},${end.y - 75} ${end.x},${end.y}`;
                return (
                    <g key={conn.id} onDoubleClick={() => handleConnectionDoubleClick(conn.id)}>
                        <path d={pathD} stroke={theme === 'light' ? '#1f2937' : '#9ca3af'} strokeWidth={theme === 'light' ? "2.5" : "2"} fill="none" markerEnd="url(#arrow)" style={{ pointerEvents: 'none' }} />
                        <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" style={{ cursor: 'pointer', pointerEvents: 'stroke' }}>
                          <title>Double-click to delete connection</title>
                        </path>
                    </g>
                )
            })}
            {dragConnection && (() => {
                    const fromModule = modules.find(m => m.id === dragConnection.from.moduleId); if (!fromModule) return null;
                    const isInput = dragConnection.from.isInput;
                    const start = getPortPosition(fromModule, dragConnection.from.portName, isInput);
                    const end = dragConnection.to;
                    const path = isInput ? `M${end.x},${end.y} C${end.x},${end.y + 75} ${start.x},${start.y - 75} ${start.x},${start.y}` : `M${start.x},${start.y} C${start.x},${start.y + 75} ${end.x},${end.y - 75} ${end.x},${end.y}`;
                    return <path d={path} stroke="#a78bfa" strokeWidth="3" fill="none" strokeDasharray="6,6" markerEnd={!isInput ? "url(#arrow-drag)" : undefined} markerStart={isInput ? "url(#arrow-drag)" : undefined} />
                })()}
        </g>
      </svg>
      
       {selectionBox && <div className="absolute border-2 border-dashed border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none z-30" style={{ left: Math.min(selectionBox.x1, selectionBox.x2), top: Math.min(selectionBox.y1, selectionBox.y2), width: Math.abs(selectionBox.x1 - selectionBox.x2), height: Math.abs(selectionBox.y1 - selectionBox.y2) }} />}
    </div>
  );
};
