import type { Stroke, StrokePoint, ShapeStroke } from '@quiet-year/shared';
import {
  PAPER_COLOR, GRID_COLOR, GRID_SPACING,
  effectiveWidth, effectiveOpacity, strokeBounds, boundsIntersect,
  type Bounds,
} from '@quiet-year/shared';
import { visibleBounds, type Size, type Viewport } from './viewport';

/**
 * Point the context at world coordinates: everything drawn afterwards uses
 * world units, and line widths scale with zoom the way ink on paper should.
 */
export function applyWorldTransform(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  size: Size,
  dpr: number,
) {
  const z = vp.zoom * dpr;
  ctx.setTransform(z, 0, 0, z, (size.width / 2 - vp.cx * vp.zoom) * dpr, (size.height / 2 - vp.cy * vp.zoom) * dpr);
}

/** Paper and dot grid. The grid thins out as you zoom away so it never mats. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  size: Size,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, size.width, size.height);

  // Pick a multiple of the base spacing that keeps dots ~24px apart on screen.
  let spacing = GRID_SPACING;
  while (spacing * vp.zoom < 24) spacing *= 4;
  const dotRadius = Math.min(1.6, Math.max(0.6, vp.zoom));

  const view = visibleBounds(vp, size, spacing * vp.zoom);
  applyWorldTransform(ctx, vp, size, dpr);
  ctx.fillStyle = GRID_COLOR;

  const startX = Math.floor(view.minX / spacing) * spacing;
  const startY = Math.floor(view.minY / spacing) * spacing;
  const r = dotRadius / vp.zoom;

  for (let x = startX; x <= view.maxX; x += spacing) {
    for (let y = startY; y <= view.maxY; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The world origin, so "recentre" always lands somewhere recognisable.
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.28)';
  ctx.lineWidth = 1 / vp.zoom;
  const tick = 14 / vp.zoom;
  ctx.beginPath();
  ctx.moveTo(-tick, 0); ctx.lineTo(tick, 0);
  ctx.moveTo(0, -tick); ctx.lineTo(0, tick);
  ctx.stroke();
}

/** Render every stroke that touches the viewport, in z-order. */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  vp: Viewport,
  size: Size,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  applyWorldTransform(ctx, vp, size, dpr);

  const view = visibleBounds(vp, size, 4);
  for (const stroke of strokes) {
    const b = strokeBounds(stroke);
    if (b && !boundsIntersect(b, view)) continue;
    drawStroke(ctx, stroke);
  }
}

/**
 * Draw one stroke in world space.
 *
 * Erasers use `destination-out`, so they cut a real hole in the ink layer
 * rather than painting paper-coloured cover-up over it. That keeps an erase
 * looking identical whether it is previewed live or replayed from history.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const isEraser = stroke.kind === 'path' && stroke.tool === 'eraser';
  ctx.save();
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  ctx.globalAlpha = effectiveOpacity(stroke);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = effectiveWidth(stroke);
  ctx.strokeStyle = isEraser ? '#000' : stroke.color;

  if (stroke.kind === 'path') tracePath(ctx, stroke.points, ctx.lineWidth);
  else if (stroke.kind === 'shape') traceShape(ctx, stroke);
  else traceFill(ctx, stroke.contours, isEraser ? '#000' : stroke.color);

  ctx.restore();
}

/** A freehand path, smoothed through the midpoints of successive samples. */
function tracePath(ctx: CanvasRenderingContext2D, points: StrokePoint[], width: number) {
  if (points.length === 0) return;

  // A tap with no travel should still leave a dot the size of the nib.
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

function traceShape(ctx: CanvasRenderingContext2D, stroke: ShapeStroke) {
  const { start, end, tool } = stroke;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.beginPath();
  switch (tool) {
    case 'line':
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      break;
    case 'arrow':
      traceArrow(ctx, start, end, ctx.lineWidth);
      break;
    case 'rect':
      ctx.rect(x, y, w, h);
      break;
    case 'ellipse':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
  }

  // Lines and arrows have no interior to fill.
  if (stroke.fillColor && tool !== 'line' && tool !== 'arrow') {
    ctx.fillStyle = stroke.fillColor;
    ctx.fill();
  }
  ctx.stroke();
}

function traceArrow(ctx: CanvasRenderingContext2D, start: StrokePoint, end: StrokePoint, width: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  if (len < 1) return;

  const head = Math.min(len * 0.4, width * 4 + 8);
  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7;
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle - spread), end.y - head * Math.sin(angle - spread));
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle + spread), end.y - head * Math.sin(angle + spread));
}

/** Bucket fills are polygons; even-odd lets inner contours act as holes. */
function traceFill(ctx: CanvasRenderingContext2D, contours: StrokePoint[][], color: string) {
  ctx.beginPath();
  for (const contour of contours) {
    if (contour.length < 3) continue;
    ctx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) ctx.lineTo(contour[i].x, contour[i].y);
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill('evenodd');
}

/**
 * Flatten strokes onto an opaque paper-coloured canvas covering `bounds`.
 * Used for PNG export.
 */
export function renderToCanvas(strokes: Stroke[], bounds: Bounds, scale: number): HTMLCanvasElement {
  const width = Math.max(1, Math.round((bounds.maxX - bounds.minX) * scale));
  const height = Math.max(1, Math.round((bounds.maxY - bounds.minY) * scale));

  // Strokes go on their own transparent layer first so erasers cut through
  // ink without punching a hole in the paper underneath.
  const ink = document.createElement('canvas');
  ink.width = width;
  ink.height = height;
  const inkCtx = ink.getContext('2d')!;
  inkCtx.setTransform(scale, 0, 0, scale, -bounds.minX * scale, -bounds.minY * scale);
  for (const stroke of strokes) drawStroke(inkCtx, stroke);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(ink, 0, 0);
  return out;
}
