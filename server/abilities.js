import {castMustache} from './maduro-super.js';
import {castKamala, updateLaugh} from './kamala-combat.js';
import {isExtracted} from '../shared/exfiltration.js';
import {castExfiltration} from './exfiltration.js';
import {castBiden} from './biden-combat.js';
import { CONFIG } from '../shared/config.js';
import { castMusk, updateMuskZone } from './musk-combat.js';
import { charge, hasLabKit, castLab, castJabLunge, firstWall, hitWall, shove, updateMicDrop } from './lab-combat.js';
// 5 briques generiques, parametrees par le JSON du pouvoir. Aucune classe en dur.
// ctx = { players: Map, projectiles: [], zones: [], physics, damage(target, amount, src, fromX, fromY, kb), nextId() }


export function nearestEnemy(ctx, p, maxRange = Infinity) {
  let best = null, bd = maxRange;
  for (const o of ctx.players.values()) {
    if (o === p || !o.alive || o.team === p.team || isExtracted(o)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// Generic bricks remain melee. Musk's lab behaviors are dispatched separately below.
// Les 5 types de protocol.js sont conserves mais interpretes en melee:
//   projectile -> coup au contact (ennemi le plus proche a portee de bras)
//   burst      -> onde de choc au sol centree sur le lanceur (tous les ennemis proches)
//   zone       -> zone au sol centree sur le lanceur (degats continus)
//   dash       -> charge qui traverse et pousse les ennemis sur la trajectoire
//   shield     -> bloque les degats un court temps
const MELEE_MAX = 110; // plafond de portee d'un coup, meme si le JSON indique plus

function fx(ctx, kind, x, y, extra = {}, duration = .45) {
  ctx.effects?.push({ id: ctx.nextId(), kind, x, y, age: 0, duration, ...extra });
}
function face(p, o) {
  const d = Math.hypot(o.x - p.x, o.y - p.y) || 1;
  p.fx = (o.x - p.x) / d; p.fy = (o.y - p.y) / d;
}
const hitable = (p, o) => o !== p && o.alive && o.hp > 0 && o.team !== p.team && !o.launch && !isExtracted(o);

// Opt-in moving shots. The generic contact attacks keep their existing rules.
function volley(ctx, p, a) {
  const target = nearestEnemy(ctx, p, a.range);
  if (target) face(p, target);
  const angle = Math.atan2(p.fy, p.fx), count = a.shots || 1, speed = a.speed || 600;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2, theta = angle + offset * (a.spread || 0);
    const ux = Math.cos(theta), uy = Math.sin(theta);
    // Start inside the owner's collision circle so nearby walls cannot be skipped.
    ctx.projectiles.push({id:ctx.nextId(),owner:p.id,team:p.team,
      x:p.x-Math.sin(angle)*offset*10,y:p.y+Math.cos(angle)*offset*10,
      vx:ux*speed,vy:uy*speed,r:a.radius||7,ttl:a.range/speed,visual:a.visual,
      damage:a.damage/count,knockback:(a.knockback||0)/count,wallDamage:a.damage/count,
      canRingOut:a.canRingOut,height:38-offset*12});
  }
}

const BRICKS = {
  // Coup: touche seulement un ennemi vivant au contact (portee = bras + rayons). Auto-aim sur le plus proche.
  projectile(ctx, p, a) {
    if (a.travel) return volley(ctx, p, a);
    const reach = Math.min(a.range || 70, MELEE_MAX);
    const e = nearestEnemy(ctx, p, reach + p.r * 2);
    // Un mur invoque entre moi et ma cible (ou devant moi) encaisse le coup a sa place.
    { const d = e ? Math.hypot(e.x - p.x, e.y - p.y) : reach, ux = e ? (e.x - p.x) / (d || 1) : p.fx, uy = e ? (e.y - p.y) / (d || 1) : p.fy;
      const wall = ctx.walls?.length ? firstWall(ctx, p, ux * d, uy * d, p.team) : null;
      if (wall) { p.fx = ux; p.fy = uy; hitWall(ctx, wall, a.damage ?? 10, p.id); fx(ctx, 'strike', wall.x, wall.y, { ux, uy, visual: a.visual }, .3); return; } }
    if (!e) { fx(ctx, 'whiff', p.x + p.fx * reach * .6, p.y + p.fy * reach * .6, { ux: p.fx, uy: p.fy, visual: a.visual }, .25); return; }
    face(p, e);
    const hx = (p.x + e.x) / 2, hy = (p.y + e.y) / 2;
    if (ctx.damage(e, a.damage ?? 10, p.id, p.x, p.y, a.knockback ?? 260, false, !a.charge, a.canRingOut)) fx(ctx, 'strike', hx, hy, { ux: p.fx, uy: p.fy, heavy: (a.damage ?? 10) >= 15, visual: a.visual });
    else fx(ctx, 'whiff', hx, hy, { ux: p.fx, uy: p.fy, visual: a.visual }, .25);
  },
  // Onde de choc au sol centree sur le lanceur: ne vole pas, gros recul radial.
  burst(ctx, p, a) {
    const r = Math.min(a.radius || a.range || 130, 220);
    fx(ctx, 'shockwave', p.x, p.y, { r, team: p.team }, .55);
    for (const o of ctx.players.values()) {
      if (!hitable(p, o) || Math.hypot(o.x - p.x, o.y - p.y) > r + o.r) continue;
      if (ctx.damage(o, a.damage ?? 20, p.id, p.x, p.y, a.knockback ?? 480, false, !a.charge, a.canRingOut)) fx(ctx, 'strike', o.x, o.y, { heavy: true }, .4);
    }
  },
  // Zone au sol centree sur le lanceur (le suit par defaut). Avec "target":"enemy": super cible a distance (targetedStrike).
  zone(ctx, p, a) {
    if (a.target === 'enemy') return targetedStrike(ctx, p, a);
    const duration = a.duration || 2;
    ctx.zones.push({
      id: ctx.nextId(), owner: p.id, team: p.team, x: p.x, y: p.y, r: Math.min(a.radius || 120, 200),
      dps: (a.damage ?? 20) / duration, ttl: duration, knockback: a.knockback ?? 60, chargeSource: !a.charge, canRingOut: a.canRingOut,
      follow: a.follow !== false ? p.id : null,
    });
  },
  // Charge: fonce (joystick, sinon vers l'ennemi le plus proche), traverse et pousse ceux touches.
  dash(ctx, p, a) {
    const t = a.duration || 0.18;
    let ux = p.dx, uy = p.dy;
    if (!ux && !uy) {
      const enemy = nearestEnemy(ctx, p, 400);
      if (a.away) { ux = enemy ? p.x - enemy.x : -p.fx; uy = enemy ? p.y - enemy.y : -p.fy; }
      else { ux = enemy ? enemy.x - p.x : p.fx; uy = enemy ? enemy.y - p.y : p.fy; }
    }
    const d = Math.hypot(ux, uy) || 1;
    const v = (a.distance || 180) / t;
    p.dashVx = (ux / d) * v; p.dashVy = (uy / d) * v; p.dashT = t;
    p.fx = ux / d; p.fy = uy / d;
    p.dashHit = { canRingOut: a.canRingOut, damage: a.damage ?? 8, knockback: a.knockback ?? 320, done: new Set() };
    if (a.invulnerable !== false) p.invulnT = Math.max(p.invulnT, t);
  },
  shield(ctx, p, a) {
    p.shieldT = Math.max(p.shieldT, a.duration || 1.5);
  },
};

// Super cible a distance (modele Mic Drop d'Ilan): vise l'ennemi vivant le plus proche dans la portee,
// pose une alerte au sol (cercle qui se remplit pendant delay) puis frappe la zone: degats + knockback.
// Sans ennemi a portee: frappe devant le lanceur a mi-portee. Rien ne vole: on peut esquiver en sortant du cercle.
// Champs: range, radius, delay, damage, knockback, hits (impacts successifs), spread (ecart entre impacts), gap (s entre impacts).
function targetedStrike(ctx, p, a) {
  const range = a.range || 400, e = nearestEnemy(ctx, p, range);
  let x, y;
  if (e) { face(p, e); x = e.x; y = e.y; } else { x = p.x + p.fx * range / 2; y = p.y + p.fy * range / 2; }
  const n = Math.max(1, a.hits || 1), spread = a.spread ?? 70, gap = a.gap ?? 0.18, delay = a.delay ?? 0.7;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread; // impacts decales perpendiculairement a la visee
    ctx.zones.push({
      id: ctx.nextId(), kind: 'strike', owner: p.id, team: p.team,
      x: x - p.fy * off, y: y + p.fx * off, ux: p.fx, uy: p.fy,
      visual: a.visual, r: a.radius || 90, age: 0, delay: delay + i * gap, duration: delay + i * gap + (a.aftermath ?? .4),
      canRingOut: a.canRingOut, damage: a.damage ?? 25, knockback: a.knockback ?? 450, hit: false,
    });
  }
}

export function updateStrike(ctx, z, dt) {
  z.age += dt;
  if (!z.hit && z.age >= z.delay) {
    z.hit = true;
    const custom=z.visual==='xiHammer'||z.visual==='inflation';
    if(custom){for(const wall of [...ctx.walls])if(Math.hypot(wall.x-z.x,wall.y-z.y)<z.r+45)hitWall(ctx,wall,wall.hp,null);}
    if(!custom)fx(ctx, 'shockwave', z.x, z.y, { r: z.r, team: z.team }, .5);
    for (const o of ctx.players.values()) {
      if (!o.alive || o.hp <= 0 || o.team === z.team || o.launch || Math.hypot(o.x - z.x, o.y - z.y) > z.r + o.r) continue;
      // pousse depuis un point en amont de la visee: une cible au centre part quand meme en arriere
      if (ctx.damage(o, z.damage, z.owner, z.x - (z.ux || 0) * 30, z.y - (z.uy || 0) * 30, z.knockback, false, false, z.canRingOut)&&!custom) fx(ctx, 'strike', o.x, o.y, { heavy: true }, .4);
    }
  }
  return z.age < z.duration;
}

// Pendant une charge: chaque ennemi touche prend les degats une fois et est pousse sur le cote de la trajectoire.
export function dashHits(ctx, p) {
  const h = p.dashHit;
  if (!h || !(p.dashT > 0)) { p.dashHit = null; return; }
  for (const o of ctx.players.values()) {
    if (!hitable(p, o) || h.done.has(o.id) || Math.hypot(o.x - p.x, o.y - p.y) > p.r + o.r + 6) continue;
    h.done.add(o.id);
    // pousse depuis un point derriere le lanceur: l'ennemi part devant et sur le cote
    if (ctx.damage(o, h.damage, p.id, p.x - p.fx * 20, p.y - p.fy * 20, h.knockback, false, true, h.canRingOut)) fx(ctx, 'strike', o.x, o.y, { ux: p.fx, uy: p.fy, heavy: true });
  }
}

// Contact defaults only. Explicit projectile and behavior kits keep their simulation.
// Les attaques au contact gardent leur label, icone et visuel. Un projectile travel ou un behavior explicite conserve son kit.
// Coup au contact standard (brique projectile sans travel), reutilise par le jab de Trump apres son bond.
export const meleeStrike = (ctx, p, a) => BRICKS.projectile(ctx, p, a);

export function standardAttack(own = {}) {
  if (own.behavior === 'jabLunge') return { ...own, ...CONFIG.BASE_ATTACK }; // jab de Trump: bond + coup standard, valeurs BASE_ATTACK
  if (own.behavior || (own.type === 'projectile' && own.travel === true)) return { ...CONFIG.BASE_ATTACK, ...own };
  return { type: 'projectile', ...CONFIG.BASE_ATTACK, label: own.label, icon: own.icon, visual: own.visual };
}

export function cast(ctx, p, slot) {
  const a = slot === 'attack' ? standardAttack(p.char.attack) : p.char[slot];
  if (!a || p.cd[slot] > 0 || !p.alive || p.hp <= 0 || p.stunT > 0 || p.launch || p.shove || p.carriedBy || p.dashT > 0 || p.napT > 0 || p.cycleT > 0 || p.exfil || p.mustache) return false;
  if (a.charge && (p.energy || 0) < a.charge) return false;
  const handler = a.behavior==='superMustache' ? castMustache : a.behavior==='jabLunge' ? castJabLunge : ['sonicLaugh','speaking'].includes(a.behavior) ? castKamala : a.behavior==='exfiltration' ? castExfiltration : a.behavior==='nap' ? castBiden : ['flamethrower','hyperloop','cybertruck','bicycle'].includes(a.behavior) ? castMusk : a.behavior ? castLab : BRICKS[a.type];
  if (!handler || handler(ctx, p, {...a, canRingOut: slot === 'super'}) === false) return false;
  if (a.charge) p.energy = 0;
  p.cd[slot] = a.cooldown || 1;
  p.poseT = slot === 'super' ? .4 : slot === 'attack' ? .2 : 0;
  p.action = slot;
  if (slot !== 'defense') p.recoveryT = a.recovery ?? (slot === 'super' ? .35 : .16);
  if (slot !== 'defense') p.protectT = 0;
  console.log(`[cast] ${p.name} ${slot} ${a.type} "${a.label || ''}"`);
  ctx.events?.push({ k: 'cast', id: p.id, slot, type: a.type, label: a.label || a.type, team: p.team, x: Math.round(p.x), y: Math.round(p.y), lab:hasLabKit(p) });
  return true;
}

export function updateProjectiles(ctx, dt) {
  const { physics } = ctx;
  ctx.projectiles = ctx.projectiles.filter((pr) => {
    const stepTime = Math.min(dt, pr.ttl), steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * stepTime / 4));
    for (let i = 0; i < steps; i++) {
      const dx = pr.vx * stepTime / steps, dy = pr.vy * stepTime / steps;
      const wall = firstWall(ctx, pr, dx, dy, pr.team);
      if (wall) { hitWall(ctx, wall, pr.wallDamage??12, pr.chargeHit===0||pr.visual==='baguette'||pr.visual==='decree'||pr.visual==='sonicLaugh'?null:pr.owner); return false; }
      pr.x += dx; pr.y += dy;
      if (physics.collidesWithWall(pr.x, pr.y, pr.r, false)) return false;
      for (const o of ctx.players.values()) {
        if (!o.alive || o.hp <= 0 || o.team === pr.team || o.launch || isExtracted(o)) continue;
        if (physics.circlesOverlap(pr, pr.r, o, o.r)) {
          const hit = ctx.damage(o, pr.damage, pr.owner, pr.x - pr.vx * .01, pr.y - pr.vy * .01, pr.pushDistance ? 0 : pr.knockback, !!pr.pushDistance, pr.chargeHit == null, !!pr.canRingOut);
          if (pr.visual === 'energy' || pr.visual === 'baguette' || pr.visual === 'icecream' || pr.visual==='maduroOil' || pr.visual==='xiStar') fx(ctx, hit ? 'strike' : 'whiff', pr.x, pr.y, {visual:pr.visual,ux:pr.vx/Math.hypot(pr.vx,pr.vy),uy:pr.vy/Math.hypot(pr.vx,pr.vy)}, .35);
          if(hit && pr.chargeHit != null)charge(ctx.players.get(pr.owner),pr.chargeHit);
          if(pr.nudge && o.alive){const speed=Math.hypot(pr.vx,pr.vy)||1, distance=hit?pr.nudge:o.shieldT>0?3:0;ctx.physics.moveWithWalls(o,pr.vx/speed*distance,pr.vy/speed*distance,o.r);}
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
    if(z.kind==='sonicLaugh')return updateLaugh(ctx,z,dt);
    if(z.kind==='flamethrower'||z.kind==='cybertruck'||z.kind==='bicycle')return updateMuskZone(ctx,z,dt);
    if (z.kind === 'micDrop' || z.kind === 'decree') return updateMicDrop(ctx, z, dt);
    if (z.kind === 'strike') return updateStrike(ctx, z, dt);
    z.ttl -= dt;
    if (z.follow) {
      const f = ctx.players.get(z.follow);
      if (f?.alive) { z.x = f.x; z.y = f.y; }
    }
    for (const o of ctx.players.values()) {
      if (!o.alive || o.team === z.team) continue;
      if (Math.hypot(o.x - z.x, o.y - z.y) < z.r + o.r) ctx.damage(o, z.dps * dt, z.owner, z.x, z.y, z.knockback * dt * 10, false, z.chargeSource !== false, z.canRingOut);
    }
    return z.ttl > 0;
  });
}
