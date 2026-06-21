import Board from './board/Board.jsx';
import Controls from './ui/Controls.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Catan</h1>
        <span className="app__phase">Phase 1 · Foundation</span>
      </header>
      <main className="app__main">
        <div className="app__board">
          <Board />
        </div>
        <Controls />
      </main>
    </div>
  );
}
