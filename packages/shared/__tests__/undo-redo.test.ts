// path: packages/shared/__tests__/undo-redo.test.ts
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

  // Undo should remove the object.
  expect(manager.undo()).toBe(true);
  expect(manager.getObject('rect_1')).toBeNull();

  // Redo should bring it back.
  expect(manager.redo()).toBe(true);
  const afterRedo = manager.getObject('rect_1');
  expect(afterRedo).not.toBeNull();
  if (afterRedo) {
    expect(afterRedo.x).toBe(100);
    expect(afterRedo.y).toBe(150);
    expect(afterRedo.type).toBe('rectangle');
  }
});
