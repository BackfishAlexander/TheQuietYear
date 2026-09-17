/**
 * Everyone weighs in on the topic going round the table, and the player who
 * raised it has the last word - so they take the final slot in the order
 * rather than sitting the discussion out.
 */
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { ACTION_COLORS } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { Icon } from './ToolIcons';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function Discussion({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [response, setResponse] = useState('');

  if (!gameState?.discussion) return null;

  const disc = gameState.discussion;
  const accent = ACTION_COLORS.discuss;
  const currentId = disc.expectedResponders[0];
  const isMyTurn = currentId === playerId;
  const current = gameState.players.find(p => p.id === currentId);
  const isHost = gameState.players.find(p => p.id === playerId)?.isHost ?? false;
  const nameOf = (id: string) => gameState.players.find(p => p.id === id)?.name ?? 'Unknown';

  const handleSubmit = () => {
    if (!response.trim()) return;
    socket.emit('discussion:respond', { text: response.trim() });
    setResponse('');
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
    }}>
      <div style={{
        background: '#faf6ee', borderRadius: 12, padding: 28,
        maxWidth: 500, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: `3px solid ${accent}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: accent, display: 'flex' }}><Icon name="discuss" size={18} /></span>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Discussion</h3>
          <span style={{ fontSize: 12, color: '#b0a795', marginLeft: 'auto' }}>
            raised by {nameOf(disc.initiatedBy)}
          </span>
        </div>

        <p style={{
          fontSize: 15, fontStyle: 'italic', color: '#555',
          marginBottom: 16, lineHeight: 1.5,
        }}>
          &ldquo;{disc.topic}&rdquo;
        </p>

        {/* Responses so far */}
        {disc.responses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {disc.responses.map((r, i) => (
              <div key={i} style={{
                padding: '8px 12px', background: 'white', borderRadius: 6,
                marginBottom: 6, border: '1px solid #e0d8c8',
                borderLeft: `3px solid ${accent}55`,
              }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                  {r.playerName}
                  {r.playerId === disc.initiatedBy && ' · the last word'}
                </div>
                <div style={{ fontSize: 14 }}>
                  {r.text || <span style={{ fontStyle: 'italic', color: '#b0a795' }}>passed</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Who is up, and who follows */}
        {disc.expectedResponders.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            {isMyTurn ? 'Your turn to weigh in' : `Waiting for ${current?.name}`}
            {disc.expectedResponders.length > 1 && (
              <span style={{ color: '#b0a795' }}>
                {' '}&middot; then {disc.expectedResponders.slice(1).map(nameOf).join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Input when the order reaches me */}
        {isMyTurn ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={response}
              onChange={e => setResponse(e.target.value)}
              placeholder={
                playerId === disc.initiatedBy
                  ? 'Your last word on the matter...'
                  : 'Your response (1-2 sentences)...'
              }
              style={{
                flex: 1, padding: '8px 12px', fontSize: 14,
                border: `2px solid ${accent}`, borderRadius: 6,
                fontFamily: 'Georgia, serif',
              }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={200}
              autoFocus
            />
            <button onClick={handleSubmit} style={{
              padding: '8px 16px', background: accent, color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'Georgia, serif', fontSize: 14,
            }}>
              Submit
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
            Waiting for {current?.name} to weigh in...
          </p>
        )}

        {/* Nobody should be stuck behind a player who has stepped away. */}
        {isHost && !isMyTurn && disc.expectedResponders.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button
              onClick={() => socket.emit('discussion:skipResponder')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Georgia, serif', fontSize: 11, color: '#b0a795',
                textDecoration: 'underline',
              }}
            >
              Skip {current?.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
