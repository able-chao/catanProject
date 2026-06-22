import Board from './board/Board.jsx';
import StatusBar from './ui/StatusBar.jsx';
import TradePanel from './ui/TradePanel.jsx';
import DevPanel from './ui/DevPanel.jsx';
import Players from './ui/Players.jsx';
import Log from './ui/Log.jsx';
import Overlays from './ui/Overlays.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Catan</h1>
        <span className="app__phase">Phase 5 · Trading</span>
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
          <Overlays />
        </aside>
      </main>
    </div>
  );
}
