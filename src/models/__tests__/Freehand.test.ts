import { FreehandShape, serializeShape, deserializeShape } from '../../models/Shape';

test('serialize and deserialize FreehandShape retains points', () => {
  const shape: FreehandShape = {
    id: 'f1',
    type: 'freehand',
    x: 0,
    y: 0,
    points: [
      { x: 10, y: 10 },
      { x: 20, y: 15 },
      { x: 30, y: 25 },
    ],
    selected: false,
    color: '#ff5722',
    strokeWidth: 2,
  };
  const json = serializeShape(shape);
  const parsed = deserializeShape(json) as FreehandShape;
  expect(parsed.points).toEqual(shape.points);
  expect(parsed.type).toBe('freehand');
});
