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

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright-core');
  const tries = [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, { channel: 'chromium' }];
  for (const opt of tries) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue;
    try { return await chromium.launch(opt); } catch {}
  }
  return null;
}

// iPhone 15: double-tap ATTACK, joystick + bouton, focus pseudo, mort puis reapparition.
// visualViewport.scale reste 1, zoom camera fixe, aucune erreur JS.
test('manette iPhone 15: aucun zoom page ni camera', { timeout: 120000 }, async (t) => {
  await ensureBuild();
  const browser = await launch();
  if (!browser) return t.skip('aucun Chromium disponible');
  t.after(() => browser.close());
  const { devices } = await import('playwright-core');
  const { defaultBrowserType, ...profile } = devices['iPhone 15 landscape'];
  const app = express(), http = createServer(app), io = new Server(http);
  app.use(express.static(dist));
  const game = new Game(io, { characters, arena });
  t.after(() => { game.dispose?.(); io.close(); http.close(); });
  io.on('connection', (s) => {
    game.sendLobby(s);
    s.on(MSG.JOIN, (d, ack) => ack?.(game.join(s, d)));
    s.on(MSG.INPUT, (d) => game.input(s.id, d));
    s.on('disconnect', () => game.leave(s.id));
  });
  await new Promise((r) => http.listen(0, r));
  const url = `http://127.0.0.1:${http.address().port}/play/`;
  const errors = [];
  const ctx = await browser.newContext(profile);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const ch = Object.keys(characters)[0];
  await page.addInitScript((ch) => { localStorage.setItem('sb_char', ch); }, ch);
  await page.goto(url);
  const scale = () => page.evaluate(() => window.visualViewport?.scale ?? 1);
  const zoom = () => page.evaluate(() => window.showerBrawlView?.camera.zoom);
  // focus du champ pseudo
  await page.waitForSelector('#name');
  const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#name')).fontSize));
  assert.ok(fs >= 16, `pseudo >= 16px (${fs})`);
  await page.tap('#name'); await wait(200);
  assert.equal(await scale(), 1, 'echelle 1 au focus');
  await page.evaluate(() => document.querySelector('#name').blur());
  await page.evaluate(() => { localStorage.setItem('sb_team', 'A'); sessionStorage.setItem('sb_release_rejoin', '1'); });
  await page.reload();
  for (let i = 0; i < 50 && game.players.size < 1; i++) await wait(100);
  assert.equal(game.players.size, 1, 'manette rejointe');
  game.start(); game.countdown = 0;
  await page.waitForFunction(() => window.showerBrawlView?.camera.ready, null, { timeout: 15000 });
  const z0 = await zoom();
  assert.ok(Math.abs(z0 - 1.4) < 1e-9, 'CAMERA_ZOOM');
  // double-tap rapide sur ATTACK
  const cdp = await ctx.newCDPSession(page);
  const center = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const atk = await center('.btn[data-k="attack"]'), stk = await center('#stick .ring');
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  for (let i = 0; i < 2; i++) { await touch('touchStart', [atk]); await touch('touchEnd', []); await wait(80); }
  assert.equal(await scale(), 1, 'echelle 1 apres double-tap');
  // joystick + bouton en meme temps, avec deplacement a deux doigts
  await touch('touchStart', [{ ...stk, id: 1 }]);
  await touch('touchStart', [{ ...stk, id: 1 }, { ...atk, id: 2 }]);
  for (let k = 1; k <= 5; k++) await touch('touchMove', [{ x: stk.x + k * 8, y: stk.y - k * 4, id: 1 }, { x: atk.x - k * 6, y: atk.y + k * 3, id: 2 }]);
  await touch('touchEnd', []);
  assert.equal(await scale(), 1, 'echelle 1 apres joystick + bouton');
  assert.equal(await zoom(), z0, 'zoom camera inchange');
  // mort puis reapparition: camera reste, zoom fixe
  const me = [...game.players.values()][0];
  const before = await page.evaluate(() => ({ ...window.showerBrawlView.camera }));
  game.kill(me, null);
  await wait(300);
  const dead = await page.evaluate(() => ({ ...window.showerBrawlView.camera }));
  assert.ok(Math.hypot(dead.x - before.x, dead.y - before.y) < 40, 'camera reste pres du dernier point pendant la mort');
  assert.equal(dead.zoom, z0);
  const samples = [];
  for (let i = 0; i < 80 && !me.alive; i++) await wait(100);
  assert.ok(me.alive, 'reapparition');
  for (let i = 0; i < 20; i++) { samples.push(await page.evaluate(() => ({ ...window.showerBrawlView.camera }))); await wait(30); }
  for (let i = 1; i < samples.length; i++) {
    assert.equal(samples[i].zoom, z0, 'zoom fixe apres reapparition');
    assert.ok(Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y) < 120, 'pas de saut brutal');
  }
  assert.equal(await scale(), 1, 'echelle 1 en fin de test');
  assert.deepEqual(errors, []);
});
