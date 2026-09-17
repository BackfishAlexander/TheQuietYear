/**
 * A sidebar list only has room for a title, so the full text - a discussion's
 * whole transcript, a project's resolution - lives in a panel that opens
 * beside the row on hover. Fixed positioning keeps it clear of the sidebar's
 * own scrolling and clipping.
 */
import { useRef, useState, type ReactNode } from 'react';

const PANEL_WIDTH = 320;
const MAX_PANEL_HEIGHT = 380;

export function HoverCard({ children, panel, accent = '#e0d8c8' }: {
  children: ReactNode;
  panel: ReactNode;
  accent?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    // Prefer the right of the row; fall back to its left when space runs out.
    const left = r.right + PANEL_WIDTH + 16 < window.innerWidth
      ? r.right + 8
      : Math.max(8, r.left - PANEL_WIDTH - 8);
    const top = Math.max(8, Math.min(r.top, window.innerHeight - MAX_PANEL_HEIGHT - 16));
    setAt({ top, left });
  };

  return (
    <div
      ref={anchorRef}
      onMouseEnter={open}
      onMouseLeave={() => setAt(null)}
    >
      {children}
      {at && (
        <div style={{
          position: 'fixed', top: at.top, left: at.left,
          width: PANEL_WIDTH, maxHeight: MAX_PANEL_HEIGHT, overflow: 'auto',
          background: '#fffcf7', border: `1px solid #e0d8c8`,
          borderTop: `3px solid ${accent}`,
          borderRadius: 8, padding: '10px 12px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          zIndex: 60, fontSize: 12, lineHeight: 1.5, color: '#4a4a4a',
          pointerEvents: 'none',
        }}>
          {panel}
        </div>
      )}
    </div>
  );
}
