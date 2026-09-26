import { charge, isLabFighter, castLab, firstWall, hitWall, shove, updateMicDrop } from './lab-combat.js';
// 5 briques generiques, parametrees par le JSON du pouvoir. Aucune classe en dur.
// ctx = { players: Map, projectiles: [], zones: [], physics, damage(target, amount, src, fromX, fromY, kb), nextId() }

const P_SPEED = 380, P_RADIUS = 9;

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
    damage: a.damage ?? 10, knockback: a.knockback ?? 150,
    ttl: (a.range || 400) / speed, visual: a.visual, pushDistance: a.pushDistance, chargeHit:a.chargeHit, wallDamage:a.wallDamage,
  });
}

const BRICKS = {
  projectile(ctx, p, a) {
    const [ux, uy] = aim(ctx, p, a.range || 400);
    p.fx = ux; p.fy = uy;
    const count=a.count||1,angle=Math.atan2(uy,ux);
    for(let i=0;i<count;i++){
      const direction=angle+(i-(count-1)/2)*(a.spread||0);
      spawnProjectile(ctx,p,a,Math.cos(direction),Math.sin(direction));
    }
  },
  burst(ctx, p, a) {
    const n = a.count || 8;
    const off = Math.atan2(p.fy, p.fx);
    for (let i = 0; i < n; i++) {
      const ang = off + (i / n) * Math.PI * 2;
      spawnProjectile(ctx, p, { range: 320, speed: 320, ...a }, Math.cos(ang), Math.sin(ang));
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
    if (!ux && !uy) {
      const enemy = a.away && nearestEnemy(ctx, p);
      ux = enemy ? p.x - enemy.x : (a.away ? -p.fx : p.fx);
      uy = enemy ? p.y - enemy.y : (a.away ? -p.fy : p.fy);
    }
    const d = Math.hypot(ux, uy) || 1;
    const v = (a.distance || 180) / t;
    p.dashVx = (ux / d) * v; p.dashVy = (uy / d) * v; p.dashT = t;
    if (a.invulnerable !== false) p.invulnT = Math.max(p.invulnT, t);
  },
  shield(ctx, p, a) {
    p.shieldT = Math.max(p.shieldT, a.duration || 1.5);
  },
};

export function cast(ctx, p, slot) {
  const a = p.char[slot];
  if (!a || p.cd[slot] > 0 || !p.alive || p.hp <= 0 || p.stunT > 0 || p.launch || p.shove || (isLabFighter(p) && p.dashT > 0)) return false;
  if (a.charge && (p.energy || 0) < a.charge) return false;
  const handler = a.behavior ? castLab : BRICKS[a.type];
  if (!handler || handler(ctx, p, a) === false) return false;
  if (a.charge) p.energy = 0;
  p.cd[slot] = a.cooldown || 1;
  p.poseT = slot === 'super' ? .4 : slot === 'attack' ? .2 : 0;
  p.action = slot;
  if (slot !== 'defense') p.protectT = 0;
  console.log(`[cast] ${p.name} ${slot} ${a.type} "${a.label || ''}"`);
  ctx.events?.push({ k: 'cast', id: p.id, slot, type: a.type, label: a.label || a.type, team: p.team, x: Math.round(p.x), y: Math.round(p.y), lab:isLabFighter(p) });
  return true;
}

export function updateProjectiles(ctx, dt) {
  const { physics } = ctx;
  ctx.projectiles = ctx.projectiles.filter((pr) => {
    const stepTime = Math.min(dt, pr.ttl), steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * stepTime / 4));
    for (let i = 0; i < steps; i++) {
      const dx = pr.vx * stepTime / steps, dy = pr.vy * stepTime / steps;
      const wall = firstWall(ctx, pr, dx, dy);
      if (wall) { hitWall(ctx, wall, pr.wallDamage??12, pr.visual==='baguette'||pr.visual==='decree'?null:pr.owner); return false; }
      pr.x += dx; pr.y += dy;
      if (physics.collidesWithWall(pr.x, pr.y, pr.r, false)) return false;
      for (const o of ctx.players.values()) {
        if (!o.alive || o.hp <= 0 || o.team === pr.team || o.launch) continue;
        if (physics.circlesOverlap(pr, pr.r, o, o.r)) {
          const hit = ctx.damage(o, pr.damage, pr.owner, pr.x - pr.vx * .01, pr.y - pr.vy * .01, pr.pushDistance ? 0 : pr.knockback, !!pr.pushDistance, pr.chargeHit == null);
          if(hit && pr.chargeHit != null)charge(ctx.players.get(pr.owner),pr.chargeHit);
          if (hit && pr.pushDistance) shove(o, pr.vx, pr.vy, pr.pushDistance);
          return false;
        }
      }
    }
    pr.ttl -= dt;
    if (pr.ttl <= 0) return false;
    return true;
  });
}

export function updateZones(ctx, dt) {
  ctx.zones = ctx.zones.filter((z) => {
    if (z.kind === 'micDrop' || z.kind === 'decree') return updateMicDrop(ctx, z, dt);
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
