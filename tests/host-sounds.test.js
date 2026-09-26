// Sons de l'ecran hote: match Trump (A) contre Biden (B) dans Chromium, sons MP3 et repli synthetise.
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
    try { return await chromium.launch({ ...opt, args: ['--autoplay-policy=no-user-gesture-required'] }); } catch {}
  }
  return null;
}

test('host joue les MP3 de Trump, le synthe pour Biden et fx_victory', { timeout: 120000 }, async (t) => {
  await ensureBuild();
  const browser = await launch();
  if (!browser) return t.skip('aucun Chromium disponible');
  t.after(() => browser.close());

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
  const logs = [], errors = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.mouse.click(5, 5); // premier geste: deblocage audio + prechargement

  const join = async (team, character) => {
    const c = ioc(url, { transports: ['websocket'] });
    t.after(() => c.close());
    const r = await new Promise((ok) => c.on('connect', () => c.emit(MSG.JOIN, { team, character, name: character }, ok)));
    assert.ok(r.ok, `${character}: ${r.error}`);
    return c;
  };
  const trump = await join('A', 'trump'), biden = await join('B', 'biden');
  await page.waitForFunction(() => document.querySelector('#start'));
  await wait(1500); // decodage des MP3
  await page.click('#start');
  await wait(300);
  game.countdown = 0;
  for (let i = 0; i < 50 && !logs.some((l) => l.includes('premier STATE')); i++) await wait(100);

  for (const [c, id] of [[trump, trump.id], [biden, biden.id]]) {
    for (const slot of ['attack', 'defense', 'super']) {
      const p = game.players.get(id); p.energy = 100; for (const k in p.cd) p.cd[k] = 0; p.stunT = 0;
      c.emit(MSG.INPUT, { dx: 0, dy: 0, [slot]: true });
      await wait(250);
      c.emit(MSG.INPUT, { dx: 0, dy: 0 });
      await wait(250);
    }
  }
  game.score.A = 1; game.end();
  await wait(1000);

  for (const slot of ['attack', 'defense', 'super']) {
    assert.ok(logs.some((l) => l.includes(`[sfx] fichier joue trump_${slot}.mp3`)), `trump_${slot} non joue\n${logs.join('\n')}`);
    assert.ok(logs.some((l) => l.includes(`[sfx] synth biden_${slot}`)), `biden_${slot} pas en synthe`);
  }
  assert.ok(!logs.some((l) => l.includes('fichier joue biden_')));
  assert.ok(logs.some((l) => l.includes('[sfx] fichier joue fx_victory.mp3')), 'fx_victory non joue');
  assert.deepEqual(errors, []);
});
