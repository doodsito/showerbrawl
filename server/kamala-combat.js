import {isExtracted} from '../shared/exfiltration.js';
import {effect, firstWall, shove} from './lab-combat.js';

function clearRay(ctx, p, o) {
  const dx=o.x-p.x, dy=o.y-p.y;
  if(firstWall(ctx,p,dx,dy))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=1;i<=steps;i++)if(ctx.physics.collidesWithWall(p.x+dx*i/steps,p.y+dy*i/steps,1,false))return false;
  return true;
}
const enemy=(p,o)=>o!==p&&o.alive&&o.hp>0&&o.team!==p.team&&!o.launch&&!o.carriedBy&&!isExtracted(o);

export function castKamala(ctx,p,a) {
  if(a.behavior==='sonicLaugh'){
    const target=[...ctx.players.values()].filter(o=>enemy(p,o)&&Math.hypot(o.x-p.x,o.y-p.y)<=a.range)
      .sort((l,r)=>Math.hypot(l.x-p.x,l.y-p.y)-Math.hypot(r.x-p.x,r.y-p.y))[0];
    if(target){const d=Math.hypot(target.x-p.x,target.y-p.y)||1;p.fx=(target.x-p.x)/d;p.fy=(target.y-p.y)/d;}
    const z={id:ctx.nextId(),kind:'sonicLaugh',owner:p.id,team:p.team,x:p.x,y:p.y,ux:p.fx,uy:p.fy,
      age:0,pulses:0,duration:.25,...a};
    emitWave(ctx,p,z);
    ctx.zones.push(z);
    return true;
  }
  if(a.behavior!=='speaking')return false;
  const within=o=>Math.hypot(o.x-p.x,o.y-p.y)<=a.range&&clearRay(ctx,p,o);
  effect(ctx,'speaking',p.x,p.y,{r:a.range,team:p.team},.65);
  ctx.projectiles=ctx.projectiles.filter(o=>o.team===p.team||!within(o));
  const interrupted=new Set();
  for(const o of ctx.players.values()){
    if(!enemy(p,o)||o.shieldT>0||o.invulnT>0||o.protectT>0||o.napT>0||!within(o))continue;
    interrupted.add(o.id);
    o.poseT=0;o.action=null;o.pending={};o.cycleT=0;o.exfil=null;
    o.recoveryT=Math.max(o.recoveryT||0,.45);
    for(const slot of ['attack','defense','super'])o.cd[slot]=Math.max(o.cd[slot]||0,.45);
    const dx=o.x-p.x,dy=o.y-p.y;
    shove(o,dx||dy?dx:p.fx,dx||dy?dy:p.fy,65,.18);
  }
  // Interrupt nearby casters, while already launched vehicles and completed impacts continue.
  ctx.zones=ctx.zones.filter(z=>{
    if(!interrupted.has(z.owner))return true;
    if(z.kind==='flamethrower'||z.kind==='sonicLaugh')return false;
    return z.delay==null||z.age>=z.delay||z.hit;
  });
  return true;
}
function emitWave(ctx,p,z){
  ctx.projectiles.push({id:ctx.nextId(),owner:p.id,team:p.team,x:p.x,y:p.y,
    vx:z.ux*z.speed,vy:z.uy*z.speed,r:10,ttl:z.range/z.speed,visual:'sonicLaugh',
    damage:z.damage/3,knockback:0,nudge:8,wallDamage:4,chargeHit:10,canRingOut:false});
  z.pulses++;
}
export function updateLaugh(ctx,z,dt){
  const p=ctx.players.get(z.owner);
  if(!p?.alive||p.hp<=0||p.team!==z.team||p.character!=='harris'||p.stunT>0||p.launch||p.carriedBy)return false;
  z.age+=dt;z.x=p.x;z.y=p.y;
  while(z.pulses<3&&z.age>=z.pulses*.12-1e-8)emitWave(ctx,p,z);
  return z.pulses<3;
}
