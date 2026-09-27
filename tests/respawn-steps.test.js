import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, RESPAWN_STEPS } from '../server/game.js';
import { characters, arena } from '../server/loader.js';

test('respawn delay grows 3, 5, 10, 15, 15 then resets on START', (t) => {
  const sockets = new Map();
  const io = { emit() {}, to: () => ({ emit() {} }), sockets: { sockets } };
  const game = new Game(io, { characters, arena, autoTick: false });
  t.after(() => game.dispose());
  const s = { id: 's1', data: {}, disconnected: false, emit() {}, disconnect() {} }; sockets.set('s1', s);
  assert.equal(game.join(s, { character: Object.keys(characters)[0], name: 'A', playerKey: 'k' }).ok, true);
  assert.deepEqual(RESPAWN_STEPS, [3, 5, 10, 15]);
  game.start();
  const p = game.players.get('s1');
  const got = [];
  for (let i = 0; i < 5; i++) { game.spawn(p); game.kill(p, null); got.push(p.respawnT); }
  assert.deepEqual(got, [3, 5, 10, 15, 15]);
  game.reset(); game.start();
  game.spawn(p); game.kill(p, null);
  assert.equal(p.respawnT, 3);
});
