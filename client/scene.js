import { getSprite } from './sprites.js';

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
let roofPattern = null;

function makeRoof(ctx) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e9ecef'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#d5dade'; g.fillRect(0, 15, 32, 2); g.fillRect(15, 0, 2, 15); g.fillRect(0, 17, 2, 15);
  g.fillStyle = '#f8f9fa'; g.fillRect(4, 4, 3, 3); g.fillRect(22, 22, 3, 3);
  return ctx.createPattern(c, 'repeat');
}

export function render(ctx, W, H, arena, state, characters) {
  ctx.fillStyle = '#0a0f24'; ctx.fillRect(0, 0, W, H);
  if (!arena || !arena.grid) return;
  const cs = arena.cellSize || 64;
  const rows = arena.grid.length, cols = arena.grid[0].length;
  const aw = cols * cs, ah = rows * cs;
  const scale = Math.min(W / aw, (H - 60) / ah);
  const ox = (W - aw * scale) / 2, oy = 60 + (H - 60 - ah * scale) / 2;
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(scale, scale);
  if (!roofPattern) roofPattern = makeRoof(ctx);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (arena.grid[r][c] === '.') { ctx.fillStyle = roofPattern; ctx.fillRect(c * cs, r * cs, cs, cs); }
    else { ctx.fillStyle = (r + c) % 2 ? '#111831' : '#0e142b'; ctx.fillRect(c * cs, r * cs, cs, cs); }
  }
  if (state) {
    for (const z of state.zones || []) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = TEAM_COL[z.team] || '#fff';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of state.projectiles || []) {
      ctx.fillStyle = TEAM_COL[p.team] || '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (const p of state.players || []) drawPlayer(ctx, p, characters);
  }
  ctx.restore();
  // HUD
  if (state) {
    const s = state.score || { A: 0, B: 0 };
    const tl = Math.max(0, Math.ceil(state.timeLeft || 0));
    const mm = String(Math.floor(tl / 60)).padStart(2, '0'), ss = String(tl % 60).padStart(2, '0');
    ctx.font = 'bold 36px system-ui'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'right'; ctx.fillStyle = TEAM_COL.A; ctx.fillText(`Bleus ${s.A}`, W / 2 - 90, 30);
    ctx.textAlign = 'left'; ctx.fillStyle = TEAM_COL.B; ctx.fillText(`${s.B} Rouges`, W / 2 + 90, 30);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`${mm}:${ss}`, W / 2, 30);
  }
}

function drawPlayer(ctx, p, characters) {
  const R = 26;
  const col = TEAM_COL[p.team] || '#fff';
  const spriteId = (characters && characters[p.character] && characters[p.character].sprite) || p.character;
  ctx.save();
  ctx.globalAlpha = p.alive === false ? 0.3 : 1;
  if (p.shield || p.protected) {
    ctx.fillStyle = p.shield ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(p.x, p.y, R + 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = col; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(p.x, p.y, R + 3, 0, Math.PI * 2); ctx.stroke();
  if (p.fx || p.fy) {
    const l = Math.hypot(p.fx, p.fy) || 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x + p.fx / l * (R + 10), p.y + p.fy / l * (R + 10), 5, 0, Math.PI * 2); ctx.fill();
  }
  const spr = getSprite(spriteId);
  if (spr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, p.x - R, p.y - R, R * 2, R * 2); }
  const bw = 56, hp = Math.max(0, Math.min(1, (p.hp || 0) / (p.maxHp || 1)));
  ctx.fillStyle = '#000a'; ctx.fillRect(p.x - bw / 2, p.y - R - 16, bw, 7);
  ctx.fillStyle = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#facc15' : '#ef4444';
  ctx.fillRect(p.x - bw / 2, p.y - R - 16, bw * hp, 7);
  ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#000'; ctx.fillText(p.name || '', p.x + 1, p.y + R + 7);
  ctx.fillStyle = '#fff'; ctx.fillText(p.name || '', p.x, p.y + R + 6);
  if (p.alive === false && p.respawnIn > 0) {
    ctx.globalAlpha = 1; ctx.font = 'bold 20px system-ui'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.ceil(p.respawnIn)), p.x, p.y);
  }
  ctx.restore();
}
