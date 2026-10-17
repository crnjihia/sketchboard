import { Point, CanvasObject } from '../schema/objects';
import { rotatePoint, getObjectAABB, BoundingBox } from './transforms';

export type HandleType =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rot'; // rotation handle

export interface HandlePosition {
  type: HandleType;
  x: number;
  y: number;
  cursor: string;
}

/**
 * Distance from point P to line segment AB.
 */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Calculates the 8 bounding handles plus rotation handle for an object.
 */
export function getObjectHandles(obj: CanvasObject, handleMargin = 24): HandlePosition[] {
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  const rad = ((obj.rotation || 0) * Math.PI) / 180;

  const minX = Math.min(obj.x, obj.x + obj.w);
  const maxX = Math.max(obj.x, obj.x + obj.w);
  const minY = Math.min(obj.y, obj.y + obj.h);
  const maxY = Math.max(obj.y, obj.y + obj.h);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const unrotated: Array<{ type: HandleType; x: number; y: number; cursor: string }> = [
    { type: 'nw', x: minX, y: minY, cursor: 'nwse-resize' },
    { type: 'n', x: midX, y: minY, cursor: 'ns-resize' },
    { type: 'ne', x: maxX, y: minY, cursor: 'nesw-resize' },
    { type: 'e', x: maxX, y: midY, cursor: 'ew-resize' },
    { type: 'se', x: maxX, y: maxY, cursor: 'nwse-resize' },
    { type: 's', x: midX, y: maxY, cursor: 'ns-resize' },
    { type: 'sw', x: minX, y: maxY, cursor: 'nesw-resize' },
    { type: 'w', x: minX, y: midY, cursor: 'ew-resize' },
    { type: 'rot', x: midX, y: minY - handleMargin, cursor: 'grab' },
  ];

  return unrotated.map((h) => {
    const rotated = rotatePoint(h.x, h.y, cx, cy, rad);
    return {
      type: h.type,
      x: rotated.x,
      y: rotated.y,
      cursor: h.cursor,
    };
  });
}

/**
 * Tests if a world point hits a handle of an object.
 * Returns the handle type or null. Minimum touch target radius is 12px (diameter 24px).
 */
export function hitTestHandles(
  p: Point,
  obj: CanvasObject,
  zoom: number,
  touchRadius = 12
): HandleType | null {
  const hitRadiusInWorld = touchRadius / zoom;
  const handles = getObjectHandles(obj, 24 / zoom);

  for (const h of handles) {
    const dist = Math.hypot(p.x - h.x, p.y - h.y);
    if (dist <= hitRadiusInWorld) {
      return h.type;
    }
  }

  return null;
}

/**
 * Tests if a world coordinate point hits a canvas object.
 * Uses inverse rotation transformation to accurately hit-test arbitrarily rotated shapes.
 */
export function hitTestObject(p: Point, obj: CanvasObject, hitMargin = 6): boolean {
  // Broad-phase: check axis-aligned bounding box with hit margin
  const aabb = getObjectAABB(obj);
  if (
    p.x < aabb.minX - hitMargin ||
    p.x > aabb.maxX + hitMargin ||
    p.y < aabb.minY - hitMargin ||
    p.y > aabb.maxY + hitMargin
  ) {
    return false;
  }

  // Narrow-phase
  if (obj.type === 'freehand') {
    if (!obj.points || obj.points.length === 0) return false;
    const threshold = Math.max(obj.style.strokeWidth / 2, hitMargin);
    for (let i = 0; i < obj.points.length - 1; i++) {
      const p1 = obj.points[i];
      const p2 = obj.points[i + 1];
      if (distanceToSegment(p, p1, p2) <= threshold) {
        return true;
      }
    }
    return false;
  }

  // Transform point into object's unrotated local space
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const local = rotatePoint(p.x, p.y, cx, cy, -rad);

  const minX = Math.min(obj.x, obj.x + obj.w);
  const maxX = Math.max(obj.x, obj.x + obj.w);
  const minY = Math.min(obj.y, obj.y + obj.h);
  const maxY = Math.max(obj.y, obj.y + obj.h);

  switch (obj.type) {
    case 'rectangle':
    case 'sticky':
    case 'text':
      return (
        local.x >= minX - hitMargin &&
        local.x <= maxX + hitMargin &&
        local.y >= minY - hitMargin &&
        local.y <= maxY + hitMargin
      );

    case 'ellipse': {
      const rx = Math.abs(obj.w) / 2 + hitMargin;
      const ry = Math.abs(obj.h) / 2 + hitMargin;
      if (rx === 0 || ry === 0) return false;
      const normalized = ((local.x - cx) ** 2) / (rx ** 2) + ((local.y - cy) ** 2) / (ry ** 2);
      return normalized <= 1;
    }

    case 'line':
    case 'arrow': {
      const threshold = Math.max(obj.style.strokeWidth / 2, hitMargin);
      return (
        distanceToSegment(
          local,
          { x: obj.x, y: obj.y },
          { x: obj.x + obj.w, y: obj.y + obj.h }
        ) <= threshold
      );
    }

    default:
      return false;
  }
}

/**
 * Determines whether an object's bounding box intersects a marquee selection box.
 */
export function intersectsMarquee(obj: CanvasObject, marquee: BoundingBox): boolean {
  const aabb = getObjectAABB(obj);
  return !(
    aabb.maxX < marquee.minX ||
    aabb.minX > marquee.maxX ||
    aabb.maxY < marquee.minY ||
    aabb.minY > marquee.maxY
  );
}
