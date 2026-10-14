import React from 'react';
import { Shape } from '../models/Shape';

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

  // Future shapes go here
  return null;
};

export default ShapeComponent;
