import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ClientEvents, ServerEvents, Stroke, StrokePoint, DrawTool, ShapeTool,
} from '@quiet-year/shared';
import {
  generateId, contentBounds, MIN_ZOOM, MAX_ZOOM,
  CANVAS_WIDTH, CANVAS_HEIGHT, HIGHLIGHTER_OPACITY, ERASER_WIDTH_MULTIPLIER,
} from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { DrawToolbar, type ToolSettings } from './DrawToolbar';
import {
  DEFAULT_VIEWPORT, ZOOM_STEP, fitBounds, isContentOffscreen, panBy,
  screenToWorld, zoomAt, type Size, type Viewport,
} from '../../canvas/viewport';
import { drawBackground, drawStroke, drawStrokes } from '../../canvas/render';
import { floodFillRegion } from '../../canvas/floodFill';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const SHAPE_TOOLS: DrawTool[] = ['line', 'arrow', 'rect', 'ellipse', 'triangle'];
/** Sub-pixel moves aren't worth a sample; they just bloat the stroke. */
const MIN_SAMPLE_DISTANCE = 1.2;
/**
 * Optimistic strokes sort above everything until the server echoes back a
 * real z-order, which is well below this.
 */
const LOCAL_SEQ_BASE = 1e12;

const SETTINGS_KEY = 'quiet-year:tool-settings';

const DEFAULT_SETTINGS: ToolSettings = {
  tool: 'pen',
  color: '#2c2c2c',
  fillColor: null,
  width: 4,
};

function loadSettings(): ToolSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_SETTINGS;
}

export function MapCanvas({ socket }: { socket: TypedSocket }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  /** Committed strokes, rendered once per viewport/stroke change and blitted. */
  const cacheRef = useRef<HTMLCanvasElement | null>(null);

  const { strokes, upsertStroke, playerId, roomId, roomState, gameState } = useGameStore();

  const [settings, setSettings] = useState<ToolSettings>(loadSettings);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [redoDepth, setRedoDepth] = useState(0);

  // Live interaction state lives in refs so pointermove never re-renders React.
  const liveStrokeRef = useRef<Stroke | null>(null);
  const pathPointsRef = useRef<StrokePoint[]>([]);
  const shapeStartRef = useRef<StrokePoint | null>(null);
  const panOriginRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const localSeqRef = useRef(0);
  /** The eraser ring follows the pointer via direct style writes, because
   *  putting the cursor position in state would re-render on every move. */
  const ringRef = useRef<HTMLDivElement>(null);

  const players = gameState?.players ?? roomState?.players ?? [];
  const me = players.find(p => p.id === playerId);
  const canDraw = me ? me.canDraw : true;
  const isHost = (roomState?.hostId ?? null) === playerId;

  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable; settings just won't persist */
    }
  }, [settings]);

  // --- sizing -------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Open on the region the old fixed-size map used to occupy, so existing
  // games and freshly loaded files land somewhere sensible.
  const didInitView = useRef(false);
  useEffect(() => {
    if (didInitView.current || size.width === 0) return;
    didInitView.current = true;
    const bounds = contentBounds(strokes) ?? {
      minX: 0, minY: 0, maxX: CANVAS_WIDTH, maxY: CANVAS_HEIGHT,
    };
    setViewport(fitBounds(bounds, size));
  }, [size, strokes]);

  // --- rendering ----------------------------------------------------------

  const syncCanvasSize = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || size.width === 0) return false;
    const w = Math.round(size.width * dpr);
    const h = Math.round(size.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return true;
  }, [size, dpr]);

  /** Repaint the visible ink layer: cached strokes plus the in-flight one. */
  const paintInk = useCallback(() => {
    frameRef.current = null;
    const ink = inkRef.current;
    const cache = cacheRef.current;
    if (!ink || !cache || !syncCanvasSize(ink)) return;
    const ctx = ink.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ink.width, ink.height);
    ctx.drawImage(cache, 0, 0);

    const live = liveStrokeRef.current;
    if (live) {
      ctx.setTransform(
        viewport.zoom * dpr, 0, 0, viewport.zoom * dpr,
        (size.width / 2 - viewport.cx * viewport.zoom) * dpr,
        (size.height / 2 - viewport.cy * viewport.zoom) * dpr,
      );
      drawStroke(ctx, live);
    }
  }, [syncCanvasSize, viewport, size, dpr]);

  const requestPaint = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(paintInk);
  }, [paintInk]);

  // Rebuild the committed-stroke cache whenever the scene or view changes.
  useEffect(() => {
    if (size.width === 0) return;
    if (!cacheRef.current) cacheRef.current = document.createElement('canvas');
    const cache = cacheRef.current;
    const w = Math.round(size.width * dpr);
    const h = Math.round(size.height * dpr);
    if (cache.width !== w || cache.height !== h) {
      cache.width = w;
      cache.height = h;
    }
    const ctx = cache.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    drawStrokes(ctx, strokes, viewport, size, dpr);
    paintInk();
  }, [strokes, viewport, size, dpr, paintInk]);

  useEffect(() => {
    const bg = bgRef.current;
    if (!bg || !syncCanvasSize(bg)) return;
    const ctx = bg.getContext('2d');
    if (ctx) drawBackground(ctx, viewport, size, dpr);
  }, [viewport, size, dpr, syncCanvasSize]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  // --- view helpers -------------------------------------------------------

  const zoomBy = useCallback((factor: number, anchor?: StrokePoint) => {
    setViewport(vp => zoomAt(vp, size, anchor ?? { x: size.width / 2, y: size.height / 2 }, factor));
  }, [size]);

  const recenter = useCallback(() => {
    setViewport(vp => ({ ...vp, cx: 0, cy: 0 }));
  }, []);

  const fitToContent = useCallback(() => {
    const bounds = contentBounds(strokes);
    if (!bounds) {
      setViewport({ cx: 0, cy: 0, zoom: 1 });
      return;
    }
    setViewport(fitBounds(bounds, size));
  }, [strokes, size]);

  const resetZoom = useCallback(() => {
    setViewport(vp => ({ ...vp, zoom: 1 }));
  }, []);

  // --- stroke commit ------------------------------------------------------

  const commitStroke = useCallback((stroke: Stroke) => {
    // Show it immediately, then let the server's echo settle its z-order.
    upsertStroke(stroke);
    socket.emit('draw:stroke', stroke);
    setRedoDepth(0);
  }, [socket, upsertStroke]);

  const nextLocalSeq = () => LOCAL_SEQ_BASE + localSeqRef.current++;

  const handleUndo = useCallback(() => {
    if (!canDraw) return;
    const mine = strokes.some(s => s.playerId === playerId);
    if (!mine) return;
    socket.emit('draw:undo');
    setRedoDepth(d => d + 1);
  }, [socket, strokes, playerId, canDraw]);

  const handleRedo = useCallback(() => {
    if (!canDraw || redoDepth === 0) return;
    socket.emit('draw:redo');
    setRedoDepth(d => Math.max(0, d - 1));
  }, [socket, redoDepth, canDraw]);

  // --- pointer interaction ------------------------------------------------

  const localPoint = (e: React.PointerEvent | PointerEvent): StrokePoint => {
    const rect = inkRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const worldPoint = (e: React.PointerEvent | PointerEvent): StrokePoint =>
    screenToWorld(localPoint(e), viewport, size);

  const performFill = useCallback((screen: StrokePoint) => {
    const cache = cacheRef.current;
    if (!cache) return;
    const result = floodFillRegion(cache, screen.x, screen.y, size.width, size.height, dpr);
    if (!result) return;

    const contours = result.contours.map(contour =>
      contour.map(p => screenToWorld(p, viewport, size)),
    );
    commitStroke({
      id: generateId(),
      playerId: playerId ?? '',
      seq: nextLocalSeq(),
      kind: 'fill',
      tool: 'fill',
      color: settings.color,
      width: 1,
      contours,
    });
  }, [size, dpr, viewport, playerId, settings.color, commitStroke]);

  function beginPan(e: React.PointerEvent) {
    panOriginRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });

    const wantsPan = settings.tool === 'pan' || spaceHeld || e.button === 1;
    if (wantsPan) {
      beginPan(e);
      return;
    }
    if (!canDraw) return;

    if (settings.tool === 'fill') {
      performFill(localPoint(e));
      return;
    }

    const point = worldPoint(e);
    setIsDrawing(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    if (SHAPE_TOOLS.includes(settings.tool)) {
      shapeStartRef.current = point;
      liveStrokeRef.current = buildShape(point, point);
    } else {
      pathPointsRef.current = [point];
      liveStrokeRef.current = buildPath([point]);
    }
    requestPaint();
  }

  function handlePointerMove(e: React.PointerEvent) {
    moveEraserRing(localPoint(e));

    if (panOriginRef.current) {
      const origin = panOriginRef.current;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      panOriginRef.current = { x: e.clientX, y: e.clientY };
      setViewport(vp => panBy(vp, dx, dy));
      return;
    }
    if (!isDrawing) return;

    const point = worldPoint(e);

    if (SHAPE_TOOLS.includes(settings.tool)) {
      const start = shapeStartRef.current;
      if (!start) return;
      // Shift locks shapes to a square, circle, or 45-degree line.
      liveStrokeRef.current = buildShape(start, e.shiftKey ? constrain(start, point) : point);
    } else {
      const points = pathPointsRef.current;
      const last = points[points.length - 1];
      const minStep = MIN_SAMPLE_DISTANCE / viewport.zoom;
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < minStep) return;
      points.push(point);
      liveStrokeRef.current = buildPath(points);
    }
    requestPaint();
  }

  function handlePointerUp() {
    if (panOriginRef.current) {
      panOriginRef.current = null;
      setIsPanning(false);
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    const live = liveStrokeRef.current;
    liveStrokeRef.current = null;
    pathPointsRef.current = [];
    shapeStartRef.current = null;
    requestPaint();
    if (!live) return;

    // A shape dragged nowhere is a misclick, not a zero-size rectangle.
    if (live.kind === 'shape') {
      const dragged = Math.hypot(live.end.x - live.start.x, live.end.y - live.start.y);
      if (dragged * viewport.zoom < 3) return;
    }
    commitStroke(live);
  }

  function moveEraserRing(at: StrokePoint | null) {
    const ring = ringRef.current;
    if (!ring) return;
    if (!at) {
      ring.style.visibility = 'hidden';
      return;
    }
    const d = Math.max(4, settings.width * ERASER_WIDTH_MULTIPLIER * viewport.zoom);
    ring.style.visibility = 'visible';
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    ring.style.transform = `translate(${at.x - d / 2}px, ${at.y - d / 2}px)`;
  }

  function handlePointerCancel() {
    panOriginRef.current = null;
    setIsPanning(false);
    setIsDrawing(false);
    liveStrokeRef.current = null;
    pathPointsRef.current = [];
    shapeStartRef.current = null;
    requestPaint();
  }

  function buildPath(points: StrokePoint[]): Stroke {
    const tool = settings.tool as 'pen' | 'marker' | 'highlighter' | 'eraser';
    return {
      id: generateId(),
      playerId: playerId ?? '',
      seq: nextLocalSeq(),
      kind: 'path',
      tool,
      points: [...points],
      color: settings.color,
      width: settings.width,
      ...(tool === 'highlighter' ? { opacity: HIGHLIGHTER_OPACITY } : {}),
    };
  }

  function buildShape(start: StrokePoint, end: StrokePoint): Stroke {
    return {
      id: generateId(),
      playerId: playerId ?? '',
      seq: nextLocalSeq(),
      kind: 'shape',
      tool: settings.tool as ShapeTool,
      start,
      end,
      color: settings.color,
      width: settings.width,
      fillColor: settings.fillColor,
    };
  }

  // --- wheel & keyboard ---------------------------------------------------

  useEffect(() => {
    const el = inkRef.current;
    if (!el) return;

    // Non-passive so trackpad pinch (which arrives as ctrl+wheel) can be
    // intercepted before the browser zooms the whole page.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (e.ctrlKey || e.metaKey) {
        setViewport(vp => zoomAt(vp, size, anchor, Math.exp(-e.deltaY * 0.01)));
      } else {
        setViewport(vp => panBy(vp, -e.deltaX, -e.deltaY));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'Space' && !spaceHeld) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      const shortcuts: Record<string, DrawTool> = {
        p: 'pen', m: 'marker', h: 'highlighter', e: 'eraser',
        l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'triangle',
        g: 'fill', v: 'pan',
      };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool) {
        setSettings(s => ({ ...s, tool }));
        return;
      }

      if (e.key === '0') resetZoom();
      if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
      if (e.key === '-' || e.key === '_') zoomBy(1 / ZOOM_STEP);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleUndo, handleRedo, resetZoom, zoomBy, spaceHeld]);

  // --- derived ------------------------------------------------------------

  const bounds = useMemo(() => contentBounds(strokes), [strokes]);
  const lost = size.width > 0 && isContentOffscreen(bounds, viewport, size);
  const canUndo = canDraw && strokes.some(s => s.playerId === playerId);
  const panMode = settings.tool === 'pan' || spaceHeld;

  const cursor = !canDraw
    ? 'not-allowed'
    : isPanning ? 'grabbing'
    : panMode ? 'grab'
    : settings.tool === 'fill' ? 'copy'
    : 'crosshair';

  const showEraserRing = settings.tool === 'eraser' && canDraw && !panMode;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#e8e0d0', overflow: 'hidden' }}
    >
      <canvas
        ref={bgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <canvas
        ref={inkRef}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => moveEraserRing(null)}
        onContextMenu={e => e.preventDefault()}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          cursor, touchAction: 'none', outline: 'none',
        }}
      />

      {showEraserRing && (
        <div
          ref={ringRef}
          style={{
            position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
            visibility: 'hidden', borderRadius: '50%',
            border: '1px solid rgba(60,60,60,0.55)', background: 'rgba(255,255,255,0.25)',
          }}
        />
      )}

      <DrawToolbar
        socket={socket}
        settings={settings}
        onSettingsChange={setSettings}
        zoom={viewport.zoom}
        onZoomIn={() => zoomBy(ZOOM_STEP)}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
        onResetZoom={resetZoom}
        onRecenter={recenter}
        onFitContent={fitToContent}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canDraw && redoDepth > 0}
        canDraw={canDraw}
        isHost={isHost}
        players={players}
        playerId={playerId}
        strokes={strokes}
        roomId={roomId}
      />

      {lost && (
        <button
          onClick={fitToContent}
          style={{
            position: 'absolute', bottom: 12, left: 12,
            padding: '8px 14px', fontSize: 13, fontFamily: 'Georgia, serif',
            background: 'rgba(44,44,44,0.88)', color: '#faf6ee', border: 'none',
            borderRadius: 20, cursor: 'pointer', zIndex: 16, whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          }}
          title="Nothing is drawn near here — jump back to the map"
        >
          ↖ Back to the drawing
        </button>
      )}

      {/* Zoom readout, bottom right, out of the action panel's way. */}
      <div style={{
        position: 'absolute', right: 10, bottom: 10, zIndex: 11,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 4px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.12)', fontSize: 12,
      }}>
        <ZoomButton label="−" title="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={viewport.zoom <= MIN_ZOOM + 1e-6} />
        <button
          onClick={resetZoom}
          title="Reset zoom to 100%"
          style={{
            border: 'none', background: 'none', cursor: 'pointer', fontSize: 11,
            fontFamily: 'monospace', minWidth: 44, color: '#555',
          }}
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <ZoomButton label="+" title="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={viewport.zoom >= MAX_ZOOM - 1e-6} />
      </div>
    </div>
  );
}

function ZoomButton({ label, title, onClick, disabled }: {
  label: string; title: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 22, height: 22, border: 'none', borderRadius: 5,
        background: disabled ? '#f2f2f2' : '#eee', color: disabled ? '#bbb' : '#333',
        cursor: disabled ? 'default' : 'pointer', fontSize: 14, lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

/** Snap a drag to a square/circle, or to the nearest 45 degrees for lines. */
function constrain(start: StrokePoint, end: StrokePoint): StrokePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx || 1) * size,
    y: start.y + Math.sign(dy || 1) * size,
  };
}
