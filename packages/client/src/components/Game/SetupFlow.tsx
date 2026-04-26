import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function SetupFlow({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [resource, setResource] = useState('');

  if (!gameState) return null;

  const isHost = gameState.players.find(p => p.isHost)?.id === playerId;
  const setup = gameState.setup;

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
    }}>
      <div style={{
        background: '#faf6ee', borderRadius: 12, padding: 32,
        maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '3px solid #4a7c59',
      }}>
        {/* Terrain Phase */}
        {setup.phase === 'terrain' && (
          <>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Sketch Your Territory</h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 8 }}>
              Take a moment to discuss what kind of habitat your community lives in.
              Then each player should draw one detail on the map.
            </p>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              Your community has 60-80 members and should occupy about one-third of the map.
              Use the drawing tools on the canvas behind this panel.
            </p>
            <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 16 }}>
              Close this panel to draw, then reopen when ready.
            </p>
            {isHost ? (
              <button
                onClick={() => socket.emit('setup:finishTerrain')}
                style={bigBtn}
              >
                Finish Terrain - Continue to Resources
              </button>
            ) : (
              <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                The host will advance when everyone is done drawing.
              </p>
            )}
          </>
        )}

        {/* Resource Declaration Phase */}
        {setup.phase === 'resources-declare' && (
          <>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Declare Resources</h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
              Each player declares one important resource the community needs (food, shelter, medicine, tools, etc.).
            </p>

            {/* Already declared */}
            {setup.resourceDeclarations.map((d, i) => {
              const player = gameState.players.find(p => p.id === d.playerId);
              return (
                <div key={i} style={{
                  padding: '6px 10px', background: 'white', borderRadius: 4,
                  marginBottom: 4, fontSize: 13, border: '1px solid #e0d8c8',
                }}>
                  <strong>{player?.name}:</strong> {d.resource}
                </div>
              );
            })}

            {/* Current declarer */}
            {setup.currentDeclarerIndex < gameState.players.length && (() => {
              const declarer = gameState.players[setup.currentDeclarerIndex];
              const isMyTurn = declarer.id === playerId;

              if (isMyTurn) {
                return (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      value={resource}
                      onChange={e => setResource(e.target.value)}
                      placeholder="Name a resource..."
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 14,
                        border: '2px solid #4a7c59', borderRadius: 6,
                        fontFamily: 'Georgia, serif',
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && resource.trim()) {
                          socket.emit('setup:declareResource', { resource: resource.trim() });
                          setResource('');
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (resource.trim()) {
                          socket.emit('setup:declareResource', { resource: resource.trim() });
                          setResource('');
                        }
                      }}
                      style={bigBtn}
                    >
                      Declare
                    </button>
                  </div>
                );
              } else {
                return (
                  <p style={{ color: '#888', fontStyle: 'italic', marginTop: 12, textAlign: 'center' }}>
                    Waiting for {declarer.name} to declare a resource...
                  </p>
                );
              }
            })()}
          </>
        )}

        {/* Abundance Vote Phase */}
        {setup.phase === 'resources-vote' && (
          <>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Choose the Abundance</h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
              Vote on which resource the community has in abundance. The rest will be scarcities.
            </p>

            {(() => {
              const hasVoted = setup.abundanceVotes.some(v => v.playerId === playerId);
              if (hasVoted) {
                return (
                  <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                    Waiting for others to vote... ({setup.abundanceVotes.length}/{gameState.players.length})
                  </p>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {setup.resourceDeclarations.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => socket.emit('setup:voteAbundance', { resource: d.resource })}
                      style={{
                        padding: '10px 16px', background: 'white',
                        border: '2px solid #2ecc71', borderRadius: 6,
                        cursor: 'pointer', fontFamily: 'Georgia, serif',
                        fontSize: 14, textAlign: 'left',
                      }}
                    >
                      {d.resource}
                    </button>
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

const bigBtn: React.CSSProperties = {
  padding: '10px 20px', fontSize: 15, background: '#4a7c59', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Georgia, serif',
};
