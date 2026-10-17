import { describe, it, expect } from 'vitest';
import {
  SWAHILI_PALETTE,
  SWAHILI_COLOR_MAP,
  getSwahiliColor,
  getDeterministicUserColor,
} from '../src/palette';

describe('Swahili Colour Palette', () => {
  it('contains exactly the 8 required Kenyan Swahili colors', () => {
    expect(SWAHILI_PALETTE).toHaveLength(8);
    const expectedNames = [
      'Njano',
      'Waridi',
      'Kijani',
      'Buluu',
      'Machungwa',
      'Zambarau',
      'Nyekundu',
      'Kijivu',
    ];
    expect(SWAHILI_PALETTE.map((c) => c.name)).toEqual(expectedNames);
  });

  it('maps each color correctly with valid hex and contrast text colors', () => {
    for (const color of SWAHILI_PALETTE) {
      expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color.borderHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color.textHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color.label).toContain(color.name);
      expect(color.rgb).toHaveLength(3);
    }
  });

  it('finds color by Swahili or English name', () => {
    const njano = getSwahiliColor('Njano');
    expect(njano?.englishName).toBe('Yellow');

    const waridi = getSwahiliColor('pink');
    expect(waridi?.name).toBe('Waridi');

    expect(getSwahiliColor('non-existent')).toBeUndefined();
  });

  it('assigns deterministic user colors and prevents collisions in a room', () => {
    const userA = 'user-uuid-1';
    const colorA = getDeterministicUserColor(userA);
    expect(colorA).toBeDefined();

    // With colorA already taken, userB should receive a different color
    const userB = 'user-uuid-2';
    const colorB = getDeterministicUserColor(userB, [colorA.hex]);
    expect(colorB.hex).not.toBe(colorA.hex);
  });
});
