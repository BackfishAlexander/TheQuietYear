import type { Stroke, StrokePoint, PathTool, ShapeTool } from './types.js';
import { ERASER_WIDTH_MULTIPLIER, HIGHLIGHTER_OPACITY } from './constants.js';

const PATH_TOOLS: PathTool[] = ['pen', 'marker', 'highlighter', 'eraser'];
const SHAPE_TOOLS: ShapeTool[] = ['line', 'arrow', 'rect', 'ellipse', 'triangle'];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Coerce anything stroke-shaped into a current-format Stroke, or return null.
 * Handles strokes saved before `kind`/`seq` existed, and guards against
 * malformed data in user-supplied canvas files.
 */
export function normalizeStroke(raw: unknown, fallbackSeq: number): Stroke | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, any>;

  const id = typeof s.id === 'string' ? s.id : null;
  if (!id) return null;
  const playerId = typeof s.playerId === 'string' ? s.playerId : '';
  const seq = Number.isFinite(s.seq) ? Number(s.seq) : fallbackSeq;
  const color = typeof s.color === 'string' ? s.color : '#2c2c2c';
  const width = Number.isFinite(s.width) ? Math.max(0.1, Number(s.width)) : 4;
  const opacity = Number.isFinite(s.opacity) ? clamp(Number(s.opacity), 0, 1) : undefined;
  const base = { id, playerId, seq, color, width, ...(opacity === undefined ? {} : { opacity }) };

  const kind = s.kind ?? (Array.isArray(s.points) ? 'path' : null);

  if (kind === 'path') {
    const tool: PathTool = PATH_TOOLS.includes(s.tool) ? s.tool : 'pen';
    const points = normalizePoints(s.points);
    if (points.length === 0) return null;
    return { ...base, kind: 'path', tool, points };
  }

  if (kind === 'shape') {
    const tool: ShapeTool = SHAPE_TOOLS.includes(s.tool) ? s.tool : 'line';
    const start = normalizePoint(s.start);
    const end = normalizePoint(s.end);
    if (!start || !end) return null;
    const fillColor = typeof s.fillColor === 'string' ? s.fillColor : null;
    return { ...base, kind: 'shape', tool, start, end, fillColor };
  }

  if (kind === 'fill') {
    const contours = Array.isArray(s.contours)
      ? s.contours.map(normalizePoints).filter((c: StrokePoint[]) => c.length >= 3)
      : [];
    if (contours.length === 0) return null;
    return { ...base, kind: 'fill', tool: 'fill', contours };
  }

  return null;
}

/** Normalize a whole list, dropping anything unusable and re-sorting by seq. */
export function normalizeStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  raw.forEach((item, i) => {
    const stroke = normalizeStroke(item, i);
    if (stroke) out.push(stroke);
  });
  return out.sort((a, b) => a.seq - b.seq);
}

function normalizePoint(raw: unknown): StrokePoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, any>;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: Number(p.x), y: Number(p.y) };
}

function normalizePoints(raw: unknown): StrokePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: StrokePoint[] = [];
  for (const p of raw) {
    const point = normalizePoint(p);
    if (point) out.push(point);
  }
  return out;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The width a stroke actually renders at (erasers bite wider than nominal). */
export function effectiveWidth(stroke: Stroke): number {
  if (stroke.kind === 'path' && stroke.tool === 'eraser') {
    return stroke.width * ERASER_WIDTH_MULTIPLIER;
  }
  return stroke.width;
}

export function effectiveOpacity(stroke: Stroke): number {
  if (stroke.opacity !== undefined) return stroke.opacity;
  if (stroke.kind === 'path' && stroke.tool === 'highlighter') return HIGHLIGHTER_OPACITY;
  return 1;
}

/** World-space bounding box of one stroke, padded by its own line width. */
export function strokeBounds(stroke: Stroke): Bounds | null {
  let points: StrokePoint[];
  if (stroke.kind === 'path') points = stroke.points;
  else if (stroke.kind === 'shape') points = [stroke.start, stroke.end];
  else points = stroke.contours.flat();
  if (points.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = effectiveWidth(stroke) / 2 + 1;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** Combined bounds of every stroke, or null if there is nothing drawn. */
export function contentBounds(strokes: Stroke[]): Bounds | null {
  let acc: Bounds | null = null;
  for (const stroke of strokes) {
    const b = strokeBounds(stroke);
    if (!b) continue;
    if (!acc) {
      acc = { ...b };
    } else {
      acc.minX = Math.min(acc.minX, b.minX);
      acc.minY = Math.min(acc.minY, b.minY);
      acc.maxX = Math.max(acc.maxX, b.maxX);
      acc.maxY = Math.max(acc.maxY, b.maxY);
    }
  }
  return acc;
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
