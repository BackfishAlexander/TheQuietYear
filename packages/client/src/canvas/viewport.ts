import type { StrokePoint } from '@quiet-year/shared';
import { MIN_ZOOM, MAX_ZOOM, clamp, type Bounds } from '@quiet-year/shared';

/**
 * A window onto the unbounded world. `cx`/`cy` are the world coordinates
 * sitting at the centre of the visible canvas; `zoom` is screen px per world
 * unit.
 */
export interface Viewport {
  cx: number;
  cy: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DEFAULT_VIEWPORT: Viewport = { cx: 0, cy: 0, zoom: 1 };

export function worldToScreen(p: StrokePoint, vp: Viewport, size: Size): StrokePoint {
  return {
    x: (p.x - vp.cx) * vp.zoom + size.width / 2,
    y: (p.y - vp.cy) * vp.zoom + size.height / 2,
  };
}

export function screenToWorld(p: StrokePoint, vp: Viewport, size: Size): StrokePoint {
  return {
    x: (p.x - size.width / 2) / vp.zoom + vp.cx,
    y: (p.y - size.height / 2) / vp.zoom + vp.cy,
  };
}

/** World-space rectangle currently visible, optionally grown by `padding` px. */
export function visibleBounds(vp: Viewport, size: Size, padding = 0): Bounds {
  const halfW = (size.width / 2 + padding) / vp.zoom;
  const halfH = (size.height / 2 + padding) / vp.zoom;
  return {
    minX: vp.cx - halfW,
    minY: vp.cy - halfH,
    maxX: vp.cx + halfW,
    maxY: vp.cy + halfH,
  };
}

/** Zoom by a factor while keeping the world point under `anchor` fixed. */
export function zoomAt(vp: Viewport, size: Size, anchor: StrokePoint, factor: number): Viewport {
  const zoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (zoom === vp.zoom) return vp;
  const before = screenToWorld(anchor, vp, size);
  const after = screenToWorld(anchor, { ...vp, zoom }, size);
  return { cx: vp.cx + (before.x - after.x), cy: vp.cy + (before.y - after.y), zoom };
}

/** Shift the view by a screen-pixel delta. */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, cx: vp.cx - dx / vp.zoom, cy: vp.cy - dy / vp.zoom };
}

/** A viewport that frames `bounds` with a little breathing room. */
export function fitBounds(bounds: Bounds, size: Size, margin = 60): Viewport {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clamp(
    Math.min((size.width - margin * 2) / width, (size.height - margin * 2) / height),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cy: (bounds.minY + bounds.maxY) / 2,
    zoom,
  };
}

/** True when nothing drawn is anywhere near the visible area. */
export function isContentOffscreen(content: Bounds | null, vp: Viewport, size: Size): boolean {
  if (!content) return false;
  const view = visibleBounds(vp, size);
  return (
    content.maxX < view.minX ||
    content.minX > view.maxX ||
    content.maxY < view.minY ||
    content.minY > view.maxY
  );
}

/** Step zoom in fixed multiples, snapping to tidy percentages. */
export const ZOOM_STEP = 1.25;
