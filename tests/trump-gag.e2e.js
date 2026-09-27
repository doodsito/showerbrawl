// Gag de fin "TRUMP WINS. AS ALWAYS." en vrai match: hote + 2 manettes, timer a 0, VICTORY puis gag a 2,5 s avec 3 images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { ensureBuild } from './build-once.js';
import { MSG } from '../shared/protocol.js';
import { CONFIG } from '../shared/config.js';
import { characters, arena } from '../server/loader.js';
import { Game } from '../server/game.js';

const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright-core');
  const tries = [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, { channel: 'chromium' }];
  for (const opt of tries) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue;
    try { return await chromium.launch({ ...opt, args: ['--autoplay-policy=no-user-gesture-required'] }); } catch {}
  }
  return null;
}

test('gag Trump en fin de vrai match', { timeout: 120000 }, async (t) => {
  await ensureBuild();
  const browser = await launch();
  if (!browser) return t.skip('aucun Chromium disponible');
  t.after(() => browser.close());
  const saved = CONFIG.MATCH_DURATION; CONFIG.MATCH_DURATION = 3; // test seulement
  t.after(() => { CONFIG.MATCH_DURATION = saved; });

  const app = express(), http = createServer(app), io = new Server(http);
  app.use(express.static(dist));
  const game = new Game(io, { characters, arena });
  t.after(() => { game.dispose?.(); io.close(); http.close(); });
  io.on('connection', (s) => {
    game.sendLobby(s);
    s.on(MSG.HOST, () => { s.join('hosts'); game.sendLobby(s); });
    s.on(MSG.JOIN, (d, ack) => ack?.(game.join(s, d)));
    s.on(MSG.INPUT, (d) => game.input(s.id, d));
    s.on(MSG.START, (ack) => { game.start(); ack?.({ ok: true }); });
    s.on('disconnect', () => game.leave(s.id));
  });
  await new Promise((r) => http.listen(0, r));
  const url = `http://127.0.0.1:${http.address().port}`;

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(url);
  const join = async (team, character) => {
    const c = ioc(url, { transports: ['websocket'] });
    t.after(() => c.close());
    const r = await new Promise((ok) => c.on('connect', () => c.emit(MSG.JOIN, { team, character, name: character }, ok)));
    assert.ok(r.ok, `${character}: ${r.error}`);
  };
  await join('A', 'trump'); await join('B', 'biden');
  await page.waitForSelector('#start');
  await page.evaluate(() => { window.__endAt = 0; window.__sbHostSocket.on('end', () => { window.__endAt = performance.now(); }); });
  await page.click('#start');

  await page.waitForFunction(() => window.__endAt > 0, null, { timeout: 30000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#end')).display !== 'none', null, { timeout: 2000 });
  assert.match(await page.textContent('#endBox'), /VICTORY|MATCH OVER/);
  await wait(1500);
  assert.ok(!(await page.$eval('#end', (e) => e.classList.contains('trump-win'))), 'gag trop tot');

  await wait(2500); // ~4 s apres la fin: gag complet (tampon a 3,95 s)
  const st = await page.evaluate(() => {
    const cv = document.querySelector('#gag canvas');
    const imgs = ['trump_win_pose', 'trump_win_banner', 'rigged_stamp'].map((n) => {
      const e = performance.getEntriesByType('resource').find((r) => r.name.includes(n));
      return { n, loaded: !!e };
    });
    let lit = 0;
    if (cv && cv.width) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 200) lit++; }
    return { canvas: !!cv, trump: document.querySelector('#end').classList.contains('trump-win'), endShown: getComputedStyle(document.querySelector('#end')).display, imgs, lit };
  });
  console.log(JSON.stringify(st));
  assert.ok(st.canvas && st.trump, 'gag absent');
  for (const i of st.imgs) assert.ok(i.loaded, `${i.n} non charge`);
  assert.ok(st.lit > 100, 'canvas du gag vide');
  await wait(2000); // gag toujours la avant le retour lobby (11 s)
  assert.ok(await page.$('#gag canvas'), 'gag coupe avant le retour lobby');
  await page.screenshot({ path: process.env.GAG_SHOT || '/tmp/gag.png' });
  assert.deepEqual(errors.filter((e) => /gag/i.test(e)), []);

  // Raccourci debug: ?debug=1 puis G rejoue le gag tout de suite.
  const dbg = await browser.newPage();
  await dbg.goto(url + '/?debug=1'); await dbg.waitForSelector('#start');
  await dbg.keyboard.press('g'); await wait(1500);
  assert.ok(await dbg.$eval('#end', (e) => e.classList.contains('trump-win')) && await dbg.$('#gag canvas'), 'touche G sans effet');
});
