import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';

const ids = Object.keys(characters);
function setup(t, n) {
  const lobbies = [];
  const game = new Game({ emit: (name, data) => { if (name === 'lobby') lobbies.push(data); } }, { characters, arena, autoTick: false });
  t.after(() => game.dispose());
  for (let i = 0; i < n; i++) assert.equal(game.join({ id: 'p' + i }, { character: ids[i % ids.length], team: 'A' }).ok, true);
  return { game, lobbies };
}
const counts = (g) => { const c = { A: 0, B: 0 }; for (const p of g.players.values()) c[p.team]++; return c; };

test('join places each player in the smallest team and ignores client team', (t) => {
  const { game } = setup(t, 0);
  for (let i = 0; i < 8; i++) {
    game.join({ id: 'p' + i }, { character: ids[i], team: 'A' });
    const c = counts(game); assert.ok(Math.abs(c.A - c.B) <= 1, JSON.stringify(c));
  }
  assert.deepEqual(counts(game), { A: 4, B: 4 });
});

test('every START redraws balanced teams, keeps characters and sends the lobby', (t) => {
  const { game, lobbies } = setup(t, 7);
  const chars = new Map([...game.players.values()].map((p) => [p.id, p.character]));
  for (let i = 0; i < 20; i++) {
    const before = lobbies.length;
    game.start();
    const c = counts(game); assert.ok(Math.abs(c.A - c.B) <= 1);
    for (const p of game.players.values()) assert.equal(p.character, chars.get(p.id));
    const last = lobbies.at(-1); assert.ok(lobbies.length > before);
    assert.equal(last.teams.A.length, c.A); assert.equal(last.teams.B.length, c.B);
    game.reset();
  }
});

test('over 200 draws with 8 players, each player lands in both teams', (t) => {
  const { game } = setup(t, 8);
  const seen = new Map([...game.players.keys()].map((id) => [id, new Set()]));
  for (let i = 0; i < 200; i++) { game.start(); for (const p of game.players.values()) seen.get(p.id).add(p.team); game.reset(); }
  for (const [id, s] of seen) assert.equal(s.size, 2, id);
});

test('auto-balance: 1 to 8 joins give 1/0, 1/1, 2/1, 2/2, 3/2 ... (serveur autoritaire)', (t) => {
  const { game } = setup(t, 0);
  for (let i = 0; i < 8; i++) {
    game.join({ id: 'p' + i }, { character: ids[i], team: 'B' });
    const c = counts(game), n = i + 1;
    assert.equal(c.A + c.B, n);
    assert.equal(Math.max(c.A, c.B), Math.ceil(n / 2), JSON.stringify(c));
  }
});

test('auto-balance: a leaver is replaced in the team that lost a player, rejoin keeps balance', (t) => {
  const { game } = setup(t, 5);
  const c0 = counts(game); const big = c0.A > c0.B ? 'A' : 'B', small = big === 'A' ? 'B' : 'A';
  const victim = [...game.players.values()].find((p) => p.team === big);
  game.leave(victim.id);
  assert.deepEqual(counts(game), { A: 2, B: 2 });
  const leaver = [...game.players.values()].find((p) => p.team === small);
  game.leave(leaver.id);
  game.join({ id: 'new' }, { character: ids[5], team: big });
  assert.equal(game.players.get('new').team, small, 'le nouveau rejoint l equipe en sous-effectif');
  game.leave('new');
  game.join({ id: 'back' }, { character: ids[5] });
  assert.equal(game.players.get('back').team, small, 'reconnexion (nouveau socket) equilibree aussi');
});

test('auto-balance: ties alternate instead of always favouring one team', (t) => {
  const firsts = { A: 0, B: 0 };
  for (let r = 0; r < 20; r++) {
    const { game } = setup(t, 0);
    const got = [];
    for (let i = 0; i < 6; i += 2) {
      game.join({ id: 'a' + i }, { character: ids[i] }); got.push(game.players.get('a' + i).team);
      game.join({ id: 'b' + i }, { character: ids[i + 1] });
    }
    assert.notEqual(got[0], got[1], JSON.stringify(got)); assert.equal(got[0], got[2]);
    firsts[got[0]]++;
  }
  assert.ok(firsts.A > 0 && firsts.B > 0, JSON.stringify(firsts));
});
