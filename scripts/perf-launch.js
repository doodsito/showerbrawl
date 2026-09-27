// Mesure du lancement d'un match a 8 joueurs: temps de chaque frame sur l'hote (1440x900) et sur une manette
// iPhone 15 (CPU ralenti x4), des le START jusqu'a FIGHT! + 10 s, avec la cause des frames > 50 ms (trace Performance).
// Usage: npm run build && node scripts/perf-launch.js [sortie.json]
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { io as ioc } from 'socket.io-client';
import { chromium } from 'playwright-core';
import { MSG } from '../shared/protocol.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3000 + 100 + Math.floor(Math.random() * 800);
const URL_ = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const COUNTDOWN_MS = 3000, MATCH_MS = 10000, LONG = 50;
const PHONE_CHAR = 'trump';
const BOT_CHARS = ['biden', 'musk', 'obama', 'harris', 'maduro', 'xi', 'macron'];

// Instrumentation en page: frames rAF + appels synchrones couteux (getImageData, canvas, decodeAudioData, JSON.parse, decode).
const PROBE = () => {
  const P = (window.__perf = { frames: [], calls: [], rec: false });
  const now = () => performance.now();
  const wrap = (obj, name, label) => {
    const orig = obj?.[name]; if (typeof orig !== 'function') return;
    obj[name] = function (...a) {
      const t0 = now();
      try { return orig.apply(this, a); } finally { const d = now() - t0; if (P.rec && d > 0.5) P.calls.push({ n: label, t: t0, d }); }
    };
  };
  wrap(CanvasRenderingContext2D.prototype, 'getImageData', 'getImageData');
  wrap(JSON, 'parse', 'JSON.parse');
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...r) {
    const t0 = now(); const el = ce.call(this, tag, ...r);
    if (P.rec && String(tag).toLowerCase() === 'canvas') P.calls.push({ n: 'createElement(canvas)', t: t0, d: now() - t0 });
    return el;
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { const o = AC.prototype.decodeAudioData; AC.prototype.decodeAudioData = function (...a) { const t0 = now(); const p = o.apply(this, a); if (P.rec) P.calls.push({ n: 'decodeAudioData', t: t0, d: now() - t0 }); return p; }; }
  let last = 0;
  const f = (t) => { if (P.rec && last) P.frames.push({ t, d: t - last }); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  window.__perfStart = () => { P.frames.length = 0; P.calls.length = 0; P.rec = true; P.t0 = performance.now(); P.epoch = performance.timeOrigin + P.t0; console.timeStamp('perf-sync'); };
  window.__perfStop = () => { P.rec = false; return P; };
};

async function launch() {
  for (const opt of [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, {}]) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue;
    try { return await chromium.launch({ ...opt, args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] }); } catch {}
  }
  throw new Error('aucun Chromium');
}

const TRACE_CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'v8.execute', 'disabled-by-default-v8.gc', 'blink', 'cc', 'gpu', 'loading'].join(',');
async function startTrace(cdp) {
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => { for (const e of d.value) events.push(e); });
  await cdp.send('Tracing.start', { categories: TRACE_CATS, transferMode: 'ReportEvents' });
  return async () => { const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done; return events; };
}

// Regroupe les evenements de trace par cause lisible.
function cause(name) {
  if (/Decode|ImageDecode|DecodeImage|Decode LazyPixelRef|ImageFrameGenerator/i.test(name)) return 'decodage image';
  if (/GC|Scavenge|MarkCompact|Sweep|V8\.GC/i.test(name)) return 'GC';
  if (/ParseHTML|ParseAuthorStyleSheet|UpdateLayoutTree|RecalcStyle|Layout$|UpdateLayerTree|Paint$|PrePaint|Layerize/.test(name)) return 'style/layout/paint';
  if (/v8.compile|V8.Compile|CompileScript|CompileCode|v8.parseOnBackground|ParseFunction/i.test(name)) return 'compilation JS';
  if (/Rasterize|RasterTask|GPUTask|ImageUploadTask|Draw Frame|DrawFrame|UploadImage/i.test(name)) return 'raster/GPU';
  return null;
}

async function measure(page, cdp, label) {
  const stopTrace = await startTrace(cdp);
  await page.evaluate(() => window.__perfStart());
  return async () => {
    const P = await page.evaluate(() => window.__perfStop());
    const events = await stopTrace();
    const sync = events.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'perf-sync');
    const toPage = sync ? (ts) => P.t0 + (ts - sync.ts) / 1000 : null;
    return { label, P, events, toPage };
  };
}

function analyse({ label, P, events, toPage }, fightAt) {
  // fightAt: epoch ms de FIGHT!; fenetre = [FIGHT, FIGHT+10 s]; compte a rebours = [START, FIGHT].
  const fightPage = fightAt - P.epoch + P.t0;
  const win = (a, b) => P.frames.filter((f) => f.t >= a && f.t < b);
  const summarize = (fr) => {
    const long = fr.filter((f) => f.d > LONG);
    const span = fr.length ? fr[fr.length - 1].t - fr[0].t + fr[0].d : 0;
    return { frames: fr.length, long: long.length, worst: Math.round(Math.max(0, ...fr.map((f) => f.d))), fps: span ? +(fr.length * 1000 / span).toFixed(1) : 0, longList: long };
  };
  const match = summarize(win(fightPage, fightPage + MATCH_MS));
  const countdown = summarize(win(P.t0, fightPage));
  const withCauses = (list) => list.map((f) => {
    const a = f.t - f.d, b = f.t, agg = {};
    for (const c of P.calls) if (c.t < b && c.t + c.d > a) agg[c.n] = (agg[c.n] || 0) + c.d;
    if (toPage) for (const e of events) {
      if (e.ph !== 'X' || !e.dur || e.dur < 1000) continue;
      const s = toPage(e.ts), en = s + e.dur / 1000;
      if (s >= b || en <= a) continue;
      const k = cause(e.name); if (!k) continue;
      agg[k] = (agg[k] || 0) + (Math.min(en, b) - Math.max(s, a));
    }
    const top = Object.entries(agg).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(0)}ms`);
    return { at: +((f.t - fightPage) / 1000).toFixed(2), ms: Math.round(f.d), causes: top.join(', ') || 'script (rendu canvas)' };
  });
  return { label, countdown: { ...countdown, longList: withCauses(countdown.longList) }, match: { ...match, longList: withCauses(match.longList) } };
}

async function main() {
  const out = process.argv[2];
  const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const netLog = [];
  server.stdout.on('data', (d) => { for (const l of String(d).split('\n')) if (l.includes('[net]')) netLog.push(l.trim()); });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(URL_ + '/health')).ok) break; } catch {} await wait(100); }

  const browser = await launch();
  const closers = [browser];
  try {
    // Hote 1440x900, sans geste prealable: le clic START est le premier geste (cas reel).
    const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const host = await hostCtx.newPage();
    await host.addInitScript(PROBE);
    await host.goto(URL_ + '/');
    const hostCdp = await hostCtx.newCDPSession(host);

    // Manette iPhone 15, CPU x4.
    const browser2 = await launch(); closers.push(browser2);
    const phoneCtx = await browser2.newContext({
      viewport: { width: 393, height: 659 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    await phoneCtx.addInitScript(() => { try { localStorage.setItem('sb_a2hs', '1'); } catch {} });
    const phone = await phoneCtx.newPage();
    await phone.addInitScript(PROBE);
    await phone.goto(URL_ + '/play/');
    const phoneCdp = await phoneCtx.newCDPSession(phone);
    await phone.fill('#name', 'PHONE');
    await phone.waitForSelector('.char');
    // Choix du perso par son nom affiche (characters.json) via l'ordre des boutons.
    const chars = JSON.parse((await import('node:fs')).readFileSync(`${root}shared/characters.json`, 'utf8'));
    const ids = Object.keys(chars).filter((k) => k !== '_schema');
    await phone.locator('.char').nth(ids.indexOf(PHONE_CHAR)).click();
    await phone.click('#join');

    // 7 bots socket.io, persos differents.
    const bots = [];
    for (const c of BOT_CHARS) {
      const s = ioc(URL_, { transports: ['websocket'], forceNew: true });
      await new Promise((r) => s.on('connect', r));
      await new Promise((r) => s.emit(MSG.JOIN, { character: c, name: 'BOT_' + c, playerKey: 'bot-' + c }, r));
      bots.push(s);
    }
    await wait(2500); // lobby: laisser le temps aux chargements prevus pendant le lobby
    await phoneCdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const stopHost = await measure(host, hostCdp, 'hote 1440x900');
    const stopPhone = await measure(phone, phoneCdp, 'manette iPhone 15 CPU x4');
    const startAt = Date.now();
    await host.click('#start');
    const fightAt = startAt + COUNTDOWN_MS;

    // Spam attaque/defense/super + deplacement des FIGHT! (bots et manette).
    let k = 0;
    const spam = setInterval(() => {
      k++;
      bots.forEach((s, i) => {
        const a = (k + i) * 0.7;
        s.emit(MSG.INPUT, { dx: Math.cos(a), dy: Math.sin(a), attack: k % 2 === 0, defense: k % 5 === i % 5, super: k % 3 === 0 });
      });
    }, 100);
    const phoneSpam = phone.evaluate(async (ms) => {
      const end = performance.now() + ms; let k = 0;
      while (performance.now() < end) {
        const btns = document.querySelectorAll('.btn');
        const b = btns[k++ % btns.length];
        if (b) { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })), 60); }
        await new Promise((r) => setTimeout(r, 120));
      }
    }, COUNTDOWN_MS + MATCH_MS + 500);
    await wait(COUNTDOWN_MS + MATCH_MS + 800);
    clearInterval(spam);
    await phoneSpam.catch(() => {});
    const h = analyse(await stopHost(), fightAt);
    const p = analyse(await stopPhone(), fightAt);
    await wait(Math.max(0, 11000 - (Date.now() - startAt))); // un log [net] complet
    const result = { host: h, phone: p, net: netLog.slice(-4) };
    for (const r of [h, p]) {
      console.log(`\n== ${r.label} ==`);
      for (const [name, w] of [['compte a rebours', r.countdown], ['FIGHT! + 10 s', r.match]]) {
        console.log(`${name}: ${w.frames} frames, ${w.long} > ${LONG} ms, pire ${w.worst} ms, ${w.fps} fps`);
        for (const f of w.longList.slice(0, 15)) console.log(`   t=${f.at}s ${f.ms} ms  ${f.causes}`);
      }
    }
    console.log('\n' + result.net.join('\n'));
    if (out) writeFileSync(out, JSON.stringify(result, null, 1));
    for (const s of bots) s.close();
  } finally {
    for (const b of closers) await b.close();
    server.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
