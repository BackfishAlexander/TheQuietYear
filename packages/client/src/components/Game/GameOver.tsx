import { useGameStore } from '../../store/gameStore';
import { SEASON_COLORS } from '@quiet-year/shared';

export function GameOver() {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const completedProjects = gameState.projects.filter(p => p.completed);
  const failedProjects = gameState.projects.filter(p => p.failed);

  return (
    <div style={{
      height: '100%', overflow: 'auto', background: '#1a1a2e',
      color: '#e8e8e8', padding: 40,
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{'\u2744'}</div>
        <h1 style={{
          fontSize: 36, fontWeight: 400, marginBottom: 8,
          fontFamily: 'Georgia, serif', color: '#93c5fd',
        }}>
          The Frost Shepherds Arrive
        </h1>
        <p style={{
          fontSize: 16, color: '#8888aa', marginBottom: 40,
          fontStyle: 'italic', lineHeight: 1.6,
        }}>
          The quiet year has come to an end. What becomes of this community
          is left to the imagination.
        </p>

        {/* Summary stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
          marginBottom: 32,
        }}>
          <div style={statBox}>
            <div style={statNum}>{gameState.weekNumber}</div>
            <div style={statLabel}>Weeks Survived</div>
          </div>
          <div style={statBox}>
            <div style={statNum}>{completedProjects.length}</div>
            <div style={statLabel}>Projects Completed</div>
          </div>
          <div style={statBox}>
            <div style={statNum}>{failedProjects.length}</div>
            <div style={statLabel}>Projects Failed</div>
          </div>
        </div>

        {/* Resources */}
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 32 }}>
          <div>
            <h3 style={{ color: '#2ecc71', fontSize: 14, marginBottom: 8 }}>Abundances</h3>
            {gameState.abundances.map((a, i) => (
              <div key={i} style={{ fontSize: 14, color: '#aaa' }}>{a}</div>
            ))}
            {gameState.abundances.length === 0 && <div style={{ color: '#555' }}>None</div>}
          </div>
          <div>
            <h3 style={{ color: '#e74c3c', fontSize: 14, marginBottom: 8 }}>Scarcities</h3>
            {gameState.scarcities.map((s, i) => (
              <div key={i} style={{ fontSize: 14, color: '#aaa' }}>{s}</div>
            ))}
            {gameState.scarcities.length === 0 && <div style={{ color: '#555' }}>None</div>}
          </div>
        </div>

        {/* Contempt */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#888' }}>Final Contempt</h3>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            {gameState.players.map(p => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', background: p.color,
                  margin: '0 auto 4px',
                }} />
                <div style={{ fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{p.contemptTokens}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chronicle */}
        <div style={{ textAlign: 'left', marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textAlign: 'center' }}>
            Chronicle of the Year
          </h3>
          <div style={{
            maxHeight: 300, overflow: 'auto', padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 8,
          }}>
            {gameState.events.map(event => (
              <div key={event.id} style={{ marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: SEASON_COLORS[event.season], marginRight: 6 }}>
                  Week {event.week}
                </span>
                <span style={{ color: '#888' }}>
                  {event.playerName}: {event.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: '#555', fontSize: 13, fontStyle: 'italic' }}>
          The limits on communication are now lifted. Discuss what happened
          and what the Frost Shepherds might mean for your community.
        </p>
      </div>
    </div>
  );
}

const statBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 8,
};
const statNum: React.CSSProperties = {
  fontSize: 32, fontWeight: 700, color: '#93c5fd',
};
const statLabel: React.CSSProperties = {
  fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase',
};
