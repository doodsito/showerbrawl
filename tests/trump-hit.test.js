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
const tap = (g, id, slot) => { g.input(id, { dx: 0, dy: 0, [slot]: true }); g.tick(1 / 30); g.input(id, { dx: 0, dy: 0, [slot]: false }); for (let i = 0; i < 6; i++) g.tick(1 / 30); };
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

// Bond du jab (lunge 70 en 0,12 s) si un ennemi est a moins de 160.
test('Trump: ennemi a 140 -> bond et touche', (t) => {
  const { g, p, q } = setup(t, 'trump', 'biden', 140); const x0 = p.x;
  tap(g, 'a', 'attack');
  assert.ok(p.x - x0 > 40, `bond vers l'ennemi (${p.x - x0})`);
  assert.equal(q.hp, q.maxHp - CONFIG.BASE_ATTACK.damage);
});
test('Trump: ennemi a 200 -> pas de bond, pas de touche', (t) => {
  const { g, p, q } = setup(t, 'trump', 'biden', 200); const x0 = p.x;
  tap(g, 'a', 'attack');
  assert.equal(p.x, x0); assert.equal(q.hp, q.maxHp);
});
test('Trump: le bond ne fait pas tomber du toit', (t) => {
  const { g, p, q } = setup(t, 'trump', 'biden', 0);
  let x = 300; while (!g.physics.isFalling({ x: x - 4, y: 320 })) x -= 4; // bord gauche du toit
  g.kill = () => {}; // l'ennemi reste 'vivant' dans le vide: il attire le bond vers le bord
  Object.assign(p, { x: x + p.r + 2, y: 320 }); Object.assign(q, { x: x - 80, y: 320 });
  let lunged = false;
  g.input('a', { attack: true }); g.tick(1 / 30); g.input('a', { attack: false });
  for (let i = 0; i < 8; i++) { lunged ||= !!p.lunge; g.tick(1 / 30); Object.assign(q, { x: x - 80, y: 320 }); }
  assert.ok(lunged, 'bond declenche vers le bord');
  assert.ok(!g.physics.isFalling(p), 'Trump reste sur le toit');
});
test('Trump: pas de ralentissement de recovery pendant le bond', (t) => {
  const { g, p } = setup(t, 'trump', 'biden', 140); const x0 = p.x;
  g.input('a', { attack: true }); g.tick(0.06); g.input('a', { attack: false }); g.tick(0.06); g.tick(0.06);
  assert.ok(p.x - x0 > 60, `bond complet malgre la recovery (${p.x - x0})`);
});
