// path: packages/shared/__tests__/undo-redo.test.ts
import { test, expect } from 'vitest';
import { BoardDocManager } from '../src/crdt/board-doc';
import { CanvasObjectSchema } from '../src/schema/objects';

test('BoardDocManager undo/redo workflow', () => {
  // Initialise with a tracked origin so the UndoManager is active.
  const manager = new BoardDocManager('test-board', undefined, new Set(['local']));

  // Create a simple rectangle object using the schema for validation.
  const rect = CanvasObjectSchema.parse({
    id: 'rect_1',
    type: 'rectangle',
    x: 100,
    y: 150,
    w: 200,
    h: 120,
    rotation: 0,
    z: 1,
    style: { fill: '#f59e0b', stroke: '#1e293b', strokeWidth: 2, opacity: 1 },
    createdBy: 'tester',
    updatedAt: Date.now(),
  });

  // Add the object locally.
  manager.addObject(rect, 'local');
  expect(manager.getObject('rect_1')).not.toBeNull();

  // Update position locally
  manager.updateObject('rect_1', { x: 300, y: 300 }, 'local');
  expect(manager.getObject('rect_1')?.x).toBe(300);

  // Undo should revert position to 100
  expect(manager.undo()).toBe(true);
  expect(manager.getObject('rect_1')?.x).toBe(100);

  // Redo should move back to 300
  expect(manager.redo()).toBe(true);
  expect(manager.getObject('rect_1')?.x).toBe(300);
});
