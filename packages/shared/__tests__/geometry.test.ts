import { describe, it, expect } from 'vitest';
import {
  screenToWorld,
  worldToScreen,
  rotatePoint,
  hitTestObject,
  hitTestHandles,
  getObjectHandles,
  SpatialGrid,
  smoothPoints,
  wrapText,
  RectangleObject,
  EllipseObject,
} from '../src';

describe('Geometry & Hit-Testing Engine', () => {
  const sampleRect: RectangleObject = {
    id: 'rect-geo',
    type: 'rectangle',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    z: 1,
    style: { fill: '#FDE047', stroke: '#000000', strokeWidth: 2, opacity: 1 },
    createdBy: 'u1',
    updatedAt: 1,
  };

  it('correctly maps coordinates between screen and world with pan and zoom', () => {
    const viewport = { x: 50, y: -100, zoom: 2 };
    const screenPt = { x: 250, y: 100 };
    const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);

    expect(worldPt.x).toBe(100);
    expect(worldPt.y).toBe(100);

    const backToScreen = worldToScreen(worldPt.x, worldPt.y, viewport);
    expect(backToScreen.x).toBe(250);
    expect(backToScreen.y).toBe(100);
  });

  it('hit-tests unrotated and rotated rectangles accurately', () => {
    // Unrotated: inside (150, 150)
    expect(hitTestObject({ x: 150, y: 150 }, sampleRect)).toBe(true);
    // Outside (50, 50)
    expect(hitTestObject({ x: 50, y: 50 }, sampleRect)).toBe(false);

    // Rotated 45 degrees
    const rotatedRect: RectangleObject = {
      ...sampleRect,
      rotation: 45,
    };
    // Center is (200, 175)
    expect(hitTestObject({ x: 200, y: 175 }, rotatedRect)).toBe(true);
  });

  it('hit-tests ellipses using normalized conic equations', () => {
    const ellipse: EllipseObject = {
      id: 'ell-1',
      type: 'ellipse',
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      rotation: 0,
      z: 1,
      style: { fill: '#60A5FA', stroke: '#000000', strokeWidth: 2, opacity: 1 },
      createdBy: 'u1',
      updatedAt: 1,
    };

    // Center is at (150, 150) -> inside
    expect(hitTestObject({ x: 150, y: 150 }, ellipse)).toBe(true);
    // Corner at (101, 101) -> outside circle
    expect(hitTestObject({ x: 101, y: 101 }, ellipse)).toBe(false);
  });

  it('detects interaction handles with touch target radius', () => {
    const handles = getObjectHandles(sampleRect);
    expect(handles).toHaveLength(9); // 8 resize + 1 rotation

    const nwHandle = handles.find((h) => h.type === 'nw')!;
    // Point right on handle
    expect(hitTestHandles({ x: nwHandle.x, y: nwHandle.y }, sampleRect, 1, 12)).toBe('nw');

    // Rotation handle
    const rotHandle = handles.find((h) => h.type === 'rot')!;
    expect(hitTestHandles({ x: rotHandle.x, y: rotHandle.y }, sampleRect, 1, 12)).toBe('rot');
  });

  it('SpatialGrid culls off-screen objects and finds visible objects', () => {
    const grid = new SpatialGrid(256);
    const objVisible: RectangleObject = { ...sampleRect, id: 'visible', x: 50, y: 50 };
    const objOffscreen: RectangleObject = { ...sampleRect, id: 'far-away', x: 5000, y: 5000 };

    grid.insert(objVisible);
    grid.insert(objOffscreen);

    const viewportAABB = { minX: 0, minY: 0, maxX: 800, maxY: 600, w: 800, h: 600 };
    const visible = grid.queryViewport(viewportAABB);

    expect(visible.map((o) => o.id)).toContain('visible');
    expect(visible.map((o) => o.id)).not.toContain('far-away');
  });

  it('smooths freehand points and wraps text', () => {
    const rawPoints = [
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
    ];
    const smoothed = smoothPoints(rawPoints, 2);
    expect(smoothed.length).toBeGreaterThan(rawPoints.length);

    const lines = wrapText('Jambo Kenya! Design canvas for teams in Nairobi', 150);
    expect(lines.length).toBeGreaterThan(1);
  });
});
