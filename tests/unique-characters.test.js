import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';

const ids = Object.keys(characters);
function setup(t) {
  const game = new Game({ emit() {} }, { characters, arena, autoTick: false });
  t.after(() => game.dispose());
  return game;
}

test('a character is held by one player only, whatever the random teams', (t) => {
  const game = setup(t);
  assert.equal(game.join({ id: 'a' }, { character: ids[0], name: 'Ann' }).ok, true);
  const res = game.join({ id: 'b' }, { character: ids[0], name: 'Bob' });
  assert.equal(res.ok, false); assert.equal(res.error, 'character already taken'); assert.equal(res.takenBy, 'Ann');
  assert.equal(game.join({ id: 'a' }, { character: ids[0], name: 'Ann' }).ok, true); // re-join sur son propre perso
});

test('no duplicate even once every character is taken', (t) => {
  const game = setup(t);
  const n = Math.min(ids.length, 8);
  for (let i = 0; i < n; i++) assert.equal(game.join({ id: 'p' + i }, { character: ids[i] }).ok, true);
  for (const c of ids.slice(0, n)) { const r = game.join({ id: 'x' }, { character: c }); assert.equal(!!r.queued, true); }
  assert.equal(new Set([...game.players.values()].map((p) => p.character)).size, game.players.size);
});

test('9th player goes to the waiting queue', (t) => {
  const game = setup(t);
  for (let i = 0; i < 8; i++) assert.equal(game.join({ id: 'p' + i }, { character: ids[i] }).ok, true);
  const res = game.join({ id: 'p8' }, { character: ids[0] }); // la limite passe avant le controle du perso
  assert.equal(res.queued, true); assert.equal(res.position, 1);
  assert.equal(game.players.size, 8);
});
