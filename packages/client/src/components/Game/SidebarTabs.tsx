/**
 * One panel for the three things a turn produces. Projects are editable here;
 * discoveries and discussions are read back out of the chronicle, so there is
 * no second copy of them to keep in step.
 */
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, GameEvent } from '@quiet-year/shared';
import { ACTION_COLORS } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { Icon, type IconName } from './ToolIcons';
import { HoverCard } from './HoverCard';
import { ProjectList } from './ProjectList';

type TypedSocket = Socket<ServerEvents, ClientEvents>;
type TabId = 'projects' | 'discoveries' | 'discussions';

const TABS: { id: TabId; icon: IconName; label: string; color: string }[] = [
  { id: 'projects', icon: 'project', label: 'Projects', color: ACTION_COLORS.project },
  { id: 'discoveries', icon: 'discover', label: 'Discoveries', color: ACTION_COLORS.discover },
  { id: 'discussions', icon: 'discuss', label: 'Discussions', color: ACTION_COLORS.discuss },
];

export function SidebarTabs({ socket }: { socket: TypedSocket }) {
  const { gameState } = useGameStore();
  const [tab, setTab] = useState<TabId>('projects');
  if (!gameState) return null;

  const discoveries = gameState.events.filter(e => e.type === 'discovery');
  const discussions = gameState.events.filter(e => e.type === 'discussion');
  const counts: Record<TabId, number> = {
    projects: gameState.projects.filter(p => !p.completed && !p.failed).length,
    discoveries: discoveries.length,
    discussions: discussions.length,
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      borderBottom: '1px solid #e0d8c8', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e0d8c8' }}>
        {TABS.map(t => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.label}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '8px 4px', cursor: 'pointer', fontFamily: 'Georgia, serif',
                fontSize: 11, fontWeight: 600,
                color: selected ? t.color : '#a8a094',
                background: selected ? `${t.color}12` : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${selected ? t.color : 'transparent'}`,
              }}
            >
              <Icon name={t.icon} size={13} />
              {counts[t.id] > 0 && <span>{counts[t.id]}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', fontSize: 13 }}>
        {tab === 'projects' && <ProjectList socket={socket} />}
        {tab === 'discoveries' && <DiscoveryList events={discoveries} />}
        {tab === 'discussions' && <DiscussionList events={discussions} />}
      </div>
    </div>
  );
}

function DiscoveryList({ events }: { events: GameEvent[] }) {
  if (events.length === 0) return <Empty>Nothing discovered yet</Empty>;

  return (
    <>
      {events.map(e => (
        <HoverCard
          key={e.id}
          accent={ACTION_COLORS.discover}
          panel={
            <div>
              <Meta event={e} color={ACTION_COLORS.discover} />
              <div style={{ marginTop: 4 }}>{e.text}</div>
            </div>
          }
        >
          <div style={rowStyle(ACTION_COLORS.discover)}>
            <div style={{ fontSize: 10, color: '#b0a795', marginBottom: 2 }}>
              Week {e.week} &middot; {e.playerName}
            </div>
            <div style={{ fontSize: 12, color: '#4a4a4a', ...clamp2 }}>{e.text}</div>
          </div>
        </HoverCard>
      ))}
    </>
  );
}

function DiscussionList({ events }: { events: GameEvent[] }) {
  if (events.length === 0) return <Empty>No discussions held yet</Empty>;

  return (
    <>
      {events.map(e => {
        const disc = e.discussion;
        return (
          <HoverCard
            key={e.id}
            accent={ACTION_COLORS.discuss}
            panel={
              <div>
                <Meta event={e} color={ACTION_COLORS.discuss} />
                <div style={{ fontStyle: 'italic', margin: '4px 0 8px' }}>
                  &ldquo;{disc?.topic ?? e.text}&rdquo;
                </div>
                {disc?.responses.map((r, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#b0a795', fontWeight: 600 }}>
                      {r.playerName}
                      {r.playerId === disc.initiatedBy && ' (last word)'}
                    </div>
                    <div>{r.text || <span style={{ fontStyle: 'italic', color: '#b0a795' }}>passed</span>}</div>
                  </div>
                ))}
                {disc && !disc.complete && (
                  <div style={{ color: '#b0a795', fontStyle: 'italic' }}>Still in progress&hellip;</div>
                )}
              </div>
            }
          >
            <div style={rowStyle(ACTION_COLORS.discuss)}>
              <div style={{ fontSize: 10, color: '#b0a795', marginBottom: 2 }}>
                Week {e.week} &middot; {e.playerName}
              </div>
              <div style={{ fontSize: 12, color: '#4a4a4a', fontStyle: 'italic', ...clamp2 }}>
                &ldquo;{disc?.topic ?? e.text}&rdquo;
              </div>
              <div style={{ fontSize: 10, color: ACTION_COLORS.discuss, marginTop: 3 }}>
                {disc?.complete === false
                  ? 'in progress'
                  : `${disc?.responses.length ?? 0} weighed in`}
              </div>
            </div>
          </HoverCard>
        );
      })}
    </>
  );
}

function Meta({ event, color }: { event: GameEvent; color: string }) {
  return (
    <div style={{
      fontSize: 10, color, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      Week {event.week} &middot; {event.playerName}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12, padding: '4px 2px' }}>
      {children}
    </p>
  );
}

const rowStyle = (accent: string): React.CSSProperties => ({
  padding: '7px 8px', marginBottom: 5, borderRadius: 5,
  background: 'white', border: '1px solid #e0d8c8',
  borderLeft: `3px solid ${accent}`,
  cursor: 'default',
});

/** Rows stay one or two lines tall; the hover panel carries the rest. */
const clamp2: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};
