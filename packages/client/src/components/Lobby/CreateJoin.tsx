import { useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, GameSaveFile, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';
import { readGameSaveFile } from '../../canvas/persist';
import { Icon } from '../Game/ToolIcons';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function CreateJoin({ socket }: { socket: TypedSocket }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  /** A save picked in the create flow, waiting to be turned back into a room. */
  const [resume, setResume] = useState<{ save: GameSaveFile; fileName: string } | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const reviewInputRef = useRef<HTMLInputElement>(null);
  const { setPlayerName, setReview, setError } = useGameStore();

  const flashError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 4000);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    setPlayerName(name.trim());
    socket.emit('room:create', { playerName: name.trim() });
  };

  const handleResume = () => {
    if (!name.trim() || !resume) return;
    setPlayerName(name.trim());
    socket.emit('room:createFromSave', { playerName: name.trim(), save: resume.save });
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    setPlayerName(name.trim());
    socket.emit('room:join', { roomId: roomCode.trim().toUpperCase(), playerName: name.trim() });
  };

  /** Read a picked save, either to resume it or to sit down and read it. */
  async function pickSave(
    e: React.ChangeEvent<HTMLInputElement>,
    then: (save: GameSaveFile, fileName: string) => void,
  ) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    const result = await readGameSaveFile(file);
    if ('error' in result) {
      flashError(result.error);
      return;
    }
    then(result.save, file.name);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#f5f0e8', position: 'relative',
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 420, width: '100%', padding: 40,
      }}>
        <h1 style={{
          fontSize: 48, fontWeight: 400, marginBottom: 8,
          fontFamily: 'Georgia, serif', color: '#2c2c2c',
          letterSpacing: '0.02em',
        }}>
          The Quiet Year
        </h1>
        <p style={{
          fontSize: 16, color: '#666', marginBottom: 40,
          fontStyle: 'italic', lineHeight: 1.5,
        }}>
          A map-drawing game about community and rebuilding
        </p>

        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setMode('create')}
            />
            <button
              onClick={() => name.trim() && setMode('create')}
              disabled={!name.trim()}
              style={buttonStyle}
            >
              Create a New Game
            </button>
            <button
              onClick={() => name.trim() && setMode('join')}
              disabled={!name.trim()}
              style={{ ...buttonStyle, background: '#6c757d' }}
            >
              Join a Game
            </button>
            <p style={{ fontSize: 12, color: '#a8a094', marginTop: 4, lineHeight: 1.5 }}>
              Rejoining a game you were already in? Join with the same name you
              used and you'll get your seat back.
            </p>
          </div>
        )}

        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#555' }}>
              Creating as <strong>{name}</strong>
            </p>

            {resume ? (
              <div style={{
                textAlign: 'left', padding: '12px 14px', background: 'white',
                border: '2px solid #4a7c59', borderRadius: 8, fontSize: 13, color: '#555',
              }}>
                <div style={{ fontWeight: 600, color: '#2c2c2c', marginBottom: 4 }}>
                  Resuming a saved game
                </div>
                <div style={{ color: '#888', fontSize: 12, wordBreak: 'break-all' }}>
                  {resume.fileName}
                </div>
                <div style={{ marginTop: 6 }}>
                  Week {resume.save.game.weekNumber} · {resume.save.game.currentSeason} ·{' '}
                  {resume.save.game.players.length} player
                  {resume.save.game.players.length === 1 ? '' : 's'} ·{' '}
                  {resume.save.strokes.length} marks on the map
                </div>
                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                  Everyone else rejoins with the room code, using the same names
                  they played under: {resume.save.game.players.map(p => p.name).join(', ')}.
                </div>
              </div>
            ) : (
              <button onClick={() => resumeInputRef.current?.click()} style={secondaryButtonStyle}>
                <Icon name="open" size={15} /> Resume from a saved game…
              </button>
            )}

            <button onClick={resume ? handleResume : handleCreate} style={buttonStyle}>
              {resume ? 'Resume This Game' : 'Create Room'}
            </button>
            <button
              onClick={() => (resume ? setResume(null) : setMode('menu'))}
              style={linkStyle}
            >
              {resume ? 'Start fresh instead' : 'Back'}
            </button>

            <input
              ref={resumeInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => pickSave(e, (save, fileName) => setResume({ save, fileName }))}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#555' }}>
              Joining as <strong>{name}</strong>
            </p>
            <input
              type="text"
              placeholder="Room code (e.g. AB3K)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontSize: 24 }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <button
              onClick={handleJoin}
              disabled={roomCode.length < 4}
              style={buttonStyle}
            >
              Join Room
            </button>
            <button onClick={() => setMode('menu')} style={linkStyle}>
              Back
            </button>
          </div>
        )}
      </div>

      {/* Reading an old year back, on your own, needs no room at all. */}
      <button
        onClick={() => reviewInputRef.current?.click()}
        title="Open a saved game to read through"
        style={{
          position: 'absolute', right: 20, bottom: 20,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 14px', fontFamily: 'Georgia, serif', fontSize: 13,
          background: 'white', color: '#6b6b6b',
          border: '1px solid #d4c5a9', borderRadius: 999, cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Icon name="file" size={15} /> Open a saved game
      </button>
      <input
        ref={reviewInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => pickSave(e, save => setReview(save))}
        style={{ display: 'none' }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 18,
  border: '2px solid #ccc',
  borderRadius: 8,
  background: 'white',
  fontFamily: 'Georgia, serif',
  outline: 'none',
  width: '100%',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  fontSize: 18,
  background: '#4a7c59',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  transition: 'opacity 0.2s',
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '10px 20px',
  fontSize: 15,
  background: 'white',
  color: '#4a4a4a',
  border: '1px solid #d4c5a9',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 14,
  textDecoration: 'underline',
  fontFamily: 'Georgia, serif',
};
