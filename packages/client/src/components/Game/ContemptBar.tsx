import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function ContemptBar({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <h3 style={{
        fontSize: 13, fontWeight: 600, marginBottom: 8,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888',
      }}>
        Contempt
      </h3>

      {gameState.players.map(player => {
        const isMe = player.id === playerId;
        return (
          <div key={player.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: player.color,
            }} />
            <span style={{ flex: 1, fontSize: 12 }}>
              {player.name}{isMe ? ' (you)' : ''}
            </span>
            {/* Token dots */}
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: player.contemptTokens }, (_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#2c2c2c', border: '1px solid #555',
                }} />
              ))}
            </div>
            {isMe && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => socket.emit('contempt:take')}
                  style={{
                    fontSize: 11, padding: '2px 6px', background: '#e74c3c',
                    color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer',
                  }}
                >
                  Take
                </button>
                {player.contemptTokens > 0 && (
                  <button
                    onClick={() => socket.emit('contempt:discard', { reason: '' })}
                    style={{
                      fontSize: 11, padding: '2px 6px', background: '#95a5a6',
                      color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
