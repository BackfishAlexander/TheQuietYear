import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

/**
 * The room code, always in reach: after a game is loaded from a file it is
 * the only way the rest of the table gets back in, and it is a click to copy.
 */
function RoomCode({ roomId, away }: { roomId: string; away: string[] }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // Clipboard access can be refused; the code is on screen regardless.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={copy}
        title={`Room code ${roomId} — click to copy. Anyone joining with this code and the name they played under gets their seat back.`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px',
          background: copied ? '#4a7c5914' : 'transparent',
          border: '1px solid #e0d8c8', borderRadius: 12, cursor: 'pointer',
          fontFamily: 'Georgia, serif',
        }}
      >
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b0a795',
        }}>
          Room
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.12em', color: '#2c2c2c',
        }}>
          {roomId}
        </span>
        <span style={{ fontSize: 10, color: copied ? '#4a7c59' : '#c3bbac' }}>
          {copied ? 'copied' : 'copy'}
        </span>
      </button>

      {away.length > 0 && (
        <span
          title={`${away.join(', ')} can rejoin with the room code, using the same name.`}
          style={{ fontSize: 11, color: '#a16207', whiteSpace: 'nowrap' }}
        >
          waiting for {away.length === 1 ? away[0] : `${away.length} players`}
        </span>
      )}
    </div>
  );
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export function TurnBar({ socket: _socket, seasonColor }: { socket: TypedSocket; seasonColor: string }) {
  const { gameState, roomState, playerId } = useGameStore();
  if (!gameState) return null;

  const roomId = roomState?.roomId ?? gameState.roomId;
  // A game picked back up from a file starts with everyone but the loader
  // still away, so the table needs the code in front of them to get back in.
  const away = gameState.players.filter(p => !p.connected);

  const activePlayer = gameState.players.find(
    p => p.id === gameState.turnOrder[gameState.activePlayerIndex]
  );
  const isMyTurn = gameState.turnOrder[gameState.activePlayerIndex] === playerId;
  const cardsLeft = gameState.deck.length;
  const suitSymbol = gameState.currentCard ? SUIT_SYMBOLS[gameState.currentCard.suit] : '';

  return (
    <div style={{
      background: '#fffcf7',
      borderBottom: `2px solid ${seasonColor}40`,
      padding: '6px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      height: 42,
      fontSize: 13,
    }}>
      <RoomCode roomId={roomId} away={away.map(p => p.name)} />

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: '#e0d8c8' }} />

      {/* Season pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          background: `${seasonColor}18`,
          color: seasonColor,
          padding: '3px 10px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          border: `1px solid ${seasonColor}30`,
        }}>
          {gameState.currentSeason}
        </div>
        <span style={{ color: '#999', fontSize: 12 }}>
          Week {gameState.weekNumber}
        </span>
        <span style={{ color: '#ccc', fontSize: 11 }}>
          {cardsLeft} cards remain
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: '#e0d8c8' }} />

      {/* Current player */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: activePlayer?.color || '#ccc',
          boxShadow: isMyTurn ? `0 0 0 3px ${activePlayer?.color}30` : 'none',
        }} />
        <span style={{
          fontSize: 13,
          fontWeight: isMyTurn ? 600 : 400,
          color: isMyTurn ? '#2c2c2c' : '#888',
        }}>
          {isMyTurn ? 'Your turn' : `${activePlayer?.name}'s turn`}
        </span>
      </div>

      {/* Right side: current card info */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {gameState.currentCard && gameState.turnPhase !== 'draw-card' && (
          <span style={{
            color: '#aaa', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ color: seasonColor, fontSize: 14 }}>{suitSymbol}</span>
            <span style={{ textTransform: 'capitalize' }}>
              {gameState.currentCard.rank} of {gameState.currentCard.suit}
            </span>
            {gameState.chosenPrompt && (
              <span style={{
                background: '#f0ebe3', padding: '1px 6px', borderRadius: 8,
                fontSize: 10, fontWeight: 600,
              }}>
                Option {gameState.chosenPrompt}
              </span>
            )}
          </span>
        )}

        {/* Player list compact */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
          {gameState.players.map(p => (
            <div key={p.id} title={p.connected ? p.name : `${p.name} — away`} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: p.color,
              opacity: p.connected ? 1 : 0.3,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
