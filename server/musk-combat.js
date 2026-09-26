// Musk's lab kit, simulated on the server. Zones carry the same geometry to every host.
import { charge, effect, firstWall, hitWall } from './lab-combat.js';

const foes = (ctx, p) => [...ctx.players.values()].filter(o => o !== p && o.alive && o.hp > 0 && o.team !== p.team && !o.launch && !o.carriedBy);
function aim(ctx, p) {
  const target = foes(ctx, p).sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  const dx=target ? target.x-p.x : p.fx, dy=target ? target.y-p.y : p.fy, len=Math.hypot(dx,dy)||1;
  return [dx/len,dy/len];
}
function clearRay(ctx, x, y, dx, dy) {
  if(firstWall(ctx,{x,y},dx,dy))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=1;i<=steps;i++)if(ctx.physics.collidesWithWall(x+dx*i/steps,y+dy*i/steps,1,false))return false;
  return true;
}
export function castMusk(ctx,p,a) {
  if(a.behavior==='hyperloop'){
    let dx=p.dx,dy=p.dy;
    if(!dx&&!dy){const [ux,uy]=aim(ctx,p);dx=-ux;dy=-uy;}
    const len=Math.hypot(dx,dy)||1,speed=a.distance/a.duration;
    p.dashVx=dx/len*speed;p.dashVy=dy/len*speed;p.dashT=a.duration;p.dashHit=null;
    return true;
  }
  const [ux,uy]=aim(ctx,p);p.fx=ux;p.fy=uy;
  if(a.behavior==='flamethrower'){
    ctx.zones.push({id:ctx.nextId(),kind:'flamethrower',owner:p.id,team:p.team,x:p.x,y:p.y,ux,uy,
      r:a.range,reach:a.range,halfAngle:a.halfAngle??24,age:0,duration:a.duration,pulse:0,dps:a.dps,push:a.pushDistance,burnDps:a.burnDps,burnDuration:a.burnDuration,chargeHit:a.chargeHit});
    return true;
  }
  if(a.behavior==='cybertruck'||a.behavior==='bicycle'){
    const bike=a.behavior==='bicycle',delay=bike?.55:.44,speed=bike?a.speed:620;
    if(bike)p.cycleT=1.15;
    ctx.zones.push({id:ctx.nextId(),kind:a.behavior,owner:p.id,team:p.team,x:p.x,y:p.y,ux,uy,r:bike?20:30,
      age:0,delay,duration:bike?delay+a.range/speed:2.04,speed,damage:a.damage,hitIds:new Set(),passengers:new Set()});
    return true;
  }
  return false;
}
export function updateMuskBurns(ctx,dt) {
  for(const p of ctx.players.values()){
    const burn=p.muskBurn;if(!burn)continue;
    const source=ctx.players.get(burn.owner);
    if(!p.alive||p.hp<=0||!source||source.team===p.team){p.muskBurn=null;continue;}
    const step=Math.min(dt,burn.remaining);burn.remaining-=step;
    ctx.damage(p,burn.dps*step,burn.owner,p.x,p.y,0,false,false);
    if(burn.remaining<=1e-6)p.muskBurn=null;
  }
}
function release(ctx,z){
  for(const id of z.passengers){
    const p=ctx.players.get(id);if(!p||p.carriedBy!==z.id)continue;
    p.carriedBy=null;p.stunT=.35;p.recoilT=.42;
    if(p.alive&&p.hp<=0)ctx.kill(p,p.lastHit);
  }
  z.passengers.clear();
}
function crash(ctx,z){
  release(ctx,z);
  effect(ctx,'impact',z.x,z.y,{ux:z.ux,uy:z.uy},1.15);
  effect(ctx,z.kind==='bicycle'?'bikeWreck':'truckWreck',z.x,z.y,{},.7);
  if(z.kind==='bicycle')return false;
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,ux=Math.cos(a),uy=Math.sin(a),x=z.x+ux*60,y=z.y+uy*60;
    if(ctx.physics.collidesWithWall(x,y,7)||!clearRay(ctx,z.x,z.y,x-z.x,y-z.y))continue;
    const speed=i%2?260:340;
    ctx.projectiles.push({id:ctx.nextId(),owner:z.owner,team:z.team,x,y,vx:ux*speed,vy:uy*speed,r:7,
      ttl:(i%2?150:190)/speed,visual:i%2?'muskDoge':'muskSteel',damage:6,pushDistance:22,chargeHit:0,knockback:0,wallDamage:6});
  }
  return false;
}
export function updateMuskZone(ctx,z,dt){
  const owner=ctx.players.get(z.owner);
  if(!owner||owner.team!==z.team){if(z.kind==='cybertruck'||z.kind==='bicycle')release(ctx,z);return false;}
  const previousAge=z.age;z.age+=dt;
  if(z.kind==='flamethrower'){
    if(!owner.alive||owner.hp<=0||owner.character!=='musk'||owner.stunT>0||owner.dashT>0||owner.carriedBy)return false;
    z.x=owner.x;z.y=owner.y;z.reach=0;
    for(let d=4;d<=z.r;d+=4){if(!clearRay(ctx,z.x+z.ux*(d-4),z.y+z.uy*(d-4),z.ux*4,z.uy*4))break;z.reach=d;}
    z.pulse+=Math.max(0,Math.min(dt,z.duration-previousAge));
    while(z.pulse>=.1-1e-8){
      z.pulse-=.1;
      const wall=firstWall(ctx,z,z.ux*z.r,z.uy*z.r);
      if(wall)hitWall(ctx,wall,5,null);
      for(const target of foes(ctx,owner)){
        const dx=target.x-z.x,dy=target.y-z.y,d=Math.hypot(dx,dy);
        if(d>z.r+target.r||(d>0&&(dx*z.ux+dy*z.uy)/d<Math.cos((z.halfAngle??24)*Math.PI/180))||!clearRay(ctx,z.x,z.y,dx,dy))continue;
        if(ctx.damage(target,z.dps*.1,z.owner,z.x,z.y,0,false,false)){
          charge(owner,z.chargeHit);
          if(target.alive){
            target.muskBurn={owner:z.owner,remaining:z.burnDuration,dps:z.burnDps};
            ctx.physics.moveWithWalls(target,z.ux*z.push,z.uy*z.push,target.r);
          }
        }
      }
    }
    return z.age<z.duration;
  }
  if(z.age<z.delay)return true;
  const stepTime=Math.max(0,Math.min(z.age,z.duration)-Math.max(previousAge,z.delay));
  const distance=z.speed*stepTime,steps=Math.max(1,Math.ceil(distance/4));
  for(let i=0;i<steps;i++){
    const dx=z.ux*distance/steps,dy=z.uy*distance/steps;
    const wall=firstWall(ctx,z,dx+z.ux*z.r,dy+z.uy*z.r);
    if(wall){hitWall(ctx,wall,wall.hp,null);if(z.kind!=='bicycle')return crash(ctx,z);}
    if(ctx.physics.collidesWithWall(z.x+dx,z.y+dy,z.r,false))return crash(ctx,z);
    z.x+=dx;z.y+=dy;
    for(const target of foes(ctx,owner)){
      if(z.hitIds.has(target.id)||Math.hypot(target.x-z.x,target.y-z.y)>z.r+target.r)continue;
      z.hitIds.add(target.id);
      if(!ctx.damage(target,z.damage,z.owner,z.x-z.ux*30,z.y-z.uy*30,0,true,false))return crash(ctx,z);
      target.carriedBy=z.id;target.shove=null;target.dashT=0;target.dashHit=null;target.kbVx=0;target.kbVy=0;target.superKbVx=0;target.superKbVy=0;target.stunT=.2;
      z.passengers.add(target.id);effect(ctx,'spark',target.x,target.y);
    }
    for(const id of z.passengers){
      const target=ctx.players.get(id);
      if(!target||!target.alive||target.carriedBy!==z.id){z.passengers.delete(id);continue;}
      const ox=target.x,oy=target.y;target.stunT=.2;
      ctx.physics.moveWithWalls(target,dx,dy,target.r);
      if(Math.hypot(target.x-ox-dx,target.y-oy-dy)>.5)return crash(ctx,z);
    }
  }
  return z.age<z.duration||crash(ctx,z);
}
