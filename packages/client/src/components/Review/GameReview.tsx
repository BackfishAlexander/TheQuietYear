/**
 * A saved year, opened on its own. Everything the table made is here to be
 * read back - the map, the resource card, every project and the whole
 * chronicle - with nothing to click that would change any of it.
 */
import { useMemo, useState } from 'react';
import type { GameSaveFile, Project } from '@quiet-year/shared';
import {
  PROJECT_COMPLETED_COLOR, PROJECT_FAILED_COLOR, RESOURCE_COLORS, SEASON_COLORS,
} from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { ChronicleEntry } from '../Game/Chronicle';
import { Icon } from '../Game/ToolIcons';
import { exportPng } from '../../canvas/persist';
import { ReviewMap } from './ReviewMap';

const ACTIVE_DIE_COLOR = '#e67e22';

export function GameReview({ save }: { save: GameSaveFile }) {
  const { setReview, setError } = useGameStore();
  const [panel, setPanel] = useState<'table' | 'chronicle'>('table');
  const game = save.game;

  const savedAt = useMemo(
    () => new Date(save.savedAt).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    }),
    [save.savedAt],
  );

  const finished = game.phase === 'game-over';
  const ongoing = game.projects.filter(p => !p.completed && !p.failed);
  const resolved = game.projects.filter(p => p.completed || p.failed);

  function handleExportPng() {
    const problem = exportPng(save.strokes, save.roomId);
    if (problem) {
      setError(problem);
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f0e8' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        background: '#fff', borderBottom: '1px solid #e0d8c8', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#2c2c2c' }}>
            The Quiet Year
            <span style={{ color: '#a8a094', fontSize: 13 }}> · room {save.roomId}</span>
          </div>
          <div style={{ fontSize: 12, color: '#a8a094' }}>
            {finished
              ? `The year ended in week ${game.weekNumber}`
              : `Week ${game.weekNumber}, ${game.currentSeason} — still unfinished`}
            {' · saved '}{savedAt}
          </div>
        </div>

        <button onClick={handleExportPng} style={headerButtonStyle} title="Export the map as a PNG">
          <Icon name="image" size={14} /> Export the map
        </button>
        <button onClick={() => setReview(null)} style={{ ...headerButtonStyle, background: '#4a7c59', color: 'white', border: 'none' }}>
          Close
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside style={{
          width: 300, flexShrink: 0, background: '#fffcf7',
          borderRight: '1px solid #e0d8c8', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e0d8c8' }}>
            <PanelTab label="The table" active={panel === 'table'} onClick={() => setPanel('table')} />
            <PanelTab label="Chronicle" active={panel === 'chronicle'} onClick={() => setPanel('chronicle')} />
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
            {panel === 'table' ? (
              <>
                <Section title="Who was there">
                  {game.players.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13,
                    }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: '#a8a094' }} title="Contempt tokens held">
                        {p.contemptTokens} contempt
                      </span>
                    </div>
                  ))}
                </Section>

                <Section title="Abundances">
                  <ResourceList items={game.abundances} color={RESOURCE_COLORS.abundance} />
                </Section>
                <Section title="Scarcities">
                  <ResourceList items={game.scarcities} color={RESOURCE_COLORS.scarcity} />
                </Section>
                <Section title="Names">
                  <ResourceList items={game.names} color={RESOURCE_COLORS.name} />
                </Section>

                <Section title={`Projects (${game.projects.length})`}>
                  {game.projects.length === 0 && <Empty>None were ever started</Empty>}
                  {ongoing.map(p => <ReviewProject key={p.id} project={p} />)}
                  {resolved.length > 0 && ongoing.length > 0 && (
                    <div style={{
                      fontSize: 10, color: '#b0a795', fontWeight: 600, margin: '10px 0 5px',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      Resolved
                    </div>
                  )}
                  {resolved.map(p => <ReviewProject key={p.id} project={p} />)}
                </Section>
              </>
            ) : (
              <>
                {game.events.length === 0 && <Empty>Nothing was written down</Empty>}
                {game.events.map(event => (
                  <ChronicleEntry key={event.id} event={event} />
                ))}
              </>
            )}
          </div>
        </aside>

        <div style={{ flex: 1, position: 'relative' }}>
          <ReviewMap strokes={save.strokes} />
          <div style={{
            position: 'absolute', top: 12, left: 12, padding: '4px 10px',
            background: 'rgba(255,255,255,0.9)', border: '1px solid #e0d8c8',
            borderRadius: 999, fontSize: 12, color: '#6b7280',
            display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: SEASON_COLORS[game.currentSeason] ?? '#999',
            }} />
            Week {game.weekNumber} · {game.currentSeason}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewProject({ project }: { project: Project }) {
  const accent = project.completed ? PROJECT_COMPLETED_COLOR
    : project.failed ? PROJECT_FAILED_COLOR
    : ACTIVE_DIE_COLOR;
  const resolved = project.completed || project.failed;

  return (
    <div style={{
      padding: '7px 8px', marginBottom: 5, borderRadius: 5,
      background: resolved ? `${accent}0e` : 'white',
      border: `1px solid ${resolved ? `${accent}45` : '#e0d8c8'}`,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: resolved ? accent : '#2c2c2c' }}>
          {project.name}
        </span>
        <span style={{ fontSize: 11, color: '#a8a094' }}>
          {project.completed ? 'completed'
            : project.failed ? 'failed'
            : `${project.weeksRemaining} ${project.weeksRemaining === 1 ? 'die' : 'dice'} left`}
        </span>
      </div>
      {project.description && (
        <div style={{ fontSize: 12, color: '#6b6b6b', marginTop: 2 }}>{project.description}</div>
      )}
      {project.resolution && (
        <div style={{ fontSize: 12, color: '#8a8a8a', fontStyle: 'italic', marginTop: 3 }}>
          {project.resolution}
        </div>
      )}
    </div>
  );
}

function ResourceList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return <Empty>None</Empty>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {items.map((item, i) => (
        <span key={`${item}-${i}`} style={{
          fontSize: 12, padding: '3px 8px', borderRadius: 999,
          background: `${color}14`, border: `1px solid ${color}44`, color: '#4a4a4a',
        }}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#a8a094', marginBottom: 6,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: '#c3bbac', fontStyle: 'italic' }}>{children}</p>;
}

function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '9px 6px', border: 'none', cursor: 'pointer',
        fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 600,
        color: active ? '#4a7c59' : '#a8a094',
        background: active ? 'rgba(74,124,89,0.08)' : 'transparent',
        borderBottom: `2px solid ${active ? '#4a7c59' : 'transparent'}`,
      }}
    >
      {label}
    </button>
  );
}

const headerButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', fontSize: 13, fontFamily: 'Georgia, serif',
  background: 'white', color: '#4a4a4a',
  border: '1px solid #d4c5a9', borderRadius: 6, cursor: 'pointer',
};
