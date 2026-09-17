import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { MapCanvas } from './MapCanvas';
import { TurnBar } from './TurnBar';
import { ActionPanel } from './ActionPanel';
import { CardDisplay } from './CardDisplay';
import { ResourceCard } from './ResourceCard';
import { SidebarTabs } from './SidebarTabs';
import { ContemptBar } from './ContemptBar';
import { Discussion } from './Discussion';
import { ProjectResolution } from './ProjectResolution';
import { SetupFlow } from './SetupFlow';
import { EventLog } from './EventLog';
import { SidebarShell } from './SidebarShell';
import { SEASON_COLORS } from '@quiet-year/shared';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const SIDEBAR_WIDTH = 278;

export function GameLayout({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [tableOpen, setTableOpen] = useState(true);
  const [chronicleOpen, setChronicleOpen] = useState(true);
  if (!gameState) return null;

  const isSetup = gameState.phase === 'setup-terrain' || gameState.phase === 'setup-resources';
  const isDiscussion = gameState.phase === 'discussion';
  const seasonColor = SEASON_COLORS[gameState.currentSeason] || '#999';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Slim top status bar */}
      <TurnBar socket={socket} seasonColor={seasonColor} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar: the state of the table */}
        <SidebarShell
          side="left"
          open={tableOpen}
          onToggle={() => setTableOpen(o => !o)}
          label="Table"
          width={SIDEBAR_WIDTH}
        >
          <ResourceCard socket={socket} />
          <SidebarTabs socket={socket} />
          <ContemptBar socket={socket} />
        </SidebarShell>

        {/* Center: Canvas + floating action panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <MapCanvas socket={socket} />

          {/* Floating action panel at bottom center */}
          <ActionPanel socket={socket} />

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

          {/* A project that just landed wants a word on how it turned out */}
          <ProjectResolution socket={socket} />
        </div>

        {/* Right sidebar: the chronicle */}
        <SidebarShell
          side="right"
          open={chronicleOpen}
          onToggle={() => setChronicleOpen(o => !o)}
          label="Chronicle"
          width={SIDEBAR_WIDTH}
        >
          <EventLog />
        </SidebarShell>
      </div>
    </div>
  );
}
