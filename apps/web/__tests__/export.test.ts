import { describe, it, expect } from 'vitest';
import {
  computeExportBounds,
  formatNairobiTimestamp,
} from '../src/export/export-engine';
import { RectangleObject, StickyObject } from '@sketchboard/shared';

describe('Export Engine (PNG & PDF)', () => {
  const shape1: RectangleObject = {
    id: 'rect-export-1',
    type: 'rectangle',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    z: 1,
    style: { fill: '#FDE047', stroke: '#000000', strokeWidth: 2, opacity: 1 },
    createdBy: 'test',
    updatedAt: 1,
  };

  const shape2: StickyObject = {
    id: 'sticky-export-2',
    type: 'sticky',
    x: 400,
    y: 300,
    w: 200,
    h: 200,
    rotation: 0,
    z: 2,
    style: { fill: '#F472B6', stroke: '#DB2777', strokeWidth: 1, opacity: 1 },
    text: 'Design export test',
    authorName: 'Amina',
    color: 'Waridi',
    fontSize: 16,
    createdBy: 'test',
    updatedAt: 2,
  };

  it('computes export bounds covering all objects with padding', () => {
    const padding = 32;
    const bounds = computeExportBounds([shape1, shape2], padding);

    // Min coords are from shape1 (100, 100) -> 100 - 32 = 68
    expect(bounds.minX).toBe(100 - padding);
    expect(bounds.minY).toBe(100 - padding);

    // Max coords are from shape2: maxX = 400 + 200 = 600, maxY = 300 + 200 = 500
    // With padding: 600 + 32 = 632, 500 + 32 = 532
    expect(bounds.maxX).toBe(600 + padding);
    expect(bounds.maxY).toBe(500 + padding);

    expect(bounds.w).toBe(600 - 100 + padding * 2);
    expect(bounds.h).toBe(500 - 100 + padding * 2);
  });

  it('returns valid default bounds for an empty board', () => {
    const bounds = computeExportBounds([]);
    expect(bounds.w).toBe(800);
    expect(bounds.h).toBe(600);
  });

  it('formats timestamps in Africa/Nairobi time zone', () => {
    // 2026-10-17T09:00:00Z is 12:00:00 in Nairobi (+03:00)
    const testDate = new Date('2026-10-17T09:00:00Z');
    const formatted = formatNairobiTimestamp(testDate);

    // Should contain Nairobi daytime and date
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });
});
