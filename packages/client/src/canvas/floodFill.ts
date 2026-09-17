import type { StrokePoint } from '@quiet-year/shared';

/**
 * Bucket fill on a vector canvas.
 *
 * There are no pixels to paint into here — strokes are stored as geometry on
 * an unbounded surface. So we rasterise what is currently on screen, flood
 * fill that raster to find the region the user clicked, then trace the
 * region's border back into polygons with marching squares. The result is a
 * resolution-independent shape that syncs as a few hundred points instead of
 * a bitmap, and stays crisp at any zoom.
 *
 * The trade-off: a fill can only see what is on screen, so filling an area
 * that runs off the edge of the viewport fills the visible part of it.
 */

/** How far apart two colours can be and still count as the same region. */
const DEFAULT_TOLERANCE = 32;
/**
 * Grow the region slightly so it tucks under the antialiased edge of the
 * strokes that bound it, instead of leaving a pale halo along every border.
 */
const DILATE_RADIUS = 2;
/** Corner-cutting tolerance when simplifying traced borders, in screen px. */
const SIMPLIFY_EPSILON = 1.1;
/**
 * A border can legitimately be long before simplification — a fill covering
 * the whole viewport traces its entire perimeter — so the raw walk gets a
 * generous safety limit and only the simplified result is held to a budget.
 */
const MAX_RAW_CONTOUR_POINTS = 250_000;
/** Refuse absurd traces rather than shipping a megabyte stroke. */
const MAX_POINTS_PER_CONTOUR = 4000;

export interface FloodFillResult {
  /** Border loops in CSS-pixel screen space, outer and holes alike. */
  contours: StrokePoint[][];
  /** Mask pixels matched; useful for rejecting no-op fills. */
  area: number;
}

/**
 * Find the region of `source` connected to (`x`, `y`) and return its border.
 * Coordinates in and out are CSS pixels; `source` may be backed by a
 * higher-density buffer, described by `dpr`.
 */
export function floodFillRegion(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  dpr: number,
  tolerance: number = DEFAULT_TOLERANCE,
): FloodFillResult | null {
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  const startX = Math.round(x);
  const startY = Math.round(y);
  if (startX < 0 || startY < 0 || startX >= W || startY >= H) return null;

  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, source.width, source.height);
  } catch {
    return null; // Tainted canvas; nothing sensible to do.
  }

  const mask = floodMask(image, source.width, source.height, W, H, dpr, startX, startY, tolerance);
  if (!mask || mask.area === 0) return null;

  const grown = DILATE_RADIUS > 0 ? dilate(mask.data, W, H, DILATE_RADIUS) : mask.data;
  const contours = traceContours(grown, W, H)
    .map(c => simplify(c, SIMPLIFY_EPSILON))
    .filter(c => c.length >= 3 && c.length <= MAX_POINTS_PER_CONTOUR);

  if (contours.length === 0) return null;
  return { contours, area: mask.area };
}

/** 4-connected scanline-free flood fill producing a binary mask. */
function floodMask(
  image: ImageData,
  srcW: number,
  srcH: number,
  W: number,
  H: number,
  dpr: number,
  startX: number,
  startY: number,
  tolerance: number,
): { data: Uint8Array; area: number } | null {
  const px = image.data;

  // Map a mask cell to its pixel in the (possibly hi-dpi) source buffer.
  const sampleAt = (mx: number, my: number): number => {
    const sx = Math.min(srcW - 1, Math.max(0, Math.round(mx * dpr)));
    const sy = Math.min(srcH - 1, Math.max(0, Math.round(my * dpr)));
    return (sy * srcW + sx) * 4;
  };

  const startIdx = sampleAt(startX, startY);
  const tr = px[startIdx], tg = px[startIdx + 1], tb = px[startIdx + 2], ta = px[startIdx + 3];
  const tolSq = tolerance * tolerance;

  const matches = (i: number): boolean => {
    const a = px[i + 3];
    // Two fully transparent pixels match regardless of their stale RGB.
    if (a === 0 && ta === 0) return true;
    const da = a - ta;
    const dr = px[i] - tr, dg = px[i + 1] - tg, db = px[i + 2] - tb;
    return (dr * dr + dg * dg + db * db + da * da) <= tolSq * 4;
  };

  const data = new Uint8Array(W * H);
  const visited = new Uint8Array(W * H);
  const stack: number[] = [startY * W + startX];
  visited[stack[0]] = 1;
  let area = 0;

  while (stack.length > 0) {
    const cell = stack.pop()!;
    const cy = (cell / W) | 0;
    const cx = cell - cy * W;
    if (!matches(sampleAt(cx, cy))) continue;

    data[cell] = 1;
    area++;

    if (cx > 0 && !visited[cell - 1]) { visited[cell - 1] = 1; stack.push(cell - 1); }
    if (cx < W - 1 && !visited[cell + 1]) { visited[cell + 1] = 1; stack.push(cell + 1); }
    if (cy > 0 && !visited[cell - W]) { visited[cell - W] = 1; stack.push(cell - W); }
    if (cy < H - 1 && !visited[cell + W]) { visited[cell + W] = 1; stack.push(cell + W); }
  }

  return { data, area };
}

/** Square dilation, done as two cheap separable max passes. */
function dilate(mask: Uint8Array, W: number, H: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let d = -radius; d <= radius && !on; d++) {
        const nx = x + d;
        if (nx >= 0 && nx < W && mask[row + nx]) on = 1;
      }
      horizontal[row + x] = on;
    }
  }

  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let d = -radius; d <= radius && !on; d++) {
        const ny = y + d;
        if (ny >= 0 && ny < H && horizontal[ny * W + x]) on = 1;
      }
      out[y * W + x] = on;
    }
  }
  return out;
}

/**
 * Marching squares: emit the border segments of every cell straddling the
 * mask edge, then stitch them into closed loops. Ambiguous saddle cases are
 * resolved consistently so every junction keeps exactly two neighbours.
 */
function traceContours(mask: Uint8Array, W: number, H: number): StrokePoint[][] {
  // Coordinates land on half-integers, so doubling them gives exact int keys.
  const key = (px: number, py: number) => (px * 2) * 1_000_003 + (py * 2);
  const points: StrokePoint[] = [];
  const indexOf = new Map<number, number>();
  const neighbours: number[][] = [];

  const nodeAt = (px: number, py: number): number => {
    const k = key(px, py);
    let idx = indexOf.get(k);
    if (idx === undefined) {
      idx = points.length;
      indexOf.set(k, idx);
      points.push({ x: px, y: py });
      neighbours.push([]);
    }
    return idx;
  };

  const connect = (ax: number, ay: number, bx: number, by: number) => {
    const a = nodeAt(ax, ay);
    const b = nodeAt(bx, by);
    neighbours[a].push(b);
    neighbours[b].push(a);
  };

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);

  // Cells run one past the mask on each side so regions touching the canvas
  // edge still close into a loop.
  for (let y = -1; y < H; y++) {
    for (let x = -1; x < W; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;

      // Midpoints of the cell's four edges.
      const Tx = x + 1, Ty = y + 0.5;
      const Rx = x + 1.5, Ry = y + 1;
      const Bx = x + 1, By = y + 1.5;
      const Lx = x + 0.5, Ly = y + 1;

      switch (code) {
        case 1: case 14: connect(Lx, Ly, Bx, By); break;
        case 2: case 13: connect(Bx, By, Rx, Ry); break;
        case 3: case 12: connect(Lx, Ly, Rx, Ry); break;
        case 4: case 11: connect(Tx, Ty, Rx, Ry); break;
        case 6: case 9:  connect(Tx, Ty, Bx, By); break;
        case 7: case 8:  connect(Tx, Ty, Lx, Ly); break;
        case 5: connect(Tx, Ty, Lx, Ly); connect(Bx, By, Rx, Ry); break;
        case 10: connect(Tx, Ty, Rx, Ry); connect(Lx, Ly, Bx, By); break;
      }
    }
  }

  // Walk each loop by always stepping to the neighbour we did not arrive from.
  const used = new Set<number>();
  const edgeKey = (a: number, b: number) => (a < b ? a * 4_000_037 + b : b * 4_000_037 + a);
  const contours: StrokePoint[][] = [];

  for (let start = 0; start < points.length; start++) {
    for (const first of neighbours[start]) {
      if (used.has(edgeKey(start, first))) continue;

      const loop: StrokePoint[] = [points[start]];
      let cur = first;
      used.add(edgeKey(start, first));

      while (cur !== start && loop.length <= MAX_RAW_CONTOUR_POINTS) {
        loop.push(points[cur]);
        let next = -1;
        for (const n of neighbours[cur]) {
          if (!used.has(edgeKey(cur, n))) { next = n; break; }
        }
        if (next === -1) break;
        used.add(edgeKey(cur, next));
        cur = next;
      }

      if (loop.length >= 3) contours.push(loop);
    }
  }

  return contours;
}

/** Ramer-Douglas-Peucker, applied to a closed loop. */
function simplify(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length < 4) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last <= first + 1) continue;

    let maxDist = -1;
    let maxIdx = first;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > epsilon) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx], [maxIdx, last]);
    }
  }

  const out: StrokePoint[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function perpendicularDistance(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
