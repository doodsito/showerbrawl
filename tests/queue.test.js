import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, MAX_PLAYERS, QUEUE_GHOST_MS } from '../server/game.js';
import { characters, arena } from '../server/loader.js';

const ids = Object.keys(characters);
function setup(t) {
  const sockets = new Map();
  const io = { emit() {}, to: () => ({ emit() {} }), sockets: { sockets } };
  const game = new Game(io, { characters, arena, autoTick: false });
  t.after(() => game.dispose());
  const sock = (id) => { const s = { id, data: {}, got: [], emit(ev, d) { s.got.push([ev, d]); }, disconnect() { sockets.delete(id); } }; sockets.set(id, s); return s; };
  const last = (s, ev) => s.got.filter(([e]) => e === ev).at(-1)?.[1];
  const fill = (n) => Array.from({ length: n }, (_, i) => { const s = sock('s' + i); return [s, game.join(s, { character: ids[i % ids.length], name: 'P' + i, playerKey: 'k' + i })]; });
  return { game, sock, last, fill };
}

test('15 players: 8 in game, 7 queued in arrival order', (t) => {
  const { game, last, fill } = setup(t);
  const r = fill(15);
  assert.equal(MAX_PLAYERS, 8);
  assert.equal(game.players.size, 8);
  assert.deepEqual(game.queue.map((q) => q.id), ['s8', 's9', 's10', 's11', 's12', 's13', 's14']);
  r.slice(8).forEach(([s, res], i) => { assert.equal(res.queued, true); assert.equal(last(s, 'queue').position, i + 1); });
  assert.equal(game.lobbyPayload().waiting, 7);
  for (const q of game.queue) assert.equal(game.players.has(q.id), false);
});

test('a lobby departure lets the first queued player in with a free character', (t) => {
  const { game, last, fill } = setup(t);
  const r = fill(10);
  const freed = game.players.get('s3').character;
  game.leave('s3');
  assert.equal(game.players.size, 8);
  const p = game.players.get('s8');
  assert.ok(p);
  assert.equal(p.character, freed); // son choix (ids[0]) est pris: premier libre
  assert.equal(last(r[8][0], 'admitted').character, freed);
  assert.deepEqual(game.queue.map((q) => q.id), ['s9']);
  assert.equal(last(r[9][0], 'queue').position, 1);
  // Peut changer pour un autre perso libre tant que le match n'a pas demarre
  const free = ids.find((c) => ![...game.players.values()].some((o) => o.character === c));
  if (free) assert.equal(game.join(r[8][0], { character: free, playerKey: 'k8' }).ok, true);
});

test('a departure during a match lets nobody in until back to lobby', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { game, fill } = setup(t);
  fill(11);
  game.start();
  game.leave('s0'); game.kick('s1');
  assert.equal(game.players.size, 6);
  assert.equal(game.queue.length, 3);
  game.end();
  assert.equal(game.players.size, 6);
  t.mock.timers.tick(20000);
  assert.equal(game.phase, 'lobby');
  assert.equal(game.players.size, 8);
  assert.deepEqual(game.queue.map((q) => q.id), ['s10']);
  assert.ok(game.players.has('s8') && game.players.has('s9'));
});

test('queued player who disconnects leaves after 10 s, keeps place if back before', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { game, sock, fill } = setup(t);
  fill(11);
  game.disconnect('s8');
  t.mock.timers.tick(QUEUE_GHOST_MS - 100);
  const res = game.join(sock('s8b'), { character: ids[0], name: 'P8', playerKey: 'k8' });
  assert.equal(res.queued, true); assert.equal(res.position, 1);
  t.mock.timers.tick(1000);
  assert.deepEqual(game.queue.map((q) => q.id), ['s8b', 's9', 's10']);
  game.disconnect('s9');
  t.mock.timers.tick(QUEUE_GHOST_MS + 10);
  assert.deepEqual(game.queue.map((q) => q.id), ['s8b', 's10']);
});
