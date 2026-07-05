// Pre-game lobby: room code, player list, colour pick, ready-up, host start.

import { useGameStore } from '../engine/store.js';
import { net } from '../net/socket.js';
import { MAP_LIST } from '../board/maps.js';
import Chat from './Chat.jsx';

const COLORS = ['#e23b3b', '#3b74e2', '#e2873b', '#dfe3ea'];

export default function Lobby() {
  const room = useGameStore((s) => s.room);
  const mySeat = useGameStore((s) => s.mySeat);
  const serverError = useGameStore((s) => s.serverError);
  const backToHome = useGameStore((s) => s.backToHome);

  if (!room) return null;
  const me = room.players.find((p) => p.seat === mySeat);
  const isHost = mySeat === room.hostSeat;
  const taken = new Set(room.players.filter((p) => p.seat !== mySeat).map((p) => p.color));
  const allReady = room.players.every((p) => p.ready || p.seat === room.hostSeat);

  const leave = () => {
    net.leave();
    backToHome();
  };

  return (
    <div className="home">
      <div className="home__card lobby">
        <div className="lobby__head">
          <h1 className="home__title">Room {room.code}</h1>
          <button className="chip-btn" onClick={leave}>Leave</button>
        </div>
        <p className="muted">Share the code so friends can join.</p>

        <h2 className="panel__title">Players ({room.players.length}/4)</h2>
        <ul className="lobby__players">
          {room.players.map((p) => (
            <li key={p.seat} className="lobby__player">
              <span className="pcard__chip" style={{ background: p.color }} />
              <span className="lobby__pname">
                {p.name}
                {p.seat === mySeat && ' (you)'}
                {p.seat === room.hostSeat && ' · host'}
              </span>
              <span className={`lobby__ready${p.ready ? ' lobby__ready--on' : ''}`}>
                {!p.connected ? 'disconnected' : p.ready ? '✓ ready' : 'not ready'}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="panel__title">Map {isHost ? '' : '(host chooses)'}</h2>
        <div className="map-pick">
          {MAP_LIST.map((m) => (
            <button
              key={m.id}
              className={`map-card${room.mapId === m.id ? ' map-card--on' : ''}`}
              disabled={!isHost}
              onClick={() => net.setMap(m.id)}
            >
              <span className="map-card__name">{m.name}</span>
              <span className="map-card__tagline">{m.tagline}</span>
            </button>
          ))}
        </div>

        <h2 className="panel__title">Options {isHost ? '' : '(host chooses)'}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(room.options?.friendlyRobber)}
            disabled={!isHost}
            onChange={(e) => net.setOptions({ friendlyRobber: e.target.checked })}
          />
          <span>Friendly robber — players under 3 VP can't be robbed</span>
        </label>

        <h2 className="panel__title">Your colour</h2>
        <div className="row-gap">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch${me?.color === c ? ' color-swatch--on' : ''}`}
              style={{ background: c }}
              disabled={taken.has(c)}
              onClick={() => net.setColor(c)}
              aria-label={`colour ${c}`}
            />
          ))}
        </div>

        <div className="row-gap lobby__actions">
          <button className="btn" onClick={net.toggleReady}>{me?.ready ? 'Unready' : 'Ready up'}</button>
          {isHost && (
            <button className="btn" disabled={!allReady || room.players.length < 2} onClick={net.startGame}>
              Start game
            </button>
          )}
        </div>
        {serverError && <p className="home__error">{serverError}</p>}

        <Chat />
      </div>
    </div>
  );
}
