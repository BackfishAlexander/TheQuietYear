import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { MapCanvas } from './MapCanvas';
import { TurnBar } from './TurnBar';
import { CardDisplay } from './CardDisplay';
import { ResourceCard } from './ResourceCard';
import { ProjectList } from './ProjectList';
import { ContemptBar } from './ContemptBar';
import { Discussion } from './Discussion';
import { SetupFlow } from './SetupFlow';
import { EventLog } from './EventLog';
import { SEASON_COLORS } from '@quiet-year/shared';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function GameLayout({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

  const isSetup = gameState.phase === 'setup-terrain' || gameState.phase === 'setup-resources';
  const isDiscussion = gameState.phase === 'discussion';
  const seasonColor = SEASON_COLORS[gameState.currentSeason] || '#999';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <TurnBar socket={socket} seasonColor={seasonColor} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{
          width: 280, borderRight: '1px solid #d4c5a9', background: '#faf6ee',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <ResourceCard socket={socket} />
          <ProjectList socket={socket} />
          <ContemptBar socket={socket} />
        </div>

        {/* Center: Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <MapCanvas socket={socket} />

          {/* Setup overlay */}
          {isSetup && <SetupFlow socket={socket} />}

          {/* Card overlay */}
          {gameState.currentCard && gameState.turnPhase === 'resolve-card' && (
            <CardDisplay socket={socket} />
          )}

          {/* Discussion overlay */}
          {isDiscussion && gameState.discussion && (
            <Discussion socket={socket} />
          )}
        </div>

        {/* Right sidebar: event log */}
        <div style={{
          width: 260, borderLeft: '1px solid #d4c5a9', background: '#faf6ee',
          overflow: 'hidden',
        }}>
          <EventLog />
        </div>
      </div>
    </div>
  );
}
