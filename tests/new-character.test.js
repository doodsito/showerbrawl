// Un perso inconnu du code doit marcher uniquement via sa config (pas d'id en dur dans le moteur ni le rendu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Game } from '../server/game.js';
import { normalizeCharacters, arena } from '../server/loader.js';
import { cast } from '../server/abilities.js';
import { CONFIG } from '../shared/config.js';
import { spriteLayout } from '../client/sprite-layout.js';

const raw = JSON.parse(readFileSync(new URL('../shared/characters.json', import.meta.url), 'utf8'));
const TEST = {
  name: 'Test', hp: 100, speed: 190, sprite: 'sprites/musk.png', fullBody: true, hint: 'Perso de test',
  attack: { type: 'projectile', damage: 10, range: 75, knockback: 220, cooldown: 0.3, label: 'Coup test' },
  defense: { type: 'dash', distance: 160, duration: 0.2, damage: 7, knockback: 300, cooldown: 3, label: 'Charge test' },
  super: { type: 'burst', radius: 140, damage: 20, knockback: 450, cooldown: 10, label: 'Onde test' },
};

test('le faux perso "test" n\'est pas dans characters.json (il vit seulement dans ce test)', () => {
  assert.equal(raw.test, undefined);
});

test('perso "test" ajoute par config: charge, rendu en pied et 3 capacites sans toucher au code', (t) => {
  const characters = normalizeCharacters({ ...raw, test: TEST });
  const ch = characters.test;
  // chargement: tous les champs transmis, types valides
  assert.ok(ch, 'charge');
  assert.equal(ch.fullBody, true); assert.equal(ch.hint, 'Perso de test');
  assert.deepEqual([ch.attack.type, ch.defense.type, ch.super.type], ['projectile', 'dash', 'burst']);
  // sprite PNG existant, dessine en pied a la meme taille que les persos fullBody existants
  assert.ok(existsSync(new URL('../client/public/' + ch.sprite, import.meta.url)), 'PNG present');
  const layout = spriteLayout(ch, true);
  assert.equal(layout.full, true);
  assert.equal(layout.h, spriteLayout(characters.trump, true).h, 'meme taille que Trump');

  const events = [];
  const game = new Game({ emit: (name, data) => events.push({ name, data }) }, { characters, arena, autoTick: false, fixedTeams: true });
  t.after(() => game.dispose());
  game.join({ id: 'a' }, { team: 'A', character: 'test' }); game.join({ id: 'b' }, { team: 'B', character: 'biden' });
  game.start(); game.countdown = 0;
  const p = game.players.get('a'), q = game.players.get('b');
  Object.assign(p, { x: 300, y: 320, protectT: 0, fx: 1, fy: 0 }); Object.assign(q, { x: 345, y: 320, protectT: 0 });

  // attaque au contact
  assert.ok(cast(game, p, 'attack')); assert.equal(q.hp, q.maxHp - CONFIG.BASE_ATTACK.damage, 'attaque de base standard');
  // charge: part vers l'ennemi, le frappe et le pousse
  Object.assign(q, { x: 420 }); const hpBefore = q.hp;
  assert.ok(cast(game, p, 'defense'));
  for (let i = 0; i < 30; i++) game.tick(0.01);
  assert.equal(q.hp, hpBefore - 7);
  // super: onde de choc au sol centree sur le lanceur
  Object.assign(p, { x: 300 }); Object.assign(q, { x: 380, hp: 110 });
  assert.ok(cast(game, p, 'super')); assert.equal(q.hp, 110 - 20);
  assert.ok(game.effects.some((e) => e.kind === 'shockwave'));
  assert.equal(game.projectiles.length, 0, 'rien ne vole');
  // les 3 capacites sont annoncees avec leurs labels
  game.broadcast();
  const labels = events.filter((e) => e.name === 'state').flatMap((e) => e.data.events || []).filter((e) => e.k === 'cast').map((e) => e.label);
  assert.deepEqual(labels, ['Coup test', 'Charge test', 'Onde test']);
});
