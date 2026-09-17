/**
 * Toolbar glyphs, drawn as inline SVG so they inherit button colour and stay
 * crisp at any density. All are 24x24 with a 2px stroke.
 */
export type IconName =
  | 'pen' | 'marker' | 'highlighter' | 'eraser'
  | 'line' | 'arrow' | 'rect' | 'ellipse' | 'triangle'
  | 'bucket' | 'hand' | 'undo' | 'redo'
  | 'target' | 'fit' | 'hundred'
  | 'file' | 'save' | 'open' | 'image' | 'trash'
  | 'users' | 'lock' | 'caret';

const PATHS: Record<IconName, JSX.Element> = {
  pen: <path d="M4 20l1-4L16 5a2 2 0 013 3L8 19l-4 1z" />,
  marker: <path d="M5 19l-1 1h4l10-10a2.5 2.5 0 00-4-4L4 16v3zM13 6l5 5" />,
  highlighter: <path d="M5 17l3 3 3-3 6-9a2.5 2.5 0 00-4-3L7 11l-2 6zM4 22h16" />,
  eraser: <path d="M8 20h12M17 8L9 16a2 2 0 000 3l1 1h4l8-8a2 2 0 000-3l-3-3a2 2 0 00-3 0L8 13" />,
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M4 20L20 4M12 4h8v8" />,
  rect: <rect x="4" y="6" width="16" height="12" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6.5" />,
  triangle: <path d="M12 5l8 14H4z" />,
  bucket: <path d="M6 5l9 9-7 6-6-6 7-6 3 3M19 14c0 0 2 2.2 2 3.6A2 2 0 0119 19.5a2 2 0 01-2-1.9c0-1.4 2-3.6 2-3.6z" />,
  hand: <path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v5a5 5 0 01-5 5h-1.5a5 5 0 01-4.3-2.4L5 15.5a1.5 1.5 0 012.4-1.8L8 14.5" />,
  undo: <path d="M9 8H4V3M4 8a9 9 0 113.3 10" />,
  redo: <path d="M15 8h5V3M20 8A9 9 0 1016.7 18" />,
  target: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 11v2" /></>,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M8.5 8.5h7v7h-7z" />,
  hundred: <path d="M4 8v8M9 9a2 2 0 012 2v2a2 2 0 01-4 0v-2a2 2 0 012-2zM18 9a2 2 0 012 2v2a2 2 0 01-4 0v-2a2 2 0 012-2zM14 6l-1 12" />,
  file: <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5" />,
  save: <path d="M12 3v11m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />,
  open: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 16l-5-5-9 8" /></>,
  trash: <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  users: <path d="M16 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20M9.5 10.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM17 4.2a3.5 3.5 0 010 6.6M21 20v-1.5a4 4 0 00-3-3.8" />,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  caret: <path d="M5 9l7 7 7-7" />,
};

/** Solid-filled glyphs read better than outlines at this size. */
const FILLED: IconName[] = ['caret'];

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={FILLED.includes(name) ? 3 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {PATHS[name]}
    </svg>
  );
}
