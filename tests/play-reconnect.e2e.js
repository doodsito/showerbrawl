// Coupure reseau de 3 s sur la manette en plein match: bandeau "Reconnecting...", puis reprise du meme perso
// sans action du joueur (re-JOIN auto avec playerKey), aucune erreur JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ensureBuild } from './build-once.js';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { MSG } from '../shared/protocol.js';
import { characters, arena } from '../server/loader.js';
import { Game } from '../server/game.js';

const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright-core');
  for (const opt of [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, { channel: 'chromium' }]) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue;
    try { return await chromium.launch(opt); } catch {}
  }
  return null;
}

test('manette: coupure reseau 3 s en match -> bandeau puis reprise du meme perso', { timeout: 60000 }, async (t) => {
  await ensureBuild();
  const browser = await launch();
  if (!browser) return t.skip('aucun Chromium disponible');
  t.after(() => browser.close());

  const app = express(), http = createServer(app), io = new Server(http, { pingInterval: 5000, pingTimeout: 5000 });
  app.use(express.static(dist));
  const game = new Game(io, { characters, arena });
  t.after(() => { game.dispose(); io.close(); http.close(); });
  let blocked = false;
  io.use((s, next) => (blocked ? next(new Error('offline')) : next()));
  io.on('connection', (s) => {
    game.sendLobby(s);
    s.on(MSG.JOIN, (d, ack) => ack?.(game.join(s, d)));
    s.on(MSG.INPUT, (d) => game.input(s.id, d));
    s.on('disconnect', () => { if (!s.data.replaced) game.disconnect(s.id); });
  });
  await new Promise((r) => http.listen(0, r));
  const url = `http://127.0.0.1:${http.address().port}/play/`;

  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ch = Object.keys(characters)[0];
  await page.addInitScript((ch) => { localStorage.setItem('sb_char', ch); localStorage.setItem('sb_name', 'Ann'); sessionStorage.setItem('sb_release_rejoin', '1'); }, ch);
  await page.goto(url);

  const deadline = async (fn, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(100); } return false; };
  assert.ok(await deadline(() => game.players.size === 1), 'joueur inscrit');
  const p = [...game.players.values()][0];
  game.start();
  assert.ok(await deadline(() => game.phase === 'playing'));
  const kills = (p.kills = 2);

  // Coupure: le serveur ferme le transport et refuse toute reconnexion pendant 3 s.
  blocked = true;
  io.sockets.sockets.get(p.id).conn.close();
  assert.ok(await deadline(() => page.locator('#reconnecting').isVisible(), 3000), 'bandeau affiche pendant la coupure');
  await wait(3000);
  blocked = false;

  assert.ok(await deadline(() => page.locator('#reconnecting').isHidden()), 'bandeau retire apres reprise');
  assert.equal(game.players.size, 1);
  const q = [...game.players.values()][0];
  assert.equal(q, p, 'meme joueur cote serveur');
  assert.equal(q.character, ch); assert.equal(q.kills, kills); assert.equal(q.offline, false);
  assert.ok(await page.locator('#pad').isVisible(), 'toujours sur la manette');
  assert.ok(await page.locator('#select').isHidden(), 'pas de retour a la selection');
  assert.deepEqual(errors, []);
});
