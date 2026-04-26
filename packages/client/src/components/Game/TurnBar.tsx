import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export function TurnBar({ socket: _socket, seasonColor }: { socket: TypedSocket; seasonColor: string }) {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

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
            <div key={p.id} style={{
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
