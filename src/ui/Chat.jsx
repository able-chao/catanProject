// Lobby / in-game chat (CHAT event).

import { useState } from 'react';
import { useGameStore } from '../engine/store.js';
import { net } from '../net/socket.js';

export default function Chat() {
  const chat = useGameStore((s) => s.chat);
  const [text, setText] = useState('');

  const send = () => {
    const t = text.trim();
    if (t) {
      net.sendChat(t);
      setText('');
    }
  };

  return (
    <div className="chat">
      <h2 className="panel__title">Chat</h2>
      <ul className="chat__list">
        {chat.map((m, i) => (
          <li key={i}>
            <span style={{ color: m.color }} className="chat__name">{m.name}:</span> {m.text}
          </li>
        ))}
        {!chat.length && <li className="muted">No messages yet</li>}
      </ul>
      <div className="chat__input">
        <input
          value={text}
          maxLength={240}
          placeholder="Say something…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="chip-btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
