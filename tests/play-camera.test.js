// Camera manette (CAMERA_ZOOM) en paysage iPhone 15 / Pixel 7: deux joueurs eloignes restent dans le VIEW
// quand ils sont a l'ecran, mon perso n'est jamais sous le joystick ni les boutons, aucune erreur JS.
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
  const self = last?.players.find(p=>p.id===cam.me);
  const cx = self ? 480 + (((self.x-x0)/(x1-x0))*2-1)*330 + 55 : cam.x;
  const cy = self ? 422 + (((self.y-y0)/(y1-y0))*2-1)*70 + 10 : cam.y;
  const settled = Math.hypot(cam.x-cx,cam.y-cy)<1;
  const rects = [...document.querySelectorAll('#stick .ring, .btns .btn')].map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
  return { settled, W, H, zoom: cam.zoom, tx, ty, scale, rects, me: v.camera.me, players: (last?.players || []).map((p) => ({ id: p.id, s: scr(p.x, p.y) })), pts: pts.map((p) => ({ id: p.id, s: scr(p.x, p.y) })) };
})(${JSON.stringify(pts)})`;

for (const device of ['iPhone 15 landscape', 'Pixel 7 landscape']) {
  test(`camera manette ${device}: 2 joueurs eloignes visibles, perso degage`, { timeout: 120000 }, async (t) => {
    await ensureBuild();
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
    const place = ([ax, ay], [bx, by]) => { Object.assign(a, { x: ax, y: ay, vx: 0, vy: 0 }); Object.assign(b, { x: bx, y: by, vx: 0, vy: 0 }); };
    // Loin l'un de l'autre, puis chacun colle a chaque mur (gauche, droite, haut, bas, coins de l'octogone).
    const spots = [[[140, 320], [580, 320]], [[120, 320], [420, 320]], [[300, 320], [650, 320]],
      [[88, 220], [680, 420]], [[88, 320], [680, 320]], [[88, 420], [680, 220]], [[680, 220], [88, 420]],
      [[384, 88], [384, 552]], [[384, 552], [384, 88]], [[200, 120], [570, 520]], [[200, 520], [570, 120]], [[570, 120], [200, 520]]];
    for (const [pa, pb] of spots) {
      for (let i = 0; i < 20; i++) { if (game.countdown > 0) game.countdown = 0; place(pa, pb); await wait(50); }
      for (const page of pages) {
        // Teleports in this fixture are much faster than gameplay movement. Wait for
        // the smoothed camera, including background tabs, before measuring overlap.
        let r;
        for(let i=0;i<100;i++){
          r=await page.evaluate(PROBE([a,b].map(p=>({id:p.id,x:p.x,y:p.y}))));
          if(r.settled)break;
          await wait(50);
        }
        assert.ok(r.settled,'camera stabilisee apres le placement');
        assert.ok(Math.abs(r.zoom - 1.45) < 1e-9, 'CAMERA_ZOOM applique');
        assert.ok(r.tx <= 0 && r.ty <= 0 && r.tx + 960 * r.scale >= r.W - 1 && r.ty + 540 * r.scale >= r.H - 1, 'jamais hors decor');
        const me = r.players.find((p) => p.id === r.me);
        // Boutons atteignables au pouce: dans l'ecran, hors HUD/bandeau, en colonne au bord droit (SUPER, DEFENSE, ATTACK de haut en bas).
        const ui = await page.evaluate(() => {
          const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
          const hud = box(document.querySelector('.hud')), bar = document.querySelector('#a2hs');
          return { hud, bar: bar && !bar.hidden ? box(bar) : null, btn: Object.fromEntries([...document.querySelectorAll('.btns .btn')].map((e) => [e.dataset.k, box(e)])) };
        });
        const hit = (u, v) => u.l < v.r && u.r > v.l && u.t < v.b && u.b > v.t;
        for (const [k, q] of Object.entries(ui.btn)) {
          assert.ok(q.l >= 0 && q.t >= 0 && q.r <= r.W && q.b <= r.H, `${k} dans l'ecran`);
          assert.ok(!hit(q, ui.hud), `${k} pas sous le HUD`);
          if (ui.bar) assert.ok(!hit(q, ui.bar), `${k} pas sous le bandeau`);
          assert.ok(Math.abs(q.r - ui.btn.attack.r) < 1, `${k} aligne sur le bord droit d'ATTACK`);
        }
        assert.ok(ui.btn.super.b <= ui.btn.defense.t && ui.btn.defense.b <= ui.btn.attack.t, 'colonne SUPER / DEFENSE / ATTACK');
        if (device.startsWith('iPhone')) {
          const bar = await page.evaluate(() => { const e = document.querySelector('#a2hs'), h = document.querySelector('.hud'); const r = e.getBoundingClientRect(), q = h.getBoundingClientRect(); return { hidden: e.hidden, top: r.top, bottom: r.bottom, l: r.left, r: r.right, hud: q.bottom }; });
          assert.equal(bar.hidden, false, 'bandeau iPhone affiche');
          assert.ok(bar.top >= bar.hud && bar.bottom < r.H / 2, 'bandeau en haut, sous le HUD');
          for (const q of r.rects) assert.ok(bar.bottom <= q.t || bar.r <= q.l || bar.l >= q.r, 'bandeau ne couvre pas les controles');
        }
        assert.ok(me, 'mon perso est dans le VIEW');
        for (const q of r.rects) assert.ok(!(me.s[0] >= q.l && me.s[0] <= q.r && me.s[1] >= q.t && me.s[1] <= q.b), `perso sous un controle ${JSON.stringify(q)} ${me.s}`);
        // Tout joueur a l'ecran (centre +- rayon sprite) doit etre dans le VIEW: le filtre serveur ne coupe rien au bord.
        for (const p of r.pts) {
          if (p.s[0] < -40 || p.s[0] > r.W + 40) continue;
          assert.ok(r.players.some((q) => q.id === p.id), `${p.id} a l'ecran (x=${Math.round(p.s[0])}/${r.W}) mais absent du VIEW (${device})`);
        }
      }
    }
    if (process.env.SHOT_DIR) for (const [i, page] of pages.entries()) await page.screenshot({ path: `${process.env.SHOT_DIR}/${device.replace(/ /g, '-')}-${i ? 'B' : 'A'}.png` });
    assert.deepEqual(errors, []);
  });
}
