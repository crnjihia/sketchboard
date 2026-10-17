import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { BoardDocManager } from '../src/crdt/board-doc';
import { SceneCache } from '../src/crdt/scene-cache';
import { RectangleObject } from '../src/schema/objects';

describe('BoardDocManager CRDT Document Model', () => {
  const sampleRect: RectangleObject = {
    id: 'shape-1',
    type: 'rectangle',
    x: 50,
    y: 60,
    w: 120,
    h: 80,
    rotation: 0,
    z: 1,
    style: {
      fill: '#FDE047',
      stroke: '#EAB308',
      strokeWidth: 2,
      opacity: 1,
    },
    createdBy: 'user-a',
    updatedAt: 1000,
  };

  it('initializes and manages objects and zOrder', () => {
    const manager = new BoardDocManager('board-1');
    manager.addObject(sampleRect);

    const retrieved = manager.getObject('shape-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.x).toBe(50);
    expect(manager.getZOrder()).toEqual(['shape-1']);
    expect(manager.getSortedObjects()).toHaveLength(1);
  });

  it('resolves property-level concurrent edits without clobbering (both win)', () => {
    // Client A and Client B start from the same base doc
    const managerA = new BoardDocManager('board-1');
    managerA.addObject(sampleRect);

    // Sync Client B from Client A
    const managerB = new BoardDocManager('board-1');
    managerB.applyUpdate(managerA.getSnapshot());

    // Client A moves the shape: mutates x & y
    managerA.updateObject('shape-1', { x: 300, y: 400 });

    // Client B concurrently edits the style (color) and width
    managerB.updateObject('shape-1', {
      w: 250,
      style: {
        fill: '#4ADE80',
        stroke: '#16A34A',
        strokeWidth: 4,
        opacity: 0.9,
      },
    });

    // Exchange updates
    const updateA = managerA.diffUpdate(managerB.getStateVector());
    const updateB = managerB.diffUpdate(managerA.getStateVector());

    managerB.applyUpdate(updateA);
    managerA.applyUpdate(updateB);

    // Both clients must have merged properties successfully!
    const objA = managerA.getObject('shape-1');
    const objB = managerB.getObject('shape-1');

    expect(objA).toBeDefined();
    expect(objB).toBeDefined();

    // Client A's movement was preserved
    expect(objA?.x).toBe(300);
    expect(objA?.y).toBe(400);
    expect(objB?.x).toBe(300);
    expect(objB?.y).toBe(400);

    // Client B's style and width were preserved
    expect(objA?.w).toBe(250);
    expect(objA?.style.fill).toBe('#4ADE80');
    expect(objB?.w).toBe(250);
    expect(objB?.style.fill).toBe('#4ADE80');

    // Both docs must be byte-identical in Yjs snapshot
    const snapA = managerA.getSnapshot();
    const snapB = managerB.getSnapshot();
    expect(snapA).toEqual(snapB);
  });

  it('converges deterministically when two users concurrently edit the same property', () => {
    const managerA = new BoardDocManager('board-1');
    managerA.addObject(sampleRect);

    const managerB = new BoardDocManager('board-1');
    managerB.applyUpdate(managerA.getSnapshot());

    // Both users update 'x' concurrently
    managerA.updateProperty('shape-1', 'x', 500);
    managerB.updateProperty('shape-1', 'x', 900);

    // Exchange diffs
    const diffA = managerA.diffUpdate(managerB.getStateVector());
    const diffB = managerB.diffUpdate(managerA.getStateVector());

    managerB.applyUpdate(diffA);
    managerA.applyUpdate(diffB);

    const valA = managerA.getObject('shape-1')?.x;
    const valB = managerB.getObject('shape-1')?.x;

    // Both must converge to the same deterministic value
    expect(valA).toBe(valB);
    expect(managerA.getSnapshot()).toEqual(managerB.getSnapshot());
  });

  it('manages zOrder layering correctly', () => {
    const manager = new BoardDocManager('board-1');
    manager.addObject({ ...sampleRect, id: 'shape-1' });
    manager.addObject({ ...sampleRect, id: 'shape-2' });
    manager.addObject({ ...sampleRect, id: 'shape-3' });

    expect(manager.getZOrder()).toEqual(['shape-1', 'shape-2', 'shape-3']);

    manager.bringToFront('shape-1');
    expect(manager.getZOrder()).toEqual(['shape-2', 'shape-3', 'shape-1']);

    manager.sendToBack('shape-3');
    expect(manager.getZOrder()).toEqual(['shape-3', 'shape-2', 'shape-1']);
  });

  it('SceneCache observes Y.Doc deep changes and manages dirty state', () => {
    const manager = new BoardDocManager('board-1');
    const cache = new SceneCache(manager);

    expect(cache.isDirty).toBe(true);
    cache.resetDirty();
    expect(cache.isDirty).toBe(false);

    // Mutating object triggers deep observer and sets isDirty
    manager.addObject(sampleRect);
    expect(cache.isDirty).toBe(true);
    expect(cache.getObject('shape-1')?.id).toBe('shape-1');

    cache.resetDirty();
    manager.updateProperty('shape-1', 'x', 777);
    expect(cache.isDirty).toBe(true);
    expect(cache.getObject('shape-1')?.x).toBe(777);

    cache.destroy();
  });

  it('provides undo and redo scoped to user tracked origins', () => {
    const manager = new BoardDocManager('board-1', undefined, new Set(['local']));

    // 1. Add object locally
    manager.addObject(sampleRect, 'local');
    expect(manager.getObject('shape-1')).toBeDefined();
    expect(manager.canUndo()).toBe(true);

    // 2. Undo local addition
    const undone = manager.undo();
    expect(undone).toBe(true);
    expect(manager.getObject('shape-1')).toBeNull();
    expect(manager.canRedo()).toBe(true);

    // 3. Redo local addition
    const redone = manager.redo();
    expect(redone).toBe(true);
    expect(manager.getObject('shape-1')).toBeDefined();

    // 4. Remote change with origin 'remote' should NOT be undone by local undoManager
    manager.updateProperty('shape-1', 'x', 999, 'remote');
    expect(manager.getObject('shape-1')?.x).toBe(999);

    // Local undo should not revert remote change
    manager.undo(); // reverts local add
    expect(manager.getObject('shape-1')).toBeNull();
  });
});

