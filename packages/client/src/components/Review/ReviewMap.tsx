/**
 * The map as a finished thing: pan, zoom and look. No tools, no socket, no
 * way to leave a mark - this is the copy you open months later to remember
 * what the community built.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stroke } from '@quiet-year/shared';
import { contentBounds, CANVAS_WIDTH, CANVAS_HEIGHT } from '@quiet-year/shared';
import {
  DEFAULT_VIEWPORT, ZOOM_STEP, fitBounds, panBy, zoomAt,
  type Size, type Viewport,
} from '../../canvas/viewport';
import { drawBackground, drawStrokes } from '../../canvas/render';
import { Icon } from '../Game/ToolIcons';

export function ReviewMap({ strokes }: { strokes: Stroke[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const panOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);

  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  const fit = useCallback((to: Size = size) => {
    if (to.width === 0) return;
    const bounds = contentBounds(strokes) ?? {
      minX: 0, minY: 0, maxX: CANVAS_WIDTH, maxY: CANVAS_HEIGHT,
    };
    setViewport(fitBounds(bounds, to));
  }, [strokes, size]);

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

  // Open framed on whatever was drawn, once the canvas knows how big it is.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || size.width === 0) return;
    framed.current = true;
    fit(size);
  }, [size, fit]);

  useEffect(() => {
    const bg = bgRef.current;
    const ink = inkRef.current;
    if (!bg || !ink || size.width === 0) return;

    for (const canvas of [bg, ink]) {
      const w = Math.round(size.width * dpr);
      const h = Math.round(size.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    const bgCtx = bg.getContext('2d');
    const inkCtx = ink.getContext('2d');
    if (!bgCtx || !inkCtx) return;
    drawBackground(bgCtx, viewport, size, dpr);
    drawStrokes(inkCtx, strokes, viewport, size, dpr);
  }, [strokes, viewport, size, dpr]);

  // Wheel has to be non-passive to stop the page scrolling under the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || size.width === 0) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (e.ctrlKey || e.metaKey) {
        setViewport(vp => zoomAt(vp, size, anchor, Math.exp(-e.deltaY / 200)));
      } else {
        setViewport(vp => panBy(vp, -e.deltaX, -e.deltaY));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]);

  function onPointerDown(e: React.PointerEvent) {
    panOriginRef.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const origin = panOriginRef.current;
    if (!origin) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    panOriginRef.current = { x: e.clientX, y: e.clientY };
    setViewport(vp => panBy(vp, dx, dy));
  }

  function endPan() {
    panOriginRef.current = null;
    setPanning(false);
  }

  const zoomCentre = (factor: number) =>
    setViewport(vp => zoomAt(vp, size, { x: size.width / 2, y: size.height / 2 }, factor));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        cursor: panning ? 'grabbing' : 'grab', touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerCancel={endPan}
    >
      <canvas ref={bgRef} style={canvasStyle} />
      <canvas ref={inkRef} style={canvasStyle} />

      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 4, padding: 4,
        background: 'rgba(255,255,255,0.94)', border: '1px solid #e0d8c8',
        borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}>
        <MapButton label="Zoom out" onClick={() => zoomCentre(1 / ZOOM_STEP)}>−</MapButton>
        <span style={{
          minWidth: 52, textAlign: 'center', fontSize: 12,
          fontFamily: 'monospace', color: '#666',
        }}>
          {Math.round(viewport.zoom * 100)}%
        </span>
        <MapButton label="Zoom in" onClick={() => zoomCentre(ZOOM_STEP)}>+</MapButton>
        <MapButton label="Fit the whole map" onClick={() => fit()}>
          <Icon name="fit" size={14} />
        </MapButton>
      </div>

      {strokes.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          color: '#b0a795', fontStyle: 'italic', fontSize: 14, pointerEvents: 'none',
        }}>
          Nothing was drawn on this map
        </div>
      )}
    </div>
  );
}

const canvasStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block',
};

function MapButton({ label, onClick, children }: {
  label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      onPointerDown={e => e.stopPropagation()}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, border: '1px solid transparent', borderRadius: 6,
        background: 'transparent', color: '#4a4a4a', cursor: 'pointer',
        fontSize: 15, fontFamily: 'Georgia, serif',
      }}
    >
      {children}
    </button>
  );
}
