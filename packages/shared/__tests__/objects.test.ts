import { describe, it, expect } from 'vitest';
import {
  validateCanvasObject,
  safeParseCanvasObject,
  RectangleObject,
  StickyObject,
  FreehandObject,
} from '../src/schema/objects';

describe('Canvas Objects Zod Schemas', () => {
  it('validates a rectangle object', () => {
    const rect: RectangleObject = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 150,
      w: 200,
      h: 120,
      rotation: 0,
      z: 1,
      style: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
      },
      createdBy: 'user-1',
      updatedAt: Date.now(),
    };

    const parsed = validateCanvasObject(rect);
    expect(parsed.type).toBe('rectangle');
    expect(parsed.id).toBe('rect-1');
  });

  it('validates a sticky note with Swahili color and author tag', () => {
    const sticky: StickyObject = {
      id: 'sticky-1',
      type: 'sticky',
      x: 300,
      y: 200,
      w: 200,
      h: 200,
      rotation: 0,
      z: 2,
      style: {
        fill: '#FDE047',
        stroke: '#EAB308',
        strokeWidth: 1,
        opacity: 0.95,
      },
      text: 'Jambo Kenya! Design sprint 2026',
      authorName: 'Amina Kimani',
      color: 'Njano',
      fontSize: 16,
      createdBy: 'user-2',
      updatedAt: Date.now(),
    };

    const parsed = validateCanvasObject(sticky) as StickyObject;
    expect(parsed.type).toBe('sticky');
    expect(parsed.authorName).toBe('Amina Kimani');
    expect(parsed.color).toBe('Njano');
  });

  it('validates a freehand drawing stroke with points', () => {
    const freehand: FreehandObject = {
      id: 'freehand-1',
      type: 'freehand',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      rotation: 0,
      z: 3,
      style: {
        fill: 'transparent',
        stroke: '#4ADE80',
        strokeWidth: 4,
        opacity: 1,
      },
      points: [
        { x: 10, y: 10, pressure: 0.5 },
        { x: 25, y: 30, pressure: 0.8 },
      ],
      createdBy: 'user-3',
      updatedAt: Date.now(),
    };

    const parsed = validateCanvasObject(freehand) as FreehandObject;
    expect(parsed.type).toBe('freehand');
    expect(parsed.points).toHaveLength(2);
  });

  it('rejects invalid objects gracefully', () => {
    const invalid = {
      id: 'bad-1',
      type: 'unknown-shape',
      x: 0,
      y: 0,
    };
    expect(safeParseCanvasObject(invalid)).toBeNull();
  });
});
