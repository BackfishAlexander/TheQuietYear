import { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { SEASON_COLORS } from '@quiet-year/shared';

export function EventLog() {
  const { gameState } = useGameStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.events.length]);

  if (!gameState) return null;

  const typeIcons: Record<string, string> = {
    'card-drawn': '\u2660',
    'prompt-chosen': '\u2192',
    'discovery': '\u2605',
    'discussion': '\u2709',
    'project-started': '\u2692',
    'project-completed': '\u2713',
    'project-failed': '\u2717',
    'contempt-taken': '\u25CF',
    'contempt-discarded': '\u25CB',
    'resource-added': '\u25C6',
    'game-over': '\u2744',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #e0d8c8',
      }}>
        <h3 style={{
          fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#888',
        }}>
          Chronicle
        </h3>
      </div>

      <div style={{
        flex: 1, overflow: 'auto', padding: '8px 12px',
      }}>
        {gameState.events.length === 0 && (
          <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: 12 }}>
            The story begins...
          </p>
        )}

        {gameState.events.map(event => {
          const seasonColor = SEASON_COLORS[event.season];
          return (
            <div key={event.id} style={{
              marginBottom: 8, fontSize: 12, lineHeight: 1.4,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                color: '#aaa', fontSize: 10, marginBottom: 2,
              }}>
                <span style={{ color: seasonColor }}>
                  {typeIcons[event.type] || '\u25CB'}
                </span>
                <span>Week {event.week}</span>
                <span style={{ marginLeft: 'auto' }}>{event.playerName}</span>
              </div>
              <div style={{ color: '#555' }}>
                {event.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
