/**
 * The map is the point of the game, so either sidebar can be folded away to a
 * thin rail when the table wants room to draw. The rail stays put when
 * collapsed so the toggle is always in the same place.
 */
import type { ReactNode } from 'react';
import { Icon } from './ToolIcons';

const RAIL_WIDTH = 22;

export function SidebarShell({ side, open, onToggle, label, width, children }: {
  side: 'left' | 'right';
  open: boolean;
  onToggle: () => void;
  /** Shown down the rail while collapsed, so a folded panel is still named. */
  label: string;
  width: number;
  children: ReactNode;
}) {
  // The chevron points the way the panel will move.
  const pointsLeft = side === 'left' ? open : !open;

  const rail = (
    <button
      onClick={onToggle}
      title={open ? `Hide ${label}` : `Show ${label}`}
      style={{
        width: RAIL_WIDTH, flexShrink: 0, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, paddingTop: 10,
        background: '#f4eee2', cursor: 'pointer',
        border: 'none',
        [side === 'left' ? 'borderLeft' : 'borderRight']: '1px solid #e8e0d0',
        color: '#a8a094', fontFamily: 'Georgia, serif',
      }}
    >
      <span style={{ display: 'flex', transform: `rotate(${pointsLeft ? 90 : -90}deg)` }}>
        <Icon name="caret" size={13} />
      </span>
      {!open && (
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
          writingMode: 'vertical-rl',
          transform: side === 'left' ? 'none' : 'rotate(180deg)',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}
    </button>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: side === 'left' ? 'row' : 'row-reverse',
      flexShrink: 0,
      overflow: 'hidden',
      background: '#faf6ee',
      [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid #e8e0d0',
    }}>
      {/* Hidden rather than unmounted, so a folded panel comes back on the
          tab it was left on. */}
      <div style={{
        width, flexShrink: 0,
        display: open ? 'flex' : 'none',
        flexDirection: 'column', overflow: 'hidden',
      }}>
        {children}
      </div>
      {rail}
    </div>
  );
}
