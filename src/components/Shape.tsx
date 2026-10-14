import React from 'react';
import { Shape, FreehandShape, TextShape } from '../models/Shape';
import FreehandShapeComponent from './FreehandShape';
import TextShapeComponent from './TextShape';

interface ShapeProps {
  shape: Shape;
  onSelect: (id: string) => void;
}

const ShapeComponent: React.FC<ShapeProps> = ({ shape, onSelect }) => {
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

  // Future shapes go here
  return null;
};

export default ShapeComponent;
