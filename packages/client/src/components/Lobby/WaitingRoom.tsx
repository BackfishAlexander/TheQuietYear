import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { moveInOrder } from '../../lib/roster';
import { Icon } from '../Game/ToolIcons';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function WaitingRoom({ socket }: { socket: TypedSocket }) {
  const { roomState, playerId, leaveRoom } = useGameStore();

  if (!roomState) return null;

  const isHost = roomState.hostId === playerId;
  const canStart = isHost && roomState.players.length >= 2;

  // The list order is the turn order the game starts with, so the host can
  // seat people where they want them before the first card is drawn.
  const reorder = (index: number, delta: number) => {
    socket.emit('admin:reorderPlayers', {
      order: moveInOrder(roomState.players.map(p => p.id), index, delta),
    });
  };

  const kick = (targetId: string, targetName: string) => {
    if (!window.confirm(`Remove ${targetName} from the room?`)) return;
    socket.emit('admin:kickPlayer', { playerId: targetId });
  };

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
            Players ({roomState.players.length}/4){isHost && ' — in turn order'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roomState.players.map((player, i) => (
              <div key={player.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', background: 'white',
                borderRadius: 6, border: '1px solid #e0d8c8',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: player.color,
                }} />
                <span style={{
                  flex: 1, textAlign: 'left', fontSize: 16,
                  opacity: player.connected ? 1 : 0.5,
                }}>
                  {player.name}
                  {!player.connected && (
                    <span style={{ fontSize: 11, color: '#888' }}> · away</span>
                  )}
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
                {isHost && (
                  <>
                    <RosterButton
                      label="Move up the order"
                      disabled={i === 0}
                      onClick={() => reorder(i, -1)}
                    >
                      ↑
                    </RosterButton>
                    <RosterButton
                      label="Move down the order"
                      disabled={i === roomState.players.length - 1}
                      onClick={() => reorder(i, 1)}
                    >
                      ↓
                    </RosterButton>
                    <RosterButton
                      label={player.id === playerId ? 'You cannot remove yourself' : `Remove ${player.name}`}
                      disabled={player.id === playerId}
                      danger
                      onClick={() => kick(player.id, player.name)}
                    >
                      <Icon name="cross" size={11} />
                    </RosterButton>
                  </>
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

        <button
          onClick={leaveRoom}
          style={{
            background: 'none', border: 'none', color: '#999', marginTop: 16,
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            fontFamily: 'Georgia, serif',
          }}
        >
          Leave the room
        </button>
      </div>
    </div>
  );
}

function RosterButton({ label, disabled, danger, onClick, children }: {
  label: string; disabled?: boolean; danger?: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        width: 22, height: 22, padding: 0, borderRadius: 4,
        border: '1px solid #e0d8c8', background: '#faf7f1',
        color: disabled ? '#ccc4b5' : danger ? '#b91c1c' : '#666',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, lineHeight: 1, flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
