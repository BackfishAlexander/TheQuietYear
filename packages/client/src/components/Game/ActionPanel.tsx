import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { SEASON_COLORS } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function ActionPanel({ socket }: { socket: TypedSocket }) {
  const { gameState, playerId } = useGameStore();
  const [narrateText, setNarrateText] = useState('');
  const [discoverText, setDiscoverText] = useState('');
  const [discussTopic, setDiscussTopic] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectDuration, setProjectDuration] = useState(3);

  if (!gameState || gameState.phase !== 'playing') return null;

  const isMyTurn = gameState.turnOrder[gameState.activePlayerIndex] === playerId;
  const activePlayer = gameState.players.find(
    p => p.id === gameState.turnOrder[gameState.activePlayerIndex]
  );
  const seasonColor = SEASON_COLORS[gameState.currentSeason];
  const tp = gameState.turnPhase;

  const handleDiscover = () => {
    if (!discoverText.trim()) return;
    socket.emit('turn:discover', { description: discoverText.trim() });
    setDiscoverText('');
  };

  const handleDiscuss = () => {
    if (!discussTopic.trim()) return;
    socket.emit('turn:startDiscussion', { topic: discussTopic.trim() });
    setDiscussTopic('');
  };

  const handleProject = () => {
    if (!projectName.trim()) return;
    socket.emit('turn:startProject', {
      name: projectName.trim(),
      description: projectDesc.trim(),
      duration: projectDuration,
      position: { x: 800 + Math.random() * 200 - 100, y: 600 + Math.random() * 200 - 100 },
    });
    setProjectName('');
    setProjectDesc('');
    setProjectDuration(3);
  };

  const handleNarrate = () => {
    socket.emit('turn:narrate', { text: narrateText.trim() });
    setNarrateText('');
  };

  // Not my turn - show minimal waiting indicator
  if (!isMyTurn) {
    return (
      <div style={panelContainer}>
        <div style={{ ...panelBase, padding: '10px 24px', background: '#faf6ee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activePlayer?.color,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>
              Waiting for {activePlayer?.name}...
            </span>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={panelContainer}>
      <div style={{
        ...panelBase,
        borderTop: `3px solid ${seasonColor}`,
      }}>
        {/* Draw card */}
        {tp === 'draw-card' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <button onClick={() => socket.emit('turn:drawCard')} style={{
              ...primaryBtn,
              background: seasonColor,
              boxShadow: `0 4px 16px ${seasonColor}40`,
            }}>
              Draw a Card
            </button>
          </div>
        )}

        {/* Choosing prompt */}
        {tp === 'resolve-card' && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 13, color: '#aaa' }}>
              Choose a prompt from the card above...
            </span>
          </div>
        )}

        {/* Narrate */}
        {tp === 'narrate-card' && (
          <div style={{ padding: '4px 0' }}>
            <label style={labelStyle}>
              Describe what happens
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                value={narrateText}
                onChange={e => setNarrateText(e.target.value)}
                placeholder="Write your response to the prompt..."
                style={textInputStyle}
                onKeyDown={e => e.key === 'Enter' && handleNarrate()}
                autoFocus
              />
              <button onClick={handleNarrate} style={{
                ...primaryBtn,
                background: seasonColor,
                fontSize: 13,
                padding: '8px 20px',
              }}>
                Continue
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
              Press Enter or leave blank to skip
            </p>
          </div>
        )}

        {/* Choose action */}
        {tp === 'choose-action' && (
          <div style={{ padding: '4px 0' }}>
            <label style={labelStyle}>Choose your action</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <ActionButton
                icon={'\u2605'}
                label="Discover"
                desc="Something new"
                color="#e67e22"
                onClick={() => socket.emit('turn:action', { action: 'discover' })}
              />
              <ActionButton
                icon={'\u2709'}
                label="Discuss"
                desc="Hold a discussion"
                color="#3498db"
                onClick={() => socket.emit('turn:action', { action: 'discuss' })}
              />
              <ActionButton
                icon={'\u2692'}
                label="Project"
                desc="Start building"
                color="#2ecc71"
                onClick={() => socket.emit('turn:action', { action: 'project' })}
              />
            </div>
          </div>
        )}

        {/* Discover */}
        {tp === 'action-discover' && (
          <div style={{ padding: '4px 0' }}>
            <label style={labelStyle}>
              <span style={{ color: '#e67e22', marginRight: 6 }}>{'\u2605'}</span>
              Discover Something New
            </label>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 8px' }}>
              Introduce a new situation and draw it on the map
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={discoverText}
                onChange={e => setDiscoverText(e.target.value)}
                placeholder="Describe what was discovered..."
                style={textInputStyle}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                autoFocus
              />
              <button
                onClick={handleDiscover}
                disabled={!discoverText.trim()}
                style={{
                  ...primaryBtn,
                  background: discoverText.trim() ? '#e67e22' : '#ddd',
                  fontSize: 13, padding: '8px 20px',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Discuss */}
        {tp === 'action-discuss' && (
          <div style={{ padding: '4px 0' }}>
            <label style={labelStyle}>
              <span style={{ color: '#3498db', marginRight: 6 }}>{'\u2709'}</span>
              Hold a Discussion
            </label>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 8px' }}>
              Pose a question or make a declaration for everyone to weigh in on
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={discussTopic}
                onChange={e => setDiscussTopic(e.target.value)}
                placeholder="What should the community discuss?"
                style={textInputStyle}
                onKeyDown={e => e.key === 'Enter' && handleDiscuss()}
                autoFocus
              />
              <button
                onClick={handleDiscuss}
                disabled={!discussTopic.trim()}
                style={{
                  ...primaryBtn,
                  background: discussTopic.trim() ? '#3498db' : '#ddd',
                  fontSize: 13, padding: '8px 20px',
                }}
              >
                Begin
              </button>
            </div>
          </div>
        )}

        {/* Project */}
        {tp === 'action-project' && (
          <div style={{ padding: '4px 0' }}>
            <label style={labelStyle}>
              <span style={{ color: '#2ecc71', marginRight: 6 }}>{'\u2692'}</span>
              Start a Project
            </label>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 8px' }}>
              Declare what the community is building and how long it will take
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Project name"
                style={{ ...textInputStyle, flex: 2, minWidth: 140 }}
                autoFocus
              />
              <input
                value={projectDesc}
                onChange={e => setProjectDesc(e.target.value)}
                placeholder="Brief description (optional)"
                style={{ ...textInputStyle, flex: 3, minWidth: 160 }}
              />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#f5f0e8', borderRadius: 8, padding: '0 12px',
                border: '1px solid #e0d8c8',
              }}>
                <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>Duration</span>
                <select
                  value={projectDuration}
                  onChange={e => setProjectDuration(Number(e.target.value))}
                  style={{
                    border: 'none', background: 'transparent', fontSize: 14,
                    fontFamily: 'Georgia, serif', fontWeight: 600, color: '#2c2c2c',
                    cursor: 'pointer', outline: 'none',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} wk{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleProject}
                disabled={!projectName.trim()}
                style={{
                  ...primaryBtn,
                  background: projectName.trim() ? '#2ecc71' : '#ddd',
                  fontSize: 13, padding: '8px 20px',
                }}
              >
                Start
              </button>
            </div>
          </div>
        )}

        {/* End turn */}
        {tp === 'turn-complete' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <button
              onClick={() => socket.emit('turn:endTurn')}
              style={{
                ...primaryBtn,
                background: seasonColor,
                boxShadow: `0 4px 16px ${seasonColor}40`,
              }}
            >
              End Turn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, desc, color, onClick }: {
  icon: string; label: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4,
        padding: '14px 16px',
        background: 'white',
        border: `2px solid ${color}25`,
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'Georgia, serif',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.background = `${color}08`;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${color}25`;
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: 20, color }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#aaa' }}>{desc}</span>
    </button>
  );
}

const panelContainer: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 15,
  width: '100%',
  maxWidth: 560,
  padding: '0 16px',
};

const panelBase: React.CSSProperties = {
  background: '#fffcf7',
  borderRadius: 14,
  padding: '14px 20px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
  backdropFilter: 'blur(8px)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888',
  display: 'flex',
  alignItems: 'center',
};

const textInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '9px 14px',
  fontSize: 14,
  border: '1.5px solid #e0d8c8',
  borderRadius: 8,
  fontFamily: 'Georgia, serif',
  background: 'white',
  outline: 'none',
  color: '#2c2c2c',
  transition: 'border-color 0.15s',
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 28px',
  fontSize: 15,
  color: 'white',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontWeight: 600,
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};
