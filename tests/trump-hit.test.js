// Trump par le vrai chemin Game.input (tap court): touche au contact, meme derriere son mur MAGA, et peut etre touche.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';
import { CONFIG } from '../shared/config.js';

function setup(t, a, b, dist) {
  const g = new Game({ emit() {}, to: () => ({ emit() {} }) }, { characters, arena, autoTick: false, fixedTeams: true });
  t.after(() => g.dispose());
  g.join({ id: 'a' }, { team: 'A', character: a }); g.join({ id: 'b' }, { team: 'B', character: b }); g.start(); g.countdown = 0;
  const p = g.players.get('a'), q = g.players.get('b');
  Object.assign(p, { x: 300, y: 320, fx: 1, fy: 0, protectT: 0 }); Object.assign(q, { x: 300 + dist, y: 320, protectT: 0 });
  return { g, p, q };
}
const tap = (g, id, slot) => { g.input(id, { dx: 0, dy: 0, [slot]: true }); g.tick(1 / 30); g.input(id, { dx: 0, dy: 0, [slot]: false }); g.tick(1 / 30); };
const ids = Object.keys(characters).filter((k) => !k.startsWith('_'));

for (const dist of [50, 70, 85]) for (const fx of [1, -1]) test(`Trump touche au contact (d=${dist}, ${fx > 0 ? 'face' : 'dos'})`, (t) => {
  const { g, p, q } = setup(t, 'trump', 'biden', dist); p.fx = fx;
  tap(g, 'a', 'attack');
  assert.equal(q.hp, q.maxHp - CONFIG.BASE_ATTACK.damage);
});

test('Trump touche a travers son propre mur MAGA, le mur reste intact', (t) => {
  const { g, p, q } = setup(t, 'trump', 'biden', 150);
  tap(g, 'a', 'defense'); assert.equal(g.walls.length, 1);
  const wallHp = g.walls[0].hp; q.x = 370;
  for (let i = 0; i < 3; i++) { p.cd.attack = 0; tap(g, 'a', 'attack'); }
  assert.equal(q.hp, q.maxHp - 3 * CONFIG.BASE_ATTACK.damage);
  assert.equal(g.walls[0].hp, wallHp);
});

for (const id of ids.filter((k) => k !== 'trump')) test(`${id} frappe Trump au contact, et Trump le frappe`, (t) => {
  const { g, p, q } = setup(t, id, 'trump', 50); p.energy = 0;
  tap(g, 'a', 'attack'); for (let i = 0; i < 30; i++) g.tick(1 / 30);
  assert.ok(q.hp < q.maxHp, `${id} touche Trump`);
  const hp = p.hp; q.fx = -1; q.x = p.x + 50; q.y = p.y; tap(g, 'b', 'attack');
  assert.ok(p.hp < hp, `Trump touche ${id}`);
});
