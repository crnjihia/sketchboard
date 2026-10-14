import React, { useState, useEffect } from 'react';
import { StickyNoteShape } from '../models/Shape';

interface StickyNoteProps {
  shape: StickyNoteShape;
  onSelect: (id: string) => void;
  onUpdate: (updated: StickyNoteShape) => void;
}

const StickyNoteComponent: React.FC<StickyNoteProps> = ({ shape, onSelect, onUpdate }) => {
  const { x, y, width, height, content, color = '#ffeb3b' } = shape;
  const [pos, setPos] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Sync position if external changes (e.g., after undo)
  useEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    onSelect(shape.id);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;
    setPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Persist new position back to the shape state via onUpdate
    onUpdate({ ...shape, x: pos.x, y: pos.y });
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, offset, pos]);

  const handleChange = (e: React.ChangeEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent ?? '';
    onUpdate({ ...shape, content: newContent, x: pos.x, y: pos.y });
  };

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: color,
    border: shape.selected ? '2px solid #000' : '1px solid #666',
    padding: '4px',
    cursor: isDragging ? 'grabbing' : 'grab',
    overflow: 'auto',
    boxSizing: 'border-box',
    userSelect: 'none',
  };

  return (
    <foreignObject x={pos.x} y={pos.y} width={width} height={height}>
      <div
        style={style}
        onMouseDown={handleMouseDown}
        contentEditable={true}
        suppressContentEditableWarning={true}
        onBlur={handleChange}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      >
        {content}
      </div>
    </foreignObject>
  );
};

export default StickyNoteComponent;
