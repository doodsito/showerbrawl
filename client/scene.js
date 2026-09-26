import { getSprite, getImage } from './sprites.js';

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
import { createDecor, DECOR_W, DECOR_H } from './decor.js';

let decor = null;
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
    for (const z of state.zones || []) {
      const [x, y] = worldToScreen(z.x, z.y, b);
      ctx.globalAlpha = 0.28; ctx.fillStyle = TEAM_COL[z.team] || '#fff';
      ctx.beginPath(); ctx.ellipse(x, y, z.r * kx, z.r * ky, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const items = [];
    for (const p of state.projectiles || []) items.push({ k: 'p', o: p, s: worldToScreen(p.x, p.y, b) });
    for (const p of state.players || []) items.push({ k: 'j', o: p, s: worldToScreen(p.x, p.y, b) });
    items.sort((a, c) => a.s[1] - c.s[1]);
    for (const it of items) {
      const [x, y] = it.s;
      if (it.k === 'p') {
        ctx.fillStyle = TEAM_COL[it.o.team] || '#fff';
        ctx.beginPath(); ctx.arc(x, y - 14, Math.max(3, (it.o.r || 6) * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else drawPlayer(ctx, { ...it.o, x, y }, characters);
    }
  }
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

function drawPlayer(ctx, p, characters) {
  const R = 15;
  p = { ...p, y: p.y - R };
  ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(p.x, p.y + R, R * 0.9, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const col = TEAM_COL[p.team] || '#fff';
  const spriteId = (characters && characters[p.character] && characters[p.character].sprite) || p.character;
  ctx.save();
  ctx.globalAlpha = p.alive === false ? 0.3 : 1;
  if (p.shield || p.protected) {
    ctx.fillStyle = p.shield ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(p.x, p.y, R + 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(p.x, p.y, R + 3, 0, Math.PI * 2); ctx.stroke();
  if (p.fx || p.fy) {
    const l = Math.hypot(p.fx, p.fy) || 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x + p.fx / l * (R + 6), p.y + p.fy / l * (R + 6), 3, 0, Math.PI * 2); ctx.fill();
  }
  // PNG de l'equipe (en pied, pieds sur le sol) sinon crane genere au runtime.
  const img = getImage(spriteId);
  const top = img ? p.y + R - R * 3.4 : p.y - R;
  if (img) {
    const h = R * 3.4, w = h * (img.naturalWidth / img.naturalHeight);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, p.x - w / 2, p.y + R - h, w, h);
  } else {
    const spr = getSprite(p.character);
    if (spr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, p.x - R, p.y - R, R * 2, R * 2); }
  }
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
