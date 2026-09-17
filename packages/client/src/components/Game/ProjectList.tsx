/**
 * Cards hand out project dice, take them away, and sometimes destroy a
 * project outright, so every part of a project is editable here: click a pip
 * to set the dice (which puts a resolved project back in progress), or use
 * the buttons to finish it, fail it, or strike it off the map.
 */
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, Project } from '@quiet-year/shared';
import {
  MAX_PROJECT_WEEKS, PROJECT_COMPLETED_COLOR, PROJECT_FAILED_COLOR,
} from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { Icon, type IconName } from './ToolIcons';
import { HoverCard } from './HoverCard';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

const ACTIVE_DIE_COLOR = '#e67e22';

export function ProjectList({ socket }: { socket: TypedSocket }) {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  // Ongoing work is what the table is deciding about, so it stays on top.
  const ongoing = gameState.projects.filter(p => !p.completed && !p.failed);
  const resolved = gameState.projects.filter(p => p.completed || p.failed);

  if (gameState.projects.length === 0) {
    return (
      <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: 12, padding: '4px 2px' }}>
        No projects yet
      </p>
    );
  }

  return (
    <div>
      {ongoing.map(p => (
        <ProjectRow key={p.id} project={p} socket={socket} />
      ))}

      {resolved.length > 0 && (
        <div style={{
          fontSize: 10, color: '#b0a795', fontWeight: 600, margin: '10px 0 5px',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Resolved
        </div>
      )}
      {resolved.map(p => (
        <ProjectRow key={p.id} project={p} socket={socket} />
      ))}
    </div>
  );
}

function ProjectRow({ project, socket }: { project: Project; socket: TypedSocket }) {
  const { gameState } = useGameStore();
  const accent = project.completed ? PROJECT_COMPLETED_COLOR
    : project.failed ? PROJECT_FAILED_COLOR
    : ACTIVE_DIE_COLOR;
  const resolved = project.completed || project.failed;
  const awaitingResolution = gameState?.pendingResolutions.includes(project.id) ?? false;

  const row = (
    <div style={{
      padding: '7px 8px', marginBottom: 5, borderRadius: 5,
      background: resolved ? `${accent}0e` : 'white',
      border: `1px solid ${resolved ? `${accent}45` : '#e0d8c8'}`,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontWeight: 600, fontSize: 13, flex: 1,
          color: resolved ? accent : '#2c2c2c',
        }}>
          {project.name}
        </span>
        {!resolved && (
          <span style={{
            background: '#f0e6d3', padding: '1px 7px', borderRadius: 10,
            fontSize: 10, fontWeight: 700, color: '#8B6914', whiteSpace: 'nowrap',
          }}>
            {project.weeksRemaining}w
          </span>
        )}
        {resolved && (
          <span style={{ color: accent, display: 'flex' }}>
            <Icon name={project.completed ? 'check' : 'cross'} size={13} />
          </span>
        )}
      </div>

      {project.description && (
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{project.description}</div>
      )}

      {awaitingResolution && (
        <div style={{ fontSize: 10, color: accent, fontStyle: 'italic', marginTop: 3 }}>
          Awaiting resolution
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <DiceTrack project={project} socket={socket} />
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <TinyButton
            icon="check" title="Mark completed" color={PROJECT_COMPLETED_COLOR}
            active={project.completed}
            onClick={() => socket.emit('project:setStatus', { projectId: project.id, status: 'completed' })}
          />
          <TinyButton
            icon="cross" title="Mark failed" color={PROJECT_FAILED_COLOR}
            active={project.failed}
            onClick={() => socket.emit('project:setStatus', { projectId: project.id, status: 'failed' })}
          />
          <TinyButton
            icon="trash" title="Remove this project" color="#a08c72"
            onClick={() => socket.emit('project:remove', { projectId: project.id })}
          />
        </div>
      </div>
    </div>
  );

  // The story of how it turned out is the point of a resolved project.
  if (resolved) {
    return (
      <HoverCard accent={accent} panel={<ResolutionPanel project={project} accent={accent} />}>
        {row}
      </HoverCard>
    );
  }
  return row;
}

function ResolutionPanel({ project, accent }: { project: Project; accent: string }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{project.name}</div>
      <div style={{
        fontSize: 10, color: accent, fontWeight: 600, marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {project.completed ? 'Completed' : 'Failed'}
      </div>
      {project.description && (
        <div style={{ color: '#8a8378', fontStyle: 'italic', marginBottom: 6 }}>
          {project.description}
        </div>
      )}
      {project.resolution
        ? <div>{project.resolution}</div>
        : <div style={{ color: '#b0a795', fontStyle: 'italic' }}>
            No resolution was recorded.
          </div>}
    </div>
  );
}

/**
 * Six pips standing in for the project's dice. Clicking one sets the count,
 * which is also how a resolved project is put back into progress; clicking
 * the leftmost pip when it is the only one left finishes the project.
 */
function DiceTrack({ project, socket }: { project: Project; socket: TypedSocket }) {
  const resolved = project.completed || project.failed;

  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: MAX_PROJECT_WEEKS }, (_, i) => {
        const value = i + 1;
        const lit = !resolved && value <= project.weeksRemaining;
        // Clicking the only remaining die takes the last one off.
        const next = !resolved && project.weeksRemaining === value ? value - 1 : value;
        return (
          <button
            key={i}
            title={next === 0 ? 'Take off the last die' : `Set to ${next} ${next === 1 ? 'die' : 'dice'}`}
            onClick={() => socket.emit('project:setDice', { projectId: project.id, weeksRemaining: next })}
            style={{
              width: 11, height: 11, borderRadius: 2, padding: 0, cursor: 'pointer',
              background: lit ? ACTIVE_DIE_COLOR : '#eee',
              border: `1px solid ${lit ? ACTIVE_DIE_COLOR : '#ddd'}`,
            }}
          />
        );
      })}
    </div>
  );
}

function TinyButton({ icon, title, color, active, onClick }: {
  icon: IconName; title: string; color: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, padding: 0, borderRadius: 4, cursor: 'pointer',
        color: active ? 'white' : color,
        background: active ? color : 'transparent',
        border: `1px solid ${active ? color : `${color}45`}`,
      }}
    >
      <Icon name={icon} size={12} />
    </button>
  );
}
