// Ecran hote: aucune musique (lobby, combat, fin), les effets sonores restent actifs, mute coupe les SFX.
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

// Niveau RMS de la sortie audio: analyseur branche sur chaque gain qui va vers destination.
const TAP = () => {
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...rest) {
    if (dst instanceof AudioDestinationNode && this instanceof GainNode && !this.__tapped) {
      this.__tapped = true;
      const an = this.context.createAnalyser(); an.fftSize = 2048;
      orig.call(this, an);
      (window.__taps ||= []).push(an);
    }
    return orig.call(this, dst, ...rest);
  };
  window.__rms = () => {
    let best = 0; const d = new Float32Array(2048);
    for (const an of window.__taps || []) { an.getFloatTimeDomainData(d); let s = 0; for (const x of d) s += x * x; best = Math.max(best, Math.sqrt(s / d.length)); }
    return best;
  };
};

test('plus aucun fichier ni module de musique', () => {
  assert.equal(existsSync(`${root}/client/public/sounds/music_circus.mp3`), false);
  assert.equal(existsSync(`${root}/client/music.js`), false);
});

test('host: silence au lobby et en combat (pas de musique), SFX joues, mute', { timeout: 120000 }, async (t) => {
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
  await page.addInitScript(TAP);
  const logs = [], errors = [], requests = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url);
  await page.mouse.click(5, 5); // premier geste: deblocage audio
  await wait(1500);
  const lobbyRms = await page.evaluate(() => window.__rms());
  assert.ok(lobbyRms < 0.002, `son au lobby: ${lobbyRms}`);

  const c = ioc(url, { transports: ['websocket'] }); t.after(() => c.close());
  await new Promise((ok) => c.on('connect', () => c.emit(MSG.JOIN, { character: 'musk', name: 'M' }, ok)));
  await page.click('#start');
  await wait(4500); // compte a rebours
  const idleRms = await page.evaluate(() => window.__rms());
  assert.ok(idleRms < 0.002, `musique en combat: ${idleRms}`);

  c.emit(MSG.INPUT, { dx: 0, dy: 0, attack: true });
  let peak = 0;
  for (let i = 0; i < 10; i++) { await wait(60); peak = Math.max(peak, await page.evaluate(() => window.__rms())); }
  c.emit(MSG.INPUT, { dx: 0, dy: 0 });
  assert.ok(peak > 0.003, `lance-flammes inaudible: ${peak}`);
  assert.ok(logs.some((l) => l.includes('[sfx] fichier joue musk_attack.mp3 x 0.22')), logs.join('\n'));

  await page.click('#mute');
  assert.ok(logs.some((l) => l.includes('[sfx] muted true')));
  await wait(1200);
  c.emit(MSG.INPUT, { dx: 0, dy: 0, attack: true });
  let mutedPeak = 0;
  for (let i = 0; i < 8; i++) { await wait(60); mutedPeak = Math.max(mutedPeak, await page.evaluate(() => window.__rms())); }
  assert.ok(mutedPeak < 0.002, `mute inefficace: ${mutedPeak}`);

  assert.ok(!logs.some((l) => l.includes('[music]')), 'log musique');
  assert.ok(!requests.some((u) => u.includes('music_')), 'fichier musique demande');
  assert.deepEqual(errors, []);
});
