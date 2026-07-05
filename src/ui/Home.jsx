// Landing screen: start a local hotseat game or create/join an online room.

import { useState } from 'react';
import { useGameStore } from '../engine/store.js';
import { net } from '../net/socket.js';
import { MAP_LIST, DEFAULT_MAP } from '../board/maps.js';

export default function Home() {
  const startLocal = useGameStore((s) => s.startLocal);
  const serverError = useGameStore((s) => s.serverError);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mapId, setMapId] = useState(DEFAULT_MAP);
  const [friendlyRobber, setFriendlyRobber] = useState(false);

  const create = () => net.createRoom(name || 'Host');
  const join = () => code.trim() && net.joinRoom(code.trim(), name || 'Player');

  return (
    <div className="home">
      <div className="home__card">
        <h1 className="home__title">Catan</h1>
        <p className="muted">A networked clone — local or online.</p>

        <h2 className="panel__title">Local game</h2>
        <div className="map-pick">
          {MAP_LIST.map((m) => (
            <button
              key={m.id}
              className={`map-card${mapId === m.id ? ' map-card--on' : ''}`}
              onClick={() => setMapId(m.id)}
            >
              <span className="map-card__name">{m.name}</span>
              <span className="map-card__tagline">{m.tagline}</span>
            </button>
          ))}
        </div>
        <label className="toggle home__option">
          <input
            type="checkbox"
            checked={friendlyRobber}
            onChange={(e) => setFriendlyRobber(e.target.checked)}
          />
          <span>Friendly robber — players under 3 VP can't be robbed</span>
        </label>
        <div className="row-gap">
          <button className="btn" onClick={() => startLocal(3, mapId, { friendlyRobber })}>3 players</button>
          <button className="btn" onClick={() => startLocal(4, mapId, { friendlyRobber })}>4 players</button>
        </div>

        <h2 className="panel__title">Online game</h2>
        <input
          className="home__input"
          placeholder="Your name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="row-gap">
          <button className="btn" onClick={create}>Create room</button>
        </div>
        <div className="home__join">
          <input
            className="home__input"
            placeholder="Room code"
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn--ghost" onClick={join}>Join</button>
        </div>

        {serverError && <p className="home__error">{serverError}</p>}
      </div>
    </div>
  );
}
