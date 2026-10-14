import React, { useRef, useEffect, useState } from 'react';
import './CanvasViewport.css';
import { Shape, RectangleShape, FreehandShape, TextShape } from '../models/Shape';
import ShapeComponent from './Shape';

const CanvasViewport: React.FC = () => {
  const elRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [drawingMode, setDrawingMode] = useState<'rectangle' | 'freehand'>('rectangle');

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
      // If clicking on a shape, skip panning (selection handled elsewhere).
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
      // Start drawing a rectangle
      const rect = (e.target as HTMLElement).closest('svg');
      if (rect) return; // ignore if clicked on existing shape
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
      setShapes(prev => [...prev, newRect]);
      setIsDrawing(true);
    } else if (drawingMode === 'freehand') {
      // Start freehand stroke
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
      setShapes(prev => [...prev, newFree]);
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
      setShapes(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== 'rectangle') return prev;
        const updated: RectangleShape = {
          ...last,
          width: x - startPos.x,
          height: y - startPos.y,
        };
        return [...prev.slice(0, -1), updated];
      });
    } else if (drawingMode === 'freehand') {
      setShapes(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== 'freehand') return prev;
        const updated: FreehandShape = {
          ...last,
          points: [...last.points, { x, y }],
        };
        return [...prev.slice(0, -1), updated];
      });
    }
  };

  const canvasMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  const canvasDoubleClick = (e: React.MouseEvent) => {
    // Create a text annotation at double‑click location
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
    setShapes(prev => [...prev, newText]);
  };

  const toggleSelect = (id: string) => {
    setShapes(prev =>
      prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : { ...s, selected: false }))
    );
  };

  return (
    <div className="canvas-viewport" ref={elRef}>
      <div className="canvas-controls" style={{ marginBottom: '0.5rem' }}>
        <button onClick={() => setDrawingMode(prev => (prev === 'rectangle' ? 'freehand' : 'rectangle'))}>
          Mode: {drawingMode}
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
          <ShapeComponent key={shape.id} shape={shape} onSelect={toggleSelect} />
        ))}
      </svg>
    </div>
  );
};

export default CanvasViewport;
