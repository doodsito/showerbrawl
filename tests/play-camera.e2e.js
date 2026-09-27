// Camera manette fixe en paysage iPhone 15 / Pixel 7: a 4 contre 4, tous les persos (sprite + nom) sont a l'ecran
// quelle que soit leur position sur le toit, tous presents dans le VIEW, controles en place, aucune erreur JS.
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
  const tries = [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, { channel: 'chromium' }];
  for (const opt of tries) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue;
    try { return await chromium.launch(opt); } catch {}
  }
  return null;
}

// Projection monde -> ecran telephone (px CSS), memes formules que client/scene.js (worldToScreen + camera.fit).
const PROBE = (pts) => `((pts) => {
  const v = window.showerBrawlView, cam = v.camera, last = window.__lastView;
  const c = document.querySelector('#view'), W = c.clientWidth, H = c.clientHeight, k = c.width / W;
  const cs = 64, g = window.__arena.grid; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  g.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.') return; x0 = Math.min(x0, i * cs); y0 = Math.min(y0, r * cs); x1 = Math.max(x1, (i + 1) * cs); y1 = Math.max(y1, (r + 1) * cs); }));
  const f = cam.fit;
  const scr = (x, y) => { const nx = ((x - x0) / (x1 - x0)) * 2 - 1, ny = ((y - y0) / (y1 - y0)) * 2 - 1; return [(f.tx + (480 + nx * 330) * f.scale) / k, (f.ty + (422 + ny * 70) * f.scale) / k, f.scale / k]; };
  return { ready: !!f && cam.ready, W, H, me: cam.me, view: (last?.players || []).map((p) => p.id), pts: pts.map((p) => ({ id: p.id, s: scr(p.x, p.y) })) };
})(${JSON.stringify(pts)})`;

for (const device of ['iPhone 15 landscape', 'Pixel 7 landscape']) {
  test(`camera manette fixe ${device}: 4 contre 4, tous les persos visibles`, { timeout: 180000 }, async (t) => {
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

    const errors = [], pages = [], names = Object.keys(characters);
    for (let i = 0; i < 8; i++) {
      const team = i % 2 ? 'B' : 'A', ch = names[i % names.length];
      const ctx = await browser.newContext(profile);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${i}: ${e.message}`));
      await page.addInitScript(({ team, ch, arena, i }) => {
        localStorage.setItem('sb_team', team); localStorage.setItem('sb_char', ch); localStorage.setItem('sb_name', 'P' + i); sessionStorage.setItem('sb_release_rejoin', '1');
        window.__arena = arena;
        const iv = setInterval(() => { const v = window.showerBrawlView; if (!v) return; clearInterval(iv); const push = v.push; v.push = (m) => { window.__lastView = m; push(m); }; }, 5);
      }, { team, ch, arena, i });
      await page.goto(url);
      pages.push(page);
    }
    for (let i = 0; i < 100 && game.players.size < 8; i++) await wait(100);
    assert.equal(game.players.size, 8, 'les huit manettes ont rejoint');
    game.start();
    const ps = [...game.players.values()];
    let pinned = null;
    const place = (pos) => ps.forEach((p, i) => Object.assign(p, { x: pos[i][0], y: pos[i][1], vx: 0, vy: 0 }));
    const tick = game.tick.bind(game);
    game.tick = (e) => { game.countdown = 0; game.timeLeft = 999; tick(e); if (pinned) place(pinned); for (const p of ps) Object.assign(p, { alive: true, hp: p.maxHp, launch: null, kbVx: 0, kbVy: 0, respawnT: 0 }); };
    // Sol du toit: x 64..704, y 64..512 (etroit en haut/bas). Coins, bords, centre, alignements extremes.
    const layouts = [
      [[90, 200], [680, 200], [90, 440], [680, 440], [384, 90], [384, 490], [250, 320], [520, 320]],
      [[90, 320], [680, 320], [200, 150], [570, 150], [200, 470], [570, 470], [384, 250], [384, 390]],
      [[90, 260], [90, 380], [680, 260], [680, 380], [300, 90], [470, 90], [300, 490], [470, 490]],
    ];
    for (const pos of layouts) {
      pinned = pos; place(pos);
      await wait(500);
      for (const page of pages) {
        let r;
        for (let i = 0; i < 60; i++) { r = await page.evaluate(PROBE(ps.map((p) => ({ id: p.id, x: p.x, y: p.y })))); if (r.ready && r.view.length === 8) break; await wait(50); }
        assert.ok(r.ready, 'cadrage calcule');
        assert.deepEqual([...r.view].sort(), ps.map((p) => p.id).sort(), 'tous les joueurs dans le VIEW');
        for (const p of r.pts) {
          const [x, y, s] = p.s;
          // Boite du perso: sprite +-35 decor px en largeur, pieds a nom (~135 decor px au-dessus).
          assert.ok(x - 35 * s >= 0 && x + 35 * s <= r.W, `${p.id} hors ecran en x (${Math.round(x)}/${r.W}, ${device})`);
          assert.ok(y - 135 * s >= 0 && y + 8 * s <= r.H, `${p.id} hors ecran en y (${Math.round(y)}/${r.H}, ${device})`);
        }
      }
    }
    const ui = await pages[0].evaluate(() => {
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      return { W: innerWidth, H: innerHeight, btn: Object.fromEntries([...document.querySelectorAll('.btns .btn')].map((e) => [e.dataset.k, box(e)])), stick: box(document.querySelector('#stick .ring')) };
    });
    for (const [k, q] of Object.entries(ui.btn)) assert.ok(q.l >= 0 && q.t >= 0 && q.r <= ui.W && q.b <= ui.H, `${k} dans l'ecran`);
    assert.ok(ui.btn.super.b <= ui.btn.defense.t && ui.btn.defense.b <= ui.btn.attack.t, 'colonne SUPER / DEFENSE / ATTACK');
    if (process.env.SHOT_DIR) for (const [i, page] of pages.entries()) if (i < 2) await page.screenshot({ path: `${process.env.SHOT_DIR}/${device.replace(/ /g, '-')}-${i}.png` });
    assert.deepEqual(errors, []);
  });
}
