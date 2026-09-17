import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, DrawTool, Player, Stroke } from '@quiet-year/shared';
import { PALETTE, STROKE_WIDTHS } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { exportPng, readCanvasFile, saveCanvasFile, CANVAS_FILE_EXTENSION } from '../../canvas/persist';
import { Icon, type IconName } from './ToolIcons';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export interface ToolSettings {
  tool: DrawTool;
  color: string;
  /** Interior colour for closed shapes, or null for outline only. */
  fillColor: string | null;
  width: number;
}

interface DrawToolbarProps {
  socket: TypedSocket;
  settings: ToolSettings;
  onSettingsChange: (settings: ToolSettings) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onRecenter: () => void;
  onFitContent: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canDraw: boolean;
  isHost: boolean;
  players: Player[];
  playerId: string | null;
  strokes: Stroke[];
  roomId: string | null;
}

const DRAW_TOOLS: { tool: DrawTool; icon: IconName; label: string; key: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen', key: 'P' },
  { tool: 'marker', icon: 'marker', label: 'Marker', key: 'M' },
  { tool: 'highlighter', icon: 'highlighter', label: 'Highlighter', key: 'H' },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
];

const SHAPES: { tool: DrawTool; icon: IconName; label: string; key: string }[] = [
  { tool: 'line', icon: 'line', label: 'Line', key: 'L' },
  { tool: 'arrow', icon: 'arrow', label: 'Arrow', key: 'A' },
  { tool: 'rect', icon: 'rect', label: 'Rectangle', key: 'R' },
  { tool: 'ellipse', icon: 'ellipse', label: 'Ellipse', key: 'O' },
  { tool: 'triangle', icon: 'triangle', label: 'Triangle', key: 'T' },
];

export function DrawToolbar(props: DrawToolbarProps) {
  const {
    socket, settings, onSettingsChange, zoom, onZoomIn, onZoomOut, onResetZoom,
    onRecenter, onFitContent, onUndo, onRedo, canUndo, canRedo, canDraw,
    isHost, players, playerId, strokes, roomId,
  } = props;

  const setError = useGameStore(s => s.setError);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<ToolSettings>) => onSettingsChange({ ...settings, ...patch });
  const toggle = (name: string) => setOpenMenu(cur => (cur === name ? null : name));

  const activeShape = SHAPES.find(s => s.tool === settings.tool) ?? SHAPES[0];
  const shapeActive = SHAPES.some(s => s.tool === settings.tool);

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;

    const result = await readCanvasFile(file);
    if ('error' in result) {
      setError(result.error);
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (!window.confirm(
      `Load ${result.strokes.length} strokes from "${file.name}"?\n\n` +
      'This replaces the current map for everyone in the room.',
    )) return;

    socket.emit('draw:load', { strokes: result.strokes });
    setOpenMenu(null);
  }

  function handleExportPng() {
    const problem = exportPng(strokes, roomId);
    if (problem) {
      setError(problem);
      setTimeout(() => setError(null), 4000);
    }
    setOpenMenu(null);
  }

  function handleClear() {
    if (!window.confirm('Erase the entire map for everyone? This cannot be undone.')) return;
    socket.emit('draw:clear');
    setOpenMenu(null);
  }

  return (
    <div style={barWrapperStyle}>
    <div style={barStyle}>
      {!canDraw && (
        <span style={lockedBadgeStyle} title="The host has turned off your drawing access">
          <Icon name="lock" size={13} /> View only
        </span>
      )}

      <ToolButton
        icon="hand"
        label="Pan (V, or hold Space)"
        active={settings.tool === 'pan'}
        onClick={() => set({ tool: 'pan' })}
      />

      <Divider />

      {DRAW_TOOLS.map(t => (
        <ToolButton
          key={t.tool}
          icon={t.icon}
          label={`${t.label} (${t.key})`}
          active={settings.tool === t.tool}
          disabled={!canDraw}
          onClick={() => set({ tool: t.tool })}
        />
      ))}

      {/* Shapes collapse into one button so the bar stays readable. */}
      <Popover
        name="shapes"
        open={openMenu === 'shapes'}
        onToggle={toggle}
        trigger={
          <ToolButton
            icon={activeShape.icon}
            label="Shapes"
            active={shapeActive}
            disabled={!canDraw}
            caret
            onClick={() => {
              if (!shapeActive) set({ tool: activeShape.tool });
              toggle('shapes');
            }}
          />
        }
      >
        <MenuTitle>Shape</MenuTitle>
        <div style={{ display: 'flex', gap: 4 }}>
          {SHAPES.map(s => (
            <ToolButton
              key={s.tool}
              icon={s.icon}
              label={`${s.label} (${s.key})`}
              active={settings.tool === s.tool}
              onClick={() => { set({ tool: s.tool }); setOpenMenu(null); }}
            />
          ))}
        </div>
        <MenuTitle>Shape fill</MenuTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => set({ fillColor: null })}
            style={{ ...menuItemStyle, fontWeight: settings.fillColor === null ? 700 : 400 }}
          >
            No fill
          </button>
          <button
            onClick={() => set({ fillColor: settings.color })}
            style={{ ...menuItemStyle, fontWeight: settings.fillColor !== null ? 700 : 400 }}
          >
            Fill with current colour
          </button>
          {settings.fillColor && (
            <span style={{ ...swatchStyle(settings.fillColor), width: 18, height: 18 }} />
          )}
        </div>
        <p style={hintStyle}>Hold Shift while dragging for a perfect square, circle, or 45° line.</p>
      </Popover>

      <ToolButton
        icon="bucket"
        label="Bucket fill (G) — fills the enclosed area you click"
        active={settings.tool === 'fill'}
        disabled={!canDraw}
        onClick={() => set({ tool: 'fill' })}
      />

      <Divider />

      {/* Colour */}
      <Popover
        name="color"
        open={openMenu === 'color'}
        onToggle={toggle}
        trigger={
          <button
            onClick={() => toggle('color')}
            disabled={!canDraw}
            title="Colour"
            style={{
              ...toolButtonStyle(false, !canDraw),
              width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
          >
            <span style={swatchStyle(settings.color)} />
            <Icon name="caret" size={8} />
          </button>
        }
      >
        <MenuTitle>Colour</MenuTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 5 }}>
          {PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { set({ color: c, fillColor: settings.fillColor === null ? null : c }); setOpenMenu(null); }}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer', padding: 0,
                border: settings.color === c ? '2px solid #4a7c59' : '1px solid rgba(0,0,0,0.18)',
                boxShadow: settings.color === c ? '0 0 0 1px #fff inset' : 'none',
              }}
            />
          ))}
        </div>
        <MenuTitle>Custom</MenuTitle>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <input
            type="color"
            value={settings.color}
            onChange={e => set({ color: e.target.value })}
            style={{ width: 40, height: 26, padding: 0, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'monospace' }}>{settings.color}</span>
        </label>
      </Popover>

      {/* Width */}
      <Popover
        name="width"
        open={openMenu === 'width'}
        onToggle={toggle}
        trigger={
          <button
            onClick={() => toggle('width')}
            disabled={!canDraw}
            title="Stroke width"
            style={{ ...toolButtonStyle(false, !canDraw), width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            <span style={{
              width: Math.min(14, settings.width + 2), height: Math.min(14, settings.width + 2),
              borderRadius: '50%', background: '#333', display: 'inline-block',
            }} />
            <Icon name="caret" size={8} />
          </button>
        }
      >
        <MenuTitle>Width</MenuTitle>
        <div style={{ display: 'flex', gap: 4 }}>
          {STROKE_WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => { set({ width: w }); setOpenMenu(null); }}
              title={`${w}px`}
              style={{
                ...toolButtonStyle(settings.width === w, false),
                width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{
                width: Math.min(20, w + 3), height: Math.min(20, w + 3), borderRadius: '50%',
                background: settings.width === w ? 'white' : '#444', display: 'inline-block',
              }} />
            </button>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 12, marginTop: 8, color: '#666' }}>
          Custom: {settings.width}px
          <input
            type="range"
            min={1}
            max={64}
            value={settings.width}
            onChange={e => set({ width: Number(e.target.value) })}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
      </Popover>

      <Divider />

      <ToolButton icon="undo" label="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} />
      <ToolButton icon="redo" label="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={onRedo} />

      <Divider />

      {/* View */}
      <Popover
        name="view"
        open={openMenu === 'view'}
        onToggle={toggle}
        trigger={<ToolButton icon="target" label="View" caret onClick={() => toggle('view')} />}
      >
        <MenuTitle>View</MenuTitle>
        <MenuButton onClick={() => { onRecenter(); setOpenMenu(null); }}>
          <Icon name="target" size={14} /> Back to centre
        </MenuButton>
        <MenuButton onClick={() => { onFitContent(); setOpenMenu(null); }}>
          <Icon name="fit" size={14} /> Fit the whole map
        </MenuButton>
        <MenuButton onClick={() => { onResetZoom(); setOpenMenu(null); }}>
          <Icon name="hundred" size={14} /> Zoom to 100%
        </MenuButton>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <MenuButton onClick={onZoomOut}>−</MenuButton>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, alignSelf: 'center', fontFamily: 'monospace' }}>
            {Math.round(zoom * 100)}%
          </span>
          <MenuButton onClick={onZoomIn}>+</MenuButton>
        </div>
        <p style={hintStyle}>
          Scroll to pan, Ctrl/⌘+scroll or pinch to zoom, Space or middle-drag to grab the paper.
          The map has no edges — it keeps going as far as you draw.
        </p>
      </Popover>

      {/* File */}
      <Popover
        name="file"
        open={openMenu === 'file'}
        onToggle={toggle}
        trigger={<ToolButton icon="file" label="Save & load" caret onClick={() => toggle('file')} />}
      >
        <MenuTitle>This map</MenuTitle>
        <MenuButton onClick={() => { saveCanvasFile(strokes, roomId); setOpenMenu(null); }}>
          <Icon name="save" size={14} /> Save to a file
        </MenuButton>
        <MenuButton onClick={handleExportPng}>
          <Icon name="image" size={14} /> Export as PNG
        </MenuButton>
        {isHost ? (
          <>
            <MenuTitle>Host only</MenuTitle>
            <MenuButton onClick={() => fileInputRef.current?.click()}>
              <Icon name="open" size={14} /> Load a saved map…
            </MenuButton>
            <MenuButton danger onClick={handleClear}>
              <Icon name="trash" size={14} /> Clear the map
            </MenuButton>
          </>
        ) : (
          <p style={hintStyle}>Only the host can load a saved map or clear the canvas.</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={`${CANVAS_FILE_EXTENSION},.json,application/json`}
          onChange={handleFilePicked}
          style={{ display: 'none' }}
        />
      </Popover>

      {/* Admin */}
      {isHost && (
        <Popover
          name="admin"
          open={openMenu === 'admin'}
          onToggle={toggle}
          trigger={<ToolButton icon="users" label="Drawing permissions" caret onClick={() => toggle('admin')} />}
        >
          <MenuTitle>Who can draw</MenuTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
            {players.map(player => {
              const self = player.id === playerId;
              return (
                <div key={player.id} style={permissionRowStyle}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: player.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, opacity: player.connected ? 1 : 0.5 }}>
                    {player.name}
                    {self && <span style={{ color: '#999', fontSize: 11 }}> (you)</span>}
                    {!player.connected && <span style={{ color: '#999', fontSize: 11 }}> · away</span>}
                  </span>
                  <Switch
                    checked={player.canDraw}
                    // The host always keeps their own access.
                    disabled={self}
                    title={self ? 'You always keep drawing access' : player.canDraw ? 'Turn drawing off' : 'Turn drawing on'}
                    onChange={next => socket.emit('admin:setDrawPermission', { playerId: player.id, canDraw: next })}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <MenuButton onClick={() => socket.emit('admin:setAllDrawPermissions', { canDraw: true })}>
              Everyone on
            </MenuButton>
            <MenuButton onClick={() => socket.emit('admin:setAllDrawPermissions', { canDraw: false })}>
              Everyone off
            </MenuButton>
          </div>
          <p style={hintStyle}>
            Players with drawing off can still pan, zoom, and save the map — they just can't mark it.
          </p>
        </Popover>
      )}
    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function ToolButton({ icon, label, active, disabled, caret, onClick }: {
  icon: IconName; label: string; active?: boolean; disabled?: boolean;
  caret?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={{
        ...toolButtonStyle(!!active, !!disabled),
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}
    >
      <Icon name={icon} size={16} />
      {caret && <Icon name="caret" size={8} />}
    </button>
  );
}

function Popover({ name, open, onToggle, trigger, children }: {
  name: string; open: boolean; onToggle: (name: string) => void;
  trigger: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onToggle(name);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle(name);
    };
    // Defer so the click that opened the popover doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, name, onToggle]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      {trigger}
      {open && <div style={popoverStyle}>{children}</div>}
    </div>
  );
}

function Switch({ checked, disabled, title, onChange }: {
  checked: boolean; disabled?: boolean; title?: string; onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 34, height: 19, borderRadius: 10, border: 'none', padding: 2,
        background: checked ? '#4a7c59' : '#c9c2b4',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 120ms',
      }}
    >
      <span style={{ width: 15, height: 15, borderRadius: '50%', background: 'white' }} />
    </button>
  );
}

function MenuTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: '#999', margin: '8px 0 5px', fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

function MenuButton({ children, onClick, danger }: {
  children: ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} style={{ ...menuItemStyle, color: danger ? '#b91c1c' : '#333', width: '100%' }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: '#e2ddd2', margin: '0 2px', flexShrink: 0 }} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * Spans the canvas so the bar can centre itself against the full width.
 * Transparent to the pointer, so the map stays drawable either side of it.
 */
const barWrapperStyle: React.CSSProperties = {
  position: 'absolute', top: 8, left: 0, right: 0, zIndex: 20,
  display: 'flex', justifyContent: 'center', padding: '0 8px',
  pointerEvents: 'none',
};

const barStyle: React.CSSProperties = {
  display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap',
  justifyContent: 'center', maxWidth: '100%', pointerEvents: 'auto',
  background: 'rgba(255,255,255,0.96)', padding: '5px 8px',
  borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
};

function toolButtonStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    height: 28, minWidth: 28, padding: '0 5px', border: 'none', borderRadius: 6,
    background: active ? '#4a7c59' : 'transparent',
    color: active ? 'white' : disabled ? '#c4c4c4' : '#3a3a3a',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}

function swatchStyle(color: string): React.CSSProperties {
  return {
    width: 16, height: 16, borderRadius: 4, background: color,
    border: '1px solid rgba(0,0,0,0.22)', display: 'inline-block', flexShrink: 0,
  };
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
  background: 'white', borderRadius: 10, padding: '4px 12px 12px',
  boxShadow: '0 6px 22px rgba(0,0,0,0.18)', zIndex: 30, maxWidth: 280,
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px',
  fontSize: 13, fontFamily: 'Georgia, serif', textAlign: 'left',
  background: '#f6f4ef', border: 'none', borderRadius: 6, cursor: 'pointer',
  color: '#333', whiteSpace: 'nowrap',
};

const permissionRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '5px 7px', background: '#f6f4ef', borderRadius: 6,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11, color: '#8a8a8a', marginTop: 9, lineHeight: 1.45,
  maxWidth: 240, whiteSpace: 'normal',
};

const lockedBadgeStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
  background: '#fdecea', color: '#b91c1c', padding: '3px 8px',
  borderRadius: 12, whiteSpace: 'nowrap',
};
