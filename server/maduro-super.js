import {isExtracted} from '../shared/exfiltration.js';
import {effect, firstWall, hitWall} from './lab-combat.js';

const enemy=(p,o)=>o!==p&&o.alive&&o.hp>0&&o.team!==p.team&&!o.launch&&!o.carriedBy&&!isExtracted(o);
export function castMustache(ctx,p,a){
  if(Math.hypot(p.kbVx||0,p.kbVy||0,p.superKbVx||0,p.superKbVy||0)>5)return false;
  const target=[...ctx.players.values()].filter(o=>enemy(p,o)&&Math.hypot(o.x-p.x,o.y-p.y)<=a.range)
    .sort((l,r)=>Math.hypot(l.x-p.x,l.y-p.y)-Math.hypot(r.x-p.x,r.y-p.y))[0];
  const dx=target?target.x-p.x:p.fx,dy=target?target.y-p.y:p.fy,len=Math.hypot(dx,dy)||1;
  p.mustache={phase:'windup',age:0,ux:dx/len,uy:dy/len,travel:0,
    delay:a.delay,range:a.range,speed:a.speed,damage:a.damage,knockback:a.knockback};
  p.fx=dx/len;p.fy=dy/len;
  return true;
}
function finish(ctx,p,hit){
  p.mustache.phase=hit?'hit':'miss';p.mustache.age=0;
  effect(ctx,hit?'mustacheHit':'mustacheMiss',p.x,p.y,{ux:p.mustache.ux,uy:p.mustache.uy},hit?.4:.65);
}
export function advanceMustache(ctx,p,dt){
  const m=p.mustache;if(!m)return false;
  if(!p.alive||p.hp<=0||p.stunT>0||p.launch||p.shove||p.carriedBy||p.exfil){p.mustache=null;return false;}
  // The suit grants no protection: incoming impulses can interrupt the charge.
  if(Math.hypot(p.kbVx||0,p.kbVy||0,p.superKbVx||0,p.superKbVy||0)>5){p.mustache=null;return false;}
  p.fx=m.ux;p.fy=m.uy;
  m.age+=dt;
  if(m.phase==='windup'){
    if(m.age<m.delay)return true;
    dt=Math.max(0,m.age-m.delay);m.age=0;m.phase='flight';
  }
  if(m.phase==='hit'||m.phase==='miss'){
    if(m.age>=(m.phase==='hit'?.35:.8))p.mustache=null;
    return true;
  }
  if(m.phase!=='flight')return true;
  const distance=Math.min(m.range-m.travel,m.speed*dt),steps=Math.max(1,Math.ceil(distance/4));
  for(let i=0;i<steps;i++){
    const dx=m.ux*distance/steps,dy=m.uy*distance/steps;
    const wall=firstWall(ctx,p,dx+m.ux*p.r,dy+m.uy*p.r);
    if(wall){hitWall(ctx,wall,36,null);finish(ctx,p,false);return true;}
    if(ctx.physics.collidesWithWall(p.x+dx,p.y+dy,p.r,false)){finish(ctx,p,false);return true;}
    p.x+=dx;p.y+=dy;m.travel+=distance/steps;
    for(const o of ctx.players.values()){
      if(!enemy(p,o)||Math.hypot(o.x-p.x,o.y-p.y)>p.r+o.r+12)continue;
      const hit=ctx.damage(o,m.damage,p.id,o.x-m.ux*30,o.y-m.uy*30,m.knockback,false,false,true);
      if(hit&&o.alive){o.uppercutT=.45;o.stunT=Math.max(o.stunT||0,.3);o.dashT=0;}
      finish(ctx,p,hit);return true;
    }
  }
  if(m.travel>=m.range-1e-6)finish(ctx,p,false);
  return true;
}
