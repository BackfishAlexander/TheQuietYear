import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function ProjectList({ socket: _socket }: { socket: TypedSocket }) {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const active = gameState.projects.filter(p => !p.completed && !p.failed);
  const done = gameState.projects.filter(p => p.completed);
  const failed = gameState.projects.filter(p => p.failed);

  return (
    <div style={{ padding: 12, borderBottom: '1px solid #e0d8c8', fontSize: 13, flex: 1, overflow: 'auto' }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>
        Projects
      </h3>

      {active.length === 0 && done.length === 0 && failed.length === 0 && (
        <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12 }}>No projects yet</p>
      )}

      {active.map(p => (
        <div key={p.id} style={{
          padding: '6px 8px', marginBottom: 4, background: 'white',
          borderRadius: 4, border: '1px solid #e0d8c8',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
            <span style={{
              background: '#f0e6d3', padding: '2px 8px', borderRadius: 10,
              fontSize: 11, fontWeight: 700, color: '#8B6914',
            }}>
              {p.weeksRemaining}w
            </span>
          </div>
          {p.description && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.description}</div>
          )}
          {/* Dice visual */}
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: 2,
                background: i < p.weeksRemaining ? '#e67e22' : '#eee',
              }} />
            ))}
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#2ecc71', fontWeight: 600, marginBottom: 4 }}>Completed</div>
          {done.map(p => (
            <div key={p.id} style={{ fontSize: 12, color: '#888', padding: '2px 0', textDecoration: 'line-through' }}>
              {p.name}
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 600, marginBottom: 4 }}>Failed</div>
          {failed.map(p => (
            <div key={p.id} style={{ fontSize: 12, color: '#888', padding: '2px 0', textDecoration: 'line-through' }}>
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
