import { getSprite, getImage } from './sprites.js';

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
import { createDecor, DECOR_W, DECOR_H } from './decor.js';

let decor = null;

// Effets ponctuels venus du serveur (cast, hit, block), affiches avec le meme retard que l'interpolation.
const FX_DELAY = 100;
let fx = [];
const hitUntil = new Map();
const trails = new Map();
export function pushEvents(events) {
  const t0 = performance.now() + FX_DELAY;
  for (const e of events || []) fx.push({ ...e, t0 });
  if (fx.length > 200) fx = fx.slice(-200);
}
const SLOT_COL = { attack: '#fde047', defense: '#7dd3fc', super: '#f0abfc' };
let bounds = null, boundsKey = null;

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

export function render(ctx, W, H, arena, state, characters) {
  ctx.fillStyle = '#0a0f24'; ctx.fillRect(0, 0, W, H);
  if (!arena || !arena.grid) return;
  if (!decor) decor = createDecor();
  const b = worldBounds(arena);
  const kx = (OCT.hw * 2) / (b.x1 - b.x0), ky = (OCT.hh * 2) / (b.y1 - b.y0);
  const time = performance.now() / 1000;

  const scale = Math.min(W / DECOR_W, H / DECOR_H);
  ctx.save();
  ctx.translate((W - DECOR_W * scale) / 2, (H - DECOR_H * scale) / 2);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(decor.background, 0, 0);
  decor.animate(ctx, time);

  if (state) {
    const now = performance.now();
    // Zones: ellipse au sol pulsante + anneau pointille qui tourne.
    for (const z of state.zones || []) {
      const [x, y] = worldToScreen(z.x, z.y, b);
      const rx = z.r * kx, ry = z.r * ky, pulse = 0.5 + 0.5 * Math.sin(now / 90);
      const col = TEAM_COL[z.team] || '#fff';
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.14 * pulse; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -now / 25;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 0.6 * pulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, rx * (0.4 + 0.5 * ((now / 600) % 1)), ry * (0.4 + 0.5 * ((now / 600) % 1)), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const items = [];
    for (const p of state.projectiles || []) items.push({ k: 'p', o: p, s: worldToScreen(p.x, p.y, b) });
    for (const p of state.players || []) items.push({ k: 'j', o: p, s: worldToScreen(p.x, p.y, b) });
    items.sort((a, c) => a.s[1] - c.s[1]);
    for (const it of items) {
      const [x, y] = it.s;
      if (it.k === 'p') drawProjectile(ctx, it.o, x, y - 18, kx, ky);
      else {
        const p = it.o;
        // Dash: images fantomes sur les dernieres positions.
        let tr = trails.get(p.id); if (!tr) trails.set(p.id, (tr = []));
        if (p.dashing) tr.push({ x, y, t: now }); 
        while (tr.length && now - tr[0].t > 220) tr.shift();
        for (const g of tr) { ctx.save(); ctx.globalAlpha = 0.35 * (1 - (now - g.t) / 220); drawPlayer(ctx, { ...p, x: g.x, y: g.y, name: '', ghost: true }, characters); ctx.restore(); }
        drawPlayer(ctx, { ...p, x, y, flash: (hitUntil.get(p.id) || 0) > now }, characters);
      }
    }
  }
  if (state) drawFx(ctx, state, b);
  decor.foreground(ctx);
  ctx.restore();
  // HUD
  if (state) {
    const s = state.score || { A: 0, B: 0 };
    const tl = Math.max(0, Math.ceil(state.timeLeft || 0));
    const mm = String(Math.floor(tl / 60)).padStart(2, '0'), ss = String(tl % 60).padStart(2, '0');
    ctx.font = 'bold 36px system-ui'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0008'; ctx.fillRect(W / 2 - 260, 8, 520, 46);
    ctx.textAlign = 'right'; ctx.fillStyle = TEAM_COL.A; ctx.fillText(`Bleus ${s.A}`, W / 2 - 90, 31);
    ctx.textAlign = 'left'; ctx.fillStyle = TEAM_COL.B; ctx.fillText(`${s.B} Rouges`, W / 2 + 90, 31);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`${mm}:${ss}`, W / 2, 31);
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
  ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFx(ctx, state, b) {
  const now = performance.now();
  const pos = new Map((state.players || []).map((p) => [p.id, p]));
  fx = fx.filter((e) => now - e.t0 < 900);
  for (const e of fx) {
    const age = now - e.t0; if (age < 0) continue;
    const pl = pos.get(e.id);
    const [x, y] = worldToScreen(pl ? pl.x : e.x, pl ? pl.y : e.y, b);
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
      ctx.fillStyle = '#7dd3fc'; ctx.fillText('BLOQUE', x, y - 60 - age * 0.03);
    } else if (e.k === 'cast') {
      // nom du pouvoir au-dessus du lanceur
      ctx.globalAlpha = Math.min(1, 2 - 2 * k); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000c'; const w = ctx.measureText(e.label).width + 10; ctx.fillRect(x - w / 2, y - 84 - age * 0.02, w, 16);
      ctx.fillStyle = SLOT_COL[e.slot] || '#fff'; ctx.fillText(e.label, x, y - 72 - age * 0.02);
      // onde de choc pour burst et zone
      if ((e.type === 'burst' || e.type === 'zone') && age < 500) {
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

function drawPlayer(ctx, p, characters) {
  const R = 15;
  p = { ...p, y: p.y - R };
  ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(p.x, p.y + R, R * 0.9, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const col = TEAM_COL[p.team] || '#fff';
  const spriteId = (characters && characters[p.character] && characters[p.character].sprite) || p.character;
  ctx.save();
  ctx.globalAlpha *= p.alive === false ? 0.3 : 1;
  const now = performance.now();
  if (p.protected && !p.shield && Math.floor(now / 150) % 2) ctx.globalAlpha *= 0.55; // clignote en protection de spawn
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(p.x, p.y, R + 3, 0, Math.PI * 2); ctx.stroke();
  if (p.fx || p.fy) {
    const l = Math.hypot(p.fx, p.fy) || 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x + p.fx / l * (R + 6), p.y + p.fy / l * (R + 6), 3, 0, Math.PI * 2); ctx.fill();
  }
  // PNG de l'equipe (en pied, pieds sur le sol) sinon crane genere au runtime.
  const img = getImage(spriteId, p.character);
  const top = img ? p.y + R - R * 3.4 : p.y - R;
  if (img) {
    const h = R * 3.4, w = h * (img.naturalWidth / img.naturalHeight);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, p.x - w / 2, p.y + R - h, w, h);
  } else {
    const spr = getSprite(p.character);
    if (spr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, p.x - R, p.y - R, R * 2, R * 2); }
  }
  // Bouclier: grosse bulle doree pulsante autour de tout le corps.
  if (p.shield) {
    const pr = 1 + 0.06 * Math.sin(now / 80), cy = (top + p.y + R) / 2, ry = ((p.y + R - top) / 2 + 8) * pr, rx = Math.max(R + 10, ry * 0.75);
    ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.ellipse(p.x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(p.x - rx * 0.35, cy - ry * 0.45, rx * 0.25, ry * 0.15, -0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Flash blanc a l'impact.
  if (p.flash) {
    ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(p.x, (top + p.y + R) / 2, R + 4, (p.y + R - top) / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (p.ghost) { ctx.restore(); return; }
  const bw = 34, hp = Math.max(0, Math.min(1, (p.hp || 0) / (p.maxHp || 1)));
  ctx.fillStyle = '#000a'; ctx.fillRect(p.x - bw / 2, top - 10, bw, 4);
  ctx.fillStyle = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#facc15' : '#ef4444';
  ctx.fillRect(p.x - bw / 2, top - 10, bw * hp, 4);
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#000'; ctx.fillText(p.name || '', p.x + 1, p.y + R + 5);
  ctx.fillStyle = '#fff'; ctx.fillText(p.name || '', p.x, p.y + R + 4);
  if (p.alive === false && p.respawnIn > 0) {
    ctx.globalAlpha = 1; ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.ceil(p.respawnIn)), p.x, p.y);
  }
  ctx.restore();
}
