export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 1200;
export const MIN_PROJECT_WEEKS = 1;
export const MAX_PROJECT_WEEKS = 6;
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const;

export const SUIT_TO_SEASON: Record<string, string> = {
  hearts: 'spring',
  diamonds: 'summer',
  clubs: 'autumn',
  spades: 'winter',
};

export const SEASON_COLORS: Record<string, string> = {
  spring: '#4ade80',
  summer: '#fbbf24',
  autumn: '#f97316',
  winter: '#93c5fd',
};

export const PLAYER_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#9b59b6',
];

// ---------------------------------------------------------------------------
// Drawing / canvas
// ---------------------------------------------------------------------------

/** Paper colour of the map. The canvas itself is unbounded. */
export const PAPER_COLOR = '#faf6ee';
export const GRID_COLOR = '#e8e0d0';
/** Spacing of the dot grid, in world units. */
export const GRID_SPACING = 40;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 12;

/** Stroke widths offered in the toolbar. */
export const STROKE_WIDTHS = [1, 2, 4, 8, 16, 32];

/**
 * Full palette. Grouped in rows of 8 for the swatch grid: inks & neutrals,
 * warm, cool, then the muted "map" tones that suit the paper background.
 */
export const PALETTE: string[] = [
  // Inks and neutrals
  '#2c2c2c', '#5a5a5a', '#8a8a8a', '#b8b8b8', '#ffffff', '#faf6ee', '#e8e0d0', '#d4c5a9',
  // Warm
  '#7f1d1d', '#dc2626', '#f87171', '#ea580c', '#f59e0b', '#fcd34d', '#a16207', '#78350f',
  // Cool
  '#14532d', '#16a34a', '#4ade80', '#0d9488', '#0ea5e9', '#1d4ed8', '#312e81', '#6d28d9',
  // Muted map tones
  '#a21caf', '#db2777', '#f9a8d4', '#4a7c59', '#8B6914', '#6b7280', '#44403c', '#1c1917',
];

/** Opacity applied to the highlighter tool. */
export const HIGHLIGHTER_OPACITY = 0.35;
/** The eraser feels right a good deal wider than its nominal width. */
export const ERASER_WIDTH_MULTIPLIER = 3;
