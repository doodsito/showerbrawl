// Collisions grille + cercles + knockback. Adapte de magic-arena (collidesWithWall).
import { CONFIG } from '../shared/config.js';

export function makePhysics(arena) {
  const TILE = arena.cellSize;
  const map = arena.grid;
  const rows = map.length, cols = map[0]?.length || 0;
  const obstacles = arena.obstacles || [];

  const cellAt = (x, y) => {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return '#';
    return map[r][c];
  };

  // Vrai si le cercle touche une case '#' (bord du toit) ou un obstacle.
  function collidesWithWall(cx, cy, radius) {
    const minCol = Math.floor((cx - radius) / TILE), maxCol = Math.floor((cx + radius) / TILE);
    const minRow = Math.floor((cy - radius) / TILE), maxRow = Math.floor((cy + radius) / TILE);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const out = row < 0 || row >= rows || col < 0 || col >= cols;
        if (out || map[row][col] !== '.') {
          const rx = col * TILE, ry = row * TILE;
          const clx = Math.max(rx, Math.min(cx, rx + TILE));
          const cly = Math.max(ry, Math.min(cy, ry + TILE));
          const dx = cx - clx, dy = cy - cly;
          if (dx * dx + dy * dy < radius * radius) return true;
        }
      }
    }
    for (const o of obstacles) {
      if (o.r != null) {
        if (Math.hypot(cx - o.x, cy - o.y) < radius + o.r) return true;
      } else if (o.w != null) {
        const clx = Math.max(o.x, Math.min(cx, o.x + o.w)), cly = Math.max(o.y, Math.min(cy, o.y + o.h));
        if ((cx - clx) ** 2 + (cy - cly) ** 2 < radius * radius) return true;
      }
    }
    return false;
  }

  // Deplacement volontaire: glisse le long des bords, ne tombe jamais tout seul.
  function moveWithWalls(p, dx, dy, radius) {
    const nx = p.x + dx, ny = p.y + dy;
    if (!collidesWithWall(nx, p.y, radius)) p.x = nx;
    if (!collidesWithWall(p.x, ny, radius)) p.y = ny;
  }

  // Knockback: ignore les bords (on peut etre ejecte du toit).
  function applyKnockback(p, dt) {
    if (!p.kbVx && !p.kbVy) return;
    p.x += p.kbVx * dt;
    p.y += p.kbVy * dt;
    const decay = Math.pow(0.02, dt);
    p.kbVx *= decay; p.kbVy *= decay;
    if (Math.abs(p.kbVx) < 5) p.kbVx = 0;
    if (Math.abs(p.kbVy) < 5) p.kbVy = 0;
  }

  function push(p, fromX, fromY, force) {
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    const f = force * CONFIG.KNOCKBACK;
    p.kbVx = (p.kbVx || 0) + ((p.x - fromX) / d) * f;
    p.kbVy = (p.kbVy || 0) + ((p.y - fromY) / d) * f;
  }

  // Centre hors sol => chute.
  const isFalling = (p) => cellAt(p.x, p.y) !== '.';

  const circlesOverlap = (a, ar, b, br) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (ar + br) ** 2;

  // Separe deux joueurs qui se chevauchent.
  function separate(a, b, r) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const overlap = 2 * r - d;
    if (overlap <= 0) return;
    const ux = dx / d, uy = dy / d, h = overlap / 2;
    moveWithWalls(a, -ux * h, -uy * h, r);
    moveWithWalls(b, ux * h, uy * h, r);
  }

  return { TILE, cellAt, collidesWithWall, moveWithWalls, applyKnockback, push, isFalling, circlesOverlap, separate,
    width: cols * TILE, height: rows * TILE };
}
