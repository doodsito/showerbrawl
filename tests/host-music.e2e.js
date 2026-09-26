// Musique de l'ecran hote: chiptune au lobby, music_circus.mp3 en combat, retour chiptune, mute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
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

// Niveau RMS de la sortie musique: analyseur branche sur chaque gain qui va vers destination.
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

test('music_circus.mp3 compresse: mono, moins de 700 Ko', () => {
  assert.ok(statSync(`${root}/client/public/sounds/music_circus.mp3`).size < 700 * 1024);
});

test('host: chiptune au lobby, MP3 en combat, retour lobby, mute', { timeout: 120000 }, async (t) => {
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
  const logs = [], errors = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.mouse.click(5, 5); // premier geste: deblocage audio + chargement du MP3
  const until = async (s, ms = 8000) => { for (let i = 0; i < ms / 100 && !logs.some((l) => l.includes(s)); i++) await wait(100); return logs.some((l) => l.includes(s)); };

  assert.ok(await until('[music] playing lobby'), logs.join('\n'));
  assert.ok(await until('[music] combat track loaded'), logs.join('\n'));
  await wait(800);
  const lobbyRms = await page.evaluate(() => window.__rms());

  const c = ioc(url, { transports: ['websocket'] }); t.after(() => c.close());
  await new Promise((ok) => c.on('connect', () => c.emit(MSG.JOIN, { team: 'A', character: 'trump', name: 'T' }, ok)));
  await page.click('#start');
  assert.ok(await until('[music] playing combatTrack'), logs.join('\n'));
  await wait(1500);
  const combatRms = await page.evaluate(() => window.__rms());
  console.log('rms lobby', lobbyRms.toFixed(4), 'combat', combatRms.toFixed(4));
  assert.ok(combatRms > 0.005, 'combat silencieux');
  assert.ok(!logs.some((l) => l.includes('[music] playing combat') && !l.includes('combatTrack')), 'chiptune de combat jouee alors que le MP3 etait pret');

  const n = logs.length;
  game.score.A = 1; game.end();
  assert.ok(await until('[music] playing lobby'), logs.slice(n).join('\n'));

  await page.click('#mute');
  assert.ok(await until('[music] muted true'));
  await wait(600);
  const mutedRms = await page.evaluate(() => window.__rms());
  assert.ok(mutedRms < 0.002, `mute inefficace: ${mutedRms}`);
  await page.click('#mute');
  assert.ok(await until('[music] muted false'));
  assert.deepEqual(errors, []);
});
