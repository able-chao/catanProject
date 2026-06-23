// Two-client integration test against a running server (`npm run server`).
// Proves: lobby join + seats/colours, server-authoritative dice (client sends
// no dice), action authorization (wrong player rejected), and reconnection.
//   node scripts/net-test.mjs
import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL || 'http://localhost:3001';
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.game = null;
  s.lobby = null;
  s.seat = null;
  s.on('LOBBY_UPDATE', ({ room, seat }) => { s.lobby = room; s.seat = seat; });
  s.on('GAME_STARTED', ({ game }) => { s.game = game; });
  s.on('STATE_UPDATE', ({ game }) => { s.game = game; });
  return s;
}
const waitFor = (cond, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => (cond() ? resolve() : Date.now() - t0 > ms ? reject(new Error('timeout')) : setTimeout(tick, 15));
    tick();
  });

async function main() {
  const A = connect();
  const B = connect();
  await waitFor(() => A.connected && B.connected);

  // --- Lobby ---
  A.emit('CREATE_ROOM', { name: 'Alice' });
  await waitFor(() => A.lobby);
  const code = A.lobby.code;
  ok('host created room (seat 0)', A.seat === 0 && A.lobby.players.length === 1);

  B.emit('JOIN_ROOM', { code, name: 'Bob' });
  await waitFor(() => B.lobby && A.lobby.players.length === 2);
  ok('second player joined (seat 1)', B.seat === 1);
  ok('distinct colours assigned', A.lobby.players[0].color !== A.lobby.players[1].color);

  // --- Start ---
  B.emit('PLAYER_READY');
  await waitFor(() => A.lobby.players[1].ready);
  A.emit('START_GAME');
  await waitFor(() => A.game && B.game);
  ok('GAME_STARTED broadcast to both', A.game.phase === 'SETUP_FORWARD' && B.game.phase === 'SETUP_FORWARD');
  ok('lobby names applied', A.game.players[0].name === 'Alice' && A.game.players[1].name === 'Bob');

  // --- Drive setup (snake draft) to reach ROLL ---
  const client = (seat) => (seat === 0 ? A : B);
  let guard = 0;
  while (['SETUP_FORWARD', 'SETUP_REVERSE'].includes(A.game.phase) && guard++ < 60) {
    const g = A.game;
    const me = client(g.currentPlayer);
    if (!g.awaitingRoad) me.emit('ACTION', { action: { type: 'PLACE_SETTLEMENT', vertexId: g.valid.settlements[0] } });
    else me.emit('ACTION', { action: { type: 'PLACE_ROAD', edgeId: g.valid.roads[0] } });
    const before = g.log.length;
    await waitFor(() => A.game.log.length !== before || A.game.phase === 'ROLL');
  }
  ok('setup completed -> ROLL', A.game.phase === 'ROLL');

  // --- Authorization: wrong player can't act ---
  const cur = A.game.currentPlayer;
  const wrong = client(cur === 0 ? 1 : 0);
  const logBefore = A.game.log.length;
  wrong.emit('ACTION', { action: { type: 'ROLL_DICE' } });
  await sleep(150);
  ok('action by wrong player rejected', A.game.log.length === logBefore && A.game.phase === 'ROLL');

  // --- Server-authoritative dice: client sends NO dice ---
  client(cur).emit('ACTION', { action: { type: 'ROLL_DICE' } }); // no dice payload!
  await waitFor(() => A.game.dice != null);
  const [d1, d2] = A.game.dice;
  ok('server generated dice in range', d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6);
  ok('dice broadcast to both clients', JSON.stringify(A.game.dice) === JSON.stringify(B.game.dice));
  ok('roll advanced the phase', A.game.phase === 'MAIN' || A.game.phase === 'MOVE_ROBBER');

  // --- Reconnection: B drops and rejoins, gets a snapshot ---
  const turnNow = A.game.turn;
  B.disconnect();
  await sleep(120);
  const B2 = connect();
  await waitFor(() => B2.connected);
  B2.emit('JOIN_ROOM', { code, name: 'Bob' });
  await waitFor(() => B2.game != null);
  ok('reconnect delivers full snapshot', B2.game.turn === turnNow && B2.game.players.length === 2);

  A.disconnect();
  B2.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
