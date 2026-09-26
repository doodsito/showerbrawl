// 5 briques generiques, parametrees par le JSON du pouvoir. Aucune classe en dur.
// ctx = { players: Map, projectiles: [], zones: [], physics, damage(target, amount, src, fromX, fromY, kb), nextId() }

const P_SPEED = 600, P_RADIUS = 8;

export function nearestEnemy(ctx, p, maxRange = Infinity) {
  let best = null, bd = maxRange;
  for (const o of ctx.players.values()) {
    if (o === p || !o.alive || o.team === p.team) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function aim(ctx, p, range) {
  const e = nearestEnemy(ctx, p, range * 1.5);
  if (e) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    return [(e.x - p.x) / d, (e.y - p.y) / d];
  }
  return [p.fx, p.fy];
}

function spawnProjectile(ctx, p, a, ux, uy) {
  const speed = a.speed || P_SPEED;
  const r = a.radius || P_RADIUS;
  ctx.projectiles.push({
    id: ctx.nextId(), owner: p.id, team: p.team,
    x: p.x + ux * (p.r + r), y: p.y + uy * (p.r + r),
    vx: ux * speed, vy: uy * speed, r,
    damage: a.damage ?? 10, knockback: a.knockback ?? 250,
    ttl: (a.range || 400) / speed,
  });
}

const BRICKS = {
  projectile(ctx, p, a) {
    const [ux, uy] = aim(ctx, p, a.range || 400);
    p.fx = ux; p.fy = uy;
    spawnProjectile(ctx, p, a, ux, uy);
  },
  burst(ctx, p, a) {
    const n = a.count || 8;
    const off = Math.atan2(p.fy, p.fx);
    for (let i = 0; i < n; i++) {
      const ang = off + (i / n) * Math.PI * 2;
      spawnProjectile(ctx, p, { range: 300, speed: 500, ...a }, Math.cos(ang), Math.sin(ang));
    }
  },
  zone(ctx, p, a) {
    const duration = a.duration || 2;
    const e = a.onEnemy ? nearestEnemy(ctx, p, a.range || 400) : null;
    ctx.zones.push({
      id: ctx.nextId(), owner: p.id, team: p.team,
      x: e ? e.x : p.x, y: e ? e.y : p.y, r: a.radius || 120,
      dps: (a.damage ?? 20) / duration, ttl: duration, knockback: a.knockback ?? 60,
      follow: !e && a.follow !== false ? p.id : null,
    });
  },
  dash(ctx, p, a) {
    const t = a.duration || 0.15;
    let ux = p.dx, uy = p.dy;
    if (!ux && !uy) { ux = p.fx; uy = p.fy; }
    const d = Math.hypot(ux, uy) || 1;
    const v = (a.distance || 180) / t;
    p.dashVx = (ux / d) * v; p.dashVy = (uy / d) * v; p.dashT = t;
    p.invulnT = Math.max(p.invulnT, t);
  },
  shield(ctx, p, a) {
    p.shieldT = Math.max(p.shieldT, a.duration || 1.5);
  },
};

export function cast(ctx, p, slot) {
  const a = p.char[slot];
  if (!a || p.cd[slot] > 0 || !p.alive) return false;
  try { BRICKS[a.type]?.(ctx, p, a); } catch { return false; }
  p.cd[slot] = a.cooldown || 1;
  return true;
}

export function updateProjectiles(ctx, dt) {
  const { physics } = ctx;
  ctx.projectiles = ctx.projectiles.filter((pr) => {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.ttl -= dt;
    if (pr.ttl <= 0 || pr.x < -200 || pr.y < -200 || pr.x > physics.width + 200 || pr.y > physics.height + 200) return false;
    for (const o of ctx.players.values()) {
      if (!o.alive || o.team === pr.team) continue;
      if (physics.circlesOverlap(pr, pr.r, o, o.r)) {
        ctx.damage(o, pr.damage, pr.owner, pr.x - pr.vx * 0.01, pr.y - pr.vy * 0.01, pr.knockback);
        return false;
      }
    }
    return true;
  });
}

export function updateZones(ctx, dt) {
  ctx.zones = ctx.zones.filter((z) => {
    z.ttl -= dt;
    if (z.follow) {
      const f = ctx.players.get(z.follow);
      if (f?.alive) { z.x = f.x; z.y = f.y; }
    }
    for (const o of ctx.players.values()) {
      if (!o.alive || o.team === z.team) continue;
      if (Math.hypot(o.x - z.x, o.y - z.y) < z.r + o.r) ctx.damage(o, z.dps * dt, z.owner, z.x, z.y, z.knockback * dt * 10);
    }
    return z.ttl > 0;
  });
}
