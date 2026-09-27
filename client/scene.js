import {drawMustache,drawMustacheWarning,mustacheLayout} from './maduro-super-fx.js';
import {drawKamalaPose,drawKamalaImpact} from './kamala-fx.js';
import {newcomerFX} from './newcomer-fx.js';
import {EXFIL} from '../shared/exfiltration.js';
import {drawSleep,drawBicycle,sleepLayout} from './biden-fx.js';
import { muskFX } from './musk-fx.js';
import { getSprite, getImage } from './sprites.js';
import { combatFX } from './combat-fx.js';
import { spriteLayout } from './sprite-layout.js';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const poses = new Map();
const seen = new Set();

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
import { createDecor, DECOR_W, DECOR_H } from './decor.js';

let decor = null;
let fxCache = null;
// Effets ponctuels venus du serveur (cast, hit, block), affiches avec le meme retard que l'interpolation.
const FX_DELAY = 100;
let fx = [];
const hitUntil = new Map();
const trails = new Map();
// Impact: hit-stop (perso touche fige 60 ms), KO! geant 1 s. Aucun tremblement d'ecran.
const HIT_STOP_MS = 60, KO_MS = 1000;
const hitStops = new Map();
let kos = [];
export function pushEvents(events) {
  const t0 = performance.now() + FX_DELAY;
  for (const e of events || []) {
    if (e.k === 'hit') {
      hitStops.set(e.id, { from: t0, until: t0 + HIT_STOP_MS, x: null, y: null });
    } else if (e.k === 'kill') {
      kos.push({ ...e, t0 });
    }
  }
  for (const e of events || []) if(!e.lab) fx.push({ ...e, t0 });
  if (fx.length > 200) fx = fx.slice(-200);
}
const SLOT_COL = { attack: '#fde047', defense: '#7dd3fc', super: '#f0abfc' };

let bounds = null, boundsKey = null;
// Pool d'items de tri en profondeur, reutilise d'une frame a l'autre (pas d'allocation par frame).
const itemPool = [], items = [];
let nItems = 0;
function addItem(k, o, x, y) {
  const it = itemPool[nItems] || (itemPool[nItems] = { k: '', o: null, x: 0, y: 0 });
  nItems++; it.k = k; it.o = o; it.x = x; it.y = y; items.push(it);
}
const byDepth = (a, c) => a.y - c.y;
// Halo de projectile pre-rendu par couleur (remplace shadowBlur, tres couteux par frame).
const glowCache = new Map();
function glow(col) {
  let c = glowCache.get(col);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48); glowCache.set(col, c);
  }
  return c;
}

// Lobby: decor fige, halos et fonctions d'effets prets avant la premiere frame de match.
export function prepareScene() {
  if (!decor) decor = createDecor();
  for (const c of Object.values(TEAM_COL)) glow(c);
  glow('#fff');
}
// Frame de chauffe hors ecran: l'arene complete avec un joueur par perso (sprites, noms, barres, HUD), jamais affichee.
export function warmRender(W, H, arena, characters, camera) {
  if (!arena || !arena.grid || typeof document === 'undefined') return;
  prepareScene();
  const b = worldBounds(arena), ids = Object.keys(characters || {}).filter((id) => id !== '_schema');
  const players = ids.map((id, i) => ({ id: '__warm' + i, name: 'WARM', team: i % 2 ? 'B' : 'A', character: id,
    x: b.x0 + (b.x1 - b.x0) * (i + 1) / (ids.length + 1), y: (b.y0 + b.y1) / 2, hp: 50, maxHp: 100, alive: true, fx: 1, fy: 0, energy: 50, moving: true, shield: i === 0 }));
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  const g = k.getContext('2d', { alpha: false });
  const cam = camera ? { fit: camera.fit, me: players[0]?.id } : undefined;
  try { render(g, W, H, arena, { players, projectiles: [], zones: [], walls: [], effects: [], score: { A: 0, B: 0 }, timeLeft: 0 }, characters, cam); } catch (e) {}
  for (const p of players) poses.delete(p.id);
  k.width = k.height = 0;
}

// Boite englobante des cases jouables '.' de arena.json (coords monde).
function worldBounds(arena) {
  const key = arena.grid.join('|') + arena.cellSize;
  if (key === boundsKey) return bounds;
  const cs = arena.cellSize || 64;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  arena.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') return;
    x0 = Math.min(x0, c * cs); y0 = Math.min(y0, r * cs); x1 = Math.max(x1, (c + 1) * cs); y1 = Math.max(y1, (r + 1) * cs);
  }));
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = arena.grid[0].length * cs; y1 = arena.grid.length * cs; }
  boundsKey = key;
  return (bounds = { x0, y0, x1, y1 });
}

// Zone de l'octogone d'Ilan ou tombent les joueurs, centree sur [480,422].
const OCT = { cx: 480, cy: 422, hw: 330, hh: 70 };

// Coords monde (arena.json) -> coords ecran du decor 960x540.
export function worldToScreen(x, y, b) {
  const nx = ((x - b.x0) / (b.x1 - b.x0)) * 2 - 1, ny = ((y - b.y0) / (b.y1 - b.y0)) * 2 - 1;
  return [OCT.cx + nx * OCT.hw, OCT.cy + ny * OCT.hh];
}

// Meme projection, ecrite dans SX/SY (boucles de rendu: pas de tableau par appel).
let SX = 0, SY = 0;
function toScreen(x, y, b) {
  SX = OCT.cx + (((x - b.x0) / (b.x1 - b.x0)) * 2 - 1) * OCT.hw;
  SY = OCT.cy + (((y - b.y0) / (b.y1 - b.y0)) * 2 - 1) * OCT.hh;
}
const EMPTY = [], DASH = [10, 6];
// Joueur dessine: objet reutilise (plus de {...p, x, y} par joueur et par frame).
const drawn = {};
function drawnAt(p, x, y, flash) {
  for (const k in drawn) if (!(k in p)) delete drawn[k];
  for (const k in p) drawn[k] = p[k];
  drawn.x = x; drawn.y = y; if (flash) drawn.flash = true;
  return drawn;
}
function kamalaPoseOf(zones, id) {
  for (let i = 0; i < zones.length; i++) { const z = zones[i]; if (z.owner === id && z.visual === 'kamalaStep' && z.age < z.delay) return z; }
  return null;
}

// Point du decor 960x540 correspondant a une position monde (pour la camera de la manette).
export { OCT };
export function decorPoint(arena, x, y) { return worldToScreen(x, y, worldBounds(arena)); }
export { DECOR_W, DECOR_H };

// camera optionnelle {fit:{scale,tx,ty}, me}: cadrage fixe de l'octogone (client/play/view.js),
// met en evidence le joueur `me` et n'affiche pas le HUD hote. Sans camera: rendu hote inchange.
export function render(ctx, W, H, arena, state, characters, camera) {
  ctx.fillStyle = '#0a0f24'; ctx.fillRect(0, 0, W, H);
  if (!arena || !arena.grid) return;
  if (!decor) decor = createDecor();
  const b = worldBounds(arena);
  const kx = (OCT.hw * 2) / (b.x1 - b.x0), ky = (OCT.hh * 2) / (b.y1 - b.y0);
  const time = performance.now() / 1000;

  ctx.save();
  if (camera) {
    // Cadrage fixe sur l'octogone (camera.fit: scale/tx/ty calcules par la manette), sans exception.
    const full = Math.min(W / DECOR_W, H / DECOR_H);
    const { scale, tx, ty } = camera.fit || { scale: full, tx: (W - DECOR_W * full) / 2, ty: (H - DECOR_H * full) / 2 };
    ctx.translate(Math.round(tx), Math.round(ty));
    ctx.scale(scale, scale);
  } else {
    const scale = Math.min(W / DECOR_W, H / DECOR_H);
    ctx.translate((W - DECOR_W * scale) / 2, (H - DECOR_H * scale) / 2);
    ctx.scale(scale, scale);
  }
  ctx.imageSmoothingEnabled = false;
  // Fonctions d'effets creees une fois par (contexte, arene, reduced-motion) au lieu de chaque frame.
  if(!fxCache||fxCache.ctx!==ctx||fxCache.b!==b||fxCache.rm!==reducedMotion.matches){
    const pr=(x,y)=>worldToScreen(x,y,b);
    fxCache={ctx,b,rm:reducedMotion.matches,project:pr,fx:combatFX(ctx,pr,kx,ky,reducedMotion.matches),musk:muskFX(ctx,pr,kx,ky,reducedMotion.matches),lab:newcomerFX(ctx,pr,kx,ky,reducedMotion.matches)};
  }
  const project=fxCache.project, fx=fxCache.fx, musk=fxCache.musk, lab=fxCache.lab;
  ctx.drawImage(decor.background, 0, 0);
  decor.animate(ctx, time);

  if (state) {
    const now=performance.now();
    seen.clear(); for (const p of state.players) seen.add(p.id);
    for (const id of poses.keys()) if(!seen.has(id))poses.delete(id);
    for(const e of state.effects||EMPTY)if(e.kind!=='truckWreck')fx.effect(e);
    for (const z of state.zones || []) {
      if(z.kind==='sonicLaugh'||z.kind==='flamethrower'||z.kind==='cybertruck'||z.kind==='bicycle')continue;
      if(z.kind==='micDrop'){fx.micDrop(z);continue;}
      if(z.kind==='strike'){if(z.visual==='xiHammer'||z.visual==='inflation')continue;if(z.visual==='decree')fx.decree(z);else fx.strikeZone(z);continue;}
      if(z.kind==='decree'){fx.decree(z);continue;}
      toScreen(z.x, z.y, b); const x = SX, y = SY;
      const rx = z.r * kx, ry = z.r * ky, pulse = 0.5 + 0.5 * Math.sin(now / 90);
      const col = TEAM_COL[z.team] || '#fff';
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.14 * pulse; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(DASH); ctx.lineDashOffset = -now / 25;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash(EMPTY); ctx.globalAlpha = 0.6 * pulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, rx * (0.4 + 0.5 * ((now / 600) % 1)), ry * (0.4 + 0.5 * ((now / 600) % 1)), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for(const p of state.players||EMPTY)drawMustacheWarning(ctx,p,project,kx,ky);
    items.length = 0; nItems = 0;
    for(const w of state.walls||EMPTY){toScreen(w.x,w.y+Math.abs(w.ux)*w.depth/2,b);addItem('wall',w,SX,SY);}
    // Every authoritative projectile must reach a renderer, on host and phone.
    for(const p of state.projectiles||EMPTY){toScreen(p.x,p.y,b);addItem(p.visual==='muskSteel'||p.visual==='muskDoge'?'muskProjectile':'p',p,SX,SY);}
    for(const z of state.zones||EMPTY)if(z.kind==='cybertruck'){toScreen(z.x,z.y,b);addItem('truck',z,SX,SY+1);}
    for(const z of state.zones||EMPTY)if(z.kind==='bicycle'){toScreen(z.x,z.y,b);addItem('bike',z,SX,SY+1);}
    for (const p of state.players || EMPTY) { toScreen(p.x, p.y, b); addItem('j', p, SX, SY); }
    items.sort(byDepth);
    for (const it of items) {
      const x = it.x, y = it.y;
      const kamalaPose=it.k==='j'?kamalaPoseOf(state.zones||EMPTY,it.o.id):null;
      if(it.k==='muskProjectile'){musk.projectile(it.o);continue;}
      if(it.k==='bike'){drawBicycle(ctx,it.o,project,kx,ky,reducedMotion.matches);continue;}
      if(it.k==='truck'){musk.truck(it.o);continue;}
      if(it.k==='wall'){fx.wall(it.o);continue;}
      if (it.k === 'p') {
        if(fx.projectile(it.o))continue;
        const img=it.o.visual==='energy'&&getImage('sprites/obama_attack.png');
        if(img){ctx.save();ctx.translate(x,y-36);ctx.rotate(Math.atan2(it.o.vy*ky,it.o.vx*kx));ctx.drawImage(img,-28,-14,48,28);ctx.restore();continue;}
        drawProjectile(ctx,it.o,x,y-18,kx,ky);
      } else {
        const hs=hitStops.get(it.o.id),nowMs=performance.now();
        if(hs&&nowMs>=hs.from&&nowMs<hs.until){if(hs.x==null){hs.x=x;hs.y=y;}drawPlayer(ctx,drawnAt(it.o,hs.x,hs.y,true),characters,hs.from/1000,kamalaPose);}
        else{if(hs&&nowMs>=hs.until)hitStops.delete(it.o.id);if(camera&&camera.me===it.o.id)drawMeMarker(ctx,x,y,time,it.o.mustache);drawPlayer(ctx, drawnAt(it.o, x, y, false), characters, time,kamalaPose);}
      }
    }
  }
  if(state)for(const z of state.zones||EMPTY)if(z.kind==='micDrop')fx.micDrop(z,true);
  if(state)for(const z of state.zones||EMPTY)if(z.kind==='decree'||(z.kind==='strike'&&z.visual==='decree'))fx.decree(z,true);
  if(state)for(const z of state.zones||EMPTY)if(z.kind==='strike'){const anim=characters?.[z.c]?.super?.anim;if(anim?.style==='kamalaStep')drawKamalaImpact(ctx,z,project,reducedMotion.matches);else if(anim)fx.superAnim(z,anim);}
  if(state)for(const z of state.zones||EMPTY)if(z.kind==='flamethrower')musk.flame(z);
  if(state)for(const z of state.zones||EMPTY)if(z.visual==='xiHammer'||z.visual==='inflation')lab.summon(z);
  if(state)drawFx(ctx,state,b);
  if(state)drawKOs(ctx,b);
  decor.foreground(ctx);
  if(state)for(const e of state.effects||EMPTY)if(e.kind==='truckWreck')musk.wreck(e);else fx.effect(e,true);
  if(state)for(const p of state.players||EMPTY)if(p.alive&&p.exfil)lab.extraction(p);
  ctx.restore();
  // HUD superieur (design/hud-top-approved.json), dessine dans le repere 960x540 du decor. Pas sur la manette (camera).
  if (state && !camera) {
    const k = Math.min(W / DECOR_W, H / DECOR_H);
    ctx.save();
    ctx.setTransform(k, 0, 0, k, (W - DECOR_W * k) / 2, (H - DECOR_H * k) / 2); // meme echelle que l'arene, sans tremblement
    drawHud(ctx, state);
    ctx.restore();
  }
}

function drawProjectile(ctx, o, x, y, kx, ky) {
  const col = TEAM_COL[o.team] || '#fff';
  const r = Math.max(4, (o.r || 8) * 0.7);
  const tx = -(o.vx || 0) * kx * 0.06, ty = -(o.vy || 0) * ky * 0.06;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + tx, y + ty);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tx, y + ty); ctx.stroke();
  const gs = r + 12; ctx.drawImage(glow(col), x - gs, y - gs, gs * 2, gs * 2);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const pos = new Map();
function drawFx(ctx, state, b) {
  const now = performance.now();
  pos.clear();
  for (const p of state.players || []) pos.set(p.id, p);
  let w = 0;
  for (let i = 0; i < fx.length; i++) if (now - fx[i].t0 < 900) fx[w++] = fx[i];
  fx.length = w;
  for (const e of fx) {
    const age = now - e.t0; if (age < 0) continue;
    const pl = pos.get(e.id);
    toScreen(pl ? pl.x : e.x, pl ? pl.y : e.y, b); const x = SX, y = SY;
    const k = age / 900;
    ctx.save();
    if (e.k === 'hit') {
      if (age < 30) hitUntil.set(e.id, now + 140);
      // etincelles + degats flottants
      if (age < 300) { ctx.fillStyle = '#fff5c0'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = 8 + age * 0.08; ctx.fillRect(x + Math.cos(a) * d - 2, y - 26 + Math.sin(a) * d * 0.6 - 2, 4, 4); } }
      ctx.globalAlpha = 1 - k; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('-' + Math.max(1, Math.round(e.amount)), x + 1, y - 58 - age * 0.04 + 1);
      ctx.fillStyle = '#ff5555'; ctx.fillText('-' + Math.max(1, Math.round(e.amount)), x, y - 58 - age * 0.04);
    } else if (e.k === 'block') {
      ctx.globalAlpha = 1 - k; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#7dd3fc'; ctx.fillText('BLOCKED', x, y - 60 - age * 0.03);
    } else if (e.k === 'cast') {
      // nom du pouvoir au-dessus du lanceur
      ctx.globalAlpha = Math.min(1, 2 - 2 * k); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000c'; const w = ctx.measureText(e.label).width + 10; ctx.fillRect(x - w / 2, y - 104 - age * 0.02, w, 16);
      ctx.fillStyle = SLOT_COL[e.slot] || '#fff'; ctx.fillText(e.label, x, y - 92 - age * 0.02);
      // onde de choc pour burst et zone
      if (e.type === 'burst' && age < 500) { // onde au lanceur: seulement le burst (le super cible frappe a distance)
        ctx.globalAlpha = 1 - age / 500; ctx.strokeStyle = TEAM_COL[e.team] || '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x, y, 10 + age * 0.25, (10 + age * 0.25) * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.type === 'dash' && age < 250) {
        ctx.globalAlpha = 1 - age / 250; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - 30, y - 20 + i * 6); ctx.lineTo(x - 10, y - 20 + i * 6); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
}

const HUD_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
// Cadre pixel: contour aux coins coupes, fond, bordure interieure. Tout en fillRect.
function pixelFrame(g, x, y, w, h, o) {
  const c = o.cut || 0, ow = o.outlineWidth || 0, iw = o.innerWidth || 0;
  if (ow) { g.fillStyle = o.outline; g.fillRect(x - ow + c, y - ow, w + ow * 2 - c * 2, h + ow * 2); g.fillRect(x - ow, y - ow + c, w + ow * 2, h + ow * 2 - c * 2); }
  g.fillStyle = o.background; g.fillRect(x, y, w, h);
  if (iw) { g.fillStyle = o.inner; g.fillRect(x, y, w, iw); g.fillRect(x, y + h - iw, w, iw); g.fillRect(x, y, iw, h); g.fillRect(x + w - iw, y, iw, h); }
}
// Etoile blanche pixel 7x7 (echelle s).
const STAR = ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
function pixelStar(g, x, y, s, col) { g.fillStyle = col; for (let j = 0; j < STAR.length; j++) { const row = STAR[j]; for (let i = 0; i < row.length; i++) if (row.charCodeAt(i) === 35) g.fillRect(x + i * s, y + j * s, s, s); } }
// HUD: styles, chaines et fonctions crees une fois (pas de closure, d'objet ni de chaine par frame).
const HUD_FRAME = { background: '#08111f', outline: '#030812', outlineWidth: 4, inner: '#34445d', innerWidth: 2, cut: 4 };
const HUD_TIMER = { background: '#111a2b', outline: '#030812', outlineWidth: 2, inner: '#65758a', innerWidth: 2, cut: 2 };
const STRIPES_A = ['#e0413a', '#f4f1e8'], STRIPES_B = ['#e0413a', '#8f2420'];
const F11 = `900 11px ${HUD_FONT}`, F24 = `900 24px ${HUD_FONT}`, F34 = `900 34px ${HUD_FONT}`;
const NO_SCORE = { A: 0, B: 0 };
let hudTl = -1, hudTime = '';
function hudSide(g, secY, secH, x0, x1, accent, accent33, light, stripes, flip) {
  g.fillStyle = accent33; g.fillRect(x0, secY, x1 - x0, secH);
  g.fillStyle = accent; g.fillRect(flip ? x1 - 6 : x0, secY, 6, secH);
  g.fillStyle = light; g.fillRect(flip ? x1 - 6 : x0, secY, 6, 2);
  const sx = flip ? x1 - 46 : x0 + 10;
  for (let i = 0; i < 5; i++) { g.fillStyle = stripes[i % 2]; g.fillRect(sx, secY + 6 + i * 7, 36, 4); }
  pixelStar(g, flip ? x1 - 36 : x0 + 20, secY + 14, 2, '#ffffff');
}
function hudLabel(g, txt, x, y, align, fill) { g.textAlign = align; g.fillStyle = '#030812'; g.fillText(txt, x, y + 2); g.fillStyle = fill; g.fillText(txt, x, y); }
function drawHud(g, state) {
  const sc = state.score || NO_SCORE;
  const tl = Math.max(0, Math.ceil(state.timeLeft || 0));
  if (tl !== hudTl) { hudTl = tl; hudTime = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`; }
  const time = hudTime;
  const X = 220, Y = 8, Wd = 520, Hd = 58, cx = 480;
  g.imageSmoothingEnabled = false;
  pixelFrame(g, X, Y, Wd, Hd, HUD_FRAME);
  // Sections equipes (gauche bleue, droite rouge): barre d'accent, rayures, etoile.
  const secY = Y + 6, secH = Hd - 12, tW = 132, tX = cx - tW / 2;
  hudSide(g, secY, secH, X + 4, tX - 6, '#2f7de1', '#2f7de133', '#60a5fa', STRIPES_A, false);
  hudSide(g, secY, secH, tX + tW + 6, X + Wd - 4, '#e0413a', '#e0413a33', '#f87171', STRIPES_B, true);
  // Nom d'equipe (petit) au-dessus du score (gros), colles au timer: blocs symetriques par rapport a cx.
  g.textBaseline = 'middle';
  const lx = tX - 14, rx = tX + tW + 14;
  g.font = F11;
  hudLabel(g, 'CONSPIRACY CREW', lx, secY + 12, 'right', '#9cc7ff'); hudLabel(g, 'CANCEL CLUB', rx, secY + 12, 'left', '#ffb4ad');
  g.font = F24;
  hudLabel(g, String(sc.A), lx, secY + 32, 'right', '#ddebff'); hudLabel(g, String(sc.B), rx, secY + 32, 'left', '#ffe2df');
  // Timer: panneau sombre isole au centre.
  pixelFrame(g, tX, Y + 5, tW, 48, HUD_TIMER);
  g.font = F34; g.textAlign = 'center';
  g.fillStyle = '#030812'; g.fillText(time, cx, Y + 5 + 26); g.fillStyle = '#f4f1e8'; g.fillText(time, cx, Y + 5 + 24);
}

const KO_OUT = [-4, 0, 4, 0, 0, -4, 0, 4, 4, 5];
// KO! enorme 1 s au point de chute (ramene dans l'ecran si la chute est hors toit) + nom du tueur.
function drawKOs(g, b) {
  const now = performance.now();
  let n = 0; for (let i = 0; i < kos.length; i++) if (now - kos[i].t0 < KO_MS) kos[n++] = kos[i]; kos.length = n;
  for (const k of kos) {
    const age = now - k.t0; if (age < 0) continue;
    toScreen(k.x, k.y, b); let x = SX, y = SY;
    x = Math.max(110, Math.min(850, x)); y = Math.max(170, Math.min(470, y - 40));
    const pop = age < 140 ? 1.8 - (age / 140) * 0.8 : 1, fade = age > KO_MS - 250 ? (KO_MS - age) / 250 : 1;
    g.save(); g.globalAlpha = fade; g.translate(Math.round(x), Math.round(y)); g.scale(pop, pop);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 64px ${HUD_FONT}`;
    g.fillStyle = '#030812'; for (let i = 0; i < KO_OUT.length; i += 2) g.fillText('KO!', KO_OUT[i], KO_OUT[i + 1]);
    g.fillStyle = '#e0413a'; g.fillText('KO!', 3, 0); g.fillStyle = '#2f7de1'; g.fillText('KO!', -3, 0); g.fillStyle = '#f6c343'; g.fillText('KO!', 0, 0);
    const who = k.killerName ? `BY ${String(k.killerName).toUpperCase()}` : k.fell ? 'FELL OFF THE ROOF' : '';
    if (who) {
      g.font = `900 14px ${HUD_FONT}`; const tw = Math.ceil(g.measureText(who).width) + 14;
      g.fillStyle = '#050a12'; g.fillRect(-tw / 2 - 2, 34, tw + 4, 22);
      g.fillStyle = '#10182a'; g.fillRect(-tw / 2, 36, tw, 18);
      g.fillStyle = k.killerTeam === 'B' ? '#e0413a' : k.killerTeam === 'A' ? '#2f7de1' : '#65758a'; g.fillRect(-tw / 2, 52, tw, 2);
      g.fillStyle = '#ffffff'; g.fillText(who, 0, 45);
    }
    g.restore();
  }
}

// Mon perso (vue manette): anneau dore au sol + fleche au-dessus, pulsants.
function drawMeMarker(g, x, y, time, mustache) {
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  g.save();
  g.strokeStyle = '#f6c343'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 24 * pulse, 8 * pulse, 0, 0, Math.PI * 2); g.stroke();
  const m=mustacheLayout(mustache,reducedMotion.matches);
  const ay = y - (m?m.height+m.lift+44:120) - Math.abs(Math.sin(time * 5)) * 4;
  g.fillStyle = '#030812'; g.beginPath(); g.moveTo(x - 8, ay - 2); g.lineTo(x + 8, ay - 2); g.lineTo(x, ay + 9); g.closePath(); g.fill();
  g.fillStyle = '#f6c343'; g.beginPath(); g.moveTo(x - 6, ay); g.lineTo(x + 6, ay); g.lineTo(x, ay + 7); g.closePath(); g.fill();
  g.restore();
}

const NO_CFG = {}, F9 = `900 9px ${HUD_FONT}`;
const layouts = new Map(), names = new Map();
function layoutOf(cfg, hasImg) {
  let m = layouts.get(cfg); if (!m) { m = [spriteLayout(cfg, false), spriteLayout(cfg, true)]; layouts.set(cfg, m); }
  return m[hasImg ? 1 : 0];
}
function upperName(n) { let u = names.get(n); if (u === undefined) { u = String(n).toUpperCase(); if (names.size > 256) names.clear(); names.set(n, u); } return u; }
function drawPlayer(ctx, p, characters, time, kamalaPose) {
  if(p.alive&&p.exfil&&p.exfil.age>=EXFIL.lift)return;
  const R=15, col=TEAM_COL[p.team]||'#fff', quiet=reducedMotion.matches;
  const img=getImage(characters?.[p.character]?.sprite||p.character,p.character);
  const cfg=characters?.[p.character]||NO_CFG, {h}=layoutOf(cfg,!!img); // rendu en pied: champ fullBody du perso
  let pose=poses.get(p.id);
  if(!pose){pose={x:p.x,y:p.y,t:time,phase:0,walk:0};poses.set(p.id,pose);}
  const dt=Math.min(.1,Math.max(0,time-pose.t)),distance=Math.hypot(p.x-pose.x,(p.y-pose.y)*3);
  const walking=p.moving&&!p.launch&&!p.shove&&!p.dash&&p.alive;
  pose.walk+=(Number(!!(walking&&distance>.01))-pose.walk)*(1-Math.exp(-22*dt));
  if(walking)pose.phase+=Math.min(20,distance)/64*Math.PI*2;
  pose.x=p.x;pose.y=p.y;pose.t=time;
  const face=p.fx>=0?1:-1, attack=(p.pose||0)/(p.action==='super'?.4:.2);
  let lift=quiet?0:Math.abs(Math.sin(pose.phase))*pose.walk*2.4,angle=quiet?0:Math.sin(pose.phase)*pose.walk*.035+face*attack*.11;
  let sx=1, sy=quiet?1:1+Math.sin(time*3)*.007*(1-pose.walk),offset=quiet?0:face*attack*8;
  if(!quiet&&p.launch){lift+=Math.sin(p.launch.progress*Math.PI)*35;angle=-p.launch.ux*.38;}
  if(!quiet&&p.shove){lift+=Math.sin(p.shove.progress*Math.PI)*8;angle=-p.shove.ux*.27;}
  if(!quiet&&p.dash){lift+=Math.sin(Math.min(1,1-p.dash.remaining/(p.character==='musk'?.18:.28))*Math.PI)*14;angle=Math.sign(p.dash.x)*.22;}
  if(!quiet&&p.recoil>0){const t=1-p.recoil/.42,bounce=Math.sin(t*Math.PI);offset-=face*bounce*14;lift+=bounce*9;sx=1-Math.max(0,1-t/.22)*.3;sy=1+Math.max(0,1-t/.22)*.13;}
  if(p.cycle&&!quiet){const age=1.15-p.cycle;if(age<.55){lift+=8+Math.sin(age*20)*2;}else{const fall=Math.sin(Math.min(1,(age-.55)/.6)*Math.PI);angle+=face*fall*1.45;lift-=fall*30;}}
  if(p.uppercut&&!quiet){lift+=Math.sin(Math.min(1,p.uppercut/.45)*Math.PI)*45;angle+=face*.35;}
  const superLayout=mustacheLayout(p.mustache,quiet);
  const top=superLayout?p.y-superLayout.height-superLayout.lift:p.y-(p.nap?sleepLayout(p.nap,quiet,h).height:img?h:30)-lift;
  ctx.save();ctx.globalAlpha=p.alive===false?.3:1;
  ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(p.x,p.y,18,5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,20,6,0,0,Math.PI*2);ctx.stroke();
  if(p.shield||p.protected){
    const pulse=quiet?1:1+.06*Math.sin(time*12.5);
    ctx.save();ctx.fillStyle=p.shield?(cfg.shieldStyle==='sunglasses'?'#75cfff22':'#facc1548'):'#ffffff28';ctx.strokeStyle=p.shield?(cfg.shieldStyle==='sunglasses'?'#8edbff':'#facc15'):'#ffffff66';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(p.x,p.y-h/2,29*pulse,(h/2+7)*pulse,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  const sleeping=p.nap>0&&drawSleep(ctx,p,time,quiet,img,h);
  const stepping=!sleeping&&(drawMustache(ctx,p,quiet)||drawKamalaPose(ctx,p,kamalaPose,quiet));
  if(img&&!sleeping&&!stepping){
    const w=h*(img.naturalWidth/img.naturalHeight);
    if(!quiet&&(p.dash||p.launch||p.shove)){
      const direction=p.dash?Math.sign(p.dash.x):(p.launch?.ux||p.shove?.ux||1);
      for(let i=1;i<5;i++){ctx.save();ctx.globalAlpha=.24/i;ctx.translate(p.x-direction*i*12,p.y-lift);ctx.scale(face,1);ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();}
    }
    ctx.save();ctx.translate(p.x+offset,p.y-lift);ctx.rotate(angle);ctx.scale(face*sx,sy);if(p.flash)ctx.globalAlpha=.75;
    ctx.drawImage(img,-w/2,-h,w,h);
    if(cfg.shieldStyle==='sunglasses'&&p.shield){
      ctx.fillStyle='#091321';ctx.fillRect(-10,-h+11,9,6);ctx.fillRect(2,-h+11,9,6);
      ctx.fillStyle='#d4b579';ctx.fillRect(-2,-h+12,5,2);
      ctx.fillStyle='#b4d9eb';ctx.fillRect(-8,-h+12,4,1);ctx.fillRect(4,-h+12,4,1);
    }
    ctx.restore();
  }else if(!sleeping&&!stepping){const spr=getSprite(p.character);if(spr)ctx.drawImage(spr,p.x-R,p.y-R*2,R*2,R*2);}
  if(p.burning&&p.alive)for(let i=0;i<7;i++){
    const t=quiet?i/7:(time*2+i/7)%1;ctx.fillStyle=t>.5?'#ffdc65':'#f98429';ctx.fillRect(p.x-15+i*5,p.y-8-t*40,3,4);
  }
  if(p.character==='musk'&&p.dash){
    ctx.save();ctx.strokeStyle='#a7e5ff';ctx.globalAlpha=.5;ctx.lineWidth=2;
    for(let i=1;i<=3;i++){ctx.beginPath();ctx.ellipse(p.x-Math.sign(p.dash.x)*i*13,p.y-35,8,30,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  const hp=Math.max(0,Math.min(1,p.hp/p.maxHp));
  ctx.fillStyle='#000a';ctx.fillRect(p.x-20,top-9,40,4);ctx.fillStyle=hp>.5?'#22c55e':hp>.25?'#facc15':'#ef4444';ctx.fillRect(p.x-20,top-9,40*hp,4);
  if(characters?.[p.character]?.super?.charge){ctx.fillStyle='#26314c';ctx.fillRect(p.x-20,top-3,40,2);ctx.fillStyle='#edcb80';ctx.fillRect(p.x-20,top-3,40*(p.energy||0)/100,2);}
  // Nom une seule fois, au-dessus de la barre de vie (plus sous les pieds, ou il semblait detache du perso).
  // Nameplate pixel compacte (design HUD): fond sombre, contour, lisere couleur d'equipe, meme position.
  if(p.name){
    ctx.font=F9;const name=upperName(p.name),tw=Math.ceil(ctx.measureText(name).width),bx=Math.round(p.x-tw/2-4),by=Math.round(top-23),bw=tw+8;
    ctx.fillStyle='#050a12';ctx.fillRect(bx-1,by-1,bw+2,14);
    ctx.fillStyle='#10182a';ctx.fillRect(bx,by,bw,12);
    ctx.fillStyle=p.team==='B'?'#e0413a':'#2f7de1';ctx.fillRect(bx,by+10,bw,2);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.fillText(name,Math.round(p.x),by+5.5);
  }
  ctx.textBaseline='top';
  if(p.alive===false&&p.respawnIn>0){ctx.globalAlpha=1;ctx.font='bold 14px monospace';ctx.fillText(String(Math.ceil(p.respawnIn)),p.x,p.y-30);}
  ctx.restore();
}
