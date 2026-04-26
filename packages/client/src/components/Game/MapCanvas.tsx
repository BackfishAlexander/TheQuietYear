import { useRef, useEffect, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, Stroke, StrokePoint } from '@quiet-year/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT, generateId } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const COLORS = ['#2c2c2c', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f5f0e8'];
const WIDTHS = [2, 4, 8];

export function MapCanvas({ socket }: { socket: TypedSocket }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { strokes, addStroke, playerId } = useGameStore();
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [scale, setScale] = useState(1);

  // Calculate scale to fit canvas in container
  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const sx = rect.width / CANVAS_WIDTH;
    const sy = rect.height / CANVAS_HEIGHT;
    setScale(Math.min(sx, sy));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Redraw all strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Paper background
    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid dots
    ctx.fillStyle = '#e8e0d0';
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw all strokes
    const allStrokes = [...strokes];
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke);
    }

    // Draw current in-progress stroke
    if (currentPoints.length > 1) {
      drawStroke(ctx, {
        id: 'current',
        playerId: playerId || '',
        tool,
        points: currentPoints,
        color: tool === 'eraser' ? '#faf6ee' : color,
        width: tool === 'eraser' ? width * 3 : width,
      });
    }
  }, [strokes, currentPoints, color, width, tool, playerId]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#faf6ee' : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.width * 3 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Smooth path with quadratic curves
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function getCanvasPoint(e: React.PointerEvent): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentPoints([point]);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawing) return;
    const point = getCanvasPoint(e);
    setCurrentPoints(prev => [...prev, point]);
  }

  function handlePointerUp() {
    if (!drawing) return;
    setDrawing(false);

    if (currentPoints.length > 1) {
      const stroke: Stroke = {
        id: generateId(),
        playerId: playerId || '',
        tool,
        points: currentPoints,
        color: tool === 'eraser' ? '#faf6ee' : color,
        width,
      };
      addStroke(stroke);
      socket.emit('draw:stroke', stroke);
    }
    setCurrentPoints([]);
  }

  function handleUndo() {
    socket.emit('draw:undo');
  }

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#e8e0d0', position: 'relative',
    }}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, background: 'white', padding: '6px 12px',
        borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10,
        alignItems: 'center',
      }}>
        {/* Tool selector */}
        <button
          onClick={() => setTool('pen')}
          style={{
            ...toolBtnStyle,
            background: tool === 'pen' ? '#4a7c59' : '#eee',
            color: tool === 'pen' ? 'white' : '#333',
          }}
        >
          Pen
        </button>
        <button
          onClick={() => setTool('eraser')}
          style={{
            ...toolBtnStyle,
            background: tool === 'eraser' ? '#4a7c59' : '#eee',
            color: tool === 'eraser' ? 'white' : '#333',
          }}
        >
          Eraser
        </button>

        <div style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />

        {/* Colors */}
        {COLORS.slice(0, -1).map(c => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen'); }}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              border: color === c && tool === 'pen' ? '3px solid #4a7c59' : '2px solid #ccc',
              cursor: 'pointer', padding: 0,
            }}
          />
        ))}

        <div style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />

        {/* Widths */}
        {WIDTHS.map(w => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            style={{
              ...toolBtnStyle, width: 28, padding: 0,
              background: width === w ? '#4a7c59' : '#eee',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{
              width: w * 2.5, height: w * 2.5, borderRadius: '50%',
              background: width === w ? 'white' : '#555',
            }} />
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: '#ddd', margin: '0 4px' }} />

        <button onClick={handleUndo} style={toolBtnStyle}>
          Undo
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          borderRadius: 4,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
      />
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4,
  cursor: 'pointer', fontFamily: 'Georgia, serif', height: 28,
};
