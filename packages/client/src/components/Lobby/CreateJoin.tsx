import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function CreateJoin({ socket }: { socket: TypedSocket }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const { setPlayerName } = useGameStore();

  const handleCreate = () => {
    if (!name.trim()) return;
    setPlayerName(name.trim());
    socket.emit('room:create', { playerName: name.trim() });
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    setPlayerName(name.trim());
    socket.emit('room:join', { roomId: roomCode.trim().toUpperCase(), playerName: name.trim() });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#f5f0e8',
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
          </div>
        )}

        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#555' }}>
              Creating as <strong>{name}</strong>
            </p>
            <button onClick={handleCreate} style={buttonStyle}>
              Create Room
            </button>
            <button onClick={() => setMode('menu')} style={linkStyle}>
              Back
            </button>
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

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 14,
  textDecoration: 'underline',
  fontFamily: 'Georgia, serif',
};
