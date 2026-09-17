/**
 * When a project's last die comes off, the player who ran the week out says
 * how it turned out. That text is what the project shows on hover from then
 * on, and it gets folded into the project's chronicle entry.
 */
import { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { PROJECT_COMPLETED_COLOR, PROJECT_FAILED_COLOR } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { Icon } from './ToolIcons';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function ProjectResolution({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [text, setText] = useState('');

  const projectId = gameState?.pendingResolutions[0];
  // A fresh prompt for each project, so last project's words don't carry over.
  useEffect(() => { setText(''); }, [projectId]);

  if (!gameState || !projectId) return null;
  const isMyTurn = gameState.turnOrder[gameState.activePlayerIndex] === playerId;
  const project = gameState.projects.find(p => p.id === projectId);
  if (!project) return null;

  const accent = project.failed ? PROJECT_FAILED_COLOR : PROJECT_COMPLETED_COLOR;
  const verb = project.failed ? 'failed' : 'is finished';
  const remaining = gameState.pendingResolutions.length;

  const submit = () => {
    socket.emit('turn:resolveProject', { projectId, resolution: text.trim() });
    setText('');
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25,
    }}>
      <div style={{
        background: '#faf6ee', borderRadius: 12, padding: 28,
        maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: `3px solid ${accent}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: accent, display: 'flex' }}>
            <Icon name={project.failed ? 'cross' : 'check'} size={20} />
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {project.name} {verb}
          </h3>
        </div>

        {project.description && (
          <p style={{ fontSize: 13, color: '#8a8378', fontStyle: 'italic', marginBottom: 14 }}>
            {project.description}
          </p>
        )}

        {isMyTurn ? (
          <>
            <p style={{ fontSize: 13, color: '#777', marginBottom: 10, lineHeight: 1.5 }}>
              Describe how it turned out. This becomes the project&rsquo;s resolution.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What came of it?"
                onKeyDown={e => e.key === 'Enter' && submit()}
                maxLength={300}
                autoFocus
                style={{
                  flex: 1, padding: '9px 14px', fontSize: 14,
                  border: `2px solid ${accent}`, borderRadius: 8,
                  fontFamily: 'Georgia, serif', outline: 'none',
                }}
              />
              <button
                onClick={submit}
                style={{
                  padding: '9px 20px', fontSize: 14, fontWeight: 600, color: 'white',
                  background: accent, border: 'none', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'Georgia, serif',
                }}
              >
                {text.trim() ? 'Record' : 'Skip'}
              </button>
            </div>
            {remaining > 1 && (
              <p style={{ fontSize: 11, color: '#b0a795', marginTop: 8 }}>
                {remaining - 1} more project{remaining - 1 === 1 ? '' : 's'} to resolve after this
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
            Waiting for the active player to describe how it turned out...
          </p>
        )}
      </div>
    </div>
  );
}
