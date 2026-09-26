// Equite des coups generiques; les kits a distance sont testes via Game.input dans ranged-kits.test.js.
// PV/vitesse communs. Mesures de contact faites en jeu (cast + ticks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';
import { cast } from '../server/abilities.js';
import { CONFIG } from '../shared/config.js';

const IDS = Object.keys(characters).filter(id=>!characters[id].attack.travel&&!characters[id].attack.behavior);
const B = CONFIG.BASE_ATTACK;

function duel(id, dist = 60) {
  const game = new Game({ emit: () => {} }, { characters, arena, autoTick: false });
  game.join({ id: 'a' }, { team: 'A', character: id }); game.join({ id: 'b' }, { team: 'B', character: 'biden' });
  game.start(); game.countdown = 0;
  const p = game.players.get('a'), q = game.players.get('b');
  Object.assign(p, { x: 300, y: 320, fx: 1, fy: 0, protectT: 0 }); Object.assign(q, { x: 300 + dist, y: 320, protectT: 0 });
  return { game, p, q };
}

// Mesures de l'attaque de base d'un perso
function measure(id) {
  const out = {};
  { // degats par coup + recul (deplacement de la cible 0,3 s apres le coup)
    const { game, p, q } = duel(id); const hp = q.hp, x0 = q.x;
    cast(game, p, 'attack'); out.damage = hp - q.hp;
    for (let i = 0; i < 30; i++) game.tick(0.01); out.push = Math.round(q.x - x0);
    game.dispose();
  }
  { // cooldown: refuse tout de suite, accepte apres le cooldown
    const { game, p } = duel(id);
    cast(game, p, 'attack'); out.recastNow = cast(game, p, 'attack');
    out.cooldown = p.cd.attack;
    game.dispose();
  }
  { // portee: touche juste sous la limite de contact, rate juste au-dessus
    const reach = Math.min(B.range, 110) + CONFIG.PLAYER_RADIUS * 2;
    let r = duel(id, reach - 5); cast(r.game, r.p, 'attack'); out.hitsInside = r.q.hp < r.q.maxHp; r.game.dispose();
    r = duel(id, reach + 10); cast(r.game, r.p, 'attack'); out.hitsOutside = r.q.hp < r.q.maxHp; r.game.dispose();
  }
  { // 5 s de frappe continue sur une cible maintenue au contact (PV enormes)
    const { game, p, q } = duel(id); q.maxHp = q.hp = 1e6;
    for (let t = 0; t < 5; t += 0.01) {
      Object.assign(q, { x: p.x + 60, y: p.y, kbVx: 0, kbVy: 0, shove: null, stunT: 0 });
      Object.assign(p, { y: 320, kbVx: 0, kbVy: 0 });
      cast(game, p, 'attack'); game.tick(0.01);
    }
    out.fiveSeconds = Math.round(1e6 - q.hp);
    game.dispose();
  }
  return out;
}

const M = Object.fromEntries(IDS.map((id) => [id, measure(id)]));

test('attaque de base: valeurs standard CONFIG.BASE_ATTACK pour chaque perso', () => {
  for (const id of IDS) {
    const m = M[id];
    assert.equal(m.damage, B.damage, `${id}: degats par coup`);
    assert.equal(m.recastNow, false, `${id}: cooldown actif`);
    assert.ok(Math.abs(m.cooldown - B.cooldown) < 1e-9, `${id}: cooldown ${m.cooldown}`);
    assert.equal(m.hitsInside, true, `${id}: touche a portee`);
    assert.equal(m.hitsOutside, false, `${id}: rate hors portee`);
    assert.ok(m.push > 0, `${id}: recul`);
    assert.ok(m.fiveSeconds > 0, `${id}: degats sur 5 s`);
  }
});

for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) {
  const a = IDS[i], b = IDS[j];
  test(`equite ${a} / ${b}: memes degats, cooldown, portee, recul et degats sur 5 s`, () => {
    assert.deepEqual(M[a], M[b]);
  });
}

test('memes PV et meme vitesse pour tous (CONFIG.BASE_HP / BASE_SPEED)', () => {
  for (const id of Object.keys(characters)) {
    assert.equal(characters[id].hp, CONFIG.BASE_HP, `${id}: hp`);
    assert.equal(characters[id].speed, CONFIG.BASE_SPEED, `${id}: speed`);
  }
});

// Deplacement: meme distance en 2 s pour un perso labKit et un perso standard, avec ou sans ennemi proche.
function run2s(id, enemyNear, dir) {
  const game = new Game({ emit: () => {} }, { characters, arena, autoTick: false });
  game.join({ id: 'a' }, { team: 'A', character: id }); game.join({ id: 'b' }, { team: 'B', character: 'biden' });
  game.start(); game.countdown = 0;
  const p = game.players.get('a'), q = game.players.get('b');
  Object.assign(p, { x: 200, y: 320, protectT: 0 });
  Object.assign(q, enemyNear ? { x: 200 + dir * -60, y: 320 } : { x: 700, y: 180 });
  q.input = { dx: 0, dy: 0 };
  game.input('a', { dx: dir, dy: 0 });
  const x0 = p.x;
  for (let i = 0; i < 40; i++) { if (enemyNear) Object.assign(q, { x: p.x + dir * -60, y: 320 }); game.tick(0.05); }
  game.dispose();
  return Math.round(Math.abs(p.x - x0));
}
test('deplacement identique pour un perso labKit et un perso standard, avec ou sans ennemi proche', () => {
  const lab = Object.keys(characters).find((id) => characters[id].labKit), std = Object.keys(characters).find((id) => !characters[id].labKit);
  assert.ok(lab && std);
  const ref = run2s(std, false, 1);
  assert.ok(ref > 300, `distance de reference ${ref}`);
  for (const id of [lab, std]) for (const near of [false, true]) {
    // s'eloigner de l'ennemi (ancien bonus de fuite) et avancer normalement
    assert.equal(run2s(id, near, 1), ref, `${id} ennemi proche=${near}`);
  }
});

test('les coups generiques au contact ne creent pas de projectile', () => {
  for (const id of IDS) {
    assert.equal(characters[id].attack.travel, undefined, `${id}: attack.travel interdit`);
    const { game: g, p } = duel(id, 400);
    assert(cast(g, p, 'attack'), `${id}: cast`);
    for (let i = 0; i < 5; i++) g.tick(0.05);
    assert.equal(g.projectiles.length, 0, `${id}: projectile cree par l attaque de base`);
    g.dispose();
  }
});
