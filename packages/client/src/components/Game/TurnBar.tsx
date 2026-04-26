import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function TurnBar({ socket, seasonColor }: { socket: TypedSocket; seasonColor: string }) {
  const { gameState, playerId } = useGameStore();
  const [discoverText, setDiscoverText] = useState('');
  const [discussTopic, setDiscussTopic] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectDuration, setProjectDuration] = useState(3);

  if (!gameState) return null;

  const activePlayer = gameState.players.find(
    p => p.id === gameState.turnOrder[gameState.activePlayerIndex]
  );
  const isMyTurn = gameState.turnOrder[gameState.activePlayerIndex] === playerId;
  const cardsLeft = gameState.deck.length;

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

  return (
    <div style={{
      background: 'white', borderBottom: '3px solid ' + seasonColor,
      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 16,
      flexWrap: 'wrap', minHeight: 52,
    }}>
      {/* Season + Week */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          background: seasonColor, color: 'white', padding: '4px 12px',
          borderRadius: 4, fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
        }}>
          {gameState.currentSeason}
        </div>
        <span style={{ fontSize: 13, color: '#888' }}>
          Week {gameState.weekNumber}
        </span>
        <span style={{ fontSize: 12, color: '#aaa' }}>
          ({cardsLeft} cards left)
        </span>
      </div>

      {/* Current player */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: activePlayer?.color || '#ccc',
        }} />
        <span style={{ fontSize: 14, fontWeight: isMyTurn ? 700 : 400 }}>
          {isMyTurn ? 'Your turn' : `${activePlayer?.name}'s turn`}
        </span>
      </div>

      {/* Turn phase actions */}
      {isMyTurn && gameState.phase === 'playing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {gameState.turnPhase === 'draw-card' && (
            <button onClick={() => socket.emit('turn:drawCard')} style={actionBtn}>
              Draw Card
            </button>
          )}

          {gameState.turnPhase === 'resolve-card' && gameState.currentCard && (
            <span style={{ fontSize: 13, color: '#888' }}>Choose a prompt...</span>
          )}

          {gameState.turnPhase === 'choose-action' && (
            <>
              <span style={{ fontSize: 13, color: '#555' }}>Choose action:</span>
              <button onClick={() => socket.emit('turn:action', { action: 'discover' })} style={actionBtn}>
                Discover
              </button>
              <button onClick={() => socket.emit('turn:action', { action: 'discuss' })} style={actionBtn}>
                Discuss
              </button>
              <button onClick={() => socket.emit('turn:action', { action: 'project' })} style={actionBtn}>
                Project
              </button>
            </>
          )}

          {gameState.turnPhase === 'action-discover' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={discoverText}
                onChange={e => setDiscoverText(e.target.value)}
                placeholder="Describe what you discovered..."
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                autoFocus
              />
              <button onClick={handleDiscover} style={actionBtn}>Confirm</button>
            </div>
          )}

          {gameState.turnPhase === 'action-discuss' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={discussTopic}
                onChange={e => setDiscussTopic(e.target.value)}
                placeholder="Discussion topic..."
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleDiscuss()}
                autoFocus
              />
              <button onClick={handleDiscuss} style={actionBtn}>Start Discussion</button>
            </div>
          )}

          {gameState.turnPhase === 'action-project' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Project name..."
                style={{ ...inputStyle, width: 150 }}
                autoFocus
              />
              <input
                value={projectDesc}
                onChange={e => setProjectDesc(e.target.value)}
                placeholder="Description..."
                style={{ ...inputStyle, width: 150 }}
              />
              <select
                value={projectDuration}
                onChange={e => setProjectDuration(Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>
                ))}
              </select>
              <button onClick={handleProject} style={actionBtn}>Start Project</button>
            </div>
          )}

          {gameState.turnPhase === 'turn-complete' && (
            <button onClick={() => socket.emit('turn:endTurn')} style={{
              ...actionBtn, background: '#4a7c59',
            }}>
              End Turn
            </button>
          )}
        </div>
      )}

      {/* Card info when not active player */}
      {!isMyTurn && gameState.currentCard && gameState.turnPhase !== 'draw-card' && (
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#888' }}>
          Card: {gameState.currentCard.rank} of {gameState.currentCard.suit}
          {gameState.chosenPrompt && ` (Option ${gameState.chosenPrompt})`}
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 13, background: '#2c2c2c', color: 'white',
  border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'Georgia, serif',
  whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4,
  fontFamily: 'Georgia, serif', width: 220,
};
