import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, GHOST_MS } from '../server/game.js';
import { characters, arena } from '../server/loader.js';

const ids = Object.keys(characters);
function setup(t) {
  const sockets = new Map();
  const io = { emit() {}, to: () => ({ emit() {} }), sockets: { sockets } };
  const game = new Game(io, { characters, arena, autoTick: false });
  t.after(() => game.dispose());
  const sock = (id) => { const s = { id, data: {}, disconnected: false, emit() {}, disconnect() { s.disconnected = true; sockets.delete(id); } }; sockets.set(id, s); return s; };
  return { game, sock };
}

test('reload: same playerKey resumes own character without "already taken"', (t) => {
  const { game, sock } = setup(t);
  const old = sock('s1');
  assert.equal(game.join(old, { character: ids[0], name: 'Ann', playerKey: 'k1' }).ok, true);
  const p = game.players.get('s1'); p.kills = 3; const team = p.team;
  const res = game.join(sock('s2'), { character: ids[0], name: 'Ann', playerKey: 'k1' });
  assert.equal(res.ok, true);
  assert.equal(game.players.size, 1);
  assert.equal(game.players.get('s2'), p);
  assert.equal(p.team, team); assert.equal(p.kills, 3);
  assert.equal(old.disconnected, true); assert.equal(old.data.replaced, true);
});

test('resume after disconnect within delay keeps the character', (t) => {
  const { game, sock } = setup(t);
  game.join(sock('s1'), { character: ids[0], name: 'Ann', playerKey: 'k1' });
  game.disconnect('s1');
  assert.equal(game.players.get('s1').offline, true);
  assert.equal(game.join(sock('s2'), { character: ids[0], name: 'Ann', playerKey: 'k1' }).ok, true);
  assert.equal(game.players.get('s2').offline, false);
});

test('phone off: character freed after 5 s', async (t) => {
  assert.equal(GHOST_MS, 5000);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { game, sock } = setup(t);
  game.join(sock('s1'), { character: ids[0], name: 'Ann', playerKey: 'k1' });
  game.disconnect('s1');
  t.mock.timers.tick(4900);
  const blocked = game.join(sock('b'), { character: ids[0], name: 'Bob', playerKey: 'k2' });
  assert.equal(blocked.ok, false); assert.equal(blocked.takenBy, 'Ann'); assert.equal(blocked.takenOffline, true);
  t.mock.timers.tick(200);
  assert.equal(game.players.has('s1'), false);
  assert.equal(game.join(sock('b'), { character: ids[0], name: 'Bob', playerKey: 'k2' }).ok, true);
});

test('two different players still refused on the same character', (t) => {
  const { game, sock } = setup(t);
  game.join(sock('a'), { character: ids[0], name: 'Ann', playerKey: 'k1' });
  const res = game.join(sock('b'), { character: ids[0], name: 'Bob', playerKey: 'k2' });
  assert.equal(res.ok, false); assert.equal(res.error, 'character already taken'); assert.equal(res.takenBy, 'Ann');
});

test('host kick frees the character, STOP MATCH purges disconnected players', (t) => {
  const { game, sock } = setup(t);
  game.join(sock('a'), { character: ids[0], name: 'Ann', playerKey: 'k1' });
  game.join(sock('c'), { character: ids[1], name: 'Cid', playerKey: 'k3' });
  assert.equal(game.kick('a'), true);
  assert.equal(game.join(sock('b'), { character: ids[0], name: 'Bob', playerKey: 'k2' }).ok, true);
  game.disconnect('c');
  game.reset();
  assert.equal(game.players.has('c'), false);
  assert.equal(game.players.size, 1);
});
