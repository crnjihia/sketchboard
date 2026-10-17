/**
 * Kenyan Swahili Colour Palette - Single Source of Truth
 * Designed for Sketchboard sticky notes, shape accents, and live user cursors.
 */

export interface SwahiliColor {
  /** Swahili name identifier */
  name: 'Njano' | 'Waridi' | 'Kijani' | 'Buluu' | 'Machungwa' | 'Zambarau' | 'Nyekundu' | 'Kijivu';
  /** English translation */
  englishName: string;
  /** UI display label, e.g. "Njano (Yellow)" */
  label: string;
  /** Primary hex fill */
  hex: string;
  /** Subtle border/stroke hex */
  borderHex: string;
  /** Text contrast hex (dark or light for legibility) */
  textHex: string;
  /** RGB triplet for canvas alpha operations */
  rgb: [number, number, number];
}

export type SwahiliColorName = SwahiliColor['name'];

export const SWAHILI_PALETTE: readonly SwahiliColor[] = [
  {
    name: 'Njano',
    englishName: 'Yellow',
    label: 'Njano (Yellow)',
    hex: '#FDE047', // Warm vibrant yellow
    borderHex: '#EAB308',
    textHex: '#713F12',
    rgb: [253, 224, 71],
  },
  {
    name: 'Waridi',
    englishName: 'Pink',
    label: 'Waridi (Pink)',
    hex: '#F472B6', // Rose pink
    borderHex: '#DB2777',
    textHex: '#831843',
    rgb: [244, 114, 182],
  },
  {
    name: 'Kijani',
    englishName: 'Green',
    label: 'Kijani (Green)',
    hex: '#4ADE80', // Fresh savannah green
    borderHex: '#16A34A',
    textHex: '#14532D',
    rgb: [74, 222, 128],
  },
  {
    name: 'Buluu',
    englishName: 'Blue',
    label: 'Buluu (Blue)',
    hex: '#60A5FA', // Sky blue
    borderHex: '#2563EB',
    textHex: '#1E3A8A',
    rgb: [96, 165, 250],
  },
  {
    name: 'Machungwa',
    englishName: 'Orange',
    label: 'Machungwa (Orange)',
    hex: '#FB923C', // Sun orange
    borderHex: '#EA580C',
    textHex: '#7C2D12',
    rgb: [251, 146, 60],
  },
  {
    name: 'Zambarau',
    englishName: 'Purple',
    label: 'Zambarau (Purple)',
    hex: '#C084FC', // Rich purple
    borderHex: '#9333EA',
    textHex: '#581C87',
    rgb: [192, 132, 252],
  },
  {
    name: 'Nyekundu',
    englishName: 'Red',
    label: 'Nyekundu (Red)',
    hex: '#F87171', // Coral red
    borderHex: '#DC2626',
    textHex: '#7F1D1D',
    rgb: [248, 113, 113],
  },
  {
    name: 'Kijivu',
    englishName: 'Grey',
    label: 'Kijivu (Grey)',
    hex: '#9CA3AF', // Neutral grey
    borderHex: '#4B5563',
    textHex: '#1F2937',
    rgb: [156, 163, 175],
  },
] as const;

export const SWAHILI_COLOR_MAP: Readonly<Record<SwahiliColorName, SwahiliColor>> =
  Object.freeze(
    SWAHILI_PALETTE.reduce((acc, color) => {
      acc[color.name] = color;
      return acc;
    }, {} as Record<SwahiliColorName, SwahiliColor>)
  );

/**
 * Find a Swahili color by name (case-insensitive)
 */
export function getSwahiliColor(name: string): SwahiliColor | undefined {
  const normalized = name.trim().toLowerCase();
  return SWAHILI_PALETTE.find(
    (c) => c.name.toLowerCase() === normalized || c.englishName.toLowerCase() === normalized
  );
}

/**
 * Assign each user a colour deterministically from the shared palette.
 * If a list of already taken colors is provided, picks the least colliding or next available colour.
 */
export function getDeterministicUserColor(
  userId: string,
  takenColors: readonly string[] = []
): SwahiliColor {
  // Simple stable hash from userId string
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  // Check which palette colors are not currently taken in the room
  const takenNormalized = new Set(takenColors.map((c) => c.toLowerCase()));
  const available = SWAHILI_PALETTE.filter(
    (c) => !takenNormalized.has(c.hex.toLowerCase()) && !takenNormalized.has(c.name.toLowerCase())
  );

  if (available.length > 0) {
    return available[positiveHash % available.length];
  }

  // Fallback if all 8 colors are already taken: cycle deterministically through full palette
  return SWAHILI_PALETTE[positiveHash % SWAHILI_PALETTE.length];
}
