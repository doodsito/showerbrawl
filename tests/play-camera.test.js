// Camera manette (CAMERA_ZOOM) en paysage iPhone 15 / Pixel 7: deux joueurs eloignes restent dans le VIEW
// quand ils sont a l'ecran, mon perso n'est jamais sous le joystick ni les boutons, aucune erreur JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
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

// Projection monde -> ecran telephone, memes formules que client/scene.js (worldToScreen + camera).
const PROBE = (pts) => `((pts) => {
  const v = window.showerBrawlView, cam = v.camera, last = window.__lastView;
  const c = document.querySelector('#view'), W = c.clientWidth, H = c.clientHeight;
  const cs = 64, g = window.__arena.grid; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  g.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.') return; x0 = Math.min(x0, i * cs); y0 = Math.min(y0, r * cs); x1 = Math.max(x1, (i + 1) * cs); y1 = Math.max(y1, (r + 1) * cs); }));
  const scale = Math.max(W / 960, H / 540) * cam.zoom;
  const tx = Math.min(0, Math.max(W - 960 * scale, W / 2 - cam.x * scale));
  const ty = Math.min(0, Math.max(H - 540 * scale, H / 2 - cam.y * scale));
  const scr = (x, y) => { const nx = ((x - x0) / (x1 - x0)) * 2 - 1, ny = ((y - y0) / (y1 - y0)) * 2 - 1; return [tx + (480 + nx * 330) * scale, ty + (422 + ny * 70) * scale]; };
  const rects = [...document.querySelectorAll('#stick .ring, .btns .btn')].map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
  return { W, H, zoom: cam.zoom, tx, ty, scale, rects, me: v.camera.me, players: (last?.players || []).map((p) => ({ id: p.id, s: scr(p.x, p.y) })), pts: pts.map((p) => ({ id: p.id, s: scr(p.x, p.y) })) };
})(${JSON.stringify(pts)})`;

for (const device of ['iPhone 15 landscape', 'Pixel 7 landscape']) {
  test(`camera manette ${device}: 2 joueurs eloignes visibles, perso degage`, { timeout: 120000 }, async (t) => {
    if (!existsSync(`${dist}/index.html`)) execSync('npx vite build', { cwd: root, stdio: 'ignore' });
    const browser = await launch();
    if (!browser) return t.skip('aucun Chromium disponible');
    t.after(() => browser.close());
    const { devices } = await import('playwright-core');
    const { defaultBrowserType, ...profile } = devices[device];

    const app = express(), http = createServer(app), io = new Server(http);
    app.use(express.static(dist));
    const game = new Game(io, { characters, arena });
    t.after(() => { game.dispose?.(); io.close(); http.close(); });
    io.on('connection', (s) => {
      game.sendLobby(s);
      s.on(MSG.JOIN, (d, ack) => ack?.(game.join(s, d)));
      s.on(MSG.INPUT, (d) => game.input(s.id, d));
      s.on(MSG.START, (ack) => { game.start(); ack?.({ ok: true }); });
      s.on('disconnect', () => game.leave(s.id));
    });
    await new Promise((r) => http.listen(0, r));
    const url = `http://127.0.0.1:${http.address().port}/play/`;

    const errors = [], pages = [];
    const [chA, chB] = Object.keys(characters);
    for (const [team, ch] of [['A', chA], ['B', chB]]) {
      const ctx = await browser.newContext(profile);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${team}: ${e.message}`));
      await page.addInitScript(({ team, ch, arena }) => {
        localStorage.setItem('sb_team', team); localStorage.setItem('sb_char', ch); sessionStorage.setItem('sb_release_rejoin', '1');
        window.__arena = arena;
        const iv = setInterval(() => { const v = window.showerBrawlView; if (!v) return; clearInterval(iv); const push = v.push; v.push = (m) => { window.__lastView = m; push(m); }; }, 5);
      }, { team, ch, arena });
      await page.goto(url);
      pages.push(page);
    }
    for (let i = 0; i < 50 && game.players.size < 2; i++) await wait(100);
    assert.equal(game.players.size, 2, 'les deux manettes ont rejoint');
    game.start();
    const [a, b] = [...game.players.values()];
    // Eloignes au maximum sur l'axe x dans l'arene (x de 64 a 704).
    const place = (ax, bx) => { Object.assign(a, { x: ax, y: 320, vx: 0, vy: 0 }); Object.assign(b, { x: bx, y: 320, vx: 0, vy: 0 }); };
    for (const [ax, bx] of [[140, 580], [120, 420], [300, 650], [90, 600], [640, 100]]) {
      for (let i = 0; i < 20; i++) { if (game.countdown > 0) game.countdown = 0; place(ax, bx); await wait(50); }
      for (const page of pages) {
        const r = await page.evaluate(PROBE([a, b].map((p) => ({ id: p.id, x: p.x, y: p.y }))));
        assert.ok(Math.abs(r.zoom - 1.4) < 1e-9, 'CAMERA_ZOOM applique');
        assert.ok(r.tx <= 0 && r.ty <= 0 && r.tx + 960 * r.scale >= r.W - 1 && r.ty + 540 * r.scale >= r.H - 1, 'jamais hors decor');
        const me = r.players.find((p) => p.id === r.me);
        assert.ok(me, 'mon perso est dans le VIEW');
        for (const q of r.rects) assert.ok(!(me.s[0] >= q.l && me.s[0] <= q.r && me.s[1] >= q.t && me.s[1] <= q.b), `perso sous un controle ${JSON.stringify(q)} ${me.s}`);
        // Tout joueur a l'ecran (centre +- rayon sprite) doit etre dans le VIEW: le filtre serveur ne coupe rien au bord.
        for (const p of r.pts) {
          if (p.s[0] < -40 || p.s[0] > r.W + 40) continue;
          assert.ok(r.players.some((q) => q.id === p.id), `${p.id} a l'ecran (x=${Math.round(p.s[0])}/${r.W}) mais absent du VIEW (${device})`);
        }
      }
    }
    assert.deepEqual(errors, []);
  });
}
