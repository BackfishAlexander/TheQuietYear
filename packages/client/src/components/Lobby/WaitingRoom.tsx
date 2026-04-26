import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function WaitingRoom({ socket }: { socket: TypedSocket }) {
  const { roomState, playerId } = useGameStore();

  if (!roomState) return null;

  const isHost = roomState.hostId === playerId;
  const canStart = isHost && roomState.players.length >= 2;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#f5f0e8',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 40 }}>
        <h2 style={{ fontSize: 28, fontWeight: 400, marginBottom: 8, fontFamily: 'Georgia, serif' }}>
          Waiting Room
        </h2>

        <div style={{
          background: '#fff', border: '2px solid #d4c5a9', borderRadius: 8,
          padding: '16px 24px', marginBottom: 24, fontSize: 14,
        }}>
          <p style={{ color: '#888', marginBottom: 4 }}>Room Code</p>
          <p style={{
            fontSize: 36, letterSpacing: '0.3em', fontWeight: 700,
            color: '#2c2c2c', fontFamily: 'monospace',
          }}>
            {roomState.roomId}
          </p>
          <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
            Share this code with other players
          </p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 400, marginBottom: 12, color: '#555' }}>
            Players ({roomState.players.length}/4)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roomState.players.map((player) => (
              <div key={player.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', background: 'white',
                borderRadius: 6, border: '1px solid #e0d8c8',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: player.color,
                }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 16 }}>
                  {player.name}
                </span>
                {player.isHost && (
                  <span style={{
                    fontSize: 11, background: '#d4c5a9', padding: '2px 8px',
                    borderRadius: 4, color: '#555',
                  }}>
                    HOST
                  </span>
                )}
                {player.id === playerId && (
                  <span style={{ fontSize: 11, color: '#888' }}>You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={() => socket.emit('game:start')}
            disabled={!canStart}
            style={{
              padding: '12px 32px', fontSize: 18, fontFamily: 'Georgia, serif',
              background: canStart ? '#4a7c59' : '#ccc',
              color: 'white', border: 'none', borderRadius: 8, cursor: canStart ? 'pointer' : 'default',
              width: '100%',
            }}
          >
            {canStart ? 'Start Game' : `Need ${2 - roomState.players.length} more player(s)`}
          </button>
        ) : (
          <p style={{ color: '#888', fontStyle: 'italic' }}>
            Waiting for the host to start the game...
          </p>
        )}
      </div>
    </div>
  );
}
