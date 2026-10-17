import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BoardDocManager,
  SceneCache,
  Point,
  RemoteCursor,
  CanvasObject,
} from '@sketchboard/shared';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { useCanvasStore } from '../store/useCanvasStore';
import { Toolbar } from './Toolbar';
import { TextEditorOverlay } from './TextEditorOverlay';
import { PerfOverlay } from './PerfOverlay';
import { HelpDialog } from './HelpDialog';

interface CanvasContainerProps {
  docManager: BoardDocManager;
  sceneCache: SceneCache;
  onEmitCursor: (pos: Point) => void;
  remoteCursors: RemoteCursor[];
  userName: string;
}

export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  docManager,
  sceneCache,
  onEmitCursor,
  remoteCursors,
  userName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  const {
    tool,
    setTool,
    selectedIds,
    setSelectedIds,
    setEditingId,
    activeColor,
    activeStrokeColor,
    activeStrokeWidth,
    viewport,
    setViewport,
    gridEnabled,
    setPerfMetrics,
  } = useCanvasStore();

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Initialize CanvasEngine
  useEffect(() => {
    if (!containerRef.current || !sceneCanvasRef.current || !overlayCanvasRef.current) return;

    const engine = new CanvasEngine({
      container: containerRef.current,
      sceneCanvas: sceneCanvasRef.current,
      overlayCanvas: overlayCanvasRef.current,
      docManager,
      sceneCache,
      onSelect: (ids) => setSelectedIds(ids),
      onEdit: (id) => setEditingId(id),
      onCursorMove: (worldPt) => onEmitCursor(worldPt),
      onPerfUpdate: (metrics) => setPerfMetrics(metrics),
    });

    engine.userName = userName;
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [docManager, onEmitCursor, sceneCache, setEditingId, setPerfMetrics, setSelectedIds, userName]);

  // Sync state to engine
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.currentTool = tool;
    engineRef.current.activeColor = activeColor;
    engineRef.current.activeStrokeColor = activeStrokeColor;
    engineRef.current.activeStrokeWidth = activeStrokeWidth;
    engineRef.current.gridEnabled = gridEnabled;
    engineRef.current.setSelectedIds(selectedIds);
  }, [tool, activeColor, activeStrokeColor, activeStrokeWidth, gridEnabled, selectedIds]);

  // Sync remote cursors to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setRemoteCursors(remoteCursors);
    }
  }, [remoteCursors]);

  // Sync external viewport updates (e.g. from toolbar buttons) to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setViewport(viewport);
    }
  }, [viewport]);

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing inside textarea or input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'h':
          setTool('hand');
          break;
        case 'r':
          setTool('rectangle');
          break;
        case 'o':
          setTool('ellipse');
          break;
        case 'l':
          setTool('line');
          break;
        case 'a':
          if (cmdOrCtrl) {
            e.preventDefault();
            // Select all shapes
            const all = sceneCache.getSortedObjects().map((o) => o.id);
            setSelectedIds(all);
          } else {
            setTool('arrow');
          }
          break;
        case 'p':
          setTool('freehand');
          break;
        case 't':
          setTool('text');
          break;
        case 'n':
          setTool('sticky');
          break;
        case 'g':
          useCanvasStore.getState().toggleGrid();
          break;
        case 'z':
          if (cmdOrCtrl) {
            e.preventDefault();
            if (e.shiftKey) {
              docManager.redo();
            } else {
              docManager.undo();
            }
          }
          break;
        case 'y':
          if (cmdOrCtrl) {
            e.preventDefault();
            docManager.redo();
          }
          break;
        case '?':
          setIsHelpOpen((prev) => !prev);
          break;
        case 'delete':
        case 'backspace':
          if (selectedIds.length > 0) {
            e.preventDefault();
            for (const id of selectedIds) {
              docManager.deleteObject(id, 'local');
            }
            setSelectedIds([]);
          }
          break;
        case 'd':
          if (cmdOrCtrl && selectedIds.length > 0) {
            e.preventDefault();
            // Duplicate selected shapes with offset
            const duplicatedIds: string[] = [];
            for (const id of selectedIds) {
              const original = sceneCache.getObject(id);
              if (original) {
                const newId = 'dup_' + Math.random().toString(36).substring(2, 9);
                const clone: CanvasObject = {
                  ...original,
                  id: newId,
                  x: original.x + 24,
                  y: original.y + 24,
                  z: sceneCache.getSortedObjects().length + 1,
                  updatedAt: Date.now(),
                };
                docManager.addObject(clone, 'local');
                duplicatedIds.push(newId);
              }
            }
            setSelectedIds(duplicatedIds);
          }
          break;
        case '[':
          if (selectedIds.length === 1) {
            docManager.sendBackward(selectedIds[0], 'local');
          }
          break;
        case ']':
          if (selectedIds.length === 1) {
            docManager.bringForward(selectedIds[0], 'local');
          }
          break;
        case 'arrowup':
        case 'arrowdown':
        case 'arrowleft':
        case 'arrowright': {
          if (selectedIds.length > 0) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            for (const id of selectedIds) {
              const obj = sceneCache.getObject(id);
              if (obj) {
                docManager.updateObject(id, { x: obj.x + dx, y: obj.y + dy }, 'local');
              }
            }
          }
          break;
        }
      }
    },
    [docManager, sceneCache, selectedIds, setSelectedIds, setTool]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      data-testid="canvas-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#090d16',
        touchAction: 'none',
      }}
    >
      {/* Layer 1: Static Scene Canvas */}
      <canvas
        ref={sceneCanvasRef}
        data-testid="scene-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Layer 2: Interaction & Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        data-testid="overlay-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Positioned DOM Textarea Overlay for text/sticky editing */}
      <TextEditorOverlay docManager={docManager} sceneCache={sceneCache} />

      {/* Floating Toolbar */}
      <Toolbar />

      {/* Debug Performance HUD (?debug=1) */}
      <PerfOverlay />

      {/* Help Modal */}
      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
