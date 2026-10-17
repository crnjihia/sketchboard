import { Point, CanvasObject } from '../schema/objects';
import { ViewportState } from '../schema/protocol';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

/**
 * Converts screen/client coordinates (CSS pixels) to world coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: ViewportState
): Point {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * Converts world coordinates to screen/client coordinates.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportState
): Point {
  return {
    x: worldX * viewport.zoom + viewport.x,
    y: worldY * viewport.zoom + viewport.y,
  };
}

/**
 * Rotates a 2D point around an origin (cx, cy) by an angle in radians.
 */
export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radians: number
): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Calculates the axis-aligned bounding box (AABB) of an unrotated or rotated canvas object.
 */
export function getObjectAABB(obj: CanvasObject): BoundingBox {
  const rotation = obj.rotation || 0;
  if (rotation === 0) {
    const minX = Math.min(obj.x, obj.x + obj.w);
    const maxX = Math.max(obj.x, obj.x + obj.w);
    const minY = Math.min(obj.y, obj.y + obj.h);
    const maxY = Math.max(obj.y, obj.y + obj.h);
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  const rad = (rotation * Math.PI) / 180;

  const corners = [
    rotatePoint(obj.x, obj.y, cx, cy, rad),
    rotatePoint(obj.x + obj.w, obj.y, cx, cy, rad),
    rotatePoint(obj.x + obj.w, obj.y + obj.h, cx, cy, rad),
    rotatePoint(obj.x, obj.y + obj.h, cx, cy, rad),
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
