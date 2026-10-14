import React from 'react';
import { FreehandShape } from '../models/Shape';

interface FreehandShapeProps {
  shape: FreehandShape;
  onSelect: (id: string) => void;
}

const FreehandShapeComponent: React.FC<FreehandShapeProps> = ({ shape, onSelect }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(shape.id);
  };

  const points = shape.points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <polyline
      points={points}
      fill="none"
      stroke={shape.selected ? '#000' : shape.color || '#ff5722'}
      strokeWidth={shape.strokeWidth || 2}
      opacity={shape.selected ? 0.6 : 1}
      onClick={handleClick}
    />
  );
};

export default FreehandShapeComponent;
