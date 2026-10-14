import * as Y from 'yjs';
import { Shape, RectangleShape, FreehandShape } from '../../models/Shape';

test('Yjs converges after concurrent rectangle and freehand edits', () => {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const arr1 = doc1.getArray<Shape>('shapes');
  const arr2 = doc2.getArray<Shape>('shapes');

  // Initial sync
  const initUpdate = Y.encodeStateAsUpdate(doc1);
  Y.applyUpdate(doc2, initUpdate);

  // doc1 adds a rectangle
  const rect: RectangleShape = {
    id: 'r1',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    selected: false,
    color: '#ff5722',
    strokeWidth: 2,
  };
  arr1.push([rect]);

  // doc2 adds a freehand shape concurrently
  const free: FreehandShape = {
    id: 'f1',
    type: 'freehand',
    x: 5,
    y: 5,
    points: [{ x: 5, y: 5 }, { x: 15, y: 15 }],
    selected: false,
    color: '#ff5722',
    strokeWidth: 2,
  };
  arr2.push([free]);

  // Exchange updates
  const update1 = Y.encodeStateAsUpdate(doc1);
  const update2 = Y.encodeStateAsUpdate(doc2);
  Y.applyUpdate(doc1, update2);
  Y.applyUpdate(doc2, update1);

  // After synchronization both docs should have both shapes
  expect(arr1.toArray()).toEqual(expect.arrayContaining([rect, free]));
  expect(arr2.toArray()).toEqual(expect.arrayContaining([rect, free]));
});
