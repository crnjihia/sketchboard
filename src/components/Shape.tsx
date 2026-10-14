import React from 'react';
import { Shape, FreehandShape, TextShape, StickyNoteShape } from '../models/Shape';
import FreehandShapeComponent from './FreehandShape';
import TextShapeComponent from './TextShape';
import StickyNoteComponent from './StickyNote';

interface ShapeProps {
  shape: Shape;
  onSelect: (id: string) => void;
  onUpdate?: (updated: Shape) => void;
}

const ShapeComponent: React.FC<ShapeProps> = ({ shape, onSelect, onUpdate }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent canvas click
    onSelect(shape.id);
  };

  if (shape.type === 'rectangle') {
    const { x, y, width, height, color = '#ff5722', strokeWidth = 2 } = shape;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke={shape.selected ? '#000' : '#333'}
        strokeWidth={strokeWidth}
        opacity={shape.selected ? 0.6 : 1}
        onClick={handleClick}
      />
    );
  }

  if (shape.type === 'freehand') {
    const freehand = shape as FreehandShape;
    return <FreehandShapeComponent shape={freehand} onSelect={onSelect} />;
  }

  if (shape.type === 'text') {
    const text = shape as TextShape;
    return <TextShapeComponent shape={text} onSelect={onSelect} />;
  }

  if (shape.type === 'sticky') {
    const sticky = shape as StickyNoteShape;
    return <StickyNoteComponent shape={sticky} onSelect={onSelect} onUpdate={onUpdate as any} />;
  }

  // Future shapes go here
  return null;
};

export default ShapeComponent;
