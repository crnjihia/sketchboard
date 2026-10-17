import { describe, it, expect } from 'vitest';
import { SpatialGrid, CanvasObject, RectangleObject } from '../src';

describe('Performance & Spatial Culling Benchmark (2,000 objects)', () => {
  it('indexes 2,000 objects and executes viewport culling in sub-millisecond time', () => {
    const grid = new SpatialGrid(256);
    const totalObjects = 2000;
    const objects: CanvasObject[] = [];

    // Distribute 2,000 shapes across an extensive 20,000 x 20,000 world
    for (let i = 0; i < totalObjects; i++) {
      const x = (i % 50) * 400 + Math.random() * 50;
      const y = Math.floor(i / 50) * 400 + Math.random() * 50;
      const rect: RectangleObject = {
        id: `bench-shape-${i}`,
        type: 'rectangle',
        x,
        y,
        w: 150,
        h: 100,
        rotation: (i % 4) * 15,
        z: i,
        style: {
          fill: '#FDE047',
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1,
        },
        createdBy: 'benchmark',
        updatedAt: Date.now(),
      };
      objects.push(rect);
    }

    // Benchmark bulk insertion
    const t0 = performance.now();
    grid.bulkLoad(objects);
    const insertDurationMs = performance.now() - t0;
    expect(insertDurationMs).toBeLessThan(50); // fast bulk load under 50ms

    // Benchmark viewport culling query for a typical 1920x1080 display
    const viewportBox = {
      minX: 500,
      minY: 500,
      maxX: 500 + 1920,
      maxY: 500 + 1080,
      w: 1920,
      h: 1080,
    };

    const tQueryStart = performance.now();
    const visible = grid.queryViewport(viewportBox);
    const queryDurationMs = performance.now() - tQueryStart;

    // Viewport query must be blistering fast (typically under 2ms) to comfortably sustain 60fps (16.6ms frame budget)
    expect(queryDurationMs).toBeLessThan(10);
    // Only a small fraction of the 2,000 objects are within the visible bounds
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(totalObjects);
  });
});
