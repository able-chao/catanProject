import { useGameStore } from './engine/store.js';
import { net } from './net/socket.js';
import Home from './ui/Home.jsx';
import Lobby from './ui/Lobby.jsx';
import Board from './board/Board.jsx';
import StatusBar from './ui/StatusBar.jsx';
import TradePanel from './ui/TradePanel.jsx';
import DevPanel from './ui/DevPanel.jsx';
import Players from './ui/Players.jsx';
import Log from './ui/Log.jsx';
import Overlays from './ui/Overlays.jsx';
import Chat from './ui/Chat.jsx';
import EndScreen from './ui/EndScreen.jsx';
import './App.css';

export default function App() {
  const view = useGameStore((s) => s.view);
  if (view === 'home') return <Home />;
  if (view === 'lobby') return <Lobby />;
  return <GameView />;
}

function GameView() {
  const mode = useGameStore((s) => s.mode);
  const room = useGameStore((s) => s.room);
  const backToHome = useGameStore((s) => s.backToHome);

  const leave = () => {
    if (mode === 'online') net.leave();
    backToHome();
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Catan</h1>
        <span className="app__phase">Phase 7 · Multiplayer</span>
        {mode === 'online' && room && <span className="app__room">Room {room.code}</span>}
        <button className="chip-btn app__leave" onClick={leave}>
          {mode === 'online' ? 'Leave' : 'Home'}
        </button>
      </header>
      <main className="app__main">
        <div className="app__board">
          <Board />
        </div>
        <aside className="sidebar">
          <StatusBar />
          <DevPanel />
          <TradePanel />
          <Players />
          <Log />
          {mode === 'online' && <Chat />}
          <Overlays />
        </aside>
      </main>
      <EndScreen />
    </div>
  );
}
