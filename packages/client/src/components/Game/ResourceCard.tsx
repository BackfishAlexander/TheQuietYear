import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../../store/gameStore';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function ResourceCard({ socket }: { socket: TypedSocket }) {
  const { gameState } = useGameStore();
  const [newAbundance, setNewAbundance] = useState('');
  const [newScarcity, setNewScarcity] = useState('');
  const [newName, setNewName] = useState('');

  if (!gameState) return null;

  const addAbundance = () => {
    if (!newAbundance.trim()) return;
    socket.emit('resource:addAbundance', { resource: newAbundance.trim() });
    setNewAbundance('');
  };

  const addScarcity = () => {
    if (!newScarcity.trim()) return;
    socket.emit('resource:addScarcity', { resource: newScarcity.trim() });
    setNewScarcity('');
  };

  const addName = () => {
    if (!newName.trim()) return;
    socket.emit('resource:addName', { name: newName.trim() });
    setNewName('');
  };

  return (
    <div style={{ padding: 12, borderBottom: '1px solid #e0d8c8', fontSize: 13 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>
        Resources
      </h3>

      {/* Abundances */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, color: '#2ecc71', marginBottom: 4, fontSize: 12 }}>
          Abundances
        </div>
        {gameState.abundances.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
            <span>{a}</span>
            <button
              onClick={() => socket.emit('resource:removeAbundance', { resource: a })}
              style={removeBtn}
            >
              x
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            value={newAbundance}
            onChange={e => setNewAbundance(e.target.value)}
            placeholder="Add..."
            style={smallInput}
            onKeyDown={e => e.key === 'Enter' && addAbundance()}
          />
          <button onClick={addAbundance} style={addBtn}>+</button>
        </div>
      </div>

      {/* Scarcities */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, color: '#e74c3c', marginBottom: 4, fontSize: 12 }}>
          Scarcities
        </div>
        {gameState.scarcities.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
            <span>{s}</span>
            <button
              onClick={() => socket.emit('resource:removeScarcity', { resource: s })}
              style={removeBtn}
            >
              x
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            value={newScarcity}
            onChange={e => setNewScarcity(e.target.value)}
            placeholder="Add..."
            style={smallInput}
            onKeyDown={e => e.key === 'Enter' && addScarcity()}
          />
          <button onClick={addScarcity} style={addBtn}>+</button>
        </div>
      </div>

      {/* Names */}
      <div>
        <div style={{ fontWeight: 600, color: '#3498db', marginBottom: 4, fontSize: 12 }}>
          Names
        </div>
        {gameState.names.map((n, i) => (
          <div key={i} style={{ padding: '2px 0' }}>{n}</div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Add..."
            style={smallInput}
            onKeyDown={e => e.key === 'Enter' && addName()}
          />
          <button onClick={addName} style={addBtn}>+</button>
        </div>
      </div>
    </div>
  );
}

const smallInput: React.CSSProperties = {
  flex: 1, padding: '3px 6px', fontSize: 12, border: '1px solid #ddd',
  borderRadius: 3, fontFamily: 'Georgia, serif',
};

const addBtn: React.CSSProperties = {
  padding: '3px 8px', fontSize: 12, background: '#4a7c59', color: 'white',
  border: 'none', borderRadius: 3, cursor: 'pointer',
};

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ccc', cursor: 'pointer',
  fontSize: 12, padding: '0 4px',
};
