import React, { useEffect, useRef, useState } from 'react';
import './CanvasViewport.css';
import { Shape, RectangleShape, FreehandShape, TextShape, StickyNoteShape } from '../models/Shape';
import ShapeComponent from './Shape';
import { useYjs } from '../context/YjsContext';

const CanvasViewport: React.FC = () => {
  const elRef = useRef<HTMLDivElement>(null);
  const { shapesArray, addShape, updateShape } = useYjs();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [drawingMode, setDrawingMode] = useState<'rectangle' | 'freehand'>('rectangle');

  // Sync local shapes with Yjs array
  useEffect(() => {
    const sync = () => {
      setShapes(shapesArray.toArray());
    };
    shapesArray.observe(sync);
    sync();
    return () => shapesArray.unobserve(sync);
  }, [shapesArray]);

  // Simple pan/zoom placeholder (unchanged) – we keep it for later.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let offsetX = 0;
    let offsetY = 0;
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('svg')?.contains(e.target as Node)) return;
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      offsetX += dx;
      offsetY += dy;
      el.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`;
      panStartX = e.clientX;
      panStartY = e.clientY;
    };
    const onMouseUp = () => {
      isPanning = false;
    };
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const canvasMouseDown = (e: React.MouseEvent) => {
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    if (drawingMode === 'rectangle') {
      const rect = (e.target as HTMLElement).closest('svg');
      if (rect) return;
      setStartPos({ x, y });
      const newRect: RectangleShape = {
        id: `${Date.now()}-${Math.random()}`,
        type: 'rectangle',
        x,
        y,
        width: 0,
        height: 0,
        selected: false,
      };
      addShape(newRect);
      setIsDrawing(true);
    } else if (drawingMode === 'freehand') {
      const newFree: FreehandShape = {
        id: `${Date.now()}-${Math.random()}`,
        type: 'freehand',
        x,
        y,
        points: [{ x, y }],
        selected: false,
        color: '#ff5722',
        strokeWidth: 2,
      };
      addShape(newFree);
      setIsDrawing(true);
    }
  };

  const canvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    if (drawingMode === 'rectangle') {
      if (!startPos) return;
      const latest = shapesArray.toArray().slice(-1)[0];
      if (!latest || latest.type !== 'rectangle') return;
      const updated: RectangleShape = {
        ...latest,
        width: x - startPos.x,
        height: y - startPos.y,
      };
      updateShape(updated);
    } else if (drawingMode === 'freehand') {
      const latest = shapesArray.toArray().slice(-1)[0];
      if (!latest || latest.type !== 'freehand') return;
      const updated: FreehandShape = {
        ...latest,
        points: [...(latest.points ?? []), { x, y }],
      };
      updateShape(updated);
    }
  };

  const canvasMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  const canvasDoubleClick = (e: React.MouseEvent) => {
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const newText: TextShape = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'text',
      x,
      y,
      content: 'Edit me',
      selected: false,
      color: '#000',
      strokeWidth: 1,
    };
    addShape(newText);
  };

  const toggleSelect = (id: string) => {
    // Ensure exclusive selection: only one shape selected at a time
    const current = shapesArray.toArray();
    current.forEach(s => {
      const updated = { ...s, selected: s.id === id ? !s.selected : false };
      updateShape(updated as Shape);
    });
  };

  const handleShapeUpdate = (updated: Shape) => {
    updateShape(updated);
  };

  return (
    <div className="canvas-viewport" ref={elRef}>
      <div className="canvas-controls" style={{ marginBottom: '0.5rem' }}>
        <button onClick={() => setDrawingMode(prev => (prev === 'rectangle' ? 'freehand' : 'rectangle'))}>
          Mode: {drawingMode}
        </button>
        <button
          onClick={() => {
            const defaultX = 100;
            const defaultY = 100;
            const newSticky: StickyNoteShape = {
              id: `${Date.now()}-${Math.random()}`,
              type: 'sticky',
              x: defaultX,
              y: defaultY,
              width: 200,
              height: 150,
              content: 'Edit me',
              selected: false,
              color: '#ffeb3b',
              strokeWidth: 1,
            };
            addShape(newSticky);
          }}
        >
          Add Sticky Note
        </button>
      </div>
      <svg
        width="100%"
        height="100%"
        style={{ background: 'transparent' }}
        onMouseDown={canvasMouseDown}
        onMouseMove={canvasMouseMove}
        onMouseUp={canvasMouseUp}
        onDoubleClick={canvasDoubleClick}
      >
        {shapes.map(shape => (
          <ShapeComponent key={shape.id} shape={shape} onSelect={toggleSelect} onUpdate={handleShapeUpdate} />
        ))}
      </svg>
    </div>
  );
};

export default CanvasViewport;
