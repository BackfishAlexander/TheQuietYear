import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function Discussion({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [response, setResponse] = useState('');

  if (!gameState?.discussion) return null;

  const disc = gameState.discussion;
  const isExpected = disc.expectedResponders.includes(playerId || '');
  const hasResponded = disc.responses.some(r => r.playerId === playerId);

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
        border: '3px solid #3498db',
      }}>
        <h3 style={{ fontSize: 16, marginBottom: 4, fontWeight: 600 }}>
          Discussion
        </h3>
        <p style={{
          fontSize: 15, fontStyle: 'italic', color: '#555',
          marginBottom: 16, lineHeight: 1.5,
        }}>
          "{disc.topic}"
        </p>

        {/* Responses so far */}
        {disc.responses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {disc.responses.map((r, i) => (
              <div key={i} style={{
                padding: '8px 12px', background: 'white', borderRadius: 6,
                marginBottom: 6, border: '1px solid #e0d8c8',
              }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                  {r.playerName}
                </div>
                <div style={{ fontSize: 14 }}>{r.text}</div>
              </div>
            ))}
          </div>
        )}

        {/* Waiting for */}
        {disc.expectedResponders.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Waiting for: {disc.expectedResponders.map(id => {
              const p = gameState.players.find(pl => pl.id === id);
              return p?.name || 'Unknown';
            }).join(', ')}
          </div>
        )}

        {/* Input if it's my turn to respond */}
        {isExpected && !hasResponded && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={response}
              onChange={e => setResponse(e.target.value)}
              placeholder="Your response (1-2 sentences)..."
              style={{
                flex: 1, padding: '8px 12px', fontSize: 14,
                border: '2px solid #3498db', borderRadius: 6,
                fontFamily: 'Georgia, serif',
              }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={200}
              autoFocus
            />
            <button onClick={handleSubmit} style={{
              padding: '8px 16px', background: '#3498db', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'Georgia, serif', fontSize: 14,
            }}>
              Submit
            </button>
          </div>
        )}

        {hasResponded && disc.expectedResponders.length > 0 && (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
            Waiting for others to respond...
          </p>
        )}
      </div>
    </div>
  );
}
