// Shape model and utilities
export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'freehand';

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  selected?: boolean;
  color?: string;
  strokeWidth?: number;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
}

export type Shape = RectangleShape; // Extend with other shapes later

/** Simple hit‑test for a rectangle shape */
export function hitTestRect(shape: RectangleShape, px: number, py: number): boolean {
  const minX = Math.min(shape.x, shape.x + shape.width);
  const maxX = Math.max(shape.x, shape.x + shape.width);
  const minY = Math.min(shape.y, shape.y + shape.height);
  const maxY = Math.max(shape.y, shape.y + shape.height);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/** Serialize a shape to JSON */
export function serializeShape(shape: Shape): string {
  return JSON.stringify(shape);
}

/** Deserialize a shape from JSON */
export function deserializeShape(json: string): Shape {
  return JSON.parse(json) as Shape;
}
