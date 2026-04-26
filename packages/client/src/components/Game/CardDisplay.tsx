import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { SEASON_COLORS } from '@quiet-year/shared';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export function CardDisplay({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  if (!gameState?.currentCard) return null;

  const card = gameState.currentCard;
  const isMyTurn = gameState.turnOrder[gameState.activePlayerIndex] === playerId;
  const seasonColor = SEASON_COLORS[card.season];
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
    }}>
      <div style={{
        background: '#faf6ee', borderRadius: 12, padding: 32,
        maxWidth: 520, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: `3px solid ${seasonColor}`,
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 32, color: seasonColor }}>{symbol}</span>
            <div>
              <div style={{
                fontSize: 18, fontWeight: 600, textTransform: 'capitalize',
              }}>
                {card.rank} of {card.suit}
              </div>
              <div style={{
                fontSize: 12, textTransform: 'uppercase', color: seasonColor,
                fontWeight: 600, letterSpacing: '0.1em',
              }}>
                {card.season}
              </div>
            </div>
          </div>
        </div>

        {/* Special rules */}
        {card.specialRules && (
          <div style={{
            background: '#fff3cd', padding: '8px 12px', borderRadius: 6,
            marginBottom: 16, fontSize: 13, color: '#856404',
            border: '1px solid #ffc107',
          }}>
            {card.specialRules}
          </div>
        )}

        {/* Prompts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PromptOption
            label="A"
            text={card.promptA}
            onClick={() => isMyTurn && socket.emit('turn:choosePrompt', { choice: 'A' })}
            enabled={isMyTurn}
            color={seasonColor}
          />
          {card.promptB && (
            <PromptOption
              label="B"
              text={card.promptB}
              onClick={() => isMyTurn && socket.emit('turn:choosePrompt', { choice: 'B' })}
              enabled={isMyTurn}
              color={seasonColor}
            />
          )}
        </div>

        {!isMyTurn && (
          <p style={{
            textAlign: 'center', color: '#888', fontSize: 13,
            marginTop: 16, fontStyle: 'italic',
          }}>
            Waiting for the active player to choose...
          </p>
        )}
      </div>
    </div>
  );
}

function PromptOption({ label, text, onClick, enabled, color }: {
  label: string;
  text: string;
  onClick: () => void;
  enabled: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        display: 'flex', gap: 12, padding: '14px 16px',
        background: enabled ? 'white' : '#f5f0e8',
        border: `2px solid ${enabled ? color : '#ddd'}`,
        borderRadius: 8, textAlign: 'left',
        cursor: enabled ? 'pointer' : 'default',
        transition: 'all 0.15s',
        fontFamily: 'Georgia, serif',
      }}
    >
      <span style={{
        fontSize: 18, fontWeight: 700, color,
        minWidth: 24,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: '#2c2c2c' }}>
        {text}
      </span>
    </button>
  );
}
