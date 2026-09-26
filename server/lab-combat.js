// Authoritative versions of the lab abilities. Visuals consume these same world objects.
import { wallContact, wallSegmentEntry, wallsOverlap } from '../shared/wall-geometry.js';

export const isLabFighter = p => p.character === 'trump' || p.character === 'obama' || p.character === 'macron';
export function effect(ctx, kind, x, y, extra = {}, duration = .6) {
  ctx.effects.push({ id: ctx.nextId(), kind, x, y, age: 0, duration, ...extra });
}
export function charge(p, amount) {
  if (p?.char.super?.charge) p.energy = Math.min(100, (p.energy || 0) + amount);
}
export function firstWall(ctx, origin, dx, dy) {
  let hit = null, nearest = Infinity;
  for (const wall of ctx.walls) {
    const t = wallSegmentEntry(wall, origin, dx, dy);
    if (t !== null && t < nearest) { nearest = t; hit = wall; }
  }
  return hit;
}
export function hitWall(ctx, wall, amount, owner) {
  wall.hp -= amount;
  effect(ctx, 'spark', wall.x, wall.y);
  charge(ctx.players.get(owner), 12);
  if (wall.hp <= 0) {
    ctx.walls = ctx.walls.filter(w => w !== wall);
    effect(ctx, 'rubble', wall.x, wall.y);
  }
}
export function shove(target, ux, uy, distance, duration = .26) {
  const len = Math.hypot(ux, uy) || 1;
  target.shove = { ux: ux / len, uy: uy / len, distance, duration, remaining: duration };
  target.stunT = duration + .08; target.dashT = 0;
  target.kbVx = 0; target.kbVy = 0;
}
function enemy(ctx, p, range) {
  return [...ctx.players.values()].filter(o => o !== p && o.alive && o.hp > 0 && o.team !== p.team && !o.launch)
    .map(o => ({ o, d: Math.hypot(o.x - p.x, o.y - p.y) }))
    .filter(o => o.d <= range).sort((a, b) => a.d - b.d)[0]?.o;
}
function direction(p, target) {
  const dx = target ? target.x - p.x : p.fx, dy = target ? target.y - p.y : p.fy;
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}
function launch(ctx, p, target) {
  const [ux, uy] = direction(p, target);
  let distance = 0;
  // Cage/arena stops the launch; summoned walls are shattered along its route.
  for (let d = 4; d <= Math.hypot(ctx.physics.width, ctx.physics.height); d += 4) {
    if (ctx.physics.collidesWithWall(target.x + ux * d, target.y + uy * d, target.r, false)) break;
    distance = d;
  }
  target.launch = { fromX: target.x, fromY: target.y, ux, uy, distance, age: 0, duration: .56 };
  target.stunT = .9; target.shove = null; target.dashT = 0; target.kbVx = 0; target.kbVy = 0;
}
export function castLab(ctx, p, a) {
  if (a.behavior === 'wall') {
    const len = Math.hypot(p.fx, p.fy) || 1, ux = p.fx / len, uy = p.fy / len;
    const wall = { id: ctx.nextId(), owner: p.id, team: p.team, x: p.x + ux * 76, y: p.y + uy * 76,
      ux, uy, width: 24, depth: 150, slant: .2, hp: 36, maxHp: 36, age: 0, ttl: a.duration };
    // Check the whole footprint against grid edges and static obstacles.
    for (let x = -12; x <= 12; x += 4) for (let y = -75; y <= 75; y += 5) {
      const lx = x + y * wall.slant;
      if (ctx.physics.collidesWithWall(wall.x + ux * lx - uy * y, wall.y + uy * lx + ux * y, 3, false)) return false;
    }
    if ([...ctx.players.values()].some(o => o.alive && wallContact(o, wall, o.r + 4)) ||
        ctx.walls.some(w => wallsOverlap(wall, w))) return false;
    ctx.walls.push(wall);
    return true;
  }
  const target = enemy(ctx, p, a.range);
  const [ux, uy] = direction(p, target);
  p.fx = ux; p.fy = uy;
  if (a.behavior === 'micDrop' || a.behavior === 'decree') {
    if(a.behavior==='decree'&&!target)return false;
    ctx.zones.push({ id: ctx.nextId(), kind: a.behavior, angle:Math.atan2(uy,ux), owner: p.id, team: p.team,
      x: target ? target.x : p.x + ux * a.range, y: target ? target.y : p.y + uy * a.range,
      r: a.radius, age: 0, delay: a.delay, duration: a.delay + 1.25, damage: a.damage, hit: false });
    // A cast without a nearby enemy still lands on the playable floor.
    const drop = ctx.zones.at(-1);
    if (!target) { drop.x = p.x; drop.y = p.y; ctx.physics.moveWithWalls(drop, ux * a.range, uy * a.range, 2); }
    return true;
  }
  const fired = a.behavior === 'fired';
  if (fired) effect(ctx, 'fired', p.x, p.y, { owner: p.id }, .65);
  const reach = target ? Math.hypot(target.x - p.x, target.y - p.y) : a.range;
  const wall = firstWall(ctx, p, ux * reach, uy * reach);
  if (wall) { hitWall(ctx, wall, fired ? 36 : 12, fired ? null : p.id); return true; }
  // Static scenery blocks melee as well as projectiles.
  for (let d = 4; d < reach; d += 4) if (ctx.physics.collidesWithWall(p.x + ux * d, p.y + uy * d, 1, false)) return true;
  if (target && ctx.damage(target, a.damage, p.id, p.x, p.y, 0, true)) {
    if (fired) launch(ctx, p, target);
    else shove(target, ux, uy, 11, .1);
    effect(ctx, 'spark', target.x, target.y);
  }
  return true;
}
export function updateLab(ctx, dt) {
  ctx.effects = ctx.effects.filter(e => (e.age += dt) < e.duration);
  for (const wall of [...ctx.walls]) {
    wall.age += dt; wall.ttl -= dt;
    if (wall.ttl <= 0) hitWall(ctx, wall, wall.hp, null);
  }
}
export function advanceForcedMovement(ctx, p, dt) {
  const flight = p.launch;
  if (flight) {
    flight.age = Math.min(flight.duration, flight.age + dt);
    const t = flight.age / flight.duration, progress = t + .12 * Math.sin(Math.PI * t);
    const nx = flight.fromX + flight.ux * flight.distance * progress;
    const ny = flight.fromY + flight.uy * flight.distance * progress;
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - p.x, ny - p.y) / 4)), dx = (nx - p.x) / steps, dy = (ny - p.y) / steps;
    for (let i = 0; i < steps; i++) {
      p.x += dx; p.y += dy;
      for (const wall of [...ctx.walls]) if (wallContact(p, wall, p.r)) hitWall(ctx, wall, wall.hp, null);
    }
    if (t === 1) {
      effect(ctx, 'impact', p.x, p.y, { ux: flight.ux, uy: flight.uy }, 1.15);
      p.launch = null; p.recoilT = .42;
    }
  } else if (p.shove) {
    const push = p.shove, step = Math.min(dt, push.remaining);
    ctx.physics.moveWithWalls(p, push.ux * push.distance * step / push.duration, push.uy * push.distance * step / push.duration, p.r);
    push.remaining -= step;
    if (push.remaining < 1e-6) p.shove = null;
  } else return false;
  if (p.hp <= 0 && !p.launch && !p.shove) ctx.kill(p, p.lastHit);
  return true;
}
export function updateMicDrop(ctx, z, dt) {
  z.age += dt;
  if (!z.hit && z.age >= z.delay) {
    z.hit = true;
    for (const wall of [...ctx.walls]) {
      if (wallContact(z, wall, z.r)) hitWall(ctx, wall, wall.hp, null);
    }
    for (const target of ctx.players.values()) {
      if (!target.alive || target.team === z.team || target.launch || Math.hypot(target.x - z.x, target.y - z.y) > z.r + target.r) continue;
      if (ctx.damage(target, z.damage, z.owner, z.x, z.y, 0, true, false)) {
        const dx = target.x - z.x, dy = target.y - z.y;
        shove(target, Math.hypot(dx, dy) > 1e-6 ? dx : Math.cos(z.angle), Math.hypot(dx,dy)>1e-6?dy:Math.sin(z.angle), z.kind==='decree'?70:100, .32);
      }
    }
    if(z.kind==='decree')for(let i=0;i<9;i++){
      const a=z.angle+i*Math.PI*2/9,ux=Math.cos(a),uy=Math.sin(a),x=z.x+ux*(z.r+24),y=z.y+uy*(z.r+24);
      if(ctx.physics.collidesWithWall(x,y,8)||firstWall(ctx,z,x-z.x,y-z.y))continue;
      ctx.projectiles.push({id:ctx.nextId(),owner:z.owner,team:z.team,x,y,vx:ux*400,vy:uy*400,r:8,ttl:420/400,visual:'decree',damage:10,knockback:0,pushDistance:65,chargeHit:0,wallDamage:12});
    }
  }
  return z.age < z.duration;
}
