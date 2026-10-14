import React, { useRef, useEffect } from 'react';
import './CanvasViewport.css';

import React, { useEffect, useRef, useState } from 'react';
import './CanvasViewport.css';
import { Shape, RectangleShape, hitTestRect } from '../models/Shape';
import ShapeComponent from './Shape';

const CanvasViewport: React.FC = () => {
  const elRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

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
    // Start drawing a rectangle
    const rect = (e.target as HTMLElement).closest('svg');
    if (rect) return; // ignore if clicked on existing shape
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
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
  };

  const canvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
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
  };

  const canvasMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  const toggleSelect = (id: string) => {
    setShapes(prev =>
      prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : { ...s, selected: false }))
    );
  };

  return (
    <div className="canvas-viewport" ref={elRef}>
      <svg
        width="100%"
        height="100%"
        style={{ background: 'transparent' }}
        onMouseDown={canvasMouseDown}
        onMouseMove={canvasMouseMove}
        onMouseUp={canvasMouseUp}
      >
        {shapes.map(shape => (
          <ShapeComponent key={shape.id} shape={shape} onSelect={toggleSelect} />
        ))}
      </svg>
    </div>
  );
};

export default CanvasViewport;
