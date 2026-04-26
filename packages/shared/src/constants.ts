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
