import { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ChronicleEntry } from './Chronicle';

export function EventLog() {
  const { gameState } = useGameStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Grouped entries grow in place as a turn unfolds, so follow the content
  // rather than just the count of entries.
  const tail = gameState?.events[gameState.events.length - 1];
  const tailSize = JSON.stringify(tail ?? null).length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.events.length, tailSize]);

  if (!gameState) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0d8c8' }}>
        <h3 style={{
          fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#888',
        }}>
          Chronicle
        </h3>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {gameState.events.length === 0 && (
          <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: 12 }}>
            The story begins...
          </p>
        )}

        {gameState.events.map(event => (
          <ChronicleEntry key={event.id} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
