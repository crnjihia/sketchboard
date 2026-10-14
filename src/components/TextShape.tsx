import React from 'react';
import { TextShape } from '../models/Shape';

interface TextShapeProps {
  shape: TextShape;
  onSelect: (id: string) => void;
}

const TextShapeComponent: React.FC<TextShapeProps> = ({ shape, onSelect }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(shape.id);
  };

  return (
    <text
      x={shape.x}
      y={shape.y}
      fill={shape.selected ? '#000' : shape.color || '#000'}
      fontSize="16"
      fontFamily="sans-serif"
      opacity={shape.selected ? 0.6 : 1}
      onClick={handleClick}
    >
      {shape.content}
    </text>
  );
};

export default TextShapeComponent;
