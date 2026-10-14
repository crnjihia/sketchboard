import { hitTestRect, RectangleShape } from '../../src/models/Shape';

test('hitTestRect returns true when point inside rectangle', () => {
  const rect: RectangleShape = {
    id: '1',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
  };
  expect(hitTestRect(rect, 50, 40)).toBe(true);
});

test('hitTestRect returns false when point outside rectangle', () => {
  const rect: RectangleShape = {
    id: '2',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 30,
    height: 30,
  };
  expect(hitTestRect(rect, 100, 100)).toBe(false);
});
