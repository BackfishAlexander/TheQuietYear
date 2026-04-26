import { useSocket } from './hooks/useSocket';
import { useGameStore } from './store/gameStore';
import { CreateJoin } from './components/Lobby/CreateJoin';
import { WaitingRoom } from './components/Lobby/WaitingRoom';
import { GameLayout } from './components/Game/GameLayout';
import { GameOver } from './components/Game/GameOver';

export default function App() {
  const socket = useSocket();
  const { roomState, gameState, error } = useGameStore();

  // Determine which screen to show
  let screen: 'lobby' | 'waiting' | 'game' | 'gameover' = 'lobby';

  if (gameState?.phase === 'game-over') {
    screen = 'gameover';
  } else if (gameState) {
    screen = 'game';
  } else if (roomState) {
    screen = 'waiting';
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#dc3545', color: 'white', padding: '8px 20px',
          borderRadius: 6, zIndex: 1000, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {error}
        </div>
      )}
      {screen === 'lobby' && <CreateJoin socket={socket} />}
      {screen === 'waiting' && <WaitingRoom socket={socket} />}
      {screen === 'game' && <GameLayout socket={socket} />}
      {screen === 'gameover' && <GameOver />}
    </div>
  );
}
